import {
  CommandId,
  EnvironmentId,
  OrganizationFolderId,
  OrganizationMembershipId,
  OrganizationWorkspaceId,
  ProjectId,
  type OrchestrationCommand,
  type OrchestrationEvent,
  type OrchestrationReadModel,
} from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { decideOrchestrationCommand } from "./decider.ts";
import { createEmptyReadModel, projectEvent } from "./projector.ts";

const at = "2026-10-02T12:00:00.000Z";

it.layer(NodeServices.layer)("organization orchestration", (it) => {
  it.effect("creates, moves, and deletes organization containers without deleting projects", () =>
    Effect.gen(function* () {
      let model: OrchestrationReadModel = {
        ...createEmptyReadModel(at),
        projects: [
          {
            id: ProjectId.make("project-1"),
            title: "Project",
            workspaceRoot: "/repo",
            repositoryIdentity: null,
            defaultModelSelection: null,
            defaultThreadEnvMode: null,
            autoPull: false,
            faviconPath: null,
            projectIcon: null,
            scripts: [],
            createdAt: at,
            updatedAt: at,
            deletedAt: null,
          },
        ],
      };
      let sequence = 0;
      const dispatch = (command: OrchestrationCommand) =>
        Effect.gen(function* () {
          const planned = yield* decideOrchestrationCommand({ command, readModel: model });
          const events = Array.isArray(planned) ? planned : [planned];
          for (const event of events) {
            sequence += 1;
            model = yield* projectEvent(model, {
              ...event,
              sequence,
            } as OrchestrationEvent);
          }
        });

      yield* dispatch({
        type: "organization.workspace.create",
        commandId: CommandId.make("workspace-create"),
        workspaceId: OrganizationWorkspaceId.make("workspace-1"),
        name: "Team",
        orderKey: "m",
        createdAt: at,
      });
      yield* dispatch({
        type: "organization.folder.create",
        commandId: CommandId.make("folder-create"),
        folderId: OrganizationFolderId.make("folder-1"),
        workspaceId: OrganizationWorkspaceId.make("workspace-1"),
        name: "Product",
        orderKey: "m",
        createdAt: at,
      });
      yield* dispatch({
        type: "organization.membership.upsert",
        commandId: CommandId.make("membership-upsert"),
        membershipId: OrganizationMembershipId.make("membership-1"),
        folderId: OrganizationFolderId.make("folder-1"),
        item: {
          kind: "project",
          environmentId: EnvironmentId.make("environment-1"),
          projectId: ProjectId.make("project-1"),
        },
        orderKey: "m",
        updatedAt: at,
      });

      expect(model.organization?.memberships).toHaveLength(1);

      yield* dispatch({
        type: "organization.workspace.delete",
        commandId: CommandId.make("workspace-delete"),
        workspaceId: OrganizationWorkspaceId.make("workspace-1"),
        deletedAt: at,
      });

      expect(model.organization).toEqual({ workspaces: [], folders: [], memberships: [] });
      expect(model.projects.map(({ id }) => id)).toEqual(["project-1"]);
    }),
  );

  it.effect("rejects folders whose workspace does not exist", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        decideOrchestrationCommand({
          command: {
            type: "organization.folder.create",
            commandId: CommandId.make("folder-create-invalid"),
            folderId: OrganizationFolderId.make("folder-1"),
            workspaceId: OrganizationWorkspaceId.make("missing"),
            name: "Product",
            orderKey: "m",
            createdAt: at,
          },
          readModel: createEmptyReadModel(at),
        }),
      );

      expect(error.message).toContain("does not exist");
    }),
  );
});
