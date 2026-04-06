import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
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

function formatThinking(level: string | undefined): string {
	return !level || level === "off" ? "standard" : level;
}

export function applyCodexChrome(
	ctx: ExtensionContext,
	prefs: CodexUiPrefs,
	getThinkingLevel: () => string,
): void {
	if (prefs.forceTheme) {
		ctx.ui.setTheme(prefs.themeName);
	}
	ctx.ui.setToolsExpanded(!prefs.compactTools);
	ctx.ui.setEditorComponent((tui, theme, keybindings) => {
		const editor = new CodexEditor(tui, theme, keybindings);
		editor.setPrefs(prefs);
		return editor;
	});
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
	ctx.ui.setFooter(undefined);
}

export function clearCodexChrome(ctx: ExtensionContext, previousThemeName?: string | null): void {
	ctx.ui.setHeader(undefined);
	ctx.ui.setFooter(undefined);
	ctx.ui.setEditorComponent(undefined);
	ctx.ui.setToolsExpanded(true);
	if (previousThemeName) {
		ctx.ui.setTheme(previousThemeName);
	}
}

export function buildCodexUiInfoMessage(ctx: ExtensionContext, prefs: CodexUiPrefs): string {
	const contextUsage = ctx.getContextUsage();
	return [
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
