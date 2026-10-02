# Team Fork Implementation Plan

This plan is based on checkout `b33eda139` from the public fork `luizstacio/t3code` on 2026-10-01.

## Baseline audit

- Release infrastructure already builds signed-capable Mac desktop artifacts and versioned Linux CLI archives, publishes updater metadata, orders server artifacts before dependent clients, and supports launcher rollback/reconnect. Desktop publish metadata already follows `GITHUB_REPOSITORY`.
- The server's default CLI release URLs and install scripts still point at `pingdotgg/t3code`. Desktop app identity, product name, data paths, protocol, and mobile identifiers still use upstream identity.
- The authenticated HTTP API exposes orchestration shell/thread snapshots and generic command dispatch under read/operate scopes. WebSocket shell events keep web and mobile projections live.
- Projects and threads are event-sourced and SQLite-projected. No organizational workspace/folder entities exist. Thread pin and active order already use persistent fractional string keys.
- Web/desktop keybindings are configurable. Mobile has command-palette and thread number shortcuts, but not equivalent configurable focus/workspace navigation.
- Mobile is still documented as development-only and requires an Expo development client.
- The checkout started clean and detached; work now lives on `codex/team-workspaces-foundation`. The documented `vp` harness and dependencies were absent at baseline, so no test result is claimed until installation succeeds.
- The GitHub fork currently has no Actions secrets, Actions variables, or releases. The upstream release workflow also depends on Blacksmith/macOS/ARM runners, production relay state, the upstream npm namespace, Vercel, AUR, and Windows jobs. A team release lane must select supported architectures/runners and exclude unrelated publishers before even an unsigned rehearsal can run; signing and notarization still require credentials.

## Phase 1: fork release foundation

1. Retarget server release discovery, install scripts, generated package links, and package metadata to `luizstacio/t3code`.
2. Keep the existing exact-version server archive, checksum, launcher preflight, rollback, and reconnect paths unchanged.
3. After product identity is chosen, replace the desktop/mobile bundle IDs, product names, data directories, protocol handlers, signing/notarization setup, and release branding together. Add explicit migration/import behavior rather than silently sharing upstream application data.
4. Select the release matrices from the team's actual Mac/Linux architectures. Run unsigned preview artifacts first; enable signing only after credentials exist.
5. Verify release ordering in CI, then validate an older-fork -> new-fork update on a representative Mac-Linux pair before rollout.

Exit: independent artifacts and feeds install side-by-side with upstream, a Linux server update reconnects clients or rolls back, and the Mac-Linux upgrade acceptance passes.

## Phase 2: organization model and API

1. Define environment-qualified organization references so folders can preserve execution context and are not mistaken for projects or checkout workspaces.
2. Store organization events and projection in the primary environment. Environment-qualified memberships provide the cross-environment view without a second service or client-only store.
3. Reuse the existing event/receipt, snapshot, HTTP auth scope, and WebSocket projection paths. Add workspace, folder, and membership projections with fractional order keys; do not create a parallel client-only store.
4. Implement create/list/read/rename/delete, assignment/movement, and order mutations as one service used by HTTP, WebSocket/RPC, MCP/software-factory tools, and clients.
5. Make container deletion transactional and non-destructive: remove child containers/memberships only. Existing projects, threads, sessions, and agents remain untouched.
6. Add focused migration, authorization, projection, live-update, and API/UI round-trip tests.

Exit: API-created organization is visible live in clients, client mutations are API-readable, order persists, and deleting containers cannot delete work or stop agents.

## Phase 3: web and desktop organization UI

1. Add one default workspace/folder migration so existing projects and threads remain visible. Preserve current order; do not synthesize main-first, pins, or special threads.
2. Filter sidebar rendering to the active workspace and folder tree. Keep agent/server subscriptions alive while inactive React subtrees unmount.
3. Reuse the installed drag-and-drop stack and existing fractional ordering planner for workspace, folder, project, and thread movement.
4. Persist per-workspace view state (selection, expansion, scroll, and active thread where valid) and refresh from the live projection when returning.
5. Expose create, rename, move, reorder, and delete/reassign flows with keyboard-accessible controls and explicit non-destructive deletion copy.

Exit: multiple repositories/threads can be arranged across folders/workspaces, state survives refresh, and inactive workspaces do not render or stop background work.

## Phase 4: keyboard and focus navigation

1. Inventory current commands and contexts, then add only missing focus, tab, sidebar-item, and workspace actions.
2. Route all entry points through shared actions: keybindings, command palette, menus, and external-keyboard commands.
3. Add conflict-safe defaults modeled on Orca after auditing macOS, browser, terminal, composer, and accessibility behavior. Editable and terminal focus keep native arrow keys.
4. Add visible roving focus and focused-item activation without coupling focus to selection.

Exit: every navigation action is configurable, discoverable, visibly focused, and covered by focused logic/interaction tests.

## Phase 5: mobile parity

1. Reuse the shared organization projection and mutation service in React Native; add touch movement/reordering and workspace switching.
2. Render only the active organizational workspace while preserving connection and agent activity state.
3. Extend hardware-keyboard commands where iOS/Android support them.
4. Audit the remaining upstream desktop/mobile feature gaps and classify each as implemented, platform-adapted, or explicitly unsupported.
5. Verify on the selected simulator/device and chosen distribution channel. Do not infer device parity from shared TypeScript tests.

Exit: the required organization and agent workflows pass on the selected mobile targets, with a documented parity audit.

## Implemented foundation

1. Save the approved PRD and this checkout-backed plan.
2. Retarget the unambiguous fork release sources to `luizstacio/t3code` and test them.
3. Added workspace, folder, and membership commands/events, SQLite projection, authenticated snapshot/dispatch API coverage, shell streaming, and non-destructive cascade tests.
4. Added active-workspace filtering and switching on web/desktop and mobile without stopping environment subscriptions. Web supports workspace/folder CRUD and project/thread assignment; mobile supports creation, switching, and thread assignment.
5. Added configurable previous/next/direct/picker workspace commands, web command-palette actions, and mobile command-palette plus native external-keyboard switching.
6. App identity, signing, architecture matrices, distribution, full folder rendering/reordering, broader focus navigation, and device acceptance remain open.
