# pi-codex-conversion

Codex-oriented adapter for [Pi](https://github.com/badlogic/pi-mono).

> [!NOTE]
> This project was inspired by and builds on two earlier efforts: the original [`pi-codex-conversion`](https://github.com/IgorWarzocha/pi-codex-conversion) repository by Igor Warzocha, and [`pi-dex`](https://www.npmjs.com/package/pi-dex), which explored a similar goal of making Pi feel more like Codex. Credit and thanks to both original authors for the ideas and groundwork behind this repository.

This package replaces Pi's default Codex/GPT experience with a narrower Codex-like surface while staying close to Pi's own runtime and prompt construction:

- swaps active tools to `exec_command`, `write_stdin`, `apply_patch`, `view_image`, and native OpenAI Codex Responses `codex_web_search` on `openai-codex`
- preserves Pi's composed system prompt and applies a narrow Codex-oriented delta on top
- renders exec activity with Codex-style command and background-terminal labels
- renders `apply_patch` calls with Codex-style `Added` / `Edited` / `Deleted` diff blocks and Pi-style colored diff lines
- ships bundled `Codex Dark` / `Codex Light` themes plus Codex-like header/editor chrome

![Available tools](./available-tools.png)

> [!NOTE]
> Native OpenAI Codex Responses web search runs silently. Pi does not expose native web-search usage events to extensions, so the adapter shows a one-time session notice instead of per-search tool-call history.

## Active tools in adapter mode

When the adapter is active, the LLM sees these tools:

- `exec_command` — shell execution with Codex-style `cmd` parameters and resumable sessions
- `write_stdin` — continue or poll a running exec session
- `apply_patch` — patch tool
- `view_image` — image-only wrapper around Pi's native image reading, enabled only for image-capable models
- `codex_web_search` — native OpenAI Codex Responses web search, enabled only on the `openai-codex` provider

Notably:

- there is **no** dedicated `read`, `edit`, or `write` tool in adapter mode
- local text-file inspection should happen through `exec_command`
- file creation and edits should default to `apply_patch`
- Pi may still expose additional runtime tools such as `parallel`; the prompt is written to tolerate that instead of assuming a fixed four-tool universe

## UI chrome

When adapter mode is active on Codex-like models, the extension can also make Pi feel more like Codex UI:

- bundled `Codex Dark` and `Codex Light` themes
- compact Codex-style header chrome
- compact editor density with narrower horizontal padding
- optional `› ` prompt prefix styling for user prompts in the transcript
- commands to inspect or tweak the UI layer without changing the core adapter behavior

Behavioral precedence stays with this extension: tool/model adaptation wins, and the UI layer is additive only.

Commands:

- `/codex-ui` — show active Codex UI preferences
- `/codex-config` — open Codex settings; writes the default config path `~/.pi/agent/pi-codex-conversion.json`
- `/codex-ui-config` — alias for `/codex-config`
- `/codex-theme dark|light` — switch the bundled Codex theme variant
- `/codex-density compact|comfortable` — switch editor density
- `/codex-ui-reset` — restore the default Codex config, including UI, tools, and prompt modes

Set `PI_CODING_AGENT_DIR` to move the config file with the rest of the Pi agent directory.

The config file is only created or updated by settings commands. Missing config preserves default behavior: Codex UI, adapter tools, and prompt rewriting are active only for Codex-like models.

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
  "tools": { "enabled": "auto", "registerAdapterTools": true },
  "prompt": { "enabled": "auto" }
}
```

Set `tools.registerAdapterTools` to `false` when another installed extension should own the Codex-style tool names (`exec_command`, `write_stdin`, `apply_patch`, `image_generation`, `codex_web_search`, or `view_image`). This prevents this extension from registering or activating those tools. Reload Pi after changing it so startup-time tool registration uses the new value.

For styling-only mode on any model while preserving normal Pi tools and prompts:

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
  "tools": { "enabled": "never", "registerAdapterTools": true },
  "prompt": { "enabled": "never" }
}
```

## Layout

- `src/index.ts` — extension entrypoint, model gating, tool-set swapping, prompt transformation
- `src/adapter/` — model detection and active-tool constants
- `src/tools/` — Pi tool wrappers, exec session management, and execution rendering
- `src/shell/` — shell tokenization, parsing, and exploration summaries
- `src/patch/` — patch parsing, path policy, and execution
- `src/prompt/` — Codex delta transformer over Pi's composed prompt
- `src/ui/` — Codex-inspired chrome, editor tweaks, input styling, and UI preferences
- `themes/` — bundled Codex-like Pi themes
- `tests/` — deterministic unit tests

## Checks

```bash
npm run typecheck
npm test
npm run check
```

## Examples

- `rg -n foo src` -> `Explored / Search foo in src`
- `rg --files src | head -n 50` -> `Explored / List src`
- `cat README.md` -> `Explored / Read README.md`
- `exec_command({ cmd: "npm test", yield_time_ms: 1000 })` may return `session_id`, then continue with `write_stdin`
- for short or non-interactive commands, omitting `yield_time_ms` is preferred; tiny non-interactive waits are clamped upward to avoid unnecessary follow-up calls
- `write_stdin({ session_id, chars: "" })` renders like `Waited for background terminal` and is meant for occasional polling, not tight repoll loops
- `write_stdin({ session_id, chars: "y\\n" })` renders like `Interacted with background terminal`
- `view_image({ path: "/absolute/path/to/screenshot.png" })` is available on image-capable models
- `codex_web_search` is surfaced only on `openai-codex`, and the adapter rewrites it into the native OpenAI Responses `type: "web_search"` payload instead of executing a local function tool
- when native web search is available, the adapter shows a one-time session notice; individual searches are not surfaced because Pi does not expose native web-search execution events to extensions
- `apply_patch` partial failures stay inline in the patch row so successful and failed file entries can be seen together
- by default the UI layer forces the bundled `Codex Dark` theme while adapter mode is active; switch with `/codex-theme`

Raw command output is still available by expanding the tool result.

## Install

```bash
pi install npm:@howaboua/pi-codex-conversion
```

Local development:

```bash
pi install ./pi-codex-conversion
```

Alternative Git install:

```bash
pi install git:github.com/IgorWarzocha/pi-codex-conversion
```

## Publishing

This package is already configured for public npm publishes via:

- `publishConfig.access = "public"`
- `prepublishOnly` / `prepack` checks

Useful commands:

```bash
npm run publish:dry-run
npm run publish:dev
npm run release:dev
```

What they do:

- `npm run publish:dry-run` — inspect what would be published
- `npm run publish:dev` — publish the current version under the `dev` dist-tag
- `npm run release:dev` — bump the package to the next `-dev.N` prerelease and publish it under the `dev` dist-tag

Typical flow:

```bash
npm login
npm run publish:dry-run
npm run release:dev
```

For modern npm auth, just run `npm login` and complete the browser flow when prompted.

After publishing, install the dev build with:

```bash
pi install npm:@howaboua/pi-codex-conversion@dev
```

## Prompt behavior

The adapter does not build a standalone replacement prompt anymore. Instead it:

- keeps Pi's tool descriptions, Pi docs section, AGENTS/project context, skills inventory, and date/cwd when Pi already surfaced them
- adds the current shell to the transformed prompt so quoting and escaping can match the runtime environment
- rewrites the top-level role framing to Codex-style wording
- adds a small Codex delta to the existing `Guidelines` section

That keeps the prompt much closer to `pi-mono` while still steering the model toward Codex-style tool use.

## Notes

- Adapter mode activates automatically for OpenAI `gpt*` and `codex*` models.
- When you switch away from those models, Pi restores the previous active tool set.
- When adapter mode disables, the extension clears its custom chrome and restores the previous theme for the active session.
- `view_image` resolves paths against the active session cwd and only exposes `detail: "original"` for Codex-family image-capable models.
- `codex_web_search` is exposed only for the `openai-codex` provider and is forwarded as the native OpenAI Codex Responses web search tool.
- `apply_patch` paths stay restricted to the current working directory.
- partial `apply_patch` failures stay in the original patch block and highlight the failed entry instead of adding a second warning row.
- `exec_command` / `write_stdin` use a custom PTY-backed session manager via `node-pty` for interactive sessions.
- tiny `exec_command` waits are clamped for non-interactive commands so short runs do not burn an avoidable follow-up tool call.
- empty `write_stdin` polls are clamped to a meaningful minimum wait so long-running processes are not repolled too aggressively.
- PTY output handling applies basic terminal rewrite semantics (`\r`, `\b`, erase-in-line, and common escape cleanup) so interactive redraws replay sensibly.
- Skills inventory is reintroduced in a Codex-style section when Pi's composed prompt already exposed the underlying Pi skills inventory.

## License

MIT
