import {
  DEFAULT_SIDEBAR_PROJECT_SORT_ORDER,
  ORGANIZATION_WORKSPACE_JUMP_KEYBINDING_COMMANDS,
  type EnvironmentId,
  type OrganizationWorkspace,
  type OrganizationWorkspaceId,
  type SidebarProjectGroupingMode,
} from "@t3tools/contracts";
import { adjacentOrganizationWorkspaceId } from "@t3tools/client-runtime/state/organization";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { HomeProjectSortOrder } from "./homeThreadList";
import { useOrganizationWorkspaces } from "../../state/organization";
import {
  type HardwareKeyboardCommand,
  useHardwareKeyboardCommand,
} from "../keyboard/hardwareKeyboardCommands";

const ORGANIZATION_WORKSPACE_COMMANDS = [
  "organizationWorkspace.previous",
  "organizationWorkspace.next",
  ...ORGANIZATION_WORKSPACE_JUMP_KEYBINDING_COMMANDS,
] as const satisfies ReadonlyArray<HardwareKeyboardCommand>;

export interface HomeListOptions {
  readonly activeOrganizationWorkspaceId: OrganizationWorkspaceId | null;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly projectSortOrder: HomeProjectSortOrder;
}

export interface ResolvedHomeListOptions extends HomeListOptions {
  readonly projectGroupingMode: SidebarProjectGroupingMode;
}

function defaultHomeListOptions(): HomeListOptions {
  return {
    activeOrganizationWorkspaceId: null,
    selectedEnvironmentId: null,
    projectSortOrder:
      DEFAULT_SIDEBAR_PROJECT_SORT_ORDER === "manual"
        ? "updated_at"
        : DEFAULT_SIDEBAR_PROJECT_SORT_ORDER,
  };
}

interface HomeListOptionsContextValue {
  readonly options: HomeListOptions;
  readonly setOptions: Dispatch<SetStateAction<HomeListOptions>>;
  readonly projectGroupingMode: SidebarProjectGroupingMode;
}

const HomeListOptionsContext = createContext<HomeListOptionsContextValue | null>(null);

/** Keeps list preferences stable while the app moves between compact and split shells. */
export function HomeListOptionsProvider({
  children,
  projectGroupingMode,
}: PropsWithChildren<{
  readonly projectGroupingMode: SidebarProjectGroupingMode;
}>) {
  const [options, setOptions] = useState<HomeListOptions>(defaultHomeListOptions);
  const organizationWorkspaces = useOrganizationWorkspaces();
  const setActiveWorkspaceId = useCallback(
    (activeOrganizationWorkspaceId: OrganizationWorkspaceId | null) => {
      setOptions((current) => ({ ...current, activeOrganizationWorkspaceId }));
    },
    [],
  );
  useOrganizationWorkspaceKeyboardShortcuts({
    workspaces: organizationWorkspaces,
    activeWorkspaceId: options.activeOrganizationWorkspaceId,
    setActiveWorkspaceId,
  });
  const value = useMemo(
    () => ({ options, setOptions, projectGroupingMode }),
    [options, projectGroupingMode],
  );
  return createElement(HomeListOptionsContext, { value }, children);
}

export function useHomeListOptions(availableEnvironmentIds: ReadonlySet<EnvironmentId>) {
  const shared = useContext(HomeListOptionsContext);
  const [localOptions, setLocalOptions] = useState<HomeListOptions>(defaultHomeListOptions);
  const options = shared?.options ?? localOptions;
  const setOptions = shared?.setOptions ?? setLocalOptions;
  const selectedEnvironmentId =
    options.selectedEnvironmentId !== null &&
    availableEnvironmentIds.has(options.selectedEnvironmentId)
      ? options.selectedEnvironmentId
      : null;
  const availableOptions =
    selectedEnvironmentId === options.selectedEnvironmentId
      ? options
      : { ...options, selectedEnvironmentId };
  const resolvedOptions: ResolvedHomeListOptions = {
    ...availableOptions,
    projectGroupingMode: shared?.projectGroupingMode ?? "repository",
  };

  const setSelectedEnvironmentId = useCallback(
    (value: EnvironmentId | null) => {
      setOptions((current) => ({ ...current, selectedEnvironmentId: value }));
    },
    [setOptions],
  );
  const setActiveOrganizationWorkspaceId = useCallback(
    (value: OrganizationWorkspaceId | null) => {
      setOptions((current) => ({ ...current, activeOrganizationWorkspaceId: value }));
    },
    [setOptions],
  );
  const setProjectSortOrder = useCallback(
    (value: HomeProjectSortOrder) => {
      setOptions((current) => ({ ...current, projectSortOrder: value }));
    },
    [setOptions],
  );
  return {
    options: resolvedOptions,
    setActiveOrganizationWorkspaceId,
    setSelectedEnvironmentId,
    setProjectSortOrder,
  } as const;
}

function useOrganizationWorkspaceKeyboardShortcuts(input: {
  readonly workspaces: ReadonlyArray<OrganizationWorkspace>;
  readonly activeWorkspaceId: OrganizationWorkspaceId | null;
  readonly setActiveWorkspaceId: (workspaceId: OrganizationWorkspaceId | null) => void;
}) {
  const { activeWorkspaceId, setActiveWorkspaceId, workspaces } = input;
  const switchWorkspace = useCallback(
    (command: HardwareKeyboardCommand) => {
      const jumpIndex = ORGANIZATION_WORKSPACE_JUMP_KEYBINDING_COMMANDS.indexOf(
        command as (typeof ORGANIZATION_WORKSPACE_JUMP_KEYBINDING_COMMANDS)[number],
      );
      if (jumpIndex !== -1) {
        const workspace = workspaces[jumpIndex];
        if (workspace) setActiveWorkspaceId(workspace.id);
        return true;
      }
      setActiveWorkspaceId(
        adjacentOrganizationWorkspaceId(
          workspaces,
          activeWorkspaceId,
          command === "organizationWorkspace.next" ? "next" : "previous",
        ),
      );
      return true;
    },
    [activeWorkspaceId, setActiveWorkspaceId, workspaces],
  );
  useHardwareKeyboardCommand(ORGANIZATION_WORKSPACE_COMMANDS, switchWorkspace);
}
