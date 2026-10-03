import {
  EnvironmentId,
  OrganizationFolderId,
  OrganizationMembershipId,
  OrganizationWorkspaceId,
  ProjectId,
  ThreadId,
  type OrganizationState,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  adjacentOrganizationWorkspaceId,
  filterOrganizationWorkspaceContent,
  resolveOrganizationThreadFolders,
  selectOrganizationWorkspace,
} from "./organization.ts";

const at = "2026-10-01T00:00:00.000Z";
const state: OrganizationState = {
  workspaces: [
    {
      id: OrganizationWorkspaceId.make("personal"),
      name: "Personal",
      orderKey: "f",
      createdAt: at,
      updatedAt: at,
    },
    {
      id: OrganizationWorkspaceId.make("agents"),
      name: "Agents",
      orderKey: "t",
      createdAt: at,
      updatedAt: at,
    },
  ],
  folders: [
    {
      id: OrganizationFolderId.make("inactive-folder"),
      workspaceId: OrganizationWorkspaceId.make("personal"),
      name: "Inactive",
      orderKey: "m",
      createdAt: at,
      updatedAt: at,
    },
    {
      id: OrganizationFolderId.make("later-folder"),
      workspaceId: OrganizationWorkspaceId.make("agents"),
      name: "Later",
      orderKey: "t",
      createdAt: at,
      updatedAt: at,
    },
    {
      id: OrganizationFolderId.make("first-folder"),
      workspaceId: OrganizationWorkspaceId.make("agents"),
      name: "First",
      orderKey: "f",
      createdAt: at,
      updatedAt: at,
    },
  ],
  memberships: [
    {
      id: OrganizationMembershipId.make("later-item"),
      folderId: OrganizationFolderId.make("first-folder"),
      item: {
        kind: "thread",
        environmentId: EnvironmentId.make("linux-b"),
        threadId: ThreadId.make("thread-2"),
      },
      orderKey: "t",
      createdAt: at,
      updatedAt: at,
    },
    {
      id: OrganizationMembershipId.make("inactive-item"),
      folderId: OrganizationFolderId.make("inactive-folder"),
      item: {
        kind: "thread",
        environmentId: EnvironmentId.make("linux-a"),
        threadId: ThreadId.make("thread-1"),
      },
      orderKey: "m",
      createdAt: at,
      updatedAt: at,
    },
    {
      id: OrganizationMembershipId.make("first-item"),
      folderId: OrganizationFolderId.make("first-folder"),
      item: {
        kind: "project",
        environmentId: EnvironmentId.make("linux-a"),
        projectId: ProjectId.make("project-1"),
      },
      orderKey: "f",
      createdAt: at,
      updatedAt: at,
    },
  ],
};

describe("selectOrganizationWorkspace", () => {
  it("returns only the active workspace in user-controlled order", () => {
    const view = selectOrganizationWorkspace(state, OrganizationWorkspaceId.make("agents"));

    expect(view?.folders.map(({ folder }) => folder.id)).toEqual(["first-folder", "later-folder"]);
    expect(view?.folders[0]?.memberships.map(({ id }) => id)).toEqual(["first-item", "later-item"]);
    expect(
      view?.folders.flatMap(({ memberships }) => memberships).map(({ id }) => id),
    ).not.toContain("inactive-item");
  });

  it("returns null for a removed workspace", () => {
    expect(selectOrganizationWorkspace(state, OrganizationWorkspaceId.make("missing"))).toBeNull();
  });
});

describe("adjacentOrganizationWorkspaceId", () => {
  it("wraps through workspace order", () => {
    expect(
      adjacentOrganizationWorkspaceId(
        state.workspaces,
        OrganizationWorkspaceId.make("agents"),
        "next",
      ),
    ).toBe("personal");
    expect(
      adjacentOrganizationWorkspaceId(
        state.workspaces,
        OrganizationWorkspaceId.make("personal"),
        "previous",
      ),
    ).toBe("agents");
  });
});

describe("filterOrganizationWorkspaceContent", () => {
  it("keeps only active memberships and leaves unassigned work in the first workspace", () => {
    const projects = [
      { environmentId: EnvironmentId.make("linux-a"), id: ProjectId.make("project-1") },
      { environmentId: EnvironmentId.make("linux-a"), id: ProjectId.make("project-2") },
    ] as never;
    const threads = [
      {
        environmentId: EnvironmentId.make("linux-b"),
        id: ThreadId.make("thread-2"),
        projectId: ProjectId.make("project-1"),
      },
      {
        environmentId: EnvironmentId.make("linux-a"),
        id: ThreadId.make("thread-3"),
        projectId: ProjectId.make("project-2"),
      },
    ] as never;

    const active = filterOrganizationWorkspaceContent({
      state,
      workspaceId: OrganizationWorkspaceId.make("agents"),
      projects,
      threads,
    });
    expect(active.projects.map(({ id }) => id)).toEqual(["project-1"]);
    expect(active.threads.map(({ id }) => id)).toEqual(["thread-2"]);

    const first = filterOrganizationWorkspaceContent({
      state,
      workspaceId: OrganizationWorkspaceId.make("personal"),
      projects,
      threads,
    });
    expect(first.projects.map(({ id }) => id)).toEqual(["project-2"]);
    expect(first.threads.map(({ id }) => id)).toEqual(["thread-3"]);
  });
});

describe("resolveOrganizationThreadFolders", () => {
  it("files threads by their own membership first, then by their project's", () => {
    const view = selectOrganizationWorkspace(state, OrganizationWorkspaceId.make("agents"))!;
    const withThreadInOtherFolder = {
      ...view,
      folders: view.folders.map((entry) =>
        entry.folder.id === "later-folder"
          ? {
              ...entry,
              memberships: [
                {
                  id: OrganizationMembershipId.make("override"),
                  folderId: OrganizationFolderId.make("later-folder"),
                  item: {
                    kind: "thread" as const,
                    environmentId: EnvironmentId.make("linux-a"),
                    threadId: ThreadId.make("thread-4"),
                  },
                  orderKey: "a",
                  createdAt: at,
                  updatedAt: at,
                },
              ],
            }
          : entry,
      ),
    };
    const folders = resolveOrganizationThreadFolders(withThreadInOtherFolder, [
      // Filed through project-1's membership.
      {
        environmentId: EnvironmentId.make("linux-a"),
        id: ThreadId.make("thread-3"),
        projectId: ProjectId.make("project-1"),
      },
      // Also in project-1, but filed on its own elsewhere.
      {
        environmentId: EnvironmentId.make("linux-a"),
        id: ThreadId.make("thread-4"),
        projectId: ProjectId.make("project-1"),
      },
      // Unfiled.
      {
        environmentId: EnvironmentId.make("linux-a"),
        id: ThreadId.make("thread-5"),
        projectId: ProjectId.make("project-2"),
      },
    ]);
    expect(Object.fromEntries(folders)).toEqual({
      "linux-a:thread-3": "first-folder",
      "linux-a:thread-4": "later-folder",
    });
  });
});
