import { describe, expect, it, vi } from "vite-plus/test";
import { OrganizationFolderId } from "@t3tools/contracts";

import { buildHomeListFilterMenu } from "./home-list-filter-menu";

describe("buildHomeListFilterMenu", () => {
  it("adds a project scope submenu that selects and clears the same scope as the chips", () => {
    const onProjectChange = vi.fn();
    const menu = buildHomeListFilterMenu({
      organizationWorkspaces: [],
      selectedOrganizationWorkspaceId: null,
      organizationFolders: [],
      environments: [],
      projects: [
        { key: "environment-1:project-1", label: "Codething" },
        { key: "environment-1:project-2", label: "Website" },
      ],
      selectedEnvironmentId: null,
      selectedProjectKey: "environment-1:project-1",
      onEnvironmentChange: vi.fn(),
      onProjectChange,
      onOrganizationWorkspaceChange: vi.fn(),
      onCreateOrganizationFolder: vi.fn(),
      onCreateOrganizationWorkspace: vi.fn(),
      onMoveProjectToOrganizationFolder: vi.fn(),
    });

    const projectMenu = menu.items.find(
      (item) => item.type === "submenu" && item.title === "Project",
    );
    expect(menu.items.some((item) => item.title === "Settings")).toBe(false);
    expect(projectMenu).toMatchObject({
      type: "submenu",
      items: [
        { title: "All projects", state: "off" },
        { title: "Codething", state: "on" },
        { title: "Website", state: "off" },
      ],
    });
    if (projectMenu?.type !== "submenu") throw new Error("Expected project submenu");

    projectMenu.items[0]?.onPress();
    projectMenu.items[2]?.onPress();
    expect(onProjectChange).toHaveBeenNthCalledWith(1, null);
    expect(onProjectChange).toHaveBeenNthCalledWith(2, "environment-1:project-2");
  });

  it("keeps workspace creation reachable before the first workspace exists", () => {
    const onCreateOrganizationWorkspace = vi.fn();
    const menu = buildHomeListFilterMenu({
      organizationWorkspaces: [],
      selectedOrganizationWorkspaceId: null,
      organizationFolders: [],
      environments: [],
      projects: [],
      selectedEnvironmentId: null,
      selectedProjectKey: null,
      onEnvironmentChange: vi.fn(),
      onProjectChange: vi.fn(),
      onOrganizationWorkspaceChange: vi.fn(),
      onCreateOrganizationFolder: vi.fn(),
      onCreateOrganizationWorkspace,
      onMoveProjectToOrganizationFolder: vi.fn(),
    });
    const create = menu.items.find(
      (item) => item.type === "action" && item.title === "New workspace…",
    );
    if (create?.type !== "action") throw new Error("Expected create workspace action");
    create.onPress();
    expect(onCreateOrganizationWorkspace).toHaveBeenCalledOnce();
  });

  it("moves the selected project into a folder", () => {
    const onMoveProjectToOrganizationFolder = vi.fn();
    const folderId = OrganizationFolderId.make("folder-1");
    const menu = buildHomeListFilterMenu({
      organizationWorkspaces: [],
      selectedOrganizationWorkspaceId: null,
      organizationFolders: [{ id: folderId, name: "Agents" }],
      environments: [],
      projects: [{ key: "project-1", label: "T3 Code" }],
      selectedEnvironmentId: null,
      selectedProjectKey: "project-1",
      onEnvironmentChange: vi.fn(),
      onProjectChange: vi.fn(),
      onOrganizationWorkspaceChange: vi.fn(),
      onCreateOrganizationFolder: vi.fn(),
      onCreateOrganizationWorkspace: vi.fn(),
      onMoveProjectToOrganizationFolder,
    });
    const move = menu.items.find(
      (item) => item.type === "submenu" && item.title === "Move project to folder",
    );
    if (move?.type !== "submenu") throw new Error("Expected move-project submenu");

    move.items[0]?.onPress();
    expect(onMoveProjectToOrganizationFolder).toHaveBeenCalledWith("project-1", folderId);
  });
});
