# Codex dark near-clone plan

## Goal

Make Pi look much closer to Codex in dark mode, aiming for near-clone visual parity while removing PI-specific affordances unless they materially improve usability.

## Constraints

- dark mode only for the first pass
- prioritize near-clone Codex over PI identity
- minimize PI chrome aggressively
- keep only affordances that clearly help scanability, focus, or recovery

## Phases

### 1. Identify exact UI control points

- map where these are rendered:
  - top header
  - transcript block wrappers
  - user prompt styling
  - tool rows
  - editor/input slab
- classify each into:
  - theme-token-only
  - spacing/layout logic
  - text/copy/chrome logic

### 2. Dark theme parity pass

- update `themes/codex-dark.json`
- darken base surfaces
- compress surface differences between:
  - background
  - tool blocks
  - user blocks
  - custom blocks
- reduce border contrast
- mute accent blue
- shift body/muted/dim text toward Codex’s gray ramp
- soften success/error/warning colors so they read informational, not vivid

### 3. Remove boxed-UI feeling

- reduce “cardness” across transcript
- flatten tool backgrounds so they feel embedded in the stream
- tone down borders on:
  - tool rows
  - input container
  - any custom chrome
- keep hierarchy mostly through:
  - text weight
  - subtle background contrast
  - indentation
  - sparse separators

### 4. Density tuning

- tighten vertical spacing between:
  - assistant paragraphs
  - tool blocks
  - user prompt blocks
- reduce internal padding on tool renderers
- reduce editor horizontal/vertical breathing room
- ensure transcript feels compact without becoming cramped

### 5. Codex-like input slab

- make prompt/editor area read as one flat bottom slab
- tune:
  - border strength
  - left prompt marker spacing
  - placeholder/help text prominence
  - surrounding empty space
- minimize anything that feels like a “custom TUI widget”

### 6. Transcript styling parity

- user prompts
  - closer to Codex’s subdued prompt treatment
  - less bubble-like, more inline/slab-like
- assistant text
  - less embellished
  - cleaner hierarchy
- tool rows
  - command first
  - result/status second
  - low-noise metadata

### 7. Tool-specific parity

- `exec_command`
  - make command rows feel like native terminal activity
  - reduce decorative labels if possible
  - background-terminal status should be quieter
- `write_stdin`
  - polling/interact rows should feel understated
- `apply_patch`
  - flatter diff sections
  - cleaner file op labels
  - less visual ceremony around edits
- interruption/error rows
  - restrained warning treatment
  - preserve clarity, remove drama

### 8. Remove remaining PI affordances

- audit for:
  - extra labels
  - heavy borders
  - startup/header emphasis
  - mode cues louder than Codex
- keep only if they materially improve:
  - focus state
  - scanning
  - recovery from errors

### 9. Screenshot-based parity review

- compare against reference screenshots on:
  - top bar weight
  - prompt slab
  - transcript density
  - border visibility
  - muted text tone
  - command/tool presentation
- finish with small tweaks to:
  - 1–2 color values
  - 1-char / 1-space alignments
  - padding constants
  - label wording

## Concrete likely change buckets

### Theme-only

- `themes/codex-dark.json`
  - `border`, `borderMuted`, `borderAccent`
  - `text`, `muted`, `dim`
  - `userMessageBg`, `toolPendingBg`, `toolSuccessBg`, `toolErrorBg`
  - `toolTitle`, `toolOutput`
  - syntax colors
  - thinking border colors

### Structural UI

- `src/ui/*`
  - header visibility and compactness
  - editor padding
  - transcript wrappers
  - prompt prefix rendering
  - background/help text styling

### Renderer polish

- likely under `src/tools/*` and some `src/ui/*` helpers
- focus on:
  - command rows
  - patch summaries
  - status labels

## What to do first

1. inspect `src/ui` and renderer files
2. patch `themes/codex-dark.json`
3. patch spacing/chrome
4. patch tool renderers
5. parity sweep

## File-by-file implementation plan

### `themes/codex-dark.json`

**Exact edit targets**

- `vars`
  - dark base surfaces: `surface`, `surfaceAlt`, `surfaceMuted`, `surfaceUser`, `surfaceCustom`
  - text ramps: `ink`, `mutedInk`, `dimInk`
  - border ramps: `borderGray`, `borderBright`
  - accents/states: `accentBlue`, `accentSlate`, `accentTeal`, `successGreen`, `errorRed`, `warningAmber`
  - code/syntax tokens: `codeGreen`, `codeOrange`, `codeCyan`, `codeComment`
- `colors`
  - borders: `border`, `borderMuted`, `borderAccent`
  - text: `text`, `muted`, `dim`, `thinkingText`
  - transcript surfaces: `userMessageBg`, `customMessageBg`, `toolPendingBg`, `toolSuccessBg`, `toolErrorBg`
  - tool rendering: `toolTitle`, `toolOutput`, `toolDiffAdded`, `toolDiffRemoved`, `toolDiffContext`
  - markdown/syntax: `md*`, `syntax*`
  - thinking borders: `thinkingOff`, `thinkingMinimal`, `thinkingLow`, `thinkingMedium`, `thinkingHigh`, `thinkingXhigh`

**Expected effect**

- darker, flatter Codex-like base
- lower border contrast
- more restrained blue accents
- warmer, more Codex-like gray text ramp
- tool/user surfaces feel embedded instead of carded

### `src/ui/*`

**Exact edit targets**

- header/chrome components
  - remove or compress top header treatment
  - mute status labels and decorative separators
- editor/input components
  - reduce padding/margins
  - flatten border treatment
  - tune prompt prefix spacing/alignment
- transcript/message wrappers
  - reduce padding around user/assistant/tool blocks
  - remove heavy framing where possible
- UI preference plumbing
  - ensure dark Codex mode stays the default path for this near-clone pass

**Expected effect**

- less “custom TUI app” feel
- flatter Codex-like prompt slab
- denser transcript rhythm
- dramatically reduced PI-specific chrome

### `src/index.ts`

**Exact edit targets**

- extension activation path for Codex UI mode
- default theme selection behavior in adapter mode
- any chrome/setup hooks that currently restore, inject, or emphasize PI affordances

**Expected effect**

- Codex dark near-clone becomes the clear default when adapter mode is active
- fewer mismatches between theme activation and UI override behavior

### `src/tools/*`

**Exact edit targets**

- exec renderer(s)
  - command label text
  - background-terminal phrasing
  - row padding and title/output separation
- stdin/session renderer(s)
  - make polling/interact rows quieter and less ceremonious
- patch renderer(s)
  - flatten file-op sections
  - reduce decorative emphasis around diff blocks
  - tighten file/status spacing
- error/interruption rendering
  - reduce loud warnings
  - preserve clarity with subtler hierarchy

**Expected effect**

- tool activity reads more like native Codex history
- less visual ceremony around command execution and patching
- errors feel calmer and closer to Codex tone

### `src/ui` helpers shared with tool rendering

**Exact edit targets**

- shared spacing constants
- helper functions for borders/backgrounds
- label formatting helpers
- any compactness toggles currently preserving extra PI spacing

**Expected effect**

- consistent density across transcript, tool rows, and input chrome
- easier final parity tuning from a few central knobs

### `README.md` or docs only if behavior changes materially

**Exact edit targets**

- update only if commands, defaults, or visible UI behavior materially change

**Expected effect**

- docs stay accurate without expanding scope

## Implementation order by file

1. `themes/codex-dark.json`
   - fastest high-impact parity gains
2. `src/ui/*`
   - remove boxed feel and tighten density
3. `src/tools/*`
   - make execution history feel Codex-native
4. `src/index.ts`
   - finalize activation/default behavior
5. docs if needed

## Verification checklist per file group

### Theme

- borders visibly quieter
- transcript surfaces closer together in tone
- text ramp matches Codex better

### UI chrome

- header no longer dominates
- prompt slab feels flat and dense
- transcript spacing is tighter

### Tool rendering

- command rows read first
- status metadata is quieter
- patch blocks feel flatter and less framed

### Activation wiring

- dark near-clone behavior reliably appears in adapter mode
- no accidental fallback to more PI-looking chrome

## Risks

- over-flattening could hurt scanability
- near-clone may require structural changes, not just token tweaks
- some spacing may come from upstream Pi primitives, limiting exact parity unless more rendering is overridden

## Definition of done

- dark mode feels unmistakably Codex at a glance
- prompt slab is flatter and denser
- transcript is more continuous, less boxy
- tool activity reads more like Codex history than custom extension UI
- PI-specific chrome is minimized to only useful affordances
