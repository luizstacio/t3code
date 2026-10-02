import { useAtomValue } from "@effect/atom-react";
import { createOrganizationEnvironmentAtoms } from "@t3tools/client-runtime/state/organization";
import { EMPTY_ORGANIZATION_STATE } from "@t3tools/contracts";
import { Atom } from "effect/unstable/reactivity";

import { environmentSnapshotAtom } from "./shell";
import { primaryEnvironmentIdAtom } from "./primaryEnvironment";
import { connectionAtomRuntime } from "../connection/runtime";

export const organizationEnvironment: ReturnType<typeof createOrganizationEnvironmentAtoms> =
  createOrganizationEnvironmentAtoms(connectionAtomRuntime);

export const primaryOrganizationStateAtom = Atom.make((get) => {
  const environmentId = get(primaryEnvironmentIdAtom);
  return environmentId === null
    ? EMPTY_ORGANIZATION_STATE
    : (get(environmentSnapshotAtom(environmentId))?.organization ?? EMPTY_ORGANIZATION_STATE);
}).pipe(Atom.withLabel("web-primary-organization"));

export function usePrimaryOrganizationState() {
  return useAtomValue(primaryOrganizationStateAtom);
}
