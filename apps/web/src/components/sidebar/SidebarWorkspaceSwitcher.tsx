/**
 * The sidebar's workspace switcher: a card above search naming the active
 * workspace on a tint of its color, opening a menu to switch, create, and
 * manage folders. It is the sidebar's loudest row on purpose: everything below
 * it is filtered by the workspace it names.
 *
 * Absent until the first workspace exists, so the sidebar of someone who
 * never uses workspaces is unchanged; the command palette's "New workspace"
 * is the way in.
 */
import type { OrganizationWorkspaceView } from "@t3tools/client-runtime/state/organization";
import type { OrganizationWorkspace, OrganizationWorkspaceId } from "@t3tools/contracts";
import { ORGANIZATION_WORKSPACE_JUMP_KEYBINDING_COMMANDS } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import {
  ChevronsUpDownIcon,
  FolderIcon,
  FolderPlusIcon,
  PaletteIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { memo } from "react";

import { shortcutLabelForCommand } from "../../keybindings";
import { primaryServerKeybindingsAtom } from "../../state/server";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu";
import { cn } from "~/lib/utils";
import { projectIconColorClassName } from "../../projectIconColors";
import { WorkspaceAvatar } from "../organization/WorkspaceAvatar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export interface SidebarWorkspaceSwitcherProps {
  workspaces: ReadonlyArray<OrganizationWorkspace>;
  activeWorkspace: OrganizationWorkspaceView;
  onSelectWorkspace: (workspaceId: OrganizationWorkspaceId) => void;
  onCreateWorkspace: () => void;
  onEditWorkspace: (workspace: OrganizationWorkspace) => void;
  onDeleteWorkspace: (workspace: OrganizationWorkspace) => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: OrganizationWorkspaceView["folders"][number]["folder"]) => void;
  onDeleteFolder: (folder: OrganizationWorkspaceView["folders"][number]["folder"]) => void;
}

export const SidebarWorkspaceSwitcher = memo(function SidebarWorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
  onEditWorkspace,
  onDeleteWorkspace,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: SidebarWorkspaceSwitcherProps) {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const { workspace, folders } = activeWorkspace;
  const folderCountLabel =
    folders.length === 0
      ? "No folders"
      : folders.length === 1
        ? "1 folder"
        : `${folders.length} folders`;
  const pickerShortcut = shortcutLabelForCommand(keybindings, "organizationWorkspace.picker");
  const projectCount = folders.reduce(
    (count, { memberships }) =>
      count + memberships.filter((membership) => membership.item.kind === "project").length,
    0,
  );
  const summary = [
    folderCountLabel,
    projectCount === 0 ? null : projectCount === 1 ? "1 project" : `${projectCount} projects`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`Workspace: ${workspace.name}. Switch or manage workspaces`}
                  className={cn(
                    // The color token sets currentColor, which tints the card
                    // and ring; the text inside resets to the sidebar's own.
                    "group/workspace flex w-full cursor-pointer items-center gap-2.5 rounded-lg bg-current/10 p-2 text-left outline-none ring-1 ring-current/20 transition-colors hover:bg-current/16 focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-current/18",
                    workspace.color
                      ? projectIconColorClassName(workspace.color)
                      : "text-sidebar-muted-foreground",
                  )}
                />
              }
            />
          }
        >
          <WorkspaceAvatar name={workspace.name} color={workspace.color} icon={workspace.icon} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-base leading-5 font-semibold tracking-tight text-sidebar-foreground">
              {workspace.name}
            </span>
            <span className="truncate text-xs leading-4 text-sidebar-muted-foreground">
              {summary}
            </span>
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-sidebar-muted-foreground group-hover/workspace:text-sidebar-foreground" />
        </TooltipTrigger>
        <TooltipPopup side="right">
          {pickerShortcut ? `Switch workspace (${pickerShortcut})` : "Switch workspace"}
        </TooltipPopup>
      </Tooltip>
      <MenuPopup
        align="start"
        className="w-(--anchor-width) min-w-56 max-w-[min(18rem,var(--available-width))]"
      >
        <MenuGroup>
          <MenuGroupLabel>Workspaces</MenuGroupLabel>
          <MenuRadioGroup
            value={workspace.id}
            onValueChange={(value) => {
              const next = workspaces.find((entry) => entry.id === value);
              if (next) onSelectWorkspace(next.id);
            }}
          >
            {workspaces.map((entry, index) => {
              const jumpCommand = ORGANIZATION_WORKSPACE_JUMP_KEYBINDING_COMMANDS[index];
              const shortcut = jumpCommand
                ? shortcutLabelForCommand(keybindings, jumpCommand)
                : null;
              return (
                <MenuRadioItem key={entry.id} value={entry.id} closeOnClick>
                  <span className="flex w-full min-w-0 items-center gap-2">
                    <WorkspaceAvatar
                      name={entry.name}
                      color={entry.color}
                      icon={entry.icon}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    {shortcut ? <MenuShortcut>{shortcut}</MenuShortcut> : null}
                    <MenuRadioItemIndicator />
                  </span>
                </MenuRadioItem>
              );
            })}
          </MenuRadioGroup>
          <MenuItem onClick={onCreateWorkspace}>
            <PlusIcon />
            New workspace…
          </MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>
            {workspace.name} · {folderCountLabel}
          </MenuGroupLabel>
          {folders.map(({ folder, memberships }) => (
            <MenuSub key={folder.id}>
              <MenuSubTrigger>
                <FolderIcon />
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {memberships.length}
                </span>
              </MenuSubTrigger>
              <MenuSubPopup>
                <MenuItem onClick={() => onRenameFolder(folder)}>
                  <PencilIcon />
                  Rename…
                </MenuItem>
                <MenuItem variant="destructive" onClick={() => onDeleteFolder(folder)}>
                  <Trash2Icon />
                  Delete folder…
                </MenuItem>
              </MenuSubPopup>
            </MenuSub>
          ))}
          <MenuItem onClick={onCreateFolder}>
            <FolderPlusIcon />
            New folder…
          </MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuItem onClick={() => onEditWorkspace(workspace)}>
          <PaletteIcon />
          Edit workspace…
        </MenuItem>
        <MenuItem variant="destructive" onClick={() => onDeleteWorkspace(workspace)}>
          <Trash2Icon />
          Delete workspace…
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
});
