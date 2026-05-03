import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_CODEX_UI_PREFS, normalizeCodexUiPrefs, type CodexUiPrefs } from "./prefs.ts";

export type CodexUiMode = "auto" | "always" | "never";
export type CodexToolsMode = "auto" | "never";
export type CodexPromptMode = "auto" | "always" | "never";

export type CodexUiConfig = CodexUiPrefs & {
	enabled: CodexUiMode;
};

export interface CodexToolsConfig {
	enabled: CodexToolsMode;
}

export interface CodexPromptConfig {
	enabled: CodexPromptMode;
}

export interface CodexConfig {
	version: 1;
	ui: CodexUiConfig;
	tools: CodexToolsConfig;
	prompt: CodexPromptConfig;
}

export interface LoadedCodexConfig {
	path: string;
	exists: boolean;
	config: CodexConfig;
	warning?: string;
}

export const DEFAULT_CODEX_CONFIG: CodexConfig = {
	version: 1,
	ui: {
		enabled: "auto",
		...DEFAULT_CODEX_UI_PREFS,
	},
	tools: {
		enabled: "auto",
	},
	prompt: {
		enabled: "auto",
	},
};

export function getCodexConfigPath(env: NodeJS.ProcessEnv = process.env): string {
	const agentDir = env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent");
	return join(agentDir, "pi-codex-conversion.json");
}

function normalizeUiMode(value: unknown): CodexUiMode {
	return value === "always" || value === "never" ? value : "auto";
}

function normalizeToolsMode(value: unknown): CodexToolsMode {
	return value === "never" ? "never" : "auto";
}

function normalizePromptMode(value: unknown): CodexPromptMode {
	return value === "always" || value === "never" ? value : "auto";
}

export function normalizeCodexConfig(input: unknown, fallbackUi?: CodexUiPrefs): CodexConfig {
	const source = input && typeof input === "object" ? input as { ui?: unknown; tools?: unknown; prompt?: unknown } : {};
	const uiSource = source.ui && typeof source.ui === "object" ? source.ui as { enabled?: unknown } : {};
	const toolsSource = source.tools && typeof source.tools === "object" ? source.tools as { enabled?: unknown } : {};
	const promptSource = source.prompt && typeof source.prompt === "object" ? source.prompt as { enabled?: unknown } : {};
	const fallbackInput = fallbackUi ? { ...fallbackUi } : undefined;
	const normalizedUiPrefs = normalizeCodexUiPrefs(source.ui ?? fallbackInput ?? DEFAULT_CODEX_UI_PREFS);
	return {
		version: 1,
		ui: {
			enabled: normalizeUiMode(uiSource.enabled),
			...normalizedUiPrefs,
		},
		tools: {
			enabled: normalizeToolsMode(toolsSource.enabled),
		},
		prompt: {
			enabled: normalizePromptMode(promptSource.enabled),
		},
	};
}

function hasInvalidCodexConfigFields(input: unknown): boolean {
	if (!input || typeof input !== "object") return false;
	const source = input as { ui?: unknown; tools?: unknown; prompt?: unknown };
	const ui = source.ui && typeof source.ui === "object" ? source.ui as Record<string, unknown> : undefined;
	const tools = source.tools && typeof source.tools === "object" ? source.tools as Record<string, unknown> : undefined;
	const prompt = source.prompt && typeof source.prompt === "object" ? source.prompt as Record<string, unknown> : undefined;
	const invalidUiMode = ui && "enabled" in ui && ui.enabled !== "auto" && ui.enabled !== "always" && ui.enabled !== "never";
	const invalidToolsMode = tools && "enabled" in tools && tools.enabled !== "auto" && tools.enabled !== "never";
	const invalidPromptMode = prompt && "enabled" in prompt && prompt.enabled !== "auto" && prompt.enabled !== "always" && prompt.enabled !== "never";
	const invalidTheme = ui && "themeName" in ui && ui.themeName !== "Codex Dark" && ui.themeName !== "Codex Light";
	const invalidDensity = ui && "density" in ui && ui.density !== "compact" && ui.density !== "comfortable";
	const invalidBoolean = ["forceTheme", "showHeader", "compactTools", "promptPrefix"].some((key) => ui && key in ui && typeof ui[key] !== "boolean");
	return Boolean(invalidUiMode || invalidToolsMode || invalidPromptMode || invalidTheme || invalidDensity || invalidBoolean);
}

export function loadCodexConfig(fallbackUi: CodexUiPrefs = DEFAULT_CODEX_UI_PREFS, path = getCodexConfigPath()): LoadedCodexConfig {
	if (!existsSync(path)) {
		return { path, exists: false, config: normalizeCodexConfig({ ui: fallbackUi }, fallbackUi) };
	}

	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		return {
			path,
			exists: true,
			config: normalizeCodexConfig(parsed),
			warning: hasInvalidCodexConfigFields(parsed) ? "Invalid Codex config fields normalized to defaults" : undefined,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			path,
			exists: true,
			config: normalizeCodexConfig(DEFAULT_CODEX_CONFIG),
			warning: `Invalid Codex config ignored: ${message}`,
		};
	}
}

export function writeCodexConfig(config: CodexConfig, path = getCodexConfigPath()): void {
	mkdirSync(dirname(path), { recursive: true });
	const normalized = normalizeCodexConfig(config);
	const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
	renameSync(tempPath, path);
}

export function formatCodexConfigInfo(loaded: LoadedCodexConfig): string {
	return [
		`Path: ${loaded.path}`,
		`Exists: ${loaded.exists ? "yes" : "no"}`,
		...(loaded.warning ? [`Warning: ${loaded.warning}`] : []),
		"",
		JSON.stringify(loaded.config, null, 2),
	].join("\n");
}
