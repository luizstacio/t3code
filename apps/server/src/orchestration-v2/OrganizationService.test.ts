import { assert, describe, it } from "@effect/vitest";
import {
  CommandId,
  EnvironmentId,
  EventId,
  OrganizationFolderId,
  OrganizationMembershipId,
  OrganizationWorkspaceId,
  ProjectId,
  EMPTY_ORGANIZATION_STATE,
  type ApplicationOrganizationEvent,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { planOrganizationMutation } from "./OrganizationService.ts";
import { applyOrganizationEvent } from "./OrganizationStore.ts";

const occurredAt = "2026-10-03T00:00:00.000Z";
const commandId = CommandId.make("command");

function plan(
  mutation: Parameters<typeof planOrganizationMutation>[0]["mutation"],
  state = EMPTY_ORGANIZATION_STATE,
) {
  return planOrganizationMutation({
    mutation,
    state,
    eventId: EventId.make(`event:${mutation.type}`),
    occurredAt,
  });
}

function committed(event: Effect.Success<ReturnType<typeof plan>>) {
  return { ...event, sequence: 1 } as ApplicationOrganizationEvent;
}

describe("organization mutations", () => {
  it("creates a workspace with server-owned timestamps", () => {
    const event = Effect.runSync(
      plan({
        type: "organization.workspace.create",
        commandId,
        workspaceId: OrganizationWorkspaceId.make("workspace"),
        name: "Team",
        orderKey: "a",
      }),
    );
    const state = applyOrganizationEvent(EMPTY_ORGANIZATION_STATE, committed(event));
    assert.deepStrictEqual(state.workspaces, [
      {
        id: OrganizationWorkspaceId.make("workspace"),
        name: "Team",
        orderKey: "a",
        createdAt: occurredAt,
        updatedAt: occurredAt,
      },
    ]);
  });

  it("keeps a workspace's color and icon, and clears them on request", () => {
    const workspaceId = OrganizationWorkspaceId.make("workspace");
    const created = applyOrganizationEvent(
      EMPTY_ORGANIZATION_STATE,
      committed(
        Effect.runSync(
          plan({
            type: "organization.workspace.create",
            commandId,
            workspaceId,
            name: "Team",
            color: "blue",
            icon: { kind: "lucide", name: "rocket" },
            orderKey: "a",
          }),
        ),
      ),
    );
    assert.strictEqual(created.workspaces[0]?.color, "blue");
    assert.deepStrictEqual(created.workspaces[0]?.icon, { kind: "lucide", name: "rocket" });

    const renamed = applyOrganizationEvent(
      created,
      committed(
        Effect.runSync(
          plan(
            { type: "organization.workspace.update", commandId, workspaceId, name: "Crew" },
            created,
          ),
        ),
      ),
    );
    assert.strictEqual(renamed.workspaces[0]?.color, "blue");

    const cleared = applyOrganizationEvent(
      renamed,
      committed(
        Effect.runSync(
          plan(
            {
              type: "organization.workspace.update",
              commandId,
              workspaceId,
              color: null,
              icon: { kind: "emoji", emoji: "🚀" },
            },
            renamed,
          ),
        ),
      ),
    );
    assert.strictEqual(cleared.workspaces[0]?.color, undefined);
    assert.ok(!("color" in cleared.workspaces[0]!));
    assert.deepStrictEqual(cleared.workspaces[0]?.icon, { kind: "emoji", emoji: "🚀" });
  });

  it("rejects a folder whose workspace does not exist", () => {
    const exit = Effect.runSyncExit(
      plan({
        type: "organization.folder.create",
        commandId,
        folderId: OrganizationFolderId.make("folder"),
        workspaceId: OrganizationWorkspaceId.make("missing"),
        name: "Active",
        orderKey: "a",
      }),
    );
    assert.ok(Exit.isFailure(exit));
  });

  it("deleting a workspace removes only its folders and memberships", () => {
    const workspaceId = OrganizationWorkspaceId.make("workspace");
    const folderId = OrganizationFolderId.make("folder");
    const membershipId = OrganizationMembershipId.make("membership");
    const state = {
      workspaces: [
        {
          id: workspaceId,
          name: "Team",
          orderKey: "a",
          createdAt: occurredAt,
          updatedAt: occurredAt,
        },
      ],
      folders: [
        {
          id: folderId,
          workspaceId,
          name: "Active",
          orderKey: "a",
          createdAt: occurredAt,
          updatedAt: occurredAt,
        },
      ],
      memberships: [
        {
          id: membershipId,
          folderId,
          item: {
            kind: "project" as const,
            environmentId: EnvironmentId.make("environment"),
            projectId: ProjectId.make("project"),
          },
          orderKey: "a",
          createdAt: occurredAt,
          updatedAt: occurredAt,
        },
      ],
    };
    const event = Effect.runSync(
      plan({ type: "organization.workspace.delete", commandId, workspaceId }, state),
    );
    assert.deepStrictEqual(applyOrganizationEvent(state, committed(event)), {
      workspaces: [],
      folders: [],
      memberships: [],
    });
  });
});
