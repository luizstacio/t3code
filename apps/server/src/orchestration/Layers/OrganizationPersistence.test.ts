import {
  CommandId,
  EnvironmentId,
  OrganizationFolderId,
  OrganizationMembershipId,
  OrganizationWorkspaceId,
  ProjectId,
} from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ServerConfig } from "../../config.ts";
import { OrchestrationCommandReceiptRepositoryLive } from "../../persistence/Layers/OrchestrationCommandReceipts.ts";
import { OrchestrationEventStoreLive } from "../../persistence/Layers/OrchestrationEventStore.ts";
import { SqlitePersistenceMemory } from "../../persistence/Layers/Sqlite.ts";
import * as RepositoryIdentityResolver from "../../project/RepositoryIdentityResolver.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../Services/ProjectionSnapshotQuery.ts";
import * as ThreadBackgroundLiveness from "../ThreadBackgroundLiveness.ts";
import * as ThreadPlanProgress from "../ThreadPlanProgress.ts";
import { OrchestrationEngineLive } from "./OrchestrationEngine.ts";
import { OrchestrationProjectionPipelineLive } from "./ProjectionPipeline.ts";
import { OrchestrationProjectionSnapshotQueryLive } from "./ProjectionSnapshotQuery.ts";

const layer = OrchestrationEngineLive.pipe(
  Layer.provideMerge(OrchestrationProjectionSnapshotQueryLive),
  Layer.provide(ThreadBackgroundLiveness.layer),
  Layer.provide(ThreadPlanProgress.layer),
  Layer.provideMerge(OrchestrationProjectionPipelineLive),
  Layer.provide(OrchestrationEventStoreLive),
  Layer.provide(OrchestrationCommandReceiptRepositoryLive),
  Layer.provide(RepositoryIdentityResolver.layer),
  Layer.provideMerge(SqlitePersistenceMemory),
  Layer.provideMerge(
    ServerConfig.layerTest(process.cwd(), { prefix: "t3-organization-persistence-test-" }),
  ),
  Layer.provideMerge(NodeServices.layer),
);

it.layer(layer)("organization persistence", (it) => {
  it.effect("projects organization changes into the shell snapshot", () =>
    Effect.gen(function* () {
      const engine = yield* OrchestrationEngineService;
      const snapshots = yield* ProjectionSnapshotQuery;
      const at = "2026-10-02T12:00:00.000Z";

      yield* engine.dispatch({
        type: "organization.workspace.create",
        commandId: CommandId.make("workspace-create"),
        workspaceId: OrganizationWorkspaceId.make("workspace-1"),
        name: "Team",
        orderKey: "m",
        createdAt: at,
      });
      yield* engine.dispatch({
        type: "organization.folder.create",
        commandId: CommandId.make("folder-create"),
        folderId: OrganizationFolderId.make("folder-1"),
        workspaceId: OrganizationWorkspaceId.make("workspace-1"),
        name: "Product",
        orderKey: "m",
        createdAt: at,
      });
      yield* engine.dispatch({
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

      assert.deepEqual((yield* snapshots.getShellSnapshot()).organization, {
        workspaces: [
          {
            id: OrganizationWorkspaceId.make("workspace-1"),
            name: "Team",
            orderKey: "m",
            createdAt: at,
            updatedAt: at,
          },
        ],
        folders: [
          {
            id: OrganizationFolderId.make("folder-1"),
            workspaceId: OrganizationWorkspaceId.make("workspace-1"),
            name: "Product",
            orderKey: "m",
            createdAt: at,
            updatedAt: at,
          },
        ],
        memberships: [
          {
            id: OrganizationMembershipId.make("membership-1"),
            folderId: OrganizationFolderId.make("folder-1"),
            item: {
              kind: "project",
              environmentId: EnvironmentId.make("environment-1"),
              projectId: ProjectId.make("project-1"),
            },
            orderKey: "m",
            createdAt: at,
            updatedAt: at,
          },
        ],
      });
    }),
  );
});
