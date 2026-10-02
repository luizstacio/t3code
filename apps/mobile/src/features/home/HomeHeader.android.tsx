import type { MenuAction } from "@react-native-menu/menu";
import { useCallback, useMemo } from "react";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { MaterialThreadListToolbar } from "./MaterialThreadListToolbar";
import type { HomeHeaderProps } from "./HomeHeader.types";

export type { HomeHeaderEnvironment } from "./HomeHeader.types";

function checkedMenuState(checked: boolean) {
  return checked ? ("on" as const) : undefined;
}

export function HomeHeader(props: HomeHeaderProps) {
  // The list uses a fixed creation order and ignores sort/group options, so
  // the filter menu only carries the filters and the "customized" icon state
  // keys off those alone.
  const hasCustomListOptions =
    props.selectedEnvironmentId !== null || props.selectedProjectKey !== null;
  const menuActions = useMemo<MenuAction[]>(
    () => [
      ...(props.organizationWorkspaces.length === 0
        ? []
        : ([
            {
              id: "workspace",
              title: "Workspace",
              subactions: props.organizationWorkspaces
                .map((workspace) => ({
                  id: `workspace:${workspace.id}`,
                  title: workspace.name,
                  state: checkedMenuState(props.selectedOrganizationWorkspaceId === workspace.id),
                }))
                .concat([
                  { id: "workspace:create", title: "New workspace…", state: undefined },
                  { id: "folder:create", title: "New folder…", state: undefined },
                ]),
            },
          ] satisfies MenuAction[])),
      ...(props.organizationWorkspaces.length === 0
        ? ([{ id: "workspace:create", title: "New workspace…" }] satisfies MenuAction[])
        : []),
      {
        id: "environment",
        title: "Environment",
        subactions: [
          {
            id: "environment:all",
            title: "All environments",
            state: checkedMenuState(props.selectedEnvironmentId === null),
          },
          ...props.environments.map((environment) => ({
            id: `environment:${environment.environmentId}`,
            title: environment.label,
            state: checkedMenuState(props.selectedEnvironmentId === environment.environmentId),
          })),
        ],
      },
      ...(props.projects.length === 0
        ? []
        : ([
            {
              id: "project",
              title: "Project",
              subactions: [
                {
                  id: "project:all",
                  title: "All projects",
                  state: checkedMenuState(props.selectedProjectKey === null),
                },
                ...props.projects.map((project) => ({
                  id: `project:${project.key}`,
                  title: project.label,
                  state: checkedMenuState(props.selectedProjectKey === project.key),
                })),
              ],
            },
          ] satisfies MenuAction[])),
      ...(props.selectedProjectKey === null || props.organizationFolders.length === 0
        ? []
        : ([
            {
              id: "project-folder",
              title: "Move project to folder",
              subactions: props.organizationFolders.map((folder) => ({
                id: `project-folder:${folder.id}`,
                title: folder.name,
              })),
            },
          ] satisfies MenuAction[])),
    ],
    [
      props.environments,
      props.organizationWorkspaces,
      props.organizationFolders,
      props.projects,
      props.selectedEnvironmentId,
      props.selectedOrganizationWorkspaceId,
      props.selectedProjectKey,
    ],
  );
  const handleMenuAction = useCallback(
    (event: { nativeEvent: { event: string } }) => {
      const id = event.nativeEvent.event;
      if (id.startsWith("project-folder:")) {
        const folderId = id.slice("project-folder:".length);
        const folder = props.organizationFolders.find((candidate) => candidate.id === folderId);
        if (folder && props.selectedProjectKey !== null) {
          props.onMoveProjectToOrganizationFolder(props.selectedProjectKey, folder.id);
        }
        return;
      }
      if (id === "workspace:create") {
        props.onCreateOrganizationWorkspace();
        return;
      }
      if (id === "folder:create") {
        props.onCreateOrganizationFolder();
        return;
      }
      if (id.startsWith("workspace:")) {
        const workspaceId = id.slice("workspace:".length);
        const workspace = props.organizationWorkspaces.find(
          (candidate) => candidate.id === workspaceId,
        );
        if (workspace) props.onOrganizationWorkspaceChange(workspace.id);
        return;
      }
      if (id === "environment:all") {
        props.onEnvironmentChange(null);
        return;
      }

      if (id.startsWith("environment:")) {
        const environmentId = id.slice("environment:".length);
        const environment = props.environments.find(
          (candidate) => candidate.environmentId === environmentId,
        );
        if (environment) {
          props.onEnvironmentChange(environment.environmentId);
        }
        return;
      }

      if (id === "project:all") {
        props.onProjectChange(null);
        return;
      }

      if (id.startsWith("project:")) {
        const projectKey = id.slice("project:".length);
        if (props.projects.some((project) => project.key === projectKey)) {
          props.onProjectChange(projectKey);
        }
        return;
      }
    },
    [props],
  );

  return (
    <>
      <NativeStackScreenOptions options={{ headerShown: false }} />
      <MaterialThreadListToolbar
        searchQuery={props.searchQuery}
        onSearchQueryChange={props.onSearchQueryChange}
        filterActions={menuActions}
        filterCustomized={hasCustomListOptions}
        onFilterAction={handleMenuAction}
        onOpenSettings={props.onOpenSettings}
        onOpenEnvironments={props.onOpenEnvironments}
      />
    </>
  );
}
