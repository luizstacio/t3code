import * as Schema from "effect/Schema";

import {
  EnvironmentId,
  IsoDateTime,
  OrganizationFolderId,
  OrganizationMembershipId,
  OrganizationWorkspaceId,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";

export const OrganizationWorkspace = Schema.Struct({
  id: OrganizationWorkspaceId,
  name: TrimmedNonEmptyString,
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
