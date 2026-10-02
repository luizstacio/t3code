import type {
  EnvironmentId,
  OrganizationFolderId,
  OrganizationWorkspaceId,
} from "@t3tools/contracts";
import type {
  HomeListFilterMenuEnvironment,
  HomeListFilterMenuProject,
} from "./home-list-filter-menu";

export type HomeHeaderEnvironment = HomeListFilterMenuEnvironment;

export interface HomeHeaderProps {
  readonly environments: ReadonlyArray<HomeHeaderEnvironment>;
  readonly projects: ReadonlyArray<HomeListFilterMenuProject>;
  readonly organizationWorkspaces: ReadonlyArray<{
    readonly id: OrganizationWorkspaceId;
    readonly name: string;
  }>;
  readonly selectedOrganizationWorkspaceId: OrganizationWorkspaceId | null;
  readonly organizationFolders: ReadonlyArray<{
    readonly id: OrganizationFolderId;
    readonly name: string;
  }>;
  readonly searchQuery: string;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly selectedProjectKey: string | null;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onEnvironmentChange: (environmentId: EnvironmentId | null) => void;
  readonly onProjectChange: (projectKey: string | null) => void;
  readonly onOrganizationWorkspaceChange: (workspaceId: OrganizationWorkspaceId) => void;
  readonly onCreateOrganizationFolder: () => void;
  readonly onCreateOrganizationWorkspace: () => void;
  readonly onMoveProjectToOrganizationFolder: (
    projectKey: string,
    folderId: OrganizationFolderId,
  ) => void;
  readonly onOpenEnvironments: () => void;
  readonly onOpenSettings: () => void;
  readonly onStartNewTask: () => void;
}
