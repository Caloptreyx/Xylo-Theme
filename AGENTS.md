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
frontend/src/lib/tiles.ts         server tiles: the default look, each user's own look (normalizeTiles(), pure)
frontend/src/app.css              static CSS keyed off html's data-xylo-* attributes, fonts
frontend/src/pages/ThemeEditor.tsx  Xylo Studio
frontend/src/elements/editor/     sections (one per editor tab), controls, mocks (the option drawings), fields.ts (each
                                  section's theme fields and their search labels)
frontend/src/elements/shell/      the rail layout: Shell.tsx (context panel, phone top bar and drawer), Rail.tsx (the
                                  rail, folders, drag and drop), nav.ts (core's sidebar nodes), folders.ts (pure rules)
frontend/src/elements/home/       the servers page: Home.tsx (page, HomeSwitch), ServerCard.tsx, home.ts (pure rules)
frontend/src/elements/tiles/      server tiles everywhere: useTiles.ts (the user setting), TileFace.tsx (icons, the
                                  glyph, a lone tile, the console's heading), TileEditor.tsx ("Customize tile")
frontend/src/elements/server/     the server overview: Overview.tsx (page, ServerHome), parts.tsx (the usage strip,
                                  status chip, section card, and the connect details the console's inspector shares),
                                  overview.ts (pure helpers)
frontend/src/elements/console/    the console page: Console.tsx (the workspace, ConsoleSwitch), Telemetry.tsx (the
                                  command bar's figures), Inspector.tsx, QuickCommands.tsx (chips, the list, their
                                  storage), xterm.ts (hooks into every console's xterm), TerminalButtons.tsx (clear,
                                  download, and TerminalLook.tsx, the visitor's own scheme and frame), console.ts and
                                  telemetry.ts (pure)
frontend/src/elements/Greeting.tsx  the greeting above the servers list
frontend/src/translations.ts      every user facing string (English)
tests/*.test.ts                   node:test cases for lib/theme.ts, lib/color.ts, lib/terminal.ts, lib/tiles.ts,
                                  shell/folders.ts, home/home.ts, server/overview.ts, console/console.ts,
                                  console/telemetry.ts, editor/fields.ts (not shipped)
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
  groups as folders, then up to 8 servers in no group (`getServers(1)` minus every group's `serverOrder`), the panel
  toggle (`xylo:panel` in localStorage) and the account avatar. Home is not lit on `/account` pages; the avatar is.
- Server tiles (lib/tiles.ts, elements/tiles/): by default the initials on a muted gradient of a hue hashed from the
  real name (`serverTile`). Each user may give a server their own name (1 to 32 characters, one line, no control
  or bidi characters), icon (`TILE_ICONS`, FontAwesome solid, mapped in TileFace.tsx; or the initials) and colour
  (`TILE_SWATCHES`, the tiles' own range, or any `#rrggbb`), in core's user settings, account scope, under
  `xylo::server_tiles` (uuid to `{ name?, color?, icon? }`, at most 300 servers, the oldest edit dropped). Core's
  `useUserSetting` reads it through a zod schema that is `normalizeTiles()`, so a missing or malformed value reads as
  defaults. Core's setter only logs a refusal (a value over the panel's size limit, 16 KiB by default; an
  impersonating admin), so `useSaveTile` shows the new map at once from its own pending copy, sends it with
  `updateUserSettings`, then hands it to core's store (`setUserSetting`, which syncs it once more); a refusal drops
  the pending copy, so the saved map shows again, with core's toast. The look applies to rail tiles, folder previews
  and the drag ghost, the servers page cards, the overview header and the console's command bar; tooltips and menus
  use the custom name; core's own UI keeps the real one. "Customize tile" (TileEditor.tsx: live preview, name with
  the real one as placeholder, searchable icon grid, swatches and a custom hex, Reset to default) opens from a rail
  tile's menu, a servers page card's menu and the overview header's tile.
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
  Ungroup, confirmed) and a server's (Customize tile) open on right click, or when a finger holds one and lets go
  without moving (iOS sends no contextmenu).
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
  stay real buttons. A name of the user's own (server tiles, above) is the title, the real one quiet before the game;
  the search matches both and the name sort uses the shown one. Power buttons follow core's rules: the server's
  permissions plus the role's, nothing while installing, restoring, transferring, suspended or in node maintenance;
  kill only while stopping, confirmed. Power goes through core's `useBulkPowerActions` (its toasts), add to group
  through core's `ServerAddGroupModal`. The tile turns into a check box; any selection brings up core's
  `BulkActionBar`.

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
  and its part is left out without it, and nothing is fetched for a block the theme hides. Databases are not
  fetched (core's list includes passwords).
- Power is core's own `ServerPowerControls` (websocket, kill confirmation, other extensions' power buttons).
- The theme shapes the page, read with `useXyloTheme()` so Studio's preview follows each draft:
  `overviewSections` (the blocks usage, activity, connect and glance, in order; one left out is hidden; allow listed
  and de-duplicated, order kept), `overviewLayout` (`overviewRows` in overview.ts: 'split', today's, gives usage a
  row and sets activity beside a narrower stack of the blocks listed next to it, on the side it was listed; 'stacked'
  is one block a row; 'wide' gives usage and activity rows and pairs neighbouring connect and glance cards at equal
  widths; every row is one column under 64rem), `overviewUsage` ('bars' against the limits; 'graphs', sparklines of
  the last minute from the console's `useTelemetry` and `sparkPath`, the network then as rates; 'numbers', the
  figures alone and larger), `overviewActivityCount` (3 to 20 of the 25 core's first page holds),
  `overviewHeader` ('plain', or 'banner': the head in a card tinted with the accent and a larger tile; the tint runs
  between the two accents only with gradient buttons) and `overviewDescription`.
- overview.ts: `eventLabel` (`server:power.start` reads "Power start"), `timeAgo`, `percentOf`/`levelOf` for the
  bars, `newest`, `overviewRows`.

## The console

`consolePage` (on by default) replaces core's console page wherever core shows it: `/terminal`, and `/` when the
overview is off. The route interceptor in index.ts gives both a `ConsoleSwitch` around core's element, read with the
theme hook so Studio switches it live; `/console/popout` stays core's. The page's own settings (`consoleMetrics`,
`consoleGraphs`, `consoleInspector`, `consoleInspectorOpen`, `consoleDensity`, `consoleQuickCommands`,
`consoleCommands`) are read with `useXyloTheme()` in the components, so Studio's preview follows each draft.

- The page is one workspace: a single surface (`.xylo-con`) from where it starts (`--xylo-con-top`, measured when the
  page's height or the window changes) to the viewport's bottom, at least 24rem, shrinking above the on-screen
  keyboard as core's terminal does (`useVisualViewportBottomInset`); no cards around or inside it. It is wrapped in
  `ServerContentContainer` with core's title and container registry, so other extensions' container slots stay.
  Core's three charts are dropped.
- The command bar (its top strip): the name (truncated), the state as text in its status colour (`phaseOf`, the
  status chip's colours) and the uptime while it runs; the telemetry (Telemetry.tsx: the figures of
  `consoleMetrics`, of CPU, memory, disk, network in and out as rates, in `CONSOLE_METRICS` order, each a dimmed
  label, a tabular value and a sparkline of the last 60 samples, limits and totals in the title; flat and muted
  while offline; none leaves the telemetry out and the bar closes up); core's `ServerPowerControls` (in core's
  `ServerCan`) restyled as one segmented group by CSS on core's markup; the inspector toggle. One row, two (figures
  under) when the workspace is under 60rem (`@container xylo-con`; the grid drops the missing figures or toggle by
  `:has`). The sparkline style is `consoleGraphs` (`data-graph` on the figures): 'area' (the line over a faint
  fill, the default), 'line', 'bars' (thin columns) or 'none' (label over value only). `useTelemetry` subscribes
  to core's server store (`useServerStoreApi`) and feeds telemetry.ts: `pushSample` (a 60 sample window), `ratesOf`
  (bytes per second from the running totals, none across a restart), `withReading` (an offline reading starts the
  curves over, the disk's excepted), `sparkPath` (the line and area paths, newest sample at the right edge, scaled to
  the limit or the largest sample) and `sparkBars` (`BARS` columns, each the highest of its share of the samples,
  half a slot wide, a one unit stub for nothing; same scale). Studio's graph drawings use the same builders.
- Spacing: `consoleDensity` (`data-density` on the workspace) sets CSS variables there (`--xylo-con-edge`, the inset
  every row starts at, and the bar's padding, gap and control height, the toolbar's, chip row's and prompt's heights;
  'comfortable' is the original spacing). Phones keep their own touch sizes.
- Core's own terminal (`terminal/Console.tsx`: search, history, SSH, popout, features, input row slots) fills the
  middle. Its card is `display: contents` inside `.xylo-con-term`, so its children lay out in that column: the header
  is a slim toolbar (its connection dot small and still), the output inset, the input row (`order: 2`) a prompt along
  the bottom edge (a `›` cue, or core's prefix button where the panel has one, 1.2.4; mono, no box, focus lights its
  edge), and the quick command chips (`order: 1`) just above it. xterm.ts and TerminalButtons still find the card.
- The workspace paints the scheme (`--xylo-term-bg`, the solid card colour with 'panel') and, with a named scheme,
  sets Mantine's text, dimmed, default and border colours and `--xylo-hairline` from it, so a dark scheme in light
  mode (or the reverse) reads; the bar and the inspector sit a step off it (the scheme's text mixed in).
- The inspector (Inspector.tsx): tabs Connect (the description, then parts.tsx's `ConnectDetails`), Commands (with
  `control.console` and `consoleQuickCommands`) and More (core's `statCards` and `statBlocks` slots, only when one
  is filled; mounted while that tab shows). It sits on the `consoleInspector` side ('right', or 'left': `data-side`
  on the workspace) or is 'off': no column, toggle, sheet, edit chip or personal commands (the site's still show).
  From 80rem of page width (`usePageSize`, measured as core's `usePageBreakpoint` does: the virtual window, else
  the body; that hook only exists from panel 1.2.2, and biome bans `useMediaQuery`) it docks as a 20rem column
  behind a hairline and the terminal narrows; open state in `xylo:console-panel` ('shown' or 'hidden', written when
  the visitor toggles it), else `consoleInspectorOpen` (open by default). Below, it slides over the terminal from
  its side's edge (transform and opacity; none with the motion setting off or reduced motion), opens on demand only,
  and closes on Escape and a press outside it (toggles and portals excepted).
- Phones (`data-phone` under 64rem, the shell's top bar width): the workspace bleeds to the canvas's edges (core's
  `px-4` and `mb-4`), the bar is identity and the inspector button, power a full width segmented row, the figures
  one sideways scrolling line with smaller sparklines (power and figures hide while the keyboard is up); the
  toolbar's buttons 40px scrolling sideways; the prompt at 16px so the browser doesn't zoom. The inspector is a
  Mantine `Drawer` from the bottom (at most 85dvh, safe area padded) with the same tabs, on either side setting.
  Touch targets are at least 40px; nothing depends on hover.
- Quick commands (`consoleQuickCommands`, on by default; off hides the chip row and the Commands tab): the site's
  (`consoleCommands`, set in Studio: control characters dropped, trimmed, 1 to 200 characters, unique, at most 12,
  by normalizeTheme()'s `siteCommand()`) first, then the visitor's own, per server and browser
  (`xylo:commands:<uuid>`), at most 20 of 200 characters, one line each, validated on read (console.ts); an own one
  the site already has is not shown twice, nor can it be added. Site chips carry `data-site` (a faint accent edge
  and cue) and the inspector lists them under their own heading without a remove button. `useQuickCommands` reads
  the own ones through `useSyncExternalStore`, so the chips and the inspector stay in step (a list storage refuses
  is kept for that load). Shown only with `control.console`; a click sends one over the server's websocket
  (`SocketRequest.SEND_COMMAND`) while it is connected and the server is not offline, the disabled chips' title
  saying why. The last chip opens the inspector at Commands; with no own commands saved it is labelled.
- xterm.ts hooks every console, core's page and the popout included (`pages.server.console.xterm`): the init handler
  sets the mono font (`MONO_STACKS`, core's when 'panel'), the line height and the palette (`terminalPalette`, with a
  transparent background: app.css paints `--xylo-term-bg` on the card holding `.xterm`, or on Xylo's workspace,
  while `data-xylo-terminal` is 'custom'). Core reassigns `term.options.theme` on every scheme change, so `theme` is
  redefined on that terminal's options object (xterm 6 defines each key as a configurable accessor): core's value is
  kept and Xylo's palette over it goes through, or core's own with the 'panel' scheme. A scheme attribute observer
  reapplies in case that fails. `subscribeTheme` reapplies colours, font and line height on every theme change
  (Studio's drafts too), then Xylo's own FitAddon refits; a web font that loads after the terminal opened triggers a
  remeasure.
- With `consoleHighlight`, `term.write` is wrapped so new uncoloured warning and error lines are tinted
  (lib/terminal.ts). Clear and download (`<server>-<date and time>.log`, the active buffer as plain text with soft
  wrapped rows joined) are core header buttons (`terminalHeaderRightComponents`), finding their terminal through
  the card they sit in.
- Frames (`terminalSkin`, `data-xylo-term-skin`; app.css's "terminal frames" section) style the card holding
  `.xterm` on core's console and the popout, and the whole workspace on Xylo's page (the card rules that would draw
  around the dissolved card skip `.xylo-con-term > *`): card (plain), window (core's card: a title bar of `::before`
  dots, core's header moved down by a margin, since core's `p-2!` is a layered `!important`; the workspace: the dots
  at the left of the command bar, which turns title bar), flush (no surface: 'theme' and 'panel' on the canvas, a
  named scheme on its own background, `--xylo-term-flush`), glass (the scheme's background translucent,
  `--xylo-blur`), crt (scanlines and vignette in a `::after` that clicks pass through, over the workspace's terminal
  column; text glow on the DOM renderer's row spans, still; `--xylo-term-scan/vignette/glow` from buildCss are faint
  on a light screen), neon (accent outline and glow, the workspace's edge). They paint with currentColor and fall
  back to the card's colour without `--xylo-term-bg`, so each works with every scheme in both modes. The selectors
  double the html attribute to outrank the glass surfaces' blur rule.
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
- The Server page tab: Page (`serverOverview`, moved here from Layout), then, only while the overview is on, Blocks
  (`BlockList` in sections.tsx: a switch and move up and down buttons per block, those on in order, then those off;
  one switched on joins the end), Layout (each tile an `OverviewLayoutMock` of the draft's blocks laid out by
  `overviewRows`), Usage figures (`OverviewUsageMock`, the graphs drawn with telemetry.ts's `sparkPath`) with the
  activity entries slider, and Header (`OverviewHeaderMock`) with the description switch.
- The Console tab: Page (Xylo's console page, and with it its spacing), then, only while that page is on, Command
  bar (the figures as toggle chips, `ToggleChips`; the graph style, each tile a `ConsoleGraphMock` drawn with
  telemetry.ts's builders), Inspector (the side, each tile a `ConsoleInspectorMock` of the workspace's layout; open
  by default unless 'off') and Quick commands (the switch, and the site's commands as an editable list: add with
  Enter or the button, move up and down, remove, with normalizeTheme()'s limits and a count); then the terminal
  scheme in groups (matched to the panel, dark, light, retro; each tile a `TerminalMock` of `terminalPalette()` in
  dark mode; Panel drawn as core's, on the surface), the frame (`TerminalSkinMock`, the draft's scheme in each
  frame), whether visitors may pick their own, line height and log highlighting. The code font stays under Type.

A new theme field needs: the `XyloTheme` field and default, a line in `normalizeTheme()`, its use in `buildCss()`
or `themeAttributes()` plus `app.css` (or in a component, read with `useXyloTheme()`), a control in a section (with
its `field`), its entry in `SECTION_FIELDS`, its strings, and a test case. `sameTheme()` compares list fields by
value. Add it to `PresetLook` only if it is part of a look rather than about the site.

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
