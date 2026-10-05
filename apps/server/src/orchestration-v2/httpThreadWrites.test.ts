import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it, vi } from "@effect/vitest";
import {
  AuthSessionId,
  CommandId,
  EnvironmentAuthenticatedAuth,
  EnvironmentAuthenticatedPrincipal,
  EnvironmentHttpApi,
  MessageId,
  ORCHESTRATION_PROTOCOL_HEADER,
  ORCHESTRATION_PROTOCOL_VERSION_TEXT,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
  type AuthEnvironmentScope,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Etag from "effect/unstable/http/Etag";
import * as HttpPlatform from "effect/unstable/http/HttpPlatform";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import * as ServerConfig from "../config.ts";
import * as GitWorkflow from "../git/GitWorkflowService.ts";
import { OrchestrationEventStoreLive } from "../persistence/Layers/OrchestrationEventStore.ts";
import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import * as ManagedProjectFolders from "../project/ManagedProjectFolders.ts";
import * as ProjectCloneTracker from "../project/ProjectCloneTracker.ts";
import * as ProjectEnrichmentService from "../project/ProjectEnrichmentService.ts";
import * as ProjectService from "../project/ProjectService.ts";
import * as ProjectSetupScriptRunner from "../project/ProjectSetupScriptRunner.ts";
import * as WorktreeSetupTracker from "../project/WorktreeSetupTracker.ts";
import { makeProviderRegistryLayer } from "../provider/testUtils/providerRegistryMock.ts";
import * as ServerRuntimeStartup from "../serverRuntimeStartup.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as TerminalManager from "../terminal/Manager.ts";
import * as TextGeneration from "../textGeneration/TextGeneration.ts";
import { CodexProviderCapabilitiesV2 } from "./Adapters/CodexAdapterV2.ts";
import * as CommandReceiptStore from "./CommandReceiptStore.ts";
import { orchestrationHttpApiLayer } from "./http.ts";
import * as IdAllocator from "./IdAllocator.ts";
import type { ProviderAdapterV2Shape } from "./ProviderAdapter.ts";
import * as ProviderAdapterRegistry from "./ProviderAdapterRegistry.ts";
import * as ProjectStore from "./ProjectStore.ts";
import { makeOrchestratorV2ReplayLayerWithRegistry } from "./testkit/ProviderReplayHarness.ts";
import * as ThreadLaunch from "./ThreadLaunchService.ts";
import * as ThreadManagement from "./ThreadManagementService.ts";

const projectId = ProjectId.make("project:http-thread-writes");
const modelSelection = {
  instanceId: ProviderInstanceId.make("codex"),
  model: "gpt-5-codex",
} as const;

const project = {
  id: projectId,
  title: "HTTP thread writes",
  workspaceRoot: "/workspace/http-thread-writes",
  repositoryIdentity: null,
  faviconPath: null,
  defaultModelSelection: modelSelection,
  defaultThreadEnvMode: null,
  scripts: [],
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z",
  deletedAt: null,
} as never;

const adapter = {
  instanceId: modelSelection.instanceId,
  driver: ProviderDriverKind.make("codex"),
  getCapabilities: () => Effect.succeed(CodexProviderCapabilitiesV2),
  planSelectionTransition: () => Effect.succeed({ type: "apply_on_next_turn" as const }),
  openSession: () => Effect.die("provider execution is disabled in these tests"),
} as ProviderAdapterV2Shape;

class ThreadWritesTestApi extends HttpApi.make("environment").add(
  EnvironmentHttpApi.groups.orchestration,
) {}

/** Grants the given scopes without the full EnvironmentAuth stack. */
const principalAuthLayer = (scopes: ReadonlyArray<AuthEnvironmentScope>) =>
  Layer.succeed(EnvironmentAuthenticatedAuth, (httpEffect) =>
    httpEffect.pipe(
      Effect.provideService(EnvironmentAuthenticatedPrincipal, {
        sessionId: AuthSessionId.make("session:http-thread-writes"),
        subject: "test-client",
        method: "bearer-access-token",
        scopes: new Set(scopes),
      }),
    ),
  );

function makeRoutesLayer(scopes: ReadonlyArray<AuthEnvironmentScope>) {
  const database = SqlitePersistenceMemory;
  const registry = ProviderAdapterRegistry.makeLayer([adapter]);
  const orchestrator = makeOrchestratorV2ReplayLayerWithRegistry(
    { name: "http-thread-writes" },
    registry,
    { databaseLayer: database, runEffectWorker: false },
  );
  const threadManagement = ThreadManagement.layer.pipe(Layer.provide(orchestrator));
  const receipts = CommandReceiptStore.layer.pipe(Layer.provide(database));
  const externalServices = Layer.mergeAll(
    WorktreeSetupTracker.layer,
    Layer.mock(ProjectCloneTracker.ProjectCloneTracker)({ get: () => Effect.succeed(null) }),
    Layer.mock(TerminalManager.TerminalManager)({ close: () => Effect.void }),
    Layer.succeed(ProjectService.ProjectService, {
      create: () => Effect.die("unused"),
      bootstrap: () => Effect.die("unused"),
      update: () => Effect.die("unused"),
      delete: () => Effect.die("unused"),
      getById: (id) => Effect.succeed(id === projectId ? Option.some(project) : Option.none()),
      getByWorkspaceRoot: () => Effect.succeed(Option.some(project)),
      snapshot: Effect.die("unused"),
      getShell: () => Effect.die("unused"),
      listShells: () => Effect.die("unused"),
    }),
    Layer.mock(GitWorkflow.GitWorkflowService)({
      createWorktree: vi.fn(() => Effect.die("worktrees unused: root strategy only")),
      renameBranch: () => Effect.die("unused"),
      fetchRemote: () => Effect.void,
      remoteExists: () => Effect.succeed(true),
      remoteBranchExists: () => Effect.succeed(true),
      removeWorktree: () => Effect.void,
      resolveRemoteTrackingCommit: () =>
        Effect.succeed({ commitSha: "remote-main-sha", remoteRefName: "origin/main" }),
    }),
    Layer.succeed(ProjectSetupScriptRunner.ProjectSetupScriptRunner, {
      runForThread: () => Effect.succeed({ status: "no-script" as const }),
    }),
    Layer.mock(TextGeneration.TextGeneration)({
      generateThreadTitle: () => Effect.succeed({ title: "Generated title" }),
      generateBranchName: () => Effect.succeed({ branch: "generated-branch" }),
    }),
    ServerSettings.layerTest(),
    makeProviderRegistryLayer(),
    Layer.mock(ManagedProjectFolders.ManagedProjectFolders)({
      namedProjectsRoot: "/projects",
      folderForThread: () => Effect.succeed(Option.none()),
    }),
    Layer.mock(ProjectEnrichmentService.ProjectEnrichmentService)({
      getAvailable: () => Effect.succeed({ repositoryIdentity: null } as never),
    }),
  );
  const launch = ThreadLaunch.layer.pipe(
    Layer.provide(Layer.mergeAll(externalServices, threadManagement, receipts, IdAllocator.layer)),
  );
  return HttpApiBuilder.layer(ThreadWritesTestApi).pipe(
    Layer.provide(orchestrationHttpApiLayer),
    Layer.provide(principalAuthLayer(scopes)),
    Layer.provideMerge(
      Layer.mergeAll(
        launch,
        threadManagement,
        orchestrator,
        OrchestrationEventStoreLive.pipe(Layer.provide(database)),
        ProjectStore.layer.pipe(Layer.provide(database)),
        database,
        externalServices,
        Layer.mock(ServerRuntimeStartup.ServerRuntimeStartup)({
          awaitCommandReady: Effect.void,
          enqueueCommand: (effect) => effect,
        }),
      ),
    ),
    Layer.provide(ServerConfig.layerTest(process.cwd(), { prefix: "t3-http-thread-writes-" })),
    Layer.provideMerge(
      HttpPlatform.layer.pipe(
        Layer.provideMerge(NodeServices.layer),
        Layer.provideMerge(Etag.layerWeak),
      ),
    ),
    Layer.provide(NodeCrypto.layer),
  );
}

const protocolHeaders = {
  "content-type": "application/json",
  [ORCHESTRATION_PROTOCOL_HEADER]: ORCHESTRATION_PROTOCOL_VERSION_TEXT,
};

const postJson = (path: string, body: unknown) =>
  new Request(`http://127.0.0.1${path}`, {
    method: "POST",
    headers: protocolHeaders,
    body: JSON.stringify(body),
  });

const launchBody = {
  commandId: CommandId.make("command:http-launch"),
  threadId: ThreadId.make("thread:http-launch"),
  projectId,
  title: "Launched over HTTP",
  modelSelection,
  runtimeMode: "full-access",
  interactionMode: "default",
  workspaceStrategy: { type: "root" },
  initialMessage: {
    messageId: MessageId.make("message:http-launch"),
    text: "Start working",
    attachments: [],
  },
};

const withHandler = <A>(
  scopes: ReadonlyArray<AuthEnvironmentScope>,
  use: (handler: (request: Request) => Promise<Response>) => Promise<A>,
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => HttpRouter.toWebHandler(makeRoutesLayer(scopes), { disableLogger: true })),
    (web) => Effect.tryPromise(() => use((request) => web.handler(request))),
    (web) => Effect.promise(() => web.dispose()),
  );

it.effect("launches, steers, and interrupts a thread over HTTP", () =>
  withHandler(["orchestration:read", "orchestration:operate"], async (handler) => {
    const launchResponse = await handler(postJson("/api/orchestration/threads/launch", launchBody));
    expect(launchResponse.status).toBe(200);
    expect(await launchResponse.json()).toMatchObject({
      threadId: "thread:http-launch",
      projectId,
      resumed: false,
    });

    // Idempotency: retrying the same commandId resumes instead of failing.
    const retryResponse = await handler(postJson("/api/orchestration/threads/launch", launchBody));
    expect(retryResponse.status).toBe(200);
    expect(await retryResponse.json()).toMatchObject({
      threadId: "thread:http-launch",
      resumed: true,
    });

    const sendResponse = await handler(
      postJson("/api/orchestration/threads/thread:http-launch/send", {
        commandId: CommandId.make("command:http-send"),
        messageId: MessageId.make("message:http-send"),
        text: "Follow-up instruction",
        mode: "queue",
      }),
    );
    expect(sendResponse.status).toBe(200);
    expect(await sendResponse.json()).toMatchObject({
      threadId: "thread:http-launch",
      delivery: "queued",
    });

    const interruptResponse = await handler(
      postJson("/api/orchestration/threads/thread:http-launch/interrupt", {
        commandId: CommandId.make("command:http-interrupt"),
      }),
    );
    expect(interruptResponse.status).toBe(200);
    expect(await interruptResponse.json()).toMatchObject({ threadId: "thread:http-launch" });

    const missingResponse = await handler(
      postJson("/api/orchestration/threads/thread:absent/send", {
        commandId: CommandId.make("command:http-send-missing"),
        messageId: MessageId.make("message:http-send-missing"),
        text: "Nobody home",
      }),
    );
    expect(missingResponse.status).toBe(404);
  }),
);

it.effect("rejects thread writes without the operate scope", () =>
  withHandler(["orchestration:read"], async (handler) => {
    const response = await handler(postJson("/api/orchestration/threads/launch", launchBody));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "insufficient_scope",
      requiredScope: "orchestration:operate",
    });
  }),
);
