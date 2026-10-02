# Team T3 Code Fork Product Requirements

## Objective

Maintain a shared team fork of [T3 Code](https://github.com/pingdotgg/t3code) that preserves the upstream coding experience while adding organizational workspaces and folders, configurable keyboard navigation, mobile feature parity, and API coverage for the team's software factory.

The registered fork is `luizstacio/t3code`. It remains an upstream fork; changes must stay easy to rebase onto `pingdotgg/t3code`.

## Deployment and releases

- Each teammate runs a Mac desktop client and a T3 Code server as a background service on their own Linux machine.
- Produce matching Mac desktop and Linux server releases. Publish a required server version before clients that depend on it.
- Give the fork an independent app identity, signing configuration, release source, and update feed.
- Preserve in-app desktop updates and the supported **Update server** action, including reconnect and rollback behavior.
- Validate a complete upgrade from an older fork build on a representative Mac-Linux pair before team rollout. Linux-only testing cannot satisfy Mac or device acceptance.
- A single button that updates both machines is not required. Updates may interrupt active work, but existing recovery mechanisms must remain intact.

## Organizational folders

- A folder is a named visual container that may contain multiple repositories and threads. It is not a single-repository project.
- Users can drag items within and between folders and choose their order.
- Moving an item preserves its repository association and execution context.
- Organization and order persist across restarts and supported clients.
- Do not force main-first ordering, automatically pin items, or create special main-branch threads. Existing branch selection is sufficient.

## Organizational workspaces

- A workspace is a named visual container above folders: workspace -> folders -> repositories and threads.
- Workspaces organize content; they are not machine or execution boundaries.
- Personal work and agent activity can be separated into different workspaces.
- Only the active workspace renders. Switching away must not stop agents or server tasks. Switching back restores view state and refreshes activity.

The codebase already uses “workspace” for a checkout/execution directory and for parts of the mobile layout. New code must use `OrganizationWorkspace` internally where ambiguity is possible.

## Keyboard navigation

- Use Orca's Command-and-arrow behavior as the interaction reference.
- Move focus between chat, tabs, and the project sidebar; navigate tabs and sidebar contents; switch organizational workspaces.
- Bindings are configurable, focus is visible, and normal text editing retains native arrow-key behavior.
- Reuse existing actions and keybinding infrastructure before adding commands.
- Expected workspace actions are next, previous, direct selection, and picker. Exact defaults follow a conflict audit.

## Mobile parity

- Mobile exposes the same user-facing organizational workflows, adapted for touch: workspaces, folders, movement and ordering, agent inspection, continuation of work, and active-workspace rendering.
- External-keyboard shortcuts apply where the platform supports them.
- Mobile may ship after desktop/web, but it remains required. Do not claim parity without real device or simulator verification.
- The initial mobile platform and distribution method remain product decisions.

## Software factory API

- Preserve the existing authenticated environment API.
- Expose workspace and folder create, list, read, rename, and delete; membership; repository and thread assignment and movement; order read/write; and associated activity/thread retrieval.
- UI and API operate on the same persistent data. API mutations appear in desktop/mobile clients, and UI mutations are immediately API-readable.
- Apply authentication and authorization to reads and mutations.
- Deleting a folder or workspace deletes only organizational containers and memberships. It must never delete repositories, delete threads, or terminate agents.
- Define compatibility behavior before extending the API contract.

## Acceptance criteria

1. Upgrade an older fork build on Mac and Linux; verify matching versions, reconnection, and saved data.
2. Organize multiple repositories and threads into folders and workspaces; verify persisted movement and user-controlled order.
3. Switch workspaces without stopping work or rendering inactive workspace content.
4. Navigate the approved surfaces with configurable keyboard commands without breaking text editing.
5. Complete the same workflows on desktop and mobile.
6. Create workspaces, folders, assignments, and ordering through the API and observe them in clients; mutate them in a client and read the result through the API.

## Delivery sequence

1. Inspect the checkout, preserve this PRD, record a baseline, and create a phased implementation plan.
2. Establish fork identity and the Mac/Linux build and update pipeline.
3. Add the shared organization model and API, then folders and workspaces.
4. Add keyboard and focus navigation.
5. Complete and verify mobile parity.

Independent product work may continue while signing or distribution credentials are unavailable.

## Material decisions still required

- Product name, bundle/application identifiers, URL scheme, and signing credentials.
- Supported Mac and Linux processor architectures.
- Linux service launcher(s) supported for team rollout.
- Mobile platform order and distribution method.
- Whether a future dedicated software-factory API should supplement the existing authenticated orchestration snapshot/dispatch API.

The fork owner and release repository are resolved as the public GitHub fork `luizstacio/t3code`. Public release hosting is therefore the reversible default unless the team chooses private artifacts.

Organization authority is resolved as the user's primary environment. It owns the event-sourced organization projection; environment-qualified memberships let that one projection organize work from every connected machine. Mobile uses its first enabled connection as that authority until mobile supports an explicit primary connection.
