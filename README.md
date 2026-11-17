# Codex Effort Slider for OpenCode

A Codex-style thinking-intensity slider for **OpenCode Desktop** and the TUI.

There is no official OpenCode slider plugin. This one talks to OpenCode's own
`variant` API and uses the blue→violet energy language documented by
[dsh-codex-effort-slider](https://github.com/Microqian2th/dsh-codex-effort-slider)
(DeepSeek Harness). All code here is original and targets OpenCode.

## Desktop

The slider sits in the composer, immediately left of the send button (right of
the native thinking-intensity control):

- Continuous drag with detent; release snaps to a level, including **Default**
- Low stays blue; higher levels shift violet, with right-to-left star particles
- Native effort labels (composer + menus) follow the same color curve, including Default
- Visible on new/draft sessions once the selected model is known; notches are that model's variants only
- Hidden when the current model exposes no effort variants
- `Ctrl/Cmd+Shift+Left` / `Right` step one level

The desktop part is a GUI plugin (`./gui-experimental`), built into
`dist/gui-experimental.cjs`.

## TUI

In the terminal, the slider sits on its own row directly below the prompt
footer (under the `shift+tab agents` / `ctrl+p commands` hints):

```text
██•█●█•██░•░  Medium
```

- Solid `█` track, white knob, white dots at each level; click a column to set effort
- Low fill is blue; xhigh fill is deep→light purple
- The value label is fixed-width so the track does not jump
- `/effort` opens the picker, `/effort high` sets a level, `/effort +` steps
- `Ctrl+Shift+Left` / `Right` step one level
- OpenCode's built-in `Ctrl+T` still cycles variants

## Install

From GitHub (OpenCode plugin field):

```jsonc
{
  "plugin": ["heyheyhey3131/codex_styled_effort_slider_for_opencode"]
}
```

(`plugin` is the current OpenCode field; older configs used `plugins`.)

Or clone into the global discovery directory:

```text
~/.config/opencode/plugins/codex-effort-slider/
```

After changing the GUI bundle, fully quit and reopen OpenCode Desktop (or
**Settings → Extensions → Plugins → Reload**). The server part reloads with
`/reload`.

## Build

```bash
npm install --legacy-peer-deps
npm test
npm run build
```

- `npm run build` emits `dist/gui-experimental.cjs`
- `npm test` runs the host-agnostic math tests

## Files

| File | Purpose |
| --- | --- |
| `effort.mjs` | Variant ordering, percentage/notch math, color curve |
| `effort.test.mjs` | Unit tests for the math |
| `gui.tsx` | Desktop Solid slider and commands |
| `tui.tsx` | Terminal slider, slots, `/effort` |
| `index.ts` | Server part (id) |
| `vite.config.ts` | GUI bundle build |

MIT.
