export type CodexThemeName = "Codex Dark" | "Codex Light";
export type CodexDensity = "compact" | "comfortable";

export interface CodexUiPrefs {
	themeName: CodexThemeName;
	density: CodexDensity;
	forceTheme: boolean;
	showHeader: boolean;
	showFooter: boolean;
	compactTools: boolean;
	promptPrefix: boolean;
}

export const CODEX_UI_PREFS_ENTRY = "codex-ui-prefs";

export const DEFAULT_CODEX_UI_PREFS: CodexUiPrefs = {
	themeName: "Codex Dark",
	density: "compact",
	forceTheme: true,
	showHeader: true,
	showFooter: true,
	compactTools: true,
	promptPrefix: true,
};

type MaybeCustomEntry = {
	type?: string;
	customType?: string;
	data?: unknown;
};

export function normalizeCodexUiPrefs(input: unknown): CodexUiPrefs {
	if (!input || typeof input !== "object") return { ...DEFAULT_CODEX_UI_PREFS };
	const source = input as Partial<CodexUiPrefs>;
	return {
		themeName: source.themeName === "Codex Light" ? "Codex Light" : "Codex Dark",
		density: source.density === "comfortable" ? "comfortable" : "compact",
		forceTheme: source.forceTheme ?? DEFAULT_CODEX_UI_PREFS.forceTheme,
		showHeader: source.showHeader ?? DEFAULT_CODEX_UI_PREFS.showHeader,
		showFooter: source.showFooter ?? DEFAULT_CODEX_UI_PREFS.showFooter,
		compactTools: source.compactTools ?? DEFAULT_CODEX_UI_PREFS.compactTools,
		promptPrefix: source.promptPrefix ?? DEFAULT_CODEX_UI_PREFS.promptPrefix,
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

export function isCodexTheme(name: string | undefined): name is CodexThemeName {
	return name === "Codex Dark" || name === "Codex Light";
}
