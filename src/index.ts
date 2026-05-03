import { existsSync, readFileSync } from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";
import { getCodexRuntimeShell } from "./adapter/runtime-shell.ts";
import { CORE_ADAPTER_TOOL_NAMES, DEFAULT_TOOL_NAMES, STATUS_KEY, STATUS_TEXT, VIEW_IMAGE_TOOL_NAME, WEB_SEARCH_TOOL_NAME } from "./adapter/tool-set.ts";
import { clearApplyPatchRenderState, registerApplyPatchTool } from "./tools/apply-patch-tool.ts";
import { isCodexLikeContext, isOpenAICodexContext } from "./adapter/codex-model.ts";
import { createExecCommandTracker } from "./tools/exec-command-state.ts";
import { registerExecCommandTool } from "./tools/exec-command-tool.ts";
import { createExecSessionManager } from "./tools/exec-session-manager.ts";
import { buildCodexSystemPrompt, extractPiPromptSkills, type PromptSkill } from "./prompt/build-system-prompt.ts";
import { applyCodexChrome, buildCodexUiInfoMessage, clearCodexChrome } from "./ui/chrome.ts";
import { formatCodexConfigInfo, loadCodexConfig, normalizeCodexConfig, writeCodexConfig, type CodexConfig } from "./ui/config.ts";
import { CodexUiConfigComponent, type CodexUiConfigAction } from "./ui/config-ui.ts";
import { resolveSessionCodexUiPrefs, DEFAULT_CODEX_UI_PREFS, CODEX_UI_PREFS_ENTRY, isCodexTheme, type CodexDensity, type CodexThemeName, type CodexUiPrefs, type CodexUiPrefsEntry } from "./ui/prefs.ts";
import { prefixUserInput, stripUserInputPrefix, shouldPrefixUserInput } from "./ui/input.ts";
import { registerViewImageTool, supportsOriginalImageDetail } from "./tools/view-image-tool.ts";
import {
	registerWebSearchTool,
	registerWebSearchSessionNoteRenderer,
	rewriteNativeWebSearchTool,
	shouldShowWebSearchSessionNote,
	supportsNativeWebSearch,
	WEB_SEARCH_SESSION_NOTE_TEXT,
	WEB_SEARCH_SESSION_NOTE_TYPE,
} from "./tools/web-search-tool.ts";
import { registerWriteStdinTool } from "./tools/write-stdin-tool.ts";

interface AdapterState {
	enabled: boolean;
	previousToolNames?: string[];
	promptSkills: PromptSkill[];
	webSearchNoticeShown: boolean;
	uiPrefs: CodexUiPrefs;
	previousThemeNames: Map<string, string | null>;
}

const ADAPTER_TOOL_NAMES = [...CORE_ADAPTER_TOOL_NAMES, VIEW_IMAGE_TOOL_NAME, WEB_SEARCH_TOOL_NAME];

function getCommandArg(args: unknown): string | undefined {
	if (!args || typeof args !== "object" || !("cmd" in args) || typeof args.cmd !== "string") {
		return undefined;
	}
	return args.cmd;
}

function isToolCallOnlyAssistantMessage(message: unknown): boolean {
	if (!message || typeof message !== "object" || !("role" in message) || message.role !== "assistant") {
		return false;
	}
	if (!("content" in message) || !Array.isArray(message.content) || message.content.length === 0) {
		return false;
	}
	return message.content.every((item) => typeof item === "object" && item !== null && "type" in item && item.type === "toolCall");
}

export default function codexConversion(pi: ExtensionAPI) {
	const tracker = createExecCommandTracker();
	const state: AdapterState = {
		enabled: false,
		promptSkills: [],
		webSearchNoticeShown: false,
		uiPrefs: { ...DEFAULT_CODEX_UI_PREFS },
		previousThemeNames: new Map(),
	};
	const sessions = createExecSessionManager();

	registerApplyPatchTool(pi);
	registerExecCommandTool(pi, tracker, sessions);
	registerWriteStdinTool(pi, sessions);
	registerWebSearchTool(pi);
	registerWebSearchSessionNoteRenderer(pi);
	registerCodexUiMessageRenderer(pi);
	registerCodexUiCommands(pi, state);

	sessions.onSessionExit((sessionId) => {
		tracker.recordSessionFinished(sessionId);
	});

	pi.on("session_start", async (event, ctx) => {
		if (event.reason === "startup" || event.reason === "reload") {
			state.webSearchNoticeShown = false;
			clearApplyPatchRenderState();
			tracker.clear();
		}
		state.uiPrefs = getEffectiveUiPrefs(ctx);
		rememberPreviousTheme(ctx, state);
		syncAdapter(pi, ctx, state);
	});

	pi.on("model_select", async (_event, ctx) => {
		syncAdapter(pi, ctx, state);
	});

	pi.on("message_start", async (event) => {
		if (event.message.role === "toolResult") return;
		if (isToolCallOnlyAssistantMessage(event.message)) return;
		tracker.resetExplorationGroup();
	});

	pi.on("tool_execution_start", async (event) => {
		if (event.toolName !== "exec_command") {
			tracker.resetExplorationGroup();
			return;
		}
		const command = getCommandArg(event.args);
		if (!command) return;
		tracker.recordStart(event.toolCallId, command);
	});

	pi.on("tool_execution_end", async (event) => {
		if (event.toolName !== "exec_command") return;
		tracker.recordEnd(event.toolCallId);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		clearApplyPatchRenderState();
		clearCodexChrome(ctx, getPreviousThemeName(state, ctx));
		sessions.shutdown();
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (!isCodexLikeContext(ctx)) {
			return undefined;
		}
		return {
			systemPrompt: buildCodexSystemPrompt(event.systemPrompt, {
				skills: state.promptSkills,
				shell: getCodexRuntimeShell(process.env.SHELL),
			}),
		};
	});

	pi.on("before_provider_request", async (event, ctx) => {
		if (!isOpenAICodexContext(ctx)) {
			return undefined;
		}
		return rewriteNativeWebSearchTool(event.payload, ctx.model);
	});

	pi.on("context", async (event) => {
		return {
			messages: event.messages.filter(
				(message) => !(message.role === "custom" && message.customType === WEB_SEARCH_SESSION_NOTE_TYPE),
			).map((message) => {
				if (message.role === "user" && typeof message.content === "string") {
					return { ...message, content: stripUserInputPrefix(message.content) };
				}
				if (message.role === "user" && Array.isArray(message.content)) {
					return {
						...message,
						content: message.content.map((item, index) =>
							index === 0 && item.type === "text"
								? { ...item, text: stripUserInputPrefix(item.text) }
								: item,
						),
					};
				}
				return message;
			}),
		};
	});

	pi.on("input", async (event) => {
		if (event.source === "extension") return { action: "continue" as const };
		if (!state.enabled || !state.uiPrefs.promptPrefix || !shouldPrefixUserInput(event.text)) {
			return { action: "continue" as const };
		}
		return event.images
			? { action: "transform" as const, text: prefixUserInput(event.text), images: event.images }
			: { action: "transform" as const, text: prefixUserInput(event.text) };
	});
}

function syncAdapter(pi: ExtensionAPI, ctx: ExtensionContext, state: AdapterState): void {
	state.promptSkills = extractPiPromptSkills(ctx.getSystemPrompt());

	registerViewImageTool(pi, { allowOriginalDetail: supportsOriginalImageDetail(ctx.model) });
	maybeShowWebSearchSessionNote(pi, ctx, state);

	if (isCodexLikeContext(ctx)) {
		enableAdapter(pi, ctx, state);
	} else {
		disableAdapter(pi, ctx, state);
	}
}

function enableAdapter(pi: ExtensionAPI, ctx: ExtensionContext, state: AdapterState): void {
	const toolNames = mergeAdapterTools(pi.getActiveTools(), getAdapterToolNames(ctx));
	if (!state.enabled) {
		// Preserve the previous active set once so switching away from Codex-like
		// models restores the user's existing Pi tool configuration.
		state.previousToolNames = pi.getActiveTools();
		state.enabled = true;
	}
	pi.setActiveTools(toolNames);
	applyCodexChrome(ctx, state.uiPrefs, () => pi.getThinkingLevel());
	setStatus(ctx, true);
}

function disableAdapter(pi: ExtensionAPI, ctx: ExtensionContext, state: AdapterState): void {
	const previousToolNames = state.previousToolNames && state.previousToolNames.length > 0 ? state.previousToolNames : DEFAULT_TOOL_NAMES;
	const restoredTools = restoreTools(previousToolNames, pi.getActiveTools());
	if (state.enabled || hasAdapterTools(pi.getActiveTools())) {
		pi.setActiveTools(restoredTools);
	}
	if (state.enabled) {
		state.enabled = false;
	}
	clearCodexChrome(ctx, getPreviousThemeName(state, ctx));
	setStatus(ctx, false);
}

function setStatus(ctx: ExtensionContext, enabled: boolean): void {
	if (!ctx.hasUI) return;
	ctx.ui.setStatus(STATUS_KEY, enabled ? STATUS_TEXT : undefined);
}

function getAdapterToolNames(ctx: ExtensionContext): string[] {
	const toolNames = [...CORE_ADAPTER_TOOL_NAMES];
	if (Array.isArray(ctx.model?.input) && ctx.model.input.includes("image")) {
		toolNames.push(VIEW_IMAGE_TOOL_NAME);
	}
	if (supportsNativeWebSearch(ctx.model)) {
		toolNames.push(WEB_SEARCH_TOOL_NAME);
	}
	return toolNames;
}

export function mergeAdapterTools(activeTools: string[], adapterTools: string[]): string[] {
	const preservedTools = activeTools.filter((toolName) => !DEFAULT_TOOL_NAMES.includes(toolName) && !ADAPTER_TOOL_NAMES.includes(toolName));
	return [...adapterTools, ...preservedTools];
}

export function restoreTools(previousTools: string[], activeTools: string[]): string[] {
	const restored = [...previousTools];
	for (const toolName of activeTools) {
		if (!ADAPTER_TOOL_NAMES.includes(toolName) && !restored.includes(toolName)) {
			restored.push(toolName);
		}
	}
	return restored;
}

function hasAdapterTools(activeTools: string[]): boolean {
	return activeTools.some((toolName) => ADAPTER_TOOL_NAMES.includes(toolName));
}

function maybeShowWebSearchSessionNote(pi: ExtensionAPI, ctx: ExtensionContext, state: AdapterState): void {
	if (!shouldShowWebSearchSessionNote(ctx.model, ctx.hasUI, state.webSearchNoticeShown)) {
		return;
	}
	pi.sendMessage({
		customType: WEB_SEARCH_SESSION_NOTE_TYPE,
		content: WEB_SEARCH_SESSION_NOTE_TEXT,
		display: true,
	});
	state.webSearchNoticeShown = true;
}

function getEffectiveUiPrefs(ctx: ExtensionContext): CodexUiPrefs {
	const sessionPrefs = resolveSessionCodexUiPrefs(ctx.sessionManager.getEntries() as CodexUiPrefsEntry[]);
	const loaded = loadCodexConfig(sessionPrefs);
	if (loaded.warning && ctx.hasUI) {
		ctx.ui.notify(loaded.warning, "warning");
	}
	return loaded.config.ui;
}

function registerCodexUiMessageRenderer(pi: ExtensionAPI): void {
	pi.registerMessageRenderer("codex-ui-info", (message, _options, theme) => {
		const title = (message.details as { title?: string } | undefined)?.title ?? "Codex UI";
		const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
		box.addChild(new Text(theme.fg("customMessageLabel", theme.bold(title)), 0, 0));
		box.addChild(new Text(theme.fg("customMessageText", String(message.content ?? "")), 0, 0));
		return box;
	});
}

function sendCodexUiInfoMessage(pi: ExtensionAPI, title: string, content: string): void {
	pi.sendMessage({ customType: "codex-ui-info", content, display: true, details: { title } });
}

function persistUiPrefs(pi: ExtensionAPI, ctx: ExtensionContext, prefs: CodexUiPrefs): void {
	try {
		writeCodexConfig({ version: 1, ui: prefs });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Codex UI config not saved: ${message}`, "error");
	}
	pi.appendEntry(CODEX_UI_PREFS_ENTRY, prefs);
}

function applyAndPersistUiPrefs(pi: ExtensionAPI, ctx: ExtensionContext, state: AdapterState, prefs: CodexUiPrefs, options: { editor?: boolean } = {}): void {
	state.uiPrefs = prefs;
	persistUiPrefs(pi, ctx, state.uiPrefs);
	if (state.enabled) applyCodexChrome(ctx, state.uiPrefs, () => pi.getThinkingLevel(), options);
}

function parseThemeArg(arg: string): CodexThemeName | undefined {
	const normalized = arg.trim().toLowerCase();
	if (normalized === "dark" || normalized === "codex-dark" || normalized === "codex dark") return "Codex Dark";
	if (normalized === "light" || normalized === "codex-light" || normalized === "codex light") return "Codex Light";
	return undefined;
}

function parseDensityArg(arg: string): CodexDensity | undefined {
	const normalized = arg.trim().toLowerCase();
	if (normalized === "compact") return "compact";
	if (normalized === "comfortable" || normalized === "normal") return "comfortable";
	return undefined;
}

function registerCodexUiCommands(pi: ExtensionAPI, state: AdapterState): void {
	pi.registerCommand("codex-ui", {
		description: "Show Codex UI status and preferences",
		handler: async (_args, ctx) => {
			sendCodexUiInfoMessage(pi, "Codex UI", buildCodexUiInfoMessage(ctx, state.uiPrefs));
		},
	});

	pi.registerCommand("codex-theme", {
		description: "Switch Codex UI theme: dark|light",
		getArgumentCompletions: (prefix) => {
			const values = ["dark", "light"].filter((item) => item.startsWith(prefix));
			return values.length > 0 ? values.map((value) => ({ value, label: value })) : null;
		},
		handler: async (args, ctx) => {
			const themeName = parseThemeArg(args);
			if (!themeName) {
				ctx.ui.notify("Usage: /codex-theme dark|light", "warning");
				return;
			}
			applyAndPersistUiPrefs(pi, ctx, state, { ...state.uiPrefs, themeName });
			ctx.ui.notify(`Codex theme set to ${themeName}`, "info");
		},
	});

	pi.registerCommand("codex-density", {
		description: "Switch Codex UI density: compact|comfortable",
		getArgumentCompletions: (prefix) => {
			const values = ["compact", "comfortable"].filter((item) => item.startsWith(prefix));
			return values.length > 0 ? values.map((value) => ({ value, label: value })) : null;
		},
		handler: async (args, ctx) => {
			const density = parseDensityArg(args);
			if (!density) {
				ctx.ui.notify("Usage: /codex-density compact|comfortable", "warning");
				return;
			}
			applyAndPersistUiPrefs(pi, ctx, state, { ...state.uiPrefs, density });
			ctx.ui.notify(`Codex density set to ${density}`, "info");
		},
	});

	pi.registerCommand("codex-ui-config", {
		description: "Open Codex UI configuration",
		handler: async (_args, ctx) => {
			const loaded = loadCodexConfig(state.uiPrefs);
			state.uiPrefs = loaded.config.ui;
			if (!ctx.hasUI) {
				sendCodexUiInfoMessage(pi, "Codex UI config", formatCodexConfigInfo(loaded));
				return;
			}
			if (state.enabled) applyCodexChrome(ctx, state.uiPrefs, () => pi.getThinkingLevel());

			const runConfigOverlay = async (): Promise<CodexUiConfigAction> => ctx.ui.custom<CodexUiConfigAction>(
				(_tui, theme, _keybindings, done) => new CodexUiConfigComponent({
					prefs: state.uiPrefs,
					configPath: loaded.path,
					theme,
					onPrefsChange: (prefs) => {
						applyAndPersistUiPrefs(pi, ctx, state, prefs, { editor: false });
						ctx.ui.notify("Codex UI config saved", "info");
					},
					done,
				}),
				{
					overlay: true,
					overlayOptions: { anchor: "center", width: "70%", minWidth: 56, maxHeight: "80%", margin: 2 },
				},
			);

			const action = await runConfigOverlay();
			if (action.type === "close") {
				if (state.enabled) applyCodexChrome(ctx, state.uiPrefs, () => pi.getThinkingLevel());
				return;
			}
			if (action.type === "reset") {
				applyAndPersistUiPrefs(pi, ctx, state, { ...DEFAULT_CODEX_UI_PREFS });
				ctx.ui.notify("Codex UI reset to defaults", "info");
				return;
			}
			if (action.type === "edit-json") {
				await editCodexConfigJson(pi, ctx, state, loaded.path);
			}
		},
	});

	pi.registerCommand("codex-ui-reset", {
		description: "Restore Codex UI defaults",
		handler: async (_args, ctx) => {
			applyAndPersistUiPrefs(pi, ctx, state, { ...DEFAULT_CODEX_UI_PREFS });
			ctx.ui.notify("Codex UI reset to defaults", "info");
		},
	});
}

async function editCodexConfigJson(pi: ExtensionAPI, ctx: ExtensionContext, state: AdapterState, path: string): Promise<void> {
	const currentConfig: CodexConfig = { version: 1, ui: state.uiPrefs };
	const { text: prefill, warning } = readCodexConfigEditorPrefill(path, currentConfig);
	if (warning) ctx.ui.notify(warning, "warning");
	const edited = await ctx.ui.editor("Codex UI config JSON", prefill);
	if (edited === undefined) return;
	try {
		const normalized = normalizeCodexConfig(JSON.parse(edited), state.uiPrefs);
		writeCodexConfig(normalized, path);
		state.uiPrefs = normalized.ui;
		pi.appendEntry(CODEX_UI_PREFS_ENTRY, state.uiPrefs);
		if (state.enabled) applyCodexChrome(ctx, state.uiPrefs, () => pi.getThinkingLevel());
		ctx.ui.notify("Codex UI config saved", "info");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Codex UI config not saved: ${message}`, "error");
	}
}

export function readCodexConfigEditorPrefill(path: string, currentConfig: CodexConfig): { text: string; warning?: string } {
	const fallback = `${JSON.stringify(currentConfig, null, 2)}\n`;
	try {
		return { text: existsSync(path) ? readFileSync(path, "utf8") : fallback };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { text: fallback, warning: `Codex UI config not read: ${message}` };
	}
}

function rememberPreviousTheme(ctx: ExtensionContext, state: AdapterState): void {
	const sessionId = ctx.sessionManager.getSessionId();
	if (!state.previousThemeNames.has(sessionId) && !isCodexTheme(ctx.ui.theme.name)) {
		state.previousThemeNames.set(sessionId, ctx.ui.theme.name ?? null);
	}
}

function getPreviousThemeName(state: AdapterState, ctx: ExtensionContext): string | null {
	return state.previousThemeNames.get(ctx.sessionManager.getSessionId()) ?? null;
}
