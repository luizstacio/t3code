import type {
  EnvironmentId,
  OrganizationFolder,
  OrganizationFolderId,
  OrganizationMembership,
  OrganizationState,
  OrganizationWorkspace,
  OrganizationWorkspaceId,
} from "@t3tools/contracts";
import type * as Crypto from "effect/Crypto";
import type { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { scopedProjectKey, scopedThreadKey } from "../environment/scoped.ts";
import {
  createOrganizationFolder,
  createOrganizationWorkspace,
  deleteOrganizationFolder,
  deleteOrganizationMembership,
  deleteOrganizationWorkspace,
  type CreateOrganizationFolderInput,
  type CreateOrganizationWorkspaceInput,
  type DeleteOrganizationFolderInput,
  type DeleteOrganizationMembershipInput,
  type DeleteOrganizationWorkspaceInput,
  type UpdateOrganizationFolderInput,
  type UpdateOrganizationWorkspaceInput,
  type UpsertOrganizationMembershipInput,
  updateOrganizationFolder,
  updateOrganizationWorkspace,
  upsertOrganizationMembership,
} from "../operations/commands.ts";
import { createAtomCommandScheduler, createEnvironmentCommand } from "./runtime.ts";
import type { EnvironmentProject, EnvironmentThreadShell } from "./models.ts";

export interface OrganizationFolderView {
  readonly folder: OrganizationFolder;
  readonly memberships: ReadonlyArray<OrganizationMembership>;
}

export interface OrganizationWorkspaceView {
  readonly workspace: OrganizationWorkspace;
  readonly folders: ReadonlyArray<OrganizationFolderView>;
}

function compareOrder(
  left: { readonly id: string; readonly orderKey: string },
  right: { readonly id: string; readonly orderKey: string },
) {
  if (left.orderKey !== right.orderKey) return left.orderKey < right.orderKey ? -1 : 1;
  return left.id === right.id ? 0 : left.id < right.id ? -1 : 1;
}

export function sortOrganizationWorkspaces(
  workspaces: ReadonlyArray<OrganizationWorkspace>,
): ReadonlyArray<OrganizationWorkspace> {
  return [...workspaces].sort(compareOrder);
}

export function adjacentOrganizationWorkspaceId(
  workspaces: ReadonlyArray<OrganizationWorkspace>,
  activeId: OrganizationWorkspaceId | null,
  direction: "previous" | "next",
): OrganizationWorkspaceId | null {
  const ordered = sortOrganizationWorkspaces(workspaces);
  if (ordered.length === 0) return null;
  const activeIndex = ordered.findIndex(({ id }) => id === activeId);
  if (activeIndex === -1) return ordered[0]!.id;
  const offset = direction === "next" ? 1 : -1;
  return ordered[(activeIndex + offset + ordered.length) % ordered.length]!.id;
}

export function selectOrganizationWorkspace(
  state: OrganizationState,
  workspaceId: OrganizationWorkspaceId,
): OrganizationWorkspaceView | null {
  const workspace = state.workspaces.find(({ id }) => id === workspaceId);
  if (!workspace) return null;

  const folders = state.folders
    .filter((folder) => folder.workspaceId === workspaceId)
    .sort(compareOrder);
  const membershipsByFolder = new Map<string, Array<OrganizationMembership>>();
  for (const membership of state.memberships) {
    const memberships = membershipsByFolder.get(membership.folderId) ?? [];
    memberships.push(membership);
    membershipsByFolder.set(membership.folderId, memberships);
  }

  return {
    workspace,
    folders: folders.map((folder) => ({
      folder,
      memberships: [...(membershipsByFolder.get(folder.id) ?? [])].sort(compareOrder),
    })),
  };
}

/**
 * The folder each thread sits in within one workspace. A thread filed on its
 * own wins over its project's folder; threads of a filed project follow it.
 */
export function resolveOrganizationThreadFolders(
  workspace: OrganizationWorkspaceView,
  threads: ReadonlyArray<Pick<EnvironmentThreadShell, "environmentId" | "id" | "projectId">>,
): ReadonlyMap<string, OrganizationFolderId> {
  const folderByThreadKey = new Map<string, OrganizationFolderId>();
  const folderByProjectKey = new Map<string, OrganizationFolderId>();
  for (const { folder, memberships } of workspace.folders) {
    for (const membership of memberships) {
      if (membership.item.kind === "thread") {
        folderByThreadKey.set(scopedThreadKey(membership.item), folder.id);
      } else {
        folderByProjectKey.set(scopedProjectKey(membership.item), folder.id);
      }
    }
  }
  const result = new Map<string, OrganizationFolderId>();
  if (folderByThreadKey.size === 0 && folderByProjectKey.size === 0) return result;
  for (const thread of threads) {
    const threadKey = scopedThreadKey({ environmentId: thread.environmentId, threadId: thread.id });
    const folderId =
      folderByThreadKey.get(threadKey) ??
      folderByProjectKey.get(
        scopedProjectKey({ environmentId: thread.environmentId, projectId: thread.projectId }),
      );
    if (folderId !== undefined) result.set(threadKey, folderId);
  }
  return result;
}

export function filterOrganizationWorkspaceContent(input: {
  readonly state: OrganizationState;
  readonly workspaceId: OrganizationWorkspaceId | null;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
}) {
  if (input.workspaceId === null) {
    return { projects: input.projects, threads: input.threads };
  }
  const workspace = selectOrganizationWorkspace(input.state, input.workspaceId);
  if (workspace === null) {
    return { projects: input.projects, threads: input.threads };
  }

  const activeFolderIds = new Set(workspace.folders.map(({ folder }) => folder.id));
  const activeProjectKeys = new Set<string>();
  const activeThreadKeys = new Set<string>();
  const assignedProjectKeys = new Set<string>();
  const assignedThreadKeys = new Set<string>();
  for (const membership of input.state.memberships) {
    if (membership.item.kind === "project") {
      const key = scopedProjectKey(membership.item);
      assignedProjectKeys.add(key);
      if (activeFolderIds.has(membership.folderId)) activeProjectKeys.add(key);
    } else {
      const key = scopedThreadKey(membership.item);
      assignedThreadKeys.add(key);
      if (activeFolderIds.has(membership.folderId)) activeThreadKeys.add(key);
    }
  }

  const showUnassigned =
    sortOrganizationWorkspaces(input.state.workspaces)[0]?.id === workspace.workspace.id;
  const threads = input.threads.filter((thread) => {
    const threadKey = scopedThreadKey({ environmentId: thread.environmentId, threadId: thread.id });
    const projectKey = scopedProjectKey({
      environmentId: thread.environmentId,
      projectId: thread.projectId,
    });
    return (
      activeThreadKeys.has(threadKey) ||
      activeProjectKeys.has(projectKey) ||
      (showUnassigned && !assignedThreadKeys.has(threadKey) && !assignedProjectKeys.has(projectKey))
    );
  });
  const projectKeysWithVisibleThreads = new Set(
    threads.map((thread) =>
      scopedProjectKey({ environmentId: thread.environmentId, projectId: thread.projectId }),
    ),
  );
  return {
    projects: input.projects.filter((project) => {
      const key = scopedProjectKey({ environmentId: project.environmentId, projectId: project.id });
      return (
        activeProjectKeys.has(key) ||
        projectKeysWithVisibleThreads.has(key) ||
        (showUnassigned && !assignedProjectKeys.has(key))
      );
    }),
    threads,
  };
}

export function createOrganizationEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | Crypto.Crypto | R, E>,
) {
  const scheduler = createAtomCommandScheduler();
  const command = <Input>(
    label: string,
    execute: (input: Input) => ReturnType<typeof createOrganizationWorkspace>,
  ) =>
    createEnvironmentCommand(runtime, {
      label,
      execute,
      scheduler,
      concurrency: {
        mode: "serial",
        key: ({ environmentId }: { readonly environmentId: EnvironmentId }) => environmentId,
      },
    });

  return {
    createWorkspace: command<CreateOrganizationWorkspaceInput>(
      "environment-data:commands:organization:workspace:create",
      createOrganizationWorkspace,
    ),
    updateWorkspace: command<UpdateOrganizationWorkspaceInput>(
      "environment-data:commands:organization:workspace:update",
      updateOrganizationWorkspace,
    ),
    deleteWorkspace: command<DeleteOrganizationWorkspaceInput>(
      "environment-data:commands:organization:workspace:delete",
      deleteOrganizationWorkspace,
    ),
    createFolder: command<CreateOrganizationFolderInput>(
      "environment-data:commands:organization:folder:create",
      createOrganizationFolder,
    ),
    updateFolder: command<UpdateOrganizationFolderInput>(
      "environment-data:commands:organization:folder:update",
      updateOrganizationFolder,
    ),
    deleteFolder: command<DeleteOrganizationFolderInput>(
      "environment-data:commands:organization:folder:delete",
      deleteOrganizationFolder,
    ),
    upsertMembership: command<UpsertOrganizationMembershipInput>(
      "environment-data:commands:organization:membership:upsert",
      upsertOrganizationMembership,
    ),
    deleteMembership: command<DeleteOrganizationMembershipInput>(
      "environment-data:commands:organization:membership:delete",
      deleteOrganizationMembership,
    ),
  };
}
