import * as Schema from "effect/Schema";

import {
  CommandId,
  EnvironmentId,
  EventId,
  IsoDateTime,
  NonNegativeInt,
  OrganizationFolderId,
  OrganizationMembershipId,
  OrganizationWorkspaceId,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";
import { ProjectIconColor } from "./project.ts";
import { ApplicationEventMetadata } from "./applicationEvent.ts";

/**
 * The workspace thumbnail. Absent means the name's initials. Shares the
 * project icon vocabulary so both pickers offer the same icons and emoji.
 */
export const OrganizationWorkspaceIcon = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("lucide"),
    name: TrimmedNonEmptyString.check(
      Schema.isMaxLength(64),
      Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("emoji"),
    emoji: TrimmedNonEmptyString.check(Schema.isMaxLength(32)),
  }),
]);
export type OrganizationWorkspaceIcon = typeof OrganizationWorkspaceIcon.Type;

export const OrganizationWorkspace = Schema.Struct({
  id: OrganizationWorkspaceId,
  name: TrimmedNonEmptyString,
  color: Schema.optional(ProjectIconColor),
  icon: Schema.optional(OrganizationWorkspaceIcon),
  orderKey: TrimmedNonEmptyString,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type OrganizationWorkspace = typeof OrganizationWorkspace.Type;

export const OrganizationFolder = Schema.Struct({
  id: OrganizationFolderId,
  workspaceId: OrganizationWorkspaceId,
  name: TrimmedNonEmptyString,
  orderKey: TrimmedNonEmptyString,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type OrganizationFolder = typeof OrganizationFolder.Type;

export const OrganizationItemReference = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("project"),
    environmentId: EnvironmentId,
    projectId: ProjectId,
  }),
  Schema.Struct({
    kind: Schema.Literal("thread"),
    environmentId: EnvironmentId,
    threadId: ThreadId,
  }),
]);
export type OrganizationItemReference = typeof OrganizationItemReference.Type;

export const OrganizationMembership = Schema.Struct({
  id: OrganizationMembershipId,
  folderId: OrganizationFolderId,
  item: OrganizationItemReference,
  orderKey: TrimmedNonEmptyString,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type OrganizationMembership = typeof OrganizationMembership.Type;

export const OrganizationState = Schema.Struct({
  workspaces: Schema.Array(OrganizationWorkspace),
  folders: Schema.Array(OrganizationFolder),
  memberships: Schema.Array(OrganizationMembership),
});
export type OrganizationState = typeof OrganizationState.Type;

export const EMPTY_ORGANIZATION_STATE: OrganizationState = {
  workspaces: [],
  folders: [],
  memberships: [],
};

export const OrganizationMutation = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("organization.workspace.create"),
    commandId: CommandId,
    workspaceId: OrganizationWorkspaceId,
    name: TrimmedNonEmptyString,
    color: Schema.optional(ProjectIconColor),
    icon: Schema.optional(OrganizationWorkspaceIcon),
    orderKey: TrimmedNonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("organization.workspace.update"),
    commandId: CommandId,
    workspaceId: OrganizationWorkspaceId,
    name: Schema.optional(TrimmedNonEmptyString),
    /** Null clears the field; absent leaves it unchanged. */
    color: Schema.optional(Schema.NullOr(ProjectIconColor)),
    icon: Schema.optional(Schema.NullOr(OrganizationWorkspaceIcon)),
    orderKey: Schema.optional(TrimmedNonEmptyString),
  }),
  Schema.Struct({
    type: Schema.Literal("organization.workspace.delete"),
    commandId: CommandId,
    workspaceId: OrganizationWorkspaceId,
  }),
  Schema.Struct({
    type: Schema.Literal("organization.folder.create"),
    commandId: CommandId,
    folderId: OrganizationFolderId,
    workspaceId: OrganizationWorkspaceId,
    name: TrimmedNonEmptyString,
    orderKey: TrimmedNonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("organization.folder.update"),
    commandId: CommandId,
    folderId: OrganizationFolderId,
    workspaceId: Schema.optional(OrganizationWorkspaceId),
    name: Schema.optional(TrimmedNonEmptyString),
    orderKey: Schema.optional(TrimmedNonEmptyString),
  }),
  Schema.Struct({
    type: Schema.Literal("organization.folder.delete"),
    commandId: CommandId,
    folderId: OrganizationFolderId,
  }),
  Schema.Struct({
    type: Schema.Literal("organization.membership.upsert"),
    commandId: CommandId,
    membershipId: OrganizationMembershipId,
    folderId: OrganizationFolderId,
    item: OrganizationItemReference,
    orderKey: TrimmedNonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("organization.membership.delete"),
    commandId: CommandId,
    membershipId: OrganizationMembershipId,
  }),
]);
export type OrganizationMutation = typeof OrganizationMutation.Type;

export class OrganizationMutationError extends Schema.TaggedError<OrganizationMutationError>()(
  "OrganizationMutationError",
  { commandId: CommandId, message: Schema.String, cause: Schema.optional(Schema.Defect()) },
) {}

const OrganizationEventBase = {
  sequence: NonNegativeInt,
  eventId: EventId,
  aggregateKind: Schema.Literal("organization"),
  aggregateId: Schema.Literal("organization"),
  occurredAt: IsoDateTime,
  commandId: CommandId,
  causationEventId: Schema.NullOr(EventId),
  correlationId: Schema.NullOr(CommandId),
  metadata: ApplicationEventMetadata,
} as const;

export const ApplicationOrganizationEvent = Schema.Union([
  Schema.Struct({
    ...OrganizationEventBase,
    type: Schema.Literal("organization.workspace-created"),
    payload: Schema.Struct({ workspace: OrganizationWorkspace }),
  }),
  Schema.Struct({
    ...OrganizationEventBase,
    type: Schema.Literal("organization.workspace-updated"),
    payload: Schema.Struct({
      workspaceId: OrganizationWorkspaceId,
      name: Schema.optional(TrimmedNonEmptyString),
      color: Schema.optional(Schema.NullOr(ProjectIconColor)),
      icon: Schema.optional(Schema.NullOr(OrganizationWorkspaceIcon)),
      orderKey: Schema.optional(TrimmedNonEmptyString),
      updatedAt: IsoDateTime,
    }),
  }),
  Schema.Struct({
    ...OrganizationEventBase,
    type: Schema.Literal("organization.workspace-deleted"),
    payload: Schema.Struct({ workspaceId: OrganizationWorkspaceId, deletedAt: IsoDateTime }),
  }),
  Schema.Struct({
    ...OrganizationEventBase,
    type: Schema.Literal("organization.folder-created"),
    payload: Schema.Struct({ folder: OrganizationFolder }),
  }),
  Schema.Struct({
    ...OrganizationEventBase,
    type: Schema.Literal("organization.folder-updated"),
    payload: Schema.Struct({
      folderId: OrganizationFolderId,
      workspaceId: Schema.optional(OrganizationWorkspaceId),
      name: Schema.optional(TrimmedNonEmptyString),
      orderKey: Schema.optional(TrimmedNonEmptyString),
      updatedAt: IsoDateTime,
    }),
  }),
  Schema.Struct({
    ...OrganizationEventBase,
    type: Schema.Literal("organization.folder-deleted"),
    payload: Schema.Struct({ folderId: OrganizationFolderId, deletedAt: IsoDateTime }),
  }),
  Schema.Struct({
    ...OrganizationEventBase,
    type: Schema.Literal("organization.membership-upserted"),
    payload: Schema.Struct({ membership: OrganizationMembership }),
  }),
  Schema.Struct({
    ...OrganizationEventBase,
    type: Schema.Literal("organization.membership-deleted"),
    payload: Schema.Struct({ membershipId: OrganizationMembershipId, deletedAt: IsoDateTime }),
  }),
]);
export type ApplicationOrganizationEvent = typeof ApplicationOrganizationEvent.Type;
