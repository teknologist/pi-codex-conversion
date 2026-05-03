import { type ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { CodexUiConfig } from "./config.ts";
import { CodexEditor } from "./editor.ts";
import type { CodexUiPrefs } from "./prefs.ts";

function basename(path: string): string {
	const normalized = path.replace(/\/$/, "");
	const parts = normalized.split("/");
	return parts[parts.length - 1] || path;
}

function fitVisible(text: string, width: number): string {
	const truncated = truncateToWidth(text, width);
	return truncated + " ".repeat(Math.max(0, width - visibleWidth(truncated)));
}

const TOOL_SURFACE_BG_ANSI = "\u001b[48;2;0;0;0m";
const patchedThemes = new WeakSet<object>();
let themePrototypePatched = false;

interface ThemeWithBackgroundAliases {
	getBgAnsi(color: string): string;
}

function formatThinking(level: string | undefined): string {
	return !level || level === "off" ? "standard" : level;
}

function isToolBackgroundAlias(color: string): boolean {
	return color === "toolBg" || color === "background";
}

function patchThemePrototypeBackgroundAliases(): void {
	if (themePrototypePatched) return;
	const prototype = Theme.prototype as ThemeWithBackgroundAliases;
	const originalGetBgAnsi = prototype.getBgAnsi;
	prototype.getBgAnsi = function getBgAnsiWithToolAliases(
		color: string,
	): string {
		if (isToolBackgroundAlias(color)) return TOOL_SURFACE_BG_ANSI;
		return originalGetBgAnsi.call(this, color);
	};
	themePrototypePatched = true;
}

export function patchToolBackgroundAliases(
	theme: ThemeWithBackgroundAliases,
): void {
	patchThemePrototypeBackgroundAliases();
	if (patchedThemes.has(theme)) return;
	const originalGetBgAnsi = theme.getBgAnsi.bind(theme);
	theme.getBgAnsi = (color: string) => {
		if (isToolBackgroundAlias(color)) return TOOL_SURFACE_BG_ANSI;
		return originalGetBgAnsi(color);
	};
	patchedThemes.add(theme);
}

export function applyCodexChrome(
	ctx: ExtensionContext,
	prefs: CodexUiPrefs,
	getThinkingLevel: () => string,
	options: { editor?: boolean } = {},
): void {
	const applyEditor = options.editor ?? true;
	if (prefs.forceTheme) {
		ctx.ui.setTheme(prefs.themeName);
	}
	patchToolBackgroundAliases(ctx.ui.theme);
	ctx.ui.setToolsExpanded(!prefs.compactTools);
	if (applyEditor) {
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			const editor = new CodexEditor(tui, theme, keybindings);
			editor.setPrefs(prefs);
			return editor;
		});
	}
	ctx.ui.setHeader(
		prefs.showHeader
			? (_tui, theme) => ({
					invalidate() {},
					render(width: number): string[] {
						const model = ctx.model?.id ?? "no-model";
						const thinking = formatThinking(getThinkingLevel());
						return [
							fitVisible(
								`${theme.fg("muted", model)} ${theme.fg("borderMuted", "·")} ${theme.fg("dim", thinking)} ${theme.fg("borderMuted", "·")} ${theme.fg("dim", basename(ctx.cwd))}`,
								width,
							),
						];
					},
				})
			: undefined,
	);
}

export function clearCodexChrome(
	ctx: ExtensionContext,
	previousThemeName?: string | null,
): void {
	ctx.ui.setHeader(undefined);
	ctx.ui.setEditorComponent(undefined);
	ctx.ui.setToolsExpanded(true);
	if (previousThemeName) {
		ctx.ui.setTheme(previousThemeName);
	}
}

export function clearCodexChromeExceptEditor(
	ctx: ExtensionContext,
	previousThemeName?: string | null,
): void {
	ctx.ui.setHeader(undefined);
	ctx.ui.setToolsExpanded(true);
	if (previousThemeName) {
		ctx.ui.setTheme(previousThemeName);
	}
}

export function buildCodexUiInfoMessage(
	ctx: ExtensionContext,
	prefs: CodexUiPrefs,
): string {
	const contextUsage = ctx.getContextUsage();
	const maybeMode =
		"enabled" in prefs ? [`UI mode: ${(prefs as CodexUiConfig).enabled}`] : [];
	return [
		...maybeMode,
		`Theme: ${prefs.themeName}`,
		`Density: ${prefs.density}`,
		`Force theme: ${prefs.forceTheme ? "on" : "off"}`,
		`Header: ${prefs.showHeader ? "on" : "off"}`,
		`Compact tools: ${prefs.compactTools ? "on" : "off"}`,
		`Prompt prefix: ${prefs.promptPrefix ? "on" : "off"}`,
		`Model: ${ctx.model?.id ?? "none"}`,
		`Context: ${contextUsage?.tokens ?? "unknown"}/${contextUsage?.contextWindow ?? "unknown"}`,
		`CWD: ${ctx.cwd}`,
	].join("\n");
}
