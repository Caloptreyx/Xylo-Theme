# Xylo Theme

A remake of the [Calagopus](https://calagopus.com) panel's look: core's sidebar is replaced by an icon rail (areas,
and your servers with your server groups as Discord style folders: drag a server onto another to group them)
beside a collapsible context panel, pages sit on a raised canvas over a slowly drifting aurora backdrop, with glass
surfaces, gradient accents, smooth page transitions, and **Xylo Studio**, a live theme editor that repaints a preview
of the real panel as you change things.

On a phone the rail and panel open from a glass top bar.

Needs panel **1.2.0 or newer**.

## Features

- **Eight presets**: five glass looks (Aurora, Nebula, Lagoon, Verdant, Ember) and three minimal ones (Graphite,
  Mono, Sandstone), plus a palette generator that builds matching accents and tinted neutrals from one hue.
- **Colours**: two accents (the gradient), background, surface and text drive every shade; optional status
  colours and light mode overrides. A contrast check flags pairs below WCAG AA.
- **Backdrop**: aurora, spotlight, mesh or solid, with intensity, slow drift, and a grid, dot or grain texture;
  or your own background image.
- **Surfaces**: glass (opacity and blur), solid or outline cards, edge strength, shadows, corner radii.
- **Layout**: the rail (default) or core's sidebar, floating or docked; pill, glow, bar or subtle current link;
  gradient, solid, soft or outline buttons; glow strength; density and interface size.
- **Servers page**: live totals (servers online, CPU, memory, disk), search, status and group filters, sorting,
  and cards with live usage bars, a copyable address and power controls; select several for bulk power actions.
  Can be switched back to the panel's own list.
- **Type**: Inter, Plus Jakarta Sans, Space Grotesk, Outfit, system or the panel's font, separately for headings;
  heading weight; gradient page titles; JetBrains Mono for code.
- **Motion**: full, subtle or none (reduced motion is always respected); rise, fade or zoom page transitions;
  hover lift on clickable cards; a greeting above the servers list.
- **Studio**: live preview of any page (servers, a server, account, admin, login) at desktop, tablet or phone
  width, in dark or light mode; undo and redo; import and export as JSON; Ctrl/⌘+S to save; a warning when
  someone else saved since you opened it.

Open it from **Admin → Xylo Studio** or the extension's card on **Admin → Extensions**. Saving needs
`settings.update` or the extension's own `xylo-theme.update` admin permission.

## Install

Download `dev_caloptreyx_xylo.c7s.zip` from the releases and add it on **Admin → Extensions**, or build it yourself
with `python3 scripts/package.py`.

## Licence

MIT. The bundled fonts are under the SIL Open Font License, with their licence texts in `frontend/src/fonts`.
