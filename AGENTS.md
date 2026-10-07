# Working on this theme

Xylo is a Calagopus Panel extension (`dev.caloptreyx.xylo`, panel **1.2.0 or newer**): a Rust crate that stores
the theme, and a TypeScript frontend the panel compiles into itself.

## Layout

```
Metadata.toml                     package name, display name, panel version range
backend/src/lib.rs                Extension impl: routers, permissions, settings deserializer
backend/src/settings.rs           one opaque setting, `theme` (the editor's JSON, empty for the default look)
backend/src/routes.rs             GET /xylo/theme (public, `{ theme, version }`, ETag, 304) and the admin PUT
backend/src/permissions.rs        the `xylo-theme.update` admin permission; the PUT takes it or settings.update
frontend/src/index.ts             entry: applies the theme, greeting, servers page, server routes, console hooks, login
                                  preview route, admin route
frontend/src/lib/theme.ts         the theme model, presets, normalizeTheme(), buildCss(), themeAttributes()
frontend/src/lib/color.ts         hex colour maths (mix, contrast, shades, hsl, toHexColor)
frontend/src/lib/store.ts         paints the theme (with the visitor's terminal look), caches it, the editor's preview
                                  bridge, useXyloTheme()
frontend/src/lib/core.ts          every core (`@/`) import, in one place
frontend/src/lib/groups.ts        the server group queries the rail and the servers page share
frontend/src/app.css              static CSS keyed off html's data-xylo-* attributes, fonts
frontend/src/pages/ThemeEditor.tsx  Xylo Studio
frontend/src/elements/editor/     sections (one per editor tab), controls, mocks (the option drawings), fields.ts (each
                                  section's theme fields and their search labels)
frontend/src/elements/shell/      the rail layout: Shell.tsx (context panel, phone top bar and drawer), Rail.tsx (the
                                  rail, folders, drag and drop), nav.ts (core's sidebar nodes), folders.ts (pure rules)
frontend/src/elements/home/       the servers page: Home.tsx (page, HomeSwitch), ServerCard.tsx, home.ts (pure rules)
frontend/src/elements/server/     the server overview: Overview.tsx (page, ServerHome), parts.tsx (the usage strip,
                                  connect details, status chip and section card the console page shares), overview.ts
                                  (pure helpers)
frontend/src/elements/console/    the console page: Console.tsx (page, its phone layout, ConsoleSwitch, quick commands),
                                  xterm.ts (hooks into every console's xterm), TerminalButtons.tsx (clear, download,
                                  and TerminalLook.tsx, the visitor's own scheme and frame), console.ts (pure)
frontend/src/elements/Greeting.tsx  the greeting above the servers list
frontend/src/translations.ts      every user facing string (English)
tests/*.test.ts                   node:test cases for lib/theme.ts, lib/color.ts, lib/terminal.ts, shell/folders.ts,
                                  home/home.ts, server/overview.ts, console/console.ts, editor/fields.ts (not shipped)
scripts/package.py                builds dist/dev_caloptreyx_xylo.c7s.zip
```

## How the theming works

Nothing is baked in at build time. `buildCss(theme)` turns the saved JSON into CSS variables in one
`<style id="xylo-theme">`, and `themeAttributes(theme)` sets `data-xylo-*` attributes on html that pick the
variants in `app.css` (backdrop, texture, surface, sidebar, buttons, current link, motion, transitions, terminal
frame). Both are rewritten only when they change, so the editor repaints its preview live without a reload.

- The panel loads every extension's `app.css` even when the extension is disabled, so every rule there is scoped
  to `html[data-xylo…]`, which only a running Xylo sets.
- Selectors in `buildCss` use `html:root` and `html:root[data-mantine-color-scheme=…]` to outrank Mantine's `:root`
  and core's pinned scheme overrides. Colours come from five values (two accents, background, surface, text);
  light mode derives its own palette (`lightBase()`) unless overridden.
- `--button-bg` is the fill Mantine sets inline per colour, so the gradient only replaces accent buttons and the
  soft and outline styles keep red and green buttons their own colour. Text on accent fills is `accentInk()`,
  white or near black, whichever reads on the worst of the fills (both gradient stops with gradient buttons or
  pill links).
- The backdrop is `html::before` (light fields, blurred, drifting with a transform only) and the texture
  `html::after`; body is transparent. Glass blur is applied to outermost cards only; nested cards become wells.
- Page transitions animate the routed page element inside core's Container (`#…-root > div > div:first-child`),
  without fill mode; the editor (fixed, full screen) is excluded because a transform would pin it to the column.
- A first visit with no cached theme hides the page (`data-xylo-pending`) until the fetch settles, at most 1.5s.
- The default look is the Carbon preset (`DEFAULT_THEME` spreads it): off-black, one muted accent whose second
  accent is only a lighter step, solid surfaces, no glow, Geist and Geist Mono. Aurora (the violet to cyan glass
  the theme started with) is a preset, and themes saved before keep their own values. Xylo's own pieces follow
  the `design-taste-frontend` / `redesign-existing-projects` skills (taste-skill, installed for every agent on this
  VM in `~/.agents/skills`, `~/.claude/skills` and `~/.codex/skills`):
  the gradient only where a preset asks for it (buttons, the pill link, the rail's current area), a plain accent
  for bars and tints for chips, gradient text only with "Gradient page titles", sentence case labels instead of
  tracked capitals, no looping animation on idle content (a running server's dot does not pulse), one card per
  group of figures rather than a card per figure, muted server tile colours (`serverTile`, `folderColor`).

**`normalizeTheme()` is the security boundary.** The saved JSON is served to every visitor, the login page
included. Colours must be `#rrggbb`, numbers are clamped, choices are allow listed, `backgroundImage` must pass
`SAFE_URL` (http(s) or root relative, no quotes, parens, semicolons, braces, backslashes or spaces), unknown
fields are dropped. Never put a raw value into CSS or an attribute without it.

## The rail layout

`sidebar: 'rail'` (the default) is a `Sidebar.addRenderInterceptor` (index.ts): `Shell` returns core's element for
the other layouts and on `/oobe` (the setup wizard's sidebar lists its steps), and otherwise renders its own
navigation from the props core gave the Sidebar.

- The rail: app icon, search (core's quick actions store, `setOpen`), Home and Admin (`isAdmin`), the user's server
  groups as folders, then up to 8 servers in no group (`getServers(1)` minus every group's `serverOrder`; tiles
  coloured from a hash of the name), the panel toggle (`xylo:panel` in localStorage) and the account avatar. Home is
  not lit on `/account` pages; the avatar is.
- Folders are core's own server groups (also made on the dashboard's Grouped Servers tab), Discord style: closed, a
  rounded square previewing the first four tiles and ringed while one of its servers is open; open (`xylo:folders`
  in localStorage, uuids), the folder head and its servers on a tinted pill. The rail fetches the groups into core's
  `useUserStore().serverGroups`, which the dashboard edits in place, so renames, reorders, moves and new groups show
  at once; each folder's servers are fetched under `[...queryKeys.user.servers.all(), groupUuid, …]`, the prefix
  core's drag and drop invalidates. Empty groups are hidden.
- Drag and drop (`@dnd-kit/core`, a direct panel dependency; mouse after 6px, touch after a 250ms press): a server
  onto a loose one creates a group of the two ("New group", put after the other folders), onto a folder appends it,
  onto the upper or lower half of a server in an open folder takes that place (a reorder within the folder, or a
  move from elsewhere), onto the free space takes it out; a group emptied that way is deleted, as Discord drops an
  empty folder. A folder (closed, or an open one by its head) dropped on another's upper or lower half reorders the
  folders (`updateServerGroupsOrder`). `dropPart()`/`dropAction()` in folders.ts decide from the target and the
  pointer's place on it, refusing no-ops, a full group or a duplicate as core does; the collision check prefers a
  server over the folder around it over the free space, and a dragged folder only sees folders. A ring marks "onto",
  a bar in the gap marks a place. `useGroupEdits` writes core's store first, then the API, and reloads the groups
  on failure. A drag swallows the click that ends it. A folder's menu (Rename, 2 to 31 characters as core allows;
  Ungroup, confirmed) opens on right click, or when a finger holds a folder and lets go without moving (iOS sends
  no contextmenu).
- The context panel (`id='sidebar-content'`, so app.css's link styles apply) lists `panelNodes(header, children)`:
  core's header and menu flattened (Mint's `flatten`), in core's order, wrappers kept (`ServerCan`, `AdminCan`),
  minus what the rail covers (the logo `NavLink`, `QuickActionsTrigger`, links to `/` and `/admin`) and the plain
  dividers that leaves stranded. What is left of core's header (the server block) is pinned above the scrolling
  menu, as in core's sidebar; core's footer (server switcher, account menu) stays at its bottom. Nodes are
  matched by component identity, so a core rename shows up as a duplicate, never a missing link. The menu and the
  rail's servers fade at an edge while there is more to scroll that way (a scroll driven animation of two
  registered properties, so browsers without it, and lists that don't scroll, show no fade).
- Below lg (a `page` container query, like core's) a sticky top bar (menu, app, search) replaces it; its menu opens
  rail and panel in a Mantine Drawer (`min(340px, 100vw - 3rem)`, the panel filling what the rail leaves), closed
  on navigation and when quick actions open, as core's drawer is.
- app.css makes the router's content column (`.xylo-shell ~ #…-root` or `.xylo-topbar ~ …`, so virtual windows
  without a sidebar are untouched) a rounded canvas (`--xylo-canvas`) with `overflow: clip`, which rounds the
  sticky page headers without making it a scroller. Page tabs (core's SubNavigation and others) become a pill bar.

## The servers page

`homePage` (on by default) replaces core's two server lists (`/` and `/grouped`, or `/all` when grouped is the
start page) with one page. Core's routes are not interceptable, but both lists render `AccountContentContainer`
(hookable) with their own registries: the render interceptor in index.ts matches those registries
(`window.extensionContext…pages.dashboard.home.containerAll`/`containerGrouped`, read at render time) and
`HomeSwitch` clones core's element with `hideTitleComponent` and Xylo's page as its children, so the page title,
padding and every extension's slots (the greeting among them) stay. Core's list component still mounts and fetches
its first page; that is the cost of not owning the route.

- Data: every server the user lists, up to 10 pages of core's 26 (`loadServers`, a note says when there are more);
  an admin's "other users' servers" switch is core's own setting (`useServerListShowOthers`). A group chip shows that
  group through `useGroupServers` (lib/groups.ts, the rail's query and cache). Live state is core's store
  (`serverResourceUsage`); the page subscribes to every node its servers live on while it is open. No resource
  usage on this page, by request: that lives on the server overview.
- home.ts: `phaseOf` (suspended, failed, installing, restoring, transferring outrank the power state; no usage reads
  offline), the status filters and their counts, and the sorts (`xylo:home-sort`).
- ServerCard: the name is the link, stretched over the card (`::after`), so the controls above it (`.xylo-home-raise`)
  stay real buttons. Power buttons follow core's rules: the server's permissions plus the role's, nothing while
  installing, restoring, transferring, suspended or in node maintenance; kill only while stopping, confirmed. Power
  goes through core's `useBulkPowerActions` (its toasts), add to group through core's `ServerAddGroupModal`. The
  tile turns into a check box; any selection brings up core's `BulkActionBar`.

## The server overview

`serverOverview` (on by default) makes Xylo's overview the page a server opens on. A server route interceptor in
index.ts replaces core's console route at `/` with one route whose element is `ServerHome` (the overview, or core's
console when the setting is off, read with the theme hook so Studio switches it live) and whose name and icon are
getters on `currentTheme()` (resolved when the sidebar renders), and adds core's console again at `/terminal`,
filtered to when the overview is on. `/console/popout` keeps no named parent, so it stays reachable. An egg with a
custom sidebar order (egg configurations) lists routes by path: `/` there shows as Overview, and Console appears only
once the admin adds `/terminal` to that order (core's editor lists it, since it runs the interceptors too).

- Data: the server, its power state and its live stats are core's server store (`useServerStore`, fed by the
  server's websocket). Activity, backups, schedules and allocations are fetched under core's query keys plus
  `'xylo-overview'`, so core's own pages' changes refresh them; each needs its page's permission (`useServerCan`)
  and its part is left out without it. Databases are not fetched (core's list includes passwords).
- Power is core's own `ServerPowerControls` (websocket, kill confirmation, other extensions' power buttons).
- overview.ts: `eventLabel` (`server:power.start` reads "Power start"), `timeAgo`, `percentOf`/`levelOf` for the
  bars, `newest`.

## The console

`consolePage` (on by default) replaces core's console page wherever core shows it: `/terminal`, and `/` when the
overview is off. The route interceptor in index.ts gives both a `ConsoleSwitch` around core's element, read with the
theme hook so Studio switches it live; `/console/popout` stays core's.

- The page is terminal first: the name, state chip and uptime with core's `ServerPowerControls` (in core's
  `ServerCan`), one compact usage strip (parts.tsx, the overview's), and core's own terminal component
  (`terminal/Console.tsx`: search, history, SSH, popout, features, input row slots). The terminal runs from where it
  starts (`--xylo-con-top`, measured when the header or window resizes) to the viewport's bottom, at least 20rem,
  and shrinks above the on-screen keyboard as core's does (`useVisualViewportBottomInset`). It is wrapped in
  `ServerContentContainer` with core's title and container registry, so other extensions' container slots stay.
- The details panel (toggle in the header, `xylo:console-panel` in localStorage): beside the terminal from 80rem of
  page width, as tall as it and scrolling on its own (`contain: size`), under it below that. It holds the connect
  details, quick commands, and core's `statCards` and `statBlocks` slots, so other extensions' cards still show.
  Core's three charts are dropped.
- Phones (a `page` container under 64rem, the shell's top bar width): `usePhone` measures it as core's
  `usePageBreakpoint` does (the virtual window, else the body; that hook only exists from panel 1.2.2, and biome
  bans `useMediaQuery`) and sets `data-phone`, and app.css's rules for it sit in `@container page (width < 64rem)`.
  A page of its own: the name (truncated) and state chip over the uptime, with a Details button instead of the
  panel toggle; core's power buttons as one row of equal buttons (CSS on core's markup); the usage strip as one line
  of figures scrolling sideways, with hairline bars; the saved quick commands as a row of chips above the terminal,
  the last one opening the sheet at them; the terminal out to the canvas's edges (`--xylo-con-bleed`, core's `px-4`)
  with a smaller radius, and core's terminal header in one row, its buttons 40px and scrolling sideways when they
  don't fit. Details is a Mantine `Drawer` from the bottom (as tall as its content, at most 85dvh, safe area padded)
  holding what the panel holds; the slots mount there only, never with the panel. Buttons and chips are at least
  40px; nothing depends on hover.
- Quick commands: per server and browser (`xylo:commands:<uuid>`), at most 20 of 200 characters, one line each,
  validated on read (console.ts). `useQuickCommands` reads them through `useSyncExternalStore`, so the chips, the
  sheet and the panel stay in step (a list storage refuses is kept for that load). Shown only with
  `control.console`; a click sends one over the server's websocket (`SocketRequest.SEND_COMMAND`) while it is
  connected and the server is not offline.
- xterm.ts hooks every console, core's page and the popout included (`pages.server.console.xterm`): the init handler
  sets the mono font (`MONO_STACKS`, core's when 'panel'), the line height and the palette (`terminalPalette`, with a
  transparent background: app.css paints `--xylo-term-bg` on the card holding `.xterm` while `data-xylo-terminal`
  is 'custom'). Core reassigns `term.options.theme` on every scheme change, so `theme` is redefined on that
  terminal's options object (xterm 6 defines each key as a configurable accessor): core's value is kept and Xylo's
  palette over it goes through, or core's own with the 'panel' scheme. A scheme attribute observer reapplies in case
  that fails. `subscribeTheme` reapplies colours, font and line height on every theme change (Studio's drafts too),
  then Xylo's own FitAddon refits; a web font that loads after the terminal opened triggers a remeasure.
- With `consoleHighlight`, `term.write` is wrapped so new uncoloured warning and error lines are tinted
  (lib/terminal.ts). Clear and download (`<server>-<date and time>.log`, the active buffer as plain text with soft
  wrapped rows joined) are core header buttons (`terminalHeaderRightComponents`), finding their terminal through
  the card they sit in.
- Frames (`terminalSkin`, `data-xylo-term-skin`; app.css's "terminal frames" section) style the card holding
  `.xterm`, so core's console and the popout wear them too: card (plain), window (a title bar of `::before` dots,
  core's header moved down by a margin, since core's `p-2!` is a layered `!important`), flush (no card: 'theme' and
  'panel' on the canvas, a named scheme on its own background, `--xylo-term-flush`), glass (the scheme's background
  translucent, `--xylo-blur`), crt (scanlines and vignette in a `::after` that clicks pass through, text glow on the
  DOM renderer's row spans, still; `--xylo-term-scan/vignette/glow` from buildCss are faint on a light screen), neon
  (accent outline and glow). They paint with currentColor and fall back to the card's colour without
  `--xylo-term-bg`, so each works with every scheme in both modes. The selectors double the html attribute to outrank
  the glass surfaces' blur rule.
- Personal looks (`terminalUserChoice`, on by default): a palette button in core's terminal header (TerminalLook.tsx,
  rendered by TerminalButtons) opens a popover of every scheme (grouped as `TERMINAL_SCHEME_GROUPS`) and frame, "Site
  default" first in each. The pick is this browser's: `xylo:terminal` in localStorage, `{ scheme?, skin? }`, allow
  listed on read (`parseTerminalPrefs`, lib/terminal.ts). lib/store.ts keeps the theme it was given as `base` and
  paints `withTerminalPrefs(base, prefs)`; `setTerminalPrefs` repaints and notifies, so xterm.ts recolours at once,
  and a `storage` event carries a pick to the other windows (the popout). The editor's preview frame ignores the
  visitor's pick (`inPreviewFrame`): drafts show the admin's choice, and the popover says so there.

## The editor

`/admin/xylo` (permission `settings.read` or `xylo-theme.update`) and the extension's card page. It previews the
panel in an iframe: the frame's Xylo posts `xylo:ready`, the editor posts each draft (`xylo:preview`, debounced
50ms) with the scheme to show. Inside the frame the scheme and the theme cache are never written to localStorage,
which the frame shares with the editor. Auth routes redirect signed in users, so the login preview is core's
`Login` at `/xylo-preview/login`.

Saving sends the loaded `version` as `base`; a 409 offers to load the other save or overwrite it. Saving is off
until the stored theme has loaded. Undo and redo are debounced whole drafts. Colour fields keep half typed text
in the draft; the preview and drawings use the last valid normalized draft.

- Sections: `SECTION_FIELDS` (elements/editor/fields.ts) lists each tab's theme fields with the label the search
  shows; every field belongs to exactly one tab (a test checks it). It drives the dot on a tab whose fields differ
  from the saved theme, "Reset section" (that tab's fields back to `DEFAULT_THEME`, one undo step; not on Presets)
  and the settings search above the tab: every control carries its field as `data-xylo-setting`, and picking a
  result opens its tab, scrolls the control into view and lights it once. A control hidden by another setting (blur
  without glass) just opens the tab.
- Compare: holding the compare button (pointer, Space or Enter) sends the saved theme to the frame, letting go the
  draft again; it is off while nothing is unsaved.
- Custom presets (`customPresets`): "Save current look" stores `pickLook()` of the draft under a name (`presetName()`,
  unique, at most `MAX_CUSTOM_PRESETS`). They are saved, undone, exported and imported with the theme like any field,
  so every visitor's theme JSON carries them; they hold looks only. "Reset to the default look" keeps them.
- The preview's page picker lists the first server's overview and console (`/terminal` while the overview is on,
  otherwise the console is the server's own page).
- The Console tab: Xylo's console page, the terminal scheme in groups (matched to the panel, dark, light, retro;
  each tile a `TerminalMock` of `terminalPalette()` in dark mode; Panel drawn as core's, on the surface), the frame
  (`TerminalSkinMock`, the draft's scheme in each frame), whether visitors may pick their own, line height and log
  highlighting. The code font stays under Type.

A new theme field needs: the `XyloTheme` field and default, a line in `normalizeTheme()`, its use in `buildCss()`
or `themeAttributes()` plus `app.css`, a control in a section (with its `field`), its entry in `SECTION_FIELDS`, its
strings, and a test case. Add it to `PresetLook` only if it is part of a look rather than about the site.

## Constraints

- The panel's CSP allows fonts from `'self'` only: fonts ship in `frontend/src/fonts` (OFL). No Google Fonts.
- Extension frontends may only import the panel's direct dependencies; core imports go through `lib/core.ts`.
- Every user facing string goes through `translations.ts`.
- The panel builds with the React Compiler; keep components pure.

## Verifying a change

`node --test "tests/*.test.ts"` runs the model tests. Everything else runs in CI: `.github/workflows/check.yml`
calls the org's shared extension check, which stages the extension into the newest panel release and runs
typecheck, biome, the frontend build, the node tests and `cargo test -p dev_caloptreyx_xylo`. Push and read that
run; do not build the panel on the development VM.

For a quick visual check against the local dev panel, bind mount (not symlink: vite resolves `shared` from the
real path) `frontend/` at `calagopus-dev/frontend/extensions/dev_caloptreyx_xylo` and run vite there; the backend
routes only exist in a panel built with the extension.

Package with `python3 scripts/package.py` and check with `panel-rs extensions inspect`.
