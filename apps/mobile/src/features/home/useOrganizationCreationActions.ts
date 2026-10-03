import { pinOrderKeyBetween } from "@t3tools/client-runtime/state/thread-sort";
import type { OrganizationWorkspaceView } from "@t3tools/client-runtime/state/organization";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  OrganizationFolderId,
  OrganizationMembershipId,
  OrganizationWorkspaceId,
  type EnvironmentId,
  type OrganizationItemReference,
  type ProjectId,
  type OrganizationState,
  type OrganizationWorkspace,
} from "@t3tools/contracts";
import { useCallback } from "react";
import { Alert, Platform } from "react-native";

import { showTextInputDialog } from "../../components/ConfirmDialogHost";
import { uuidv4 } from "../../lib/uuid";
import {
  organizationEnvironment,
  useOrganizationAuthorityEnvironmentId,
} from "../../state/organization";
import { useAtomCommand } from "../../state/use-atom-command";

function requestName(title: string, confirmText: string, onConfirm: (name: string) => void) {
  const commit = (value: string) => {
    const name = value.trim();
    if (name) onConfirm(name);
  };
  if (Platform.OS === "ios") {
    Alert.prompt(title, undefined, (value) => commit(value ?? ""));
    return;
  }
  showTextInputDialog({ title, confirmText, initialValue: "", onConfirm: commit });
}

export function useOrganizationCreationActions(input: {
  readonly workspaces: ReadonlyArray<OrganizationWorkspace>;
  readonly activeWorkspace: OrganizationWorkspaceView | null;
  readonly organization: OrganizationState;
  readonly setActiveWorkspaceId: (workspaceId: OrganizationWorkspaceId | null) => void;
}) {
  const { activeWorkspace, organization, setActiveWorkspaceId, workspaces } = input;
  const environmentId = useOrganizationAuthorityEnvironmentId();
  const createWorkspace = useAtomCommand(organizationEnvironment.createWorkspace);
  const createFolder = useAtomCommand(organizationEnvironment.createFolder);
  const upsertMembership = useAtomCommand(organizationEnvironment.upsertMembership);

  const onCreateWorkspace = useCallback(() => {
    if (environmentId === null) return;
    requestName("New workspace", "Create", (name) => {
      const workspaceId = OrganizationWorkspaceId.make(uuidv4());
      const last = workspaces.at(-1);
      void createWorkspace({
        environmentId,
        input: {
          workspaceId,
          name,
          orderKey: pinOrderKeyBetween(last?.orderKey ?? null, null) ?? uuidv4(),
        },
      }).then((result) => {
        if (result._tag === "Success") setActiveWorkspaceId(workspaceId);
      });
    });
  }, [createWorkspace, environmentId, setActiveWorkspaceId, workspaces]);

  const onCreateFolder = useCallback(() => {
    if (environmentId === null || activeWorkspace === null) return;
    requestName("New folder", "Create", (name) => {
      const last = activeWorkspace.folders.at(-1)?.folder;
      void createFolder({
        environmentId,
        input: {
          folderId: OrganizationFolderId.make(uuidv4()),
          workspaceId: activeWorkspace.workspace.id,
          name,
          orderKey: pinOrderKeyBetween(last?.orderKey ?? null, null) ?? uuidv4(),
        },
      });
    });
  }, [activeWorkspace, createFolder, environmentId]);

  const moveItemToFolder = useCallback(
    (item: OrganizationItemReference, folderId: OrganizationFolderId) => {
      if (environmentId === null || activeWorkspace === null) return;
      const folder = activeWorkspace.folders.find((entry) => entry.folder.id === folderId);
      if (!folder) return;
      const existing = organization.memberships.find((membership) =>
        membership.item.kind === "project" && item.kind === "project"
          ? membership.item.environmentId === item.environmentId &&
            membership.item.projectId === item.projectId
          : membership.item.kind === "thread" && item.kind === "thread"
            ? membership.item.environmentId === item.environmentId &&
              membership.item.threadId === item.threadId
            : false,
      );
      void upsertMembership({
        environmentId,
        input: {
          membershipId: existing?.id ?? OrganizationMembershipId.make(uuidv4()),
          folderId,
          item,
          orderKey:
            pinOrderKeyBetween(folder.memberships.at(-1)?.orderKey ?? null, null) ?? uuidv4(),
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [activeWorkspace, environmentId, organization.memberships, upsertMembership],
  );

  const onMoveThreadToFolder = useCallback(
    (thread: EnvironmentThreadShell, folderId: OrganizationFolderId) =>
      moveItemToFolder(
        { kind: "thread", environmentId: thread.environmentId, threadId: thread.id },
        folderId,
      ),
    [moveItemToFolder],
  );
  const onMoveProjectToFolder = useCallback(
    (projectEnvironmentId: EnvironmentId, projectId: ProjectId, folderId: OrganizationFolderId) =>
      moveItemToFolder(
        { kind: "project", environmentId: projectEnvironmentId, projectId },
        folderId,
      ),
    [moveItemToFolder],
  );

  return {
    onCreateFolder,
    onCreateWorkspace,
    onMoveProjectToFolder,
    onMoveThreadToFolder,
  };
}
