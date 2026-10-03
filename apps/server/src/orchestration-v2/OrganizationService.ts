import {
  type ApplicationOrganizationEvent,
  type EventId,
  OrganizationMutation,
  OrganizationMutationError,
  type OrganizationState,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import * as Receipts from "../persistence/Services/OrchestrationCommandReceipts.ts";
import * as Events from "../persistence/Services/OrchestrationEventStore.ts";
import * as IdAllocator from "./IdAllocator.ts";
import { makeKeyedSerialExecutor } from "./KeyedSerialExecutor.ts";
import * as OrganizationStore from "./OrganizationStore.ts";

type UnsequencedOrganizationEvent = Events.UnsequencedOrganizationEvent;
const isOrganizationMutationError = Schema.is(OrganizationMutationError);

export function planOrganizationMutation(input: {
  readonly mutation: OrganizationMutation;
  readonly state: OrganizationState;
  readonly eventId: EventId;
  readonly occurredAt: string;
}): Effect.Effect<UnsequencedOrganizationEvent, OrganizationMutationError> {
  const { mutation, state, eventId, occurredAt } = input;
  const reject = (message: string) =>
    Effect.fail(new OrganizationMutationError({ commandId: mutation.commandId, message }));
  const base = {
    eventId,
    aggregateKind: "organization" as const,
    aggregateId: "organization" as const,
    occurredAt,
    commandId: mutation.commandId,
    causationEventId: null,
    correlationId: mutation.commandId,
    metadata: {},
  };

  switch (mutation.type) {
    case "organization.workspace.create":
      if (state.workspaces.some((workspace) => workspace.id === mutation.workspaceId))
        return reject(`Workspace '${mutation.workspaceId}' already exists.`);
      return Effect.succeed({
        ...base,
        type: "organization.workspace-created",
        payload: {
          workspace: {
            id: mutation.workspaceId,
            name: mutation.name,
            orderKey: mutation.orderKey,
            createdAt: occurredAt,
            updatedAt: occurredAt,
          },
        },
      });
    case "organization.workspace.update":
      if (!state.workspaces.some((workspace) => workspace.id === mutation.workspaceId))
        return reject(`Workspace '${mutation.workspaceId}' does not exist.`);
      return Effect.succeed({
        ...base,
        type: "organization.workspace-updated",
        payload: {
          workspaceId: mutation.workspaceId,
          ...(mutation.name === undefined ? {} : { name: mutation.name }),
          ...(mutation.orderKey === undefined ? {} : { orderKey: mutation.orderKey }),
          updatedAt: occurredAt,
        },
      });
    case "organization.workspace.delete":
      if (!state.workspaces.some((workspace) => workspace.id === mutation.workspaceId))
        return reject(`Workspace '${mutation.workspaceId}' does not exist.`);
      return Effect.succeed({
        ...base,
        type: "organization.workspace-deleted",
        payload: { workspaceId: mutation.workspaceId, deletedAt: occurredAt },
      });
    case "organization.folder.create":
      if (!state.workspaces.some((workspace) => workspace.id === mutation.workspaceId))
        return reject(`Workspace '${mutation.workspaceId}' does not exist.`);
      if (state.folders.some((folder) => folder.id === mutation.folderId))
        return reject(`Folder '${mutation.folderId}' already exists.`);
      return Effect.succeed({
        ...base,
        type: "organization.folder-created",
        payload: {
          folder: {
            id: mutation.folderId,
            workspaceId: mutation.workspaceId,
            name: mutation.name,
            orderKey: mutation.orderKey,
            createdAt: occurredAt,
            updatedAt: occurredAt,
          },
        },
      });
    case "organization.folder.update":
      if (!state.folders.some((folder) => folder.id === mutation.folderId))
        return reject(`Folder '${mutation.folderId}' does not exist.`);
      if (
        mutation.workspaceId !== undefined &&
        !state.workspaces.some((workspace) => workspace.id === mutation.workspaceId)
      )
        return reject(`Workspace '${mutation.workspaceId}' does not exist.`);
      return Effect.succeed({
        ...base,
        type: "organization.folder-updated",
        payload: {
          folderId: mutation.folderId,
          ...(mutation.workspaceId === undefined ? {} : { workspaceId: mutation.workspaceId }),
          ...(mutation.name === undefined ? {} : { name: mutation.name }),
          ...(mutation.orderKey === undefined ? {} : { orderKey: mutation.orderKey }),
          updatedAt: occurredAt,
        },
      });
    case "organization.folder.delete":
      if (!state.folders.some((folder) => folder.id === mutation.folderId))
        return reject(`Folder '${mutation.folderId}' does not exist.`);
      return Effect.succeed({
        ...base,
        type: "organization.folder-deleted",
        payload: { folderId: mutation.folderId, deletedAt: occurredAt },
      });
    case "organization.membership.upsert": {
      if (!state.folders.some((folder) => folder.id === mutation.folderId))
        return reject(`Folder '${mutation.folderId}' does not exist.`);
      const existing = state.memberships.find(
        (membership) => membership.id === mutation.membershipId,
      );
      return Effect.succeed({
        ...base,
        type: "organization.membership-upserted",
        payload: {
          membership: {
            id: mutation.membershipId,
            folderId: mutation.folderId,
            item: mutation.item,
            orderKey: mutation.orderKey,
            createdAt: existing?.createdAt ?? occurredAt,
            updatedAt: occurredAt,
          },
        },
      });
    }
    case "organization.membership.delete":
      if (!state.memberships.some((membership) => membership.id === mutation.membershipId))
        return reject(`Membership '${mutation.membershipId}' does not exist.`);
      return Effect.succeed({
        ...base,
        type: "organization.membership-deleted",
        payload: { membershipId: mutation.membershipId, deletedAt: occurredAt },
      });
  }
}

export class OrganizationService extends Context.Service<
  OrganizationService,
  {
    readonly get: Effect.Effect<OrganizationState, OrganizationStore.OrganizationStoreError>;
    readonly mutate: (
      mutation: OrganizationMutation,
    ) => Effect.Effect<OrganizationState, OrganizationMutationError>;
  }
>()("t3/orchestration-v2/OrganizationService") {}

export const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const store = yield* OrganizationStore.OrganizationStore;
  const events = yield* Events.OrchestrationEventStore;
  const receipts = yield* Receipts.OrchestrationCommandReceiptRepository;
  const ids = yield* IdAllocator.IdAllocatorV2;
  const lock = yield* makeKeyedSerialExecutor<"organization">();

  const mutate: OrganizationService["Service"]["mutate"] = (mutation) =>
    lock
      .withLock(
        "organization",
        sql.withTransaction(
          Effect.gen(function* () {
            const prior = yield* receipts.getByCommandId({ commandId: mutation.commandId });
            if (Option.isSome(prior)) {
              if (
                prior.value.aggregateKind !== "organization" ||
                prior.value.commandType !== mutation.type
              ) {
                return yield* new OrganizationMutationError({
                  commandId: mutation.commandId,
                  message: `Command id was already used by ${prior.value.commandType}.`,
                });
              }
              return { state: yield* store.get, event: null };
            }

            const occurredAt = DateTime.formatIso(yield* DateTime.now);
            const planned = yield* planOrganizationMutation({
              mutation,
              state: yield* store.get,
              eventId: yield* ids.allocate.event({ commandId: mutation.commandId }),
              occurredAt,
            });
            const event = yield* events.appendOrganizationEvent(planned);
            const state = yield* store.apply(event);
            yield* receipts.insertIfAbsent({
              commandId: mutation.commandId,
              aggregateKind: "organization",
              aggregateId: "organization",
              commandType: mutation.type,
              acceptedAt: occurredAt,
              resultSequence: event.sequence,
              status: "accepted",
              error: null,
            });
            return { state, event };
          }),
        ),
      )
      .pipe(
        Effect.tap(({ event }) =>
          event === null ? Effect.void : events.publishCommitted([event]),
        ),
        Effect.map(({ state }) => state),
        Effect.mapError((cause) =>
          isOrganizationMutationError(cause)
            ? cause
            : new OrganizationMutationError({
                commandId: mutation.commandId,
                message: "Organization mutation failed.",
                cause,
              }),
        ),
      );

  return { get: store.get, mutate } satisfies OrganizationService["Service"];
});

export const layer = Layer.effect(OrganizationService, make);
