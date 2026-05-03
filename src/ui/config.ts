import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_CODEX_UI_PREFS, normalizeCodexUiPrefs, type CodexUiPrefs } from "./prefs.ts";

export interface CodexConfig {
	version: 1;
	ui: CodexUiPrefs;
}

export interface LoadedCodexConfig {
	path: string;
	exists: boolean;
	config: CodexConfig;
	warning?: string;
}

export function getCodexConfigPath(env: NodeJS.ProcessEnv = process.env): string {
	const agentDir = env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent");
	return join(agentDir, "pi-codex-conversion.json");
}

export function normalizeCodexConfig(input: unknown, fallbackUi: CodexUiPrefs = DEFAULT_CODEX_UI_PREFS): CodexConfig {
	const source = input && typeof input === "object" ? input as { ui?: unknown } : {};
	return {
		version: 1,
		ui: normalizeCodexUiPrefs(source.ui ?? fallbackUi),
	};
}

export function loadCodexConfig(fallbackUi: CodexUiPrefs = DEFAULT_CODEX_UI_PREFS, path = getCodexConfigPath()): LoadedCodexConfig {
	if (!existsSync(path)) {
		return { path, exists: false, config: normalizeCodexConfig({ ui: fallbackUi }, fallbackUi) };
	}

	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		return { path, exists: true, config: normalizeCodexConfig(parsed, fallbackUi) };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			path,
			exists: true,
			config: normalizeCodexConfig({ ui: fallbackUi }, fallbackUi),
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
