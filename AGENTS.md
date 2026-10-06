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
frontend/src/index.ts             entry: applies the theme, greeting, login preview route, admin route
frontend/src/lib/theme.ts         the theme model, presets, normalizeTheme(), buildCss(), themeAttributes()
frontend/src/lib/color.ts         hex colour maths (mix, contrast, shades, hsl, toHexColor)
frontend/src/lib/store.ts         paints the theme, caches it, the editor's preview bridge, useXyloTheme()
frontend/src/lib/core.ts          every core (`@/`) import, in one place
frontend/src/app.css              static CSS keyed off html's data-xylo-* attributes, fonts
frontend/src/pages/ThemeEditor.tsx  Xylo Studio
frontend/src/elements/editor/     sections (one per editor tab), controls, mocks (the option drawings)
frontend/src/elements/shell/      the rail layout: Shell.tsx (rail, context panel, phone top bar and drawer), nav.ts
frontend/src/elements/Greeting.tsx  the greeting above the servers list
frontend/src/translations.ts      every user facing string (English)
tests/theme.test.ts               node:test cases for lib/theme.ts and lib/color.ts (not shipped)
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

- The rail: app icon, search (core's quick actions store, `setOpen`), Home and Admin (`isAdmin`), the user's first
  8 servers (`getServers(1)`, react-query, tiles coloured from a hash of the name), the panel toggle
  (`xylo:panel` in localStorage) and the account avatar. Home is not lit on `/account` pages; the avatar is.
- The context panel (`id='sidebar-content'`, so app.css's link styles apply) lists `panelNodes(header, children)`:
  core's header and menu flattened (Mint's `flatten`), in core's order, wrappers kept (`ServerCan`, `AdminCan`),
  minus what the rail covers (the logo `NavLink`, `QuickActionsTrigger`, links to `/` and `/admin`) and the plain
  dividers that leaves stranded. Core's footer (server switcher, account menu) stays at its bottom. Nodes are
  matched by component identity, so a core rename shows up as a duplicate, never a missing link.
- Below lg (a `page` container query, like core's) a sticky top bar replaces it; its menu opens rail and panel in a
  Mantine Drawer, closed on navigation and when quick actions open, as core's drawer is.
- app.css makes the router's content column (`.xylo-shell ~ #…-root` or `.xylo-topbar ~ …`, so virtual windows
  without a sidebar are untouched) a rounded canvas (`--xylo-canvas`) with `overflow: clip`, which rounds the
  sticky page headers without making it a scroller. Page tabs (core's SubNavigation and others) become a pill bar.

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
