import type { OrganizationWorkspaceIcon, ProjectIconColor } from "@t3tools/contracts";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { BanIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { create } from "zustand";

import {
  filterProjectIconNames,
  firstEmoji,
  PROJECT_EMOJIS,
  PROJECT_ICON_COLORS,
  projectIconColorClassName,
} from "../../projectIconOptions";
import { cn, randomUUID } from "~/lib/utils";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { WorkspaceAvatar } from "./WorkspaceAvatar";

export interface WorkspaceAppearance {
  readonly name: string;
  readonly color: ProjectIconColor | null;
  readonly icon: OrganizationWorkspaceIcon | null;
}

/** Colors a new workspace cycles through, so neighbors start out distinct. */
export const WORKSPACE_DEFAULT_COLORS: ReadonlyArray<ProjectIconColor> = [
  "blue",
  "violet",
  "pink",
  "orange",
  "green",
  "teal",
  "amber",
  "rose",
];

type Request = {
  readonly id: string;
  readonly mode: "create" | "edit";
  readonly initial: WorkspaceAppearance;
  readonly resolve: (value: WorkspaceAppearance | null) => void;
};
const useRequest = create<{ request: Request | null }>(() => ({ request: null }));

/** Opens the workspace dialog; resolves with the chosen appearance, or null when cancelled. */
export function requestWorkspaceAppearance(
  mode: Request["mode"],
  initial: WorkspaceAppearance,
): Promise<WorkspaceAppearance | null> {
  useRequest.getState().request?.resolve(null);
  return new Promise((resolve) => {
    useRequest.setState({ request: { id: randomUUID(), mode, initial, resolve } });
  });
}

function finish(value: WorkspaceAppearance | null) {
  const request = useRequest.getState().request;
  useRequest.setState({ request: null });
  request?.resolve(value);
}

export function WorkspaceAppearanceDialogHost() {
  const request = useRequest((state) => state.request);
  useEffect(() => () => finish(null), []);
  return request ? <WorkspaceAppearanceDialog key={request.id} request={request} /> : null;
}

type ThumbnailMode = "initials" | "lucide" | "emoji";

function iconLabel(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sameIcon(a: OrganizationWorkspaceIcon | null, b: OrganizationWorkspaceIcon | null) {
  if (a === null || b === null) return a === b;
  if (a.kind === "lucide" && b.kind === "lucide") return a.name === b.name;
  if (a.kind === "emoji" && b.kind === "emoji") return a.emoji === b.emoji;
  return false;
}

function WorkspaceAppearanceDialog({ request }: { request: Request }) {
  const id = useId();
  const { initial } = request;
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [mode, setMode] = useState<ThumbnailMode>(initial.icon?.kind ?? "initials");
  const [iconName, setIconName] = useState<IconName>(
    initial.icon?.kind === "lucide" ? (initial.icon.name as IconName) : "briefcase",
  );
  const [emoji, setEmoji] = useState(initial.icon?.kind === "emoji" ? initial.icon.emoji : "🚀");
  const [query, setQuery] = useState("");
  const [customEmoji, setCustomEmoji] = useState("");
  const icons = useMemo(() => filterProjectIconNames(query), [query]);

  const trimmedName = name.trim();
  const icon: OrganizationWorkspaceIcon | null =
    mode === "lucide"
      ? { kind: "lucide", name: iconName }
      : mode === "emoji"
        ? { kind: "emoji", emoji }
        : null;
  const changed =
    request.mode === "create" ||
    trimmedName !== initial.name.trim() ||
    color !== initial.color ||
    !sameIcon(icon, initial.icon);
  const canSubmit = trimmedName.length > 0 && changed;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) finish(null);
      }}
    >
      <DialogPopup className="w-full sm:w-[32rem]">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) finish({ name: trimmedName, color, icon });
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {request.mode === "create" ? "New workspace" : "Edit workspace"}
            </DialogTitle>
            <DialogDescription>
              {request.mode === "create"
                ? "Workspaces group projects and threads into folders. Switching hides everything outside it from the sidebar."
                : "Change the name, color, and thumbnail shown in the sidebar."}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="flex items-center gap-3">
              <WorkspaceAvatar
                name={trimmedName || "Workspace"}
                color={color ?? undefined}
                icon={icon ?? undefined}
                size="lg"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor={`${id}-name`}>Name</Label>
                <Input
                  id={`${id}-name`}
                  autoFocus
                  required
                  autoComplete="off"
                  placeholder="Client work"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onFocus={(event) => event.target.select()}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Color</div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Workspace color">
                <button
                  type="button"
                  aria-label="No color"
                  aria-pressed={color === null}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border border-transparent text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    color === null && "border-foreground/64",
                  )}
                  onClick={() => setColor(null)}
                >
                  <BanIcon className="size-4" />
                </button>
                {PROJECT_ICON_COLORS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={color === option.value}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      color === option.value && "border-foreground/64",
                    )}
                    onClick={() => setColor(option.value)}
                  >
                    <span className={cn("size-4 rounded-full", option.swatchClassName)} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-3">
              <div className="text-xs font-medium text-muted-foreground">Thumbnail</div>
              <ToggleGroup
                aria-label="Thumbnail type"
                value={[mode]}
                onValueChange={(next) => {
                  const value = next[0];
                  if (value === "initials" || value === "lucide" || value === "emoji")
                    setMode(value);
                }}
              >
                <Toggle value="initials">Initials</Toggle>
                <Toggle value="lucide">Icon</Toggle>
                <Toggle value="emoji">Emoji</Toggle>
              </ToggleGroup>
              {mode === "lucide" ? (
                <>
                  <Input
                    type="search"
                    value={query}
                    aria-label="Search icons"
                    placeholder="Search all icons"
                    onChange={(event) => setQuery(event.currentTarget.value)}
                  />
                  <ScrollArea scrollFade className="max-h-48">
                    <div className="grid grid-cols-8 gap-1 p-0.5 sm:grid-cols-10">
                      {icons.map((entry) => (
                        <button
                          key={entry}
                          type="button"
                          aria-label={iconLabel(entry)}
                          aria-pressed={iconName === entry}
                          className={cn(
                            "flex aspect-square items-center justify-center rounded-md border border-transparent outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                            iconName === entry && "border-border bg-accent",
                            color && projectIconColorClassName(color),
                          )}
                          onClick={() => setIconName(entry)}
                        >
                          <DynamicIcon name={entry} className="size-5" />
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                  {icons.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No icons found.
                    </p>
                  ) : null}
                </>
              ) : mode === "emoji" ? (
                <>
                  <ScrollArea scrollFade className="max-h-48">
                    <div className="grid grid-cols-8 gap-1 p-0.5 sm:grid-cols-10">
                      {PROJECT_EMOJIS.map((option) => (
                        <button
                          key={option.emoji}
                          type="button"
                          aria-label={option.label}
                          aria-pressed={emoji === option.emoji}
                          className={cn(
                            "flex aspect-square items-center justify-center rounded-md border border-transparent text-xl outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                            emoji === option.emoji && "border-border bg-accent",
                          )}
                          onClick={() => setEmoji(option.emoji)}
                        >
                          {option.emoji}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                  <Input
                    value={customEmoji}
                    aria-label="Custom emoji"
                    placeholder="Or paste any emoji"
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setCustomEmoji(value);
                      const next = firstEmoji(value);
                      if (next) setEmoji(next);
                    }}
                  />
                </>
              ) : null}
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => finish(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {request.mode === "create" ? "Create workspace" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
