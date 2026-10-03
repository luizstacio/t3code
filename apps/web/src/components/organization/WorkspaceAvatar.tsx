import type { OrganizationWorkspaceIcon, ProjectIconColor } from "@t3tools/contracts";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

import { projectIconColorClassName } from "../../projectIconColors";
import { cn } from "~/lib/utils";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function workspaceInitials(name: string) {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const first = (word: string) => segmenter.segment(word)[Symbol.iterator]().next().value?.segment;
  const letters =
    words.length > 1
      ? `${first(words[0]!) ?? ""}${first(words[1]!) ?? ""}`
      : Array.from(segmenter.segment(words[0] ?? ""), ({ segment }) => segment)
          .slice(0, 2)
          .join("");
  return letters.toUpperCase();
}

/**
 * A workspace's thumbnail: its icon, emoji, or initials on a tint of its
 * color. Uses the project icon color tokens, so it follows light and dark
 * themes; without a color it takes the surrounding text color.
 */
export function WorkspaceAvatar({
  name,
  color,
  icon,
  size = "md",
  className,
}: {
  name: string;
  color?: ProjectIconColor | undefined;
  icon?: OrganizationWorkspaceIcon | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-current/14 font-semibold tracking-tight select-none",
        color && projectIconColorClassName(color),
        size === "sm" && "size-5 rounded-sm text-3xs [&>svg]:size-3",
        size === "md" && "size-8 rounded-lg text-xs [&>svg]:size-4",
        size === "lg" && "size-12 rounded-xl text-base [&>svg]:size-6",
        className,
      )}
    >
      {icon?.kind === "emoji" ? (
        <span
          className={cn(
            "leading-none",
            size === "sm" ? "text-xs" : size === "md" ? "text-base" : "text-2xl",
          )}
        >
          {icon.emoji}
        </span>
      ) : icon?.kind === "lucide" ? (
        <DynamicIcon name={icon.name as IconName} strokeWidth={2.25} />
      ) : (
        workspaceInitials(name)
      )}
    </span>
  );
}
