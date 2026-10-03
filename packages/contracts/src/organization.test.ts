import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import { OrganizationState } from "./organization.ts";

const decode = Schema.decodeUnknownSync(OrganizationState);

describe("OrganizationState", () => {
  it("models ordered cross-environment projects and threads", () => {
    const state = decode({
      workspaces: [
        {
          id: "workspace-1",
          name: "  Team  ",
          orderKey: "m",
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      folders: [
        {
          id: "folder-1",
          workspaceId: "workspace-1",
          name: "Product",
          orderKey: "m",
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      memberships: [
        {
          id: "membership-1",
          folderId: "folder-1",
          item: { kind: "project", environmentId: "linux-a", projectId: "project-1" },
          orderKey: "f",
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
        {
          id: "membership-2",
          folderId: "folder-1",
          item: { kind: "thread", environmentId: "linux-b", threadId: "thread-1" },
          orderKey: "t",
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    });

    expect(state.workspaces[0]?.name).toBe("Team");
    expect(state.memberships.map(({ item }) => item.kind)).toEqual(["project", "thread"]);
    expect(state.memberships.map(({ item }) => item.environmentId)).toEqual(["linux-a", "linux-b"]);
  });

  it("rejects blank names and order keys", () => {
    expect(() =>
      decode({
        workspaces: [
          {
            id: "workspace-1",
            name: " ",
            orderKey: " ",
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
        ],
        folders: [],
        memberships: [],
      }),
    ).toThrow();
  });

  it("accepts the project color tokens and rejects anything else", () => {
    const workspace = (color: string) => ({
      workspaces: [
        {
          id: "workspace-1",
          name: "Team",
          color,
          icon: { kind: "lucide", name: "rocket" },
          orderKey: "a",
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      folders: [],
      memberships: [],
    });
    expect(decode(workspace("violet")).workspaces[0]?.color).toBe("violet");
    expect(() => decode(workspace("#2563eb"))).toThrow();
  });
});
