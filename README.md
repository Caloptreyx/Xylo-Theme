# Xylo Theme

A remake of the [Calagopus](https://calagopus.com) panel's look: core's sidebar is replaced by an icon rail (areas,
and your servers with your server groups as Discord style folders: drag a server onto another to group them)
beside a collapsible context panel, pages sit on a raised canvas, the servers page shows live usage, and **Xylo
Studio**, a live theme editor, repaints a preview of the real panel as you change things.

The default look, Carbon, is quiet on purpose: an off-black base, one muted accent, solid surfaces and Geist. The
glass looks (Aurora's drifting violet and cyan, and the rest) are a click away in Studio.

On a phone the rail and panel open from a top bar.

Everyone can give a server their own tile (an icon, a colour, a name only they see), from the rail tile's or the
server card's menu or the overview header; it follows their account to every device.

Needs panel **1.2.0 or newer**.

## Features

- **Nine presets**: four minimal looks (Carbon, the default, Graphite, Mono, Sandstone) and five glass ones (Aurora,
  Nebula, Lagoon, Verdant, Ember), plus a palette generator that builds matching accents and tinted neutrals from one
  hue.
- **Colours**: two accents (the gradient), background, surface and text drive every shade; optional status
  colours and light mode overrides. A contrast check flags pairs below WCAG AA.
- **Backdrop**: aurora, spotlight, mesh or solid, with intensity, slow drift, and a grid, dot or grain texture;
  or your own background image.
- **Surfaces**: glass (opacity and blur), solid or outline cards, edge strength, shadows, corner radii.
- **Layout**: the rail (default) or core's sidebar, floating or docked; pill, glow, bar or subtle current link;
  gradient, solid, soft or outline buttons; glow strength; density and interface size.
- **Servers page**: search, status and group filters, sorting, and cards with status, uptime, a copyable address
  and power controls; select several for bulk power actions. Can be switched back to the panel's own list.
- **Server overview**: a server opens on its status, live CPU, memory, disk and network, recent activity, how to
  connect (address, SFTP, ID) and its backups, schedules and addresses at a glance; the console is the next link.
  Studio's Server page tab picks its blocks and their order, the layout, bars, graphs or plain figures for usage, how
  much activity, a plain or banner header and the description, or switches it off.
- **Console**: one full height workspace with live figures, the terminal, quick commands and the server's details.
  In Studio: which figures show and their graph style (area, line, bars or none), the inspector on the right, the
  left or off and whether it starts open, spacing, quick commands on or off and commands for everyone; terminal
  colours, frames, line height and error highlighting, and whether visitors may pick their own look.
- **Type**: Geist, Inter, Plus Jakarta Sans, Space Grotesk, Outfit, system or the panel's font, separately for
  headings; heading weight; gradient page titles (the greeting follows them); Geist Mono or JetBrains Mono for code.
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
