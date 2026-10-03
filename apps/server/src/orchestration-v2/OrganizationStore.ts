import {
  ApplicationOrganizationEvent,
  EMPTY_ORGANIZATION_STATE,
  OrganizationState,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export class OrganizationStoreError extends Schema.TaggedError<OrganizationStoreError>()(
  "OrganizationStoreError",
  { operation: Schema.String, cause: Schema.Defect() },
) {}

export function applyOrganizationEvent(
  state: OrganizationState,
  event: ApplicationOrganizationEvent,
): OrganizationState {
  switch (event.type) {
    case "organization.workspace-created":
      return { ...state, workspaces: [...state.workspaces, event.payload.workspace] };
    case "organization.workspace-updated":
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === event.payload.workspaceId
            ? {
                ...workspace,
                ...(event.payload.name === undefined ? {} : { name: event.payload.name }),
                ...(event.payload.orderKey === undefined
                  ? {}
                  : { orderKey: event.payload.orderKey }),
                updatedAt: event.payload.updatedAt,
              }
            : workspace,
        ),
      };
    case "organization.workspace-deleted": {
      const folderIds = new Set(
        state.folders
          .filter((folder) => folder.workspaceId === event.payload.workspaceId)
          .map((folder) => folder.id),
      );
      return {
        workspaces: state.workspaces.filter(
          (workspace) => workspace.id !== event.payload.workspaceId,
        ),
        folders: state.folders.filter((folder) => !folderIds.has(folder.id)),
        memberships: state.memberships.filter((membership) => !folderIds.has(membership.folderId)),
      };
    }
    case "organization.folder-created":
      return { ...state, folders: [...state.folders, event.payload.folder] };
    case "organization.folder-updated":
      return {
        ...state,
        folders: state.folders.map((folder) =>
          folder.id === event.payload.folderId
            ? {
                ...folder,
                ...(event.payload.workspaceId === undefined
                  ? {}
                  : { workspaceId: event.payload.workspaceId }),
                ...(event.payload.name === undefined ? {} : { name: event.payload.name }),
                ...(event.payload.orderKey === undefined
                  ? {}
                  : { orderKey: event.payload.orderKey }),
                updatedAt: event.payload.updatedAt,
              }
            : folder,
        ),
      };
    case "organization.folder-deleted":
      return {
        ...state,
        folders: state.folders.filter((folder) => folder.id !== event.payload.folderId),
        memberships: state.memberships.filter(
          (membership) => membership.folderId !== event.payload.folderId,
        ),
      };
    case "organization.membership-upserted": {
      const exists = state.memberships.some(
        (membership) => membership.id === event.payload.membership.id,
      );
      return {
        ...state,
        memberships: exists
          ? state.memberships.map((membership) =>
              membership.id === event.payload.membership.id ? event.payload.membership : membership,
            )
          : [...state.memberships, event.payload.membership],
      };
    }
    case "organization.membership-deleted":
      return {
        ...state,
        memberships: state.memberships.filter(
          (membership) => membership.id !== event.payload.membershipId,
        ),
      };
  }
}

export class OrganizationStore extends Context.Service<
  OrganizationStore,
  {
    readonly get: Effect.Effect<OrganizationState, OrganizationStoreError>;
    readonly apply: (
      event: ApplicationOrganizationEvent,
    ) => Effect.Effect<OrganizationState, OrganizationStoreError>;
  }
>()("t3/orchestration-v2/OrganizationStore") {}

export const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const decode = Schema.decodeUnknownEffect(Schema.fromJsonString(OrganizationState));
  const encode = Schema.encodeEffect(Schema.fromJsonString(OrganizationState));
  const mapError =
    (operation: string) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(Effect.mapError((cause) => new OrganizationStoreError({ operation, cause })));

  const get = sql<{ readonly state_json: string }>`
    SELECT state_json FROM projection_organization WHERE singleton = 1
  `.pipe(
    Effect.flatMap((rows) =>
      rows[0] === undefined ? Effect.succeed(EMPTY_ORGANIZATION_STATE) : decode(rows[0].state_json),
    ),
    mapError("get"),
  );

  const apply: OrganizationStore["Service"]["apply"] = (event) =>
    Effect.gen(function* () {
      const state = applyOrganizationEvent(yield* get, event);
      const stateJson = yield* encode(state);
      yield* sql`
        INSERT INTO projection_organization (singleton, state_json, updated_at)
        VALUES (1, ${stateJson}, ${event.occurredAt})
        ON CONFLICT(singleton) DO UPDATE SET
          state_json = excluded.state_json,
          updated_at = excluded.updated_at
      `;
      return state;
    }).pipe(mapError("apply"));

  return { get, apply } satisfies OrganizationStore["Service"];
});

export const layer = Layer.effect(OrganizationStore, make);
