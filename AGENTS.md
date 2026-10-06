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
frontend/src/index.ts             entry: applies the theme, greeting, servers page, login preview route, admin route
frontend/src/lib/theme.ts         the theme model, presets, normalizeTheme(), buildCss(), themeAttributes()
frontend/src/lib/color.ts         hex colour maths (mix, contrast, shades, hsl, toHexColor)
frontend/src/lib/store.ts         paints the theme, caches it, the editor's preview bridge, useXyloTheme()
frontend/src/lib/core.ts          every core (`@/`) import, in one place
frontend/src/lib/groups.ts        the server group queries the rail and the servers page share
frontend/src/app.css              static CSS keyed off html's data-xylo-* attributes, fonts
frontend/src/pages/ThemeEditor.tsx  Xylo Studio
frontend/src/elements/editor/     sections (one per editor tab), controls, mocks (the option drawings)
frontend/src/elements/shell/      the rail layout: Shell.tsx (context panel, phone top bar and drawer), Rail.tsx (the
                                  rail, folders, drag and drop), nav.ts (core's sidebar nodes), folders.ts (pure rules)
frontend/src/elements/home/       the servers page: Home.tsx (page, HomeSwitch), ServerCard.tsx, home.ts (pure rules)
frontend/src/elements/Greeting.tsx  the greeting above the servers list
frontend/src/translations.ts      every user facing string (English)
tests/*.test.ts                   node:test cases for lib/theme.ts, lib/color.ts, shell/folders.ts, home/home.ts
                                  (not shipped)
scripts/package.py                builds dist/dev_caloptreyx_xylo.c7s.zip
```

## How the theming works

Nothing is baked in at build time. `buildCss(theme)` turns the saved JSON into CSS variables in one
`<style id="xylo-theme">`, and `themeAttributes(theme)` sets `data-xylo-*` attributes on html that pick the
variants in `app.css` (backdrop, texture, surface, sidebar, buttons, current link, motion, transitions). Both are
rewritten only when they change, so the editor repaints its preview live without a reload.

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
  group through `useGroupServers` (lib/groups.ts, the rail's query and cache). Live usage is core's store
  (`serverResourceUsage`); the page subscribes to every node its servers live on while it is open.
- home.ts: `phaseOf` (suspended, failed, installing, restoring, transferring outrank the power state; no usage reads
  offline), the status filters and their counts, the sorts (`xylo:home-sort`), and `summarize` for the stat strip
  (CPU and memory over running servers, disk over all; a 0 limit anywhere makes that total unlimited).
- ServerCard: the name is the link, stretched over the card (`::after`), so the controls above it (`.xylo-home-raise`)
  stay real buttons. Power buttons follow core's rules: the server's permissions plus the role's, nothing while
  installing, restoring, transferring, suspended or in node maintenance; kill only while stopping, confirmed. Power
  goes through core's `useBulkPowerActions` (its toasts), add to group through core's `ServerAddGroupModal`. The
  tile turns into a check box; any selection brings up core's `BulkActionBar`.

## The editor

`/admin/xylo` (permission `settings.read` or `xylo-theme.update`) and the extension's card page. It previews the
panel in an iframe: the frame's Xylo posts `xylo:ready`, the editor posts each draft (`xylo:preview`, debounced
50ms) with the scheme to show. Inside the frame the scheme and the theme cache are never written to localStorage,
which the frame shares with the editor. Auth routes redirect signed in users, so the login preview is core's
`Login` at `/xylo-preview/login`.

Saving sends the loaded `version` as `base`; a 409 offers to load the other save or overwrite it. Saving is off
until the stored theme has loaded. Undo and redo are debounced whole drafts. Colour fields keep half typed text
in the draft; the preview and drawings use the last valid normalized draft.

A new theme field needs: the `XyloTheme` field and default, a line in `normalizeTheme()`, its use in `buildCss()`
or `themeAttributes()` plus `app.css`, a control in a section, its strings, and a test case. Add it to
`PresetLook` only if it is part of a look rather than about the site.

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
