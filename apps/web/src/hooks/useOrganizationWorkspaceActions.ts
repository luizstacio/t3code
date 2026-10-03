import { pinOrderKeyBetween } from "@t3tools/client-runtime/state/thread-sort";
import {
  selectOrganizationWorkspace,
  sortOrganizationWorkspaces,
  type OrganizationWorkspaceView,
} from "@t3tools/client-runtime/state/organization";
import {
  OrganizationFolderId,
  OrganizationMembershipId,
  OrganizationWorkspaceId,
  type OrganizationFolder,
  type OrganizationItemReference,
  type OrganizationWorkspace,
} from "@t3tools/contracts";
import { useCallback, useEffect, useMemo } from "react";

import { requestOrganizationName } from "../components/OrganizationNameDialog";
import {
  requestWorkspaceAppearance,
  WORKSPACE_DEFAULT_COLORS,
} from "../components/organization/WorkspaceAppearanceDialog";
import { readLocalApi } from "../localApi";
import { randomUUID } from "~/lib/utils";
import { usePrimaryEnvironmentId } from "../state/environments";
import { organizationEnvironment, usePrimaryOrganizationState } from "../state/organization";
import { useAtomCommand } from "../state/use-atom-command";
import { useUiStateStore } from "../uiStateStore";

function orderKeyAfter(last: string | undefined) {
  return pinOrderKeyBetween(last ?? null, null) ?? randomUUID();
}

/**
 * The primary environment's workspaces, the one the user has selected, and
 * every way to change them. Shared by the sidebar switcher and the command
 * palette so both surfaces prompt, confirm, and order the same way.
 */
export function useOrganizationWorkspaces() {
  const organization = usePrimaryOrganizationState();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const savedWorkspaceId = useUiStateStore((store) => store.activeOrganizationWorkspaceId);
  const setActiveWorkspaceId = useUiStateStore((store) => store.setActiveOrganizationWorkspaceId);
  const workspaces = useMemo(
    () => sortOrganizationWorkspaces(organization.workspaces),
    [organization.workspaces],
  );
  const activeWorkspaceId =
    workspaces.find((workspace) => workspace.id === savedWorkspaceId)?.id ??
    workspaces[0]?.id ??
    null;
  const activeWorkspace: OrganizationWorkspaceView | null = useMemo(
    () =>
      activeWorkspaceId === null
        ? null
        : selectOrganizationWorkspace(organization, activeWorkspaceId),
    [activeWorkspaceId, organization],
  );

  const createWorkspaceCommand = useAtomCommand(organizationEnvironment.createWorkspace);
  const updateWorkspaceCommand = useAtomCommand(organizationEnvironment.updateWorkspace);
  const deleteWorkspaceCommand = useAtomCommand(organizationEnvironment.deleteWorkspace);
  const createFolderCommand = useAtomCommand(organizationEnvironment.createFolder);
  const updateFolderCommand = useAtomCommand(organizationEnvironment.updateFolder);
  const deleteFolderCommand = useAtomCommand(organizationEnvironment.deleteFolder);
  const upsertMembershipCommand = useAtomCommand(organizationEnvironment.upsertMembership);
  const deleteMembershipCommand = useAtomCommand(organizationEnvironment.deleteMembership);

  const createWorkspace = useCallback(async () => {
    if (primaryEnvironmentId === null) return;
    const appearance = await requestWorkspaceAppearance("create", {
      name: "",
      color: WORKSPACE_DEFAULT_COLORS[workspaces.length % WORKSPACE_DEFAULT_COLORS.length]!,
      icon: null,
    });
    if (!appearance) return;
    const workspaceId = OrganizationWorkspaceId.make(randomUUID());
    const result = await createWorkspaceCommand({
      environmentId: primaryEnvironmentId,
      input: {
        workspaceId,
        name: appearance.name,
        ...(appearance.color === null ? {} : { color: appearance.color }),
        ...(appearance.icon === null ? {} : { icon: appearance.icon }),
        orderKey: orderKeyAfter(workspaces.at(-1)?.orderKey),
      },
    });
    if (result._tag === "Success") setActiveWorkspaceId(workspaceId);
  }, [createWorkspaceCommand, primaryEnvironmentId, setActiveWorkspaceId, workspaces]);

  const editWorkspace = useCallback(
    async (workspace: OrganizationWorkspace) => {
      if (primaryEnvironmentId === null) return;
      const appearance = await requestWorkspaceAppearance("edit", {
        name: workspace.name,
        color: workspace.color ?? null,
        icon: workspace.icon ?? null,
      });
      if (!appearance) return;
      await updateWorkspaceCommand({
        environmentId: primaryEnvironmentId,
        input: {
          workspaceId: workspace.id,
          name: appearance.name,
          color: appearance.color,
          icon: appearance.icon,
        },
      });
    },
    [primaryEnvironmentId, updateWorkspaceCommand],
  );

  const deleteWorkspace = useCallback(
    async (workspace: OrganizationWorkspace) => {
      const api = readLocalApi();
      if (primaryEnvironmentId === null || !api) return;
      const confirmed = await api.dialogs.confirm(
        `Delete the "${workspace.name}" workspace? Its projects, threads, and running agents stay intact.`,
        { variant: "destructive" },
      );
      if (!confirmed) return;
      await deleteWorkspaceCommand({
        environmentId: primaryEnvironmentId,
        input: { workspaceId: workspace.id },
      });
    },
    [deleteWorkspaceCommand, primaryEnvironmentId],
  );

  const createFolder = useCallback(async () => {
    if (primaryEnvironmentId === null || activeWorkspace === null) return;
    const name = await requestOrganizationName({
      title: "New folder",
      description: `Folders in ${activeWorkspace.workspace.name} hold the projects and threads you move into them.`,
      placeholder: "In progress",
      submitLabel: "Create folder",
    });
    if (!name) return;
    await createFolderCommand({
      environmentId: primaryEnvironmentId,
      input: {
        folderId: OrganizationFolderId.make(randomUUID()),
        workspaceId: activeWorkspace.workspace.id,
        name,
        orderKey: orderKeyAfter(activeWorkspace.folders.at(-1)?.folder.orderKey),
      },
    });
  }, [activeWorkspace, createFolderCommand, primaryEnvironmentId]);

  const renameFolder = useCallback(
    async (folder: OrganizationFolder) => {
      if (primaryEnvironmentId === null) return;
      const name = await requestOrganizationName({
        title: "Rename folder",
        submitLabel: "Rename",
        initialName: folder.name,
      });
      if (!name) return;
      await updateFolderCommand({
        environmentId: primaryEnvironmentId,
        input: { folderId: folder.id, name },
      });
    },
    [primaryEnvironmentId, updateFolderCommand],
  );

  const deleteFolder = useCallback(
    async (folder: OrganizationFolder) => {
      const api = readLocalApi();
      if (primaryEnvironmentId === null || !api) return;
      const confirmed = await api.dialogs.confirm(
        `Delete the "${folder.name}" folder? Its projects and threads stay intact and return to unfiled.`,
        { variant: "destructive" },
      );
      if (!confirmed) return;
      await deleteFolderCommand({
        environmentId: primaryEnvironmentId,
        input: { folderId: folder.id },
      });
    },
    [deleteFolderCommand, primaryEnvironmentId],
  );

  const findMembership = useCallback(
    (item: OrganizationItemReference) =>
      organization.memberships.find((membership) =>
        membership.item.kind === "project" && item.kind === "project"
          ? membership.item.environmentId === item.environmentId &&
            membership.item.projectId === item.projectId
          : membership.item.kind === "thread" && item.kind === "thread"
            ? membership.item.environmentId === item.environmentId &&
              membership.item.threadId === item.threadId
            : false,
      ),
    [organization.memberships],
  );

  const moveItemToFolder = useCallback(
    async (item: OrganizationItemReference, folderId: OrganizationFolderId) => {
      if (primaryEnvironmentId === null || activeWorkspace === null) return;
      const folder = activeWorkspace.folders.find((entry) => entry.folder.id === folderId);
      if (folder === undefined) return;
      const existing = findMembership(item);
      if (existing?.folderId === folderId) return;
      await upsertMembershipCommand({
        environmentId: primaryEnvironmentId,
        input: {
          membershipId: existing?.id ?? OrganizationMembershipId.make(randomUUID()),
          folderId,
          item,
          orderKey: orderKeyAfter(folder.memberships.at(-1)?.orderKey),
        },
      });
    },
    [activeWorkspace, findMembership, primaryEnvironmentId, upsertMembershipCommand],
  );

  /** The way back out of "Move to folder": the item returns to unfiled. */
  const removeItemFromFolder = useCallback(
    async (item: OrganizationItemReference) => {
      const existing = findMembership(item);
      if (primaryEnvironmentId === null || existing === undefined) return;
      await deleteMembershipCommand({
        environmentId: primaryEnvironmentId,
        input: { membershipId: existing.id },
      });
    },
    [deleteMembershipCommand, findMembership, primaryEnvironmentId],
  );

  return {
    organization,
    available: primaryEnvironmentId !== null,
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    savedWorkspaceId,
    setActiveWorkspaceId,
    createWorkspace,
    editWorkspace,
    deleteWorkspace,
    createFolder,
    renameFolder,
    deleteFolder,
    moveItemToFolder,
    removeItemFromFolder,
  };
}

/** Writes the resolved workspace back when the saved one was deleted elsewhere. */
export function useReconcileActiveOrganizationWorkspace(
  activeWorkspaceId: OrganizationWorkspaceId | null,
  savedWorkspaceId: string | null,
  setActiveWorkspaceId: (workspaceId: string | null) => void,
) {
  useEffect(() => {
    if (activeWorkspaceId !== savedWorkspaceId) setActiveWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId, savedWorkspaceId, setActiveWorkspaceId]);
}
