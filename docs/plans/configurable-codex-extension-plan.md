# Configurable Codex Extension Plan

## Goal

Make `pi-codex-conversion` configurable from a durable extension config in the Pi agent dir, while allowing Codex styling/chrome to be enabled independently from Codex tool swapping and prompt rewriting.

## Decisions

- Config file: `~/.pi/agent/pi-codex-conversion.json`.
- Respect `PI_CODING_AGENT_DIR`; fallback to `~/.pi/agent`.
- Do not create config on normal startup.
- Create/update config only through `/codex-config` actions or explicit init/write paths.
- Missing config preserves current behavior.
- Invalid config: warn in UI, ignore invalid fields, fallback safely.
- Global file wins over old session `codex-ui-prefs`.
- Old session prefs remain fallback only when global config does not exist.
- `/codex-config` opens settings TUI by default.
- Non-TUI `/codex-config` fallback shows config path and effective JSON.
- `/codex-config` TUI mirrors `pi-gitlab` settings UI style.
- TUI changes write config and apply immediately.
- Reset restores current package behavior defaults.
- Config writes are atomic enough for user config: write JSON with trailing newline to a temp file in the same dir, then rename.
- Existing compatibility commands remain available; they update the same global config and then resync the active session.

## Config schema

```json
{
  "version": 1,
  "ui": {
    "enabled": "auto",
    "themeName": "Codex Dark",
    "density": "compact",
    "forceTheme": true,
    "showHeader": false,
    "compactTools": true,
    "promptPrefix": false
  },
  "tools": {
    "enabled": "auto"
  },
  "prompt": {
    "enabled": "auto"
  }
}
```

## Mode semantics

### `ui.enabled`

- `auto`: apply Codex chrome/theme only for Codex-like contexts. Current behavior.
- `always`: apply Codex chrome/theme on any model.
- `never`: never apply Codex chrome/theme.

### `tools.enabled`

- `auto`: enable Codex adapter tools only for Codex-like contexts. Current behavior.
- `never`: never swap tools; preserve Pi/current active tools.

No `always` for tools. Tools must not be forced on non-Codex models.

Tool activation is independent from UI styling. If tools are disabled while currently active, restore the remembered pre-adapter tool set. If no remembered set exists, leave the current non-adapter tools alone and remove adapter tools.

### `prompt.enabled`

- `auto`: apply Codex prompt transform only for Codex-like contexts. Current behavior.
- `always`: apply Codex prompt transform on any model.
- `never`: never apply Codex prompt transform.

## Styling-only profile

```json
{
  "version": 1,
  "ui": {
    "enabled": "always",
    "themeName": "Codex Dark",
    "density": "compact",
    "forceTheme": true,
    "showHeader": false,
    "compactTools": true,
    "promptPrefix": false
  },
  "tools": {
    "enabled": "never"
  },
  "prompt": {
    "enabled": "never"
  }
}
```

Effect: Codex visual styling/chrome, normal Pi tool set, no Codex prompt rewrite.

## Effective behavior matrix

| Context | Config | UI | Tools | Prompt |
| --- | --- | --- | --- | --- |
| Codex-like model | missing/default | on | adapter tools on | Codex transform on |
| Non-Codex model | missing/default | off | unchanged | unchanged |
| Any model | `ui.always`, `tools.never`, `prompt.never` | on | unchanged | unchanged |
| Any model | `ui.never`, `tools.auto`, `prompt.auto` | off | Codex-like only | Codex-like only |
| Any model | `prompt.always` | per UI mode | per tools mode | Codex transform on |

Definitions:

- “Codex-like model” means the current `isCodexLikeContext(ctx)` result.
- “Adapter tools” means `exec_command`, `write_stdin`, `apply_patch`, plus capability-gated `view_image` and provider-gated `codex_web_search`.
- “Unchanged tools” means preserve the user's active tool configuration, including Pi built-ins and other extension tools.

## TUI design

Command: `/codex-config`.

Use same pattern as `/Users/eric/Dev/pi-gitlab/src/settings-ui.ts`:

- centered overlay
- `DynamicBorder`
- `SelectList`
- header
- preview line
- help text
- `edit-json`
- `reset-all`

Settings list:

- `UI: Mode` = `auto | always | never`
- `Tools: Mode` = `auto | never`
- `Prompt: Mode` = `auto | always | never`
- `UI: Theme` = `Codex Dark | Codex Light`
- `UI: Force theme` = `true | false`
- `UI: Density` = `compact | comfortable`
- `UI: Header` = `true | false`
- `UI: Compact tools` = `true | false`
- `UI: Prompt prefix` = `true | false`
- `Open/edit config JSON`
- `Reset all settings`

Use constrained choices for enum/bool settings, not free-text, except JSON editor.

TUI save behavior:

- Validate the next config before writing.
- Write the normalized full config, not a partial patch.
- After write, reload effective config into extension state.
- Resync UI/tools/prompt immediately for the active session.
- If a setting change disables UI, clear Codex chrome and restore the previous theme when one was remembered.
- If a setting change disables tools, remove adapter tools and restore the remembered pre-adapter tools.
- If a setting change enables UI, remember the current non-Codex theme before applying a forced Codex theme.

Non-TUI fallback:

- If `ctx.hasUI` is false, `/codex-config` must not call TUI APIs that require interaction.
- Return/show config path, whether the file exists, parse warning if any, and effective normalized JSON.

Existing commands:

- `/codex-theme dark|light` updates `ui.themeName` and applies immediately.
- `/codex-density compact|comfortable` updates `ui.density` and applies immediately.
- `/codex-ui-reset` resets the global config to defaults and applies immediately.
- `/codex-ui` may remain as a status alias, but `/codex-config` is the primary settings command.

## Implementation steps

1. Add config module.
   - Path resolution.
   - Defaults.
   - Forgiving parser/normalizer.
   - `loadUserConfig()` / `writeUserConfig()`.
   - `configExists` / warning metadata so old session prefs can be fallback only when the file is absent.
   - Atomic write via temp file and rename.
   - Tests.

2. Add settings TUI module.
   - Overlay component cloned from `pi-gitlab` pattern.
   - Menu model.
   - Constrained choice editing.
   - JSON editor.
   - Reset action.
   - Tests for model/update helpers.

3. Refactor adapter state.
   - Store effective config separately from session UI prefs.
   - Old session prefs fallback only when config file missing.
   - Split state that is currently conflated behind `state.enabled` into at least UI-active, tools-active, and prompt-active decisions.
   - Keep previous theme tracking scoped to UI activation.
   - Keep previous tool tracking scoped to tool activation.

4. Split sync logic.
   - Independently decide UI, tools, prompt activation.
   - UI: `auto | always | never`.
   - Tools: `auto | never`.
   - Prompt: `auto | always | never`.
   - Ensure each transition has an inverse cleanup path.
   - Re-register capability-gated tools when model changes, but only activate adapter tools when tools mode allows it.

5. Update commands.
   - Add `/codex-config` as TUI entrypoint plus non-TUI config dump.
   - Keep existing theme/density/reset commands, but make them file-backed.
   - Apply config immediately after write.

6. Update README.
   - Config file path.
   - Example styling-only config.
   - `/codex-config` behavior.

7. Verify.
   - `npm run typecheck`
   - `npm test`
   - `npm run check`

## Edge cases to cover

- Config file absent: no file is created during startup.
- Config file malformed: warning emitted, defaults used, Pi still starts.
- Config file partially valid: valid fields apply, invalid fields normalize to defaults.
- `PI_CODING_AGENT_DIR` points to a custom dir: config path follows it.
- UI switches from on to off mid-session: header/editor/tools-expanded/theme are restored or cleared.
- UI switches from off to on mid-session: previous theme is remembered before forced theme is applied.
- Tools switch from auto/on to never mid-session: adapter tools are removed and previous tools restored.
- Tools are never enabled on non-Codex models.
- Prompt `always` works on non-Codex models without enabling adapter tools.
- Other extension tools remain active when adapter tools are enabled or disabled.
- `compactTools` affects display expansion for all tool rows, not only adapter tools.
- JSON editor writes normalized config and rejects malformed edits without overwriting the last good file.

## Acceptance criteria

- With no config file, behavior matches today.
- With styling-only config, Codex chrome/theme is active and Pi tools remain unchanged.
- With `prompt.enabled: "never"`, system prompt is not Codex-transformed.
- `/codex-config` opens interactive overlay in TUI mode.
- `/codex-config` has a usable non-TUI fallback.
- TUI edits persist to the global config file.
- TUI edits apply immediately in the active session.
- Malformed config does not break startup.
- Existing `/codex-theme`, `/codex-density`, `/codex-ui`, and `/codex-ui-reset` behavior remains compatible.
- Tests cover config normalization, path handling, atomic writes, settings update helpers, and activation transition helpers.
