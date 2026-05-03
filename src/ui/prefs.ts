export type CodexThemeName = "Codex Dark" | "Codex Light";
export type CodexDensity = "compact" | "comfortable";

export interface CodexUiPrefs {
	themeName: CodexThemeName;
	density: CodexDensity;
	forceTheme: boolean;
	showHeader: boolean;
	compactTools: boolean;
	promptPrefix: boolean;
}

export const CODEX_UI_PREFS_ENTRY = "codex-ui-prefs";

export const DEFAULT_CODEX_UI_PREFS: CodexUiPrefs = {
	themeName: "Codex Dark",
	density: "compact",
	forceTheme: true,
	showHeader: false,
	compactTools: true,
	promptPrefix: false,
};

type MaybeCustomEntry = {
	type?: string;
	customType?: string;
	data?: unknown;
};

export type CodexUiPrefsEntry = MaybeCustomEntry;

export function normalizeCodexUiPrefs(input: unknown): CodexUiPrefs {
	if (!input || typeof input !== "object") return { ...DEFAULT_CODEX_UI_PREFS };
	const source = input as Partial<CodexUiPrefs>;
	return {
		themeName: source.themeName === "Codex Light" ? "Codex Light" : "Codex Dark",
		density: source.density === "comfortable" ? "comfortable" : "compact",
		forceTheme: typeof source.forceTheme === "boolean" ? source.forceTheme : DEFAULT_CODEX_UI_PREFS.forceTheme,
		showHeader: typeof source.showHeader === "boolean" ? source.showHeader : DEFAULT_CODEX_UI_PREFS.showHeader,
		compactTools: typeof source.compactTools === "boolean" ? source.compactTools : DEFAULT_CODEX_UI_PREFS.compactTools,
		promptPrefix: typeof source.promptPrefix === "boolean" ? source.promptPrefix : DEFAULT_CODEX_UI_PREFS.promptPrefix,
	};
}

export function loadCodexUiPrefs(entries: ReadonlyArray<MaybeCustomEntry>): CodexUiPrefs {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry?.type === "custom" && entry.customType === CODEX_UI_PREFS_ENTRY) {
			return normalizeCodexUiPrefs(entry.data);
		}
	}
	return { ...DEFAULT_CODEX_UI_PREFS };
}

export function resolveSessionCodexUiPrefs(entries: ReadonlyArray<CodexUiPrefsEntry>): CodexUiPrefs {
	return loadCodexUiPrefs(entries);
}

export function isCodexTheme(name: string | undefined): name is CodexThemeName {
	return name === "Codex Dark" || name === "Codex Light";
}
