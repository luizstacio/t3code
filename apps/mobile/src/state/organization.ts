import { useAtomValue } from "@effect/atom-react";
import {
  createOrganizationEnvironmentAtoms,
  filterOrganizationWorkspaceContent,
  selectOrganizationWorkspace,
  sortOrganizationWorkspaces,
} from "@t3tools/client-runtime/state/organization";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { EMPTY_ORGANIZATION_STATE, type OrganizationWorkspaceId } from "@t3tools/contracts";
import { useEffect, useMemo } from "react";
import { Atom } from "effect/unstable/reactivity";

import { environmentCatalog } from "../connection/catalog";
import { connectionAtomRuntime } from "../connection/runtime";
import { environmentSnapshotAtom } from "./shell";

export const organizationEnvironment: ReturnType<typeof createOrganizationEnvironmentAtoms> =
  createOrganizationEnvironmentAtoms(connectionAtomRuntime);

const organizationAuthorityEnvironmentIdAtom = Atom.make((get) => {
  for (const [environmentId, entry] of get(environmentCatalog.catalogValueAtom).entries) {
    if (!entry.enabled) continue;
    // ponytail: the first enabled mobile connection is the organization authority;
    // add an explicit authority picker when multi-authority mobile profiles ship.
    return environmentId;
  }
  return null;
}).pipe(Atom.withLabel("mobile-organization-authority"));

const organizationStateAtom = Atom.make((get) => {
  const environmentId = get(organizationAuthorityEnvironmentIdAtom);
  return environmentId === null
    ? EMPTY_ORGANIZATION_STATE
    : (get(environmentSnapshotAtom(environmentId))?.organization ?? EMPTY_ORGANIZATION_STATE);
}).pipe(Atom.withLabel("mobile-organization"));

export function useOrganizationAuthorityEnvironmentId() {
  return useAtomValue(organizationAuthorityEnvironmentIdAtom);
}

export function useOrganizationWorkspaces() {
  const organization = useAtomValue(organizationStateAtom);
  return useMemo(
    () => sortOrganizationWorkspaces(organization.workspaces),
    [organization.workspaces],
  );
}

export function useOrganizationWorkspaceContent(input: {
  readonly selectedWorkspaceId: OrganizationWorkspaceId | null;
  readonly setSelectedWorkspaceId: (workspaceId: OrganizationWorkspaceId | null) => void;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
}) {
  const { projects, selectedWorkspaceId, setSelectedWorkspaceId, threads } = input;
  const organization = useAtomValue(organizationStateAtom);
  const workspaces = useMemo(
    () => sortOrganizationWorkspaces(organization.workspaces),
    [organization.workspaces],
  );
  const activeWorkspaceId =
    workspaces.find(({ id }) => id === selectedWorkspaceId)?.id ?? workspaces[0]?.id ?? null;
  useEffect(() => {
    if (activeWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(activeWorkspaceId);
    }
  }, [activeWorkspaceId, selectedWorkspaceId, setSelectedWorkspaceId]);
  const content = useMemo(
    () =>
      filterOrganizationWorkspaceContent({
        state: organization,
        workspaceId: activeWorkspaceId,
        projects,
        threads,
      }),
    [activeWorkspaceId, organization, projects, threads],
  );
  const activeWorkspace = useMemo(
    () =>
      activeWorkspaceId === null
        ? null
        : selectOrganizationWorkspace(organization, activeWorkspaceId),
    [activeWorkspaceId, organization],
  );
  return { ...content, activeWorkspace, activeWorkspaceId, organization, workspaces };
}
