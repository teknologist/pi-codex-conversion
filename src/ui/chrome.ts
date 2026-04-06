import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { VERSION } from "@mariozechner/pi-coding-agent";
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

function formatContextLeft(percent: number | null | undefined): string | undefined {
	if (percent == null) return undefined;
	const left = Math.max(0, Math.min(100, Math.round(100 - percent)));
	return `${left}% ctx left`;
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
						const boxWidth = width >= 60 ? 56 : Math.max(28, width);
						const model = ctx.model?.id ?? "no-model";
						const thinking = formatThinking(getThinkingLevel());
						const border = (text: string) => theme.fg("borderAccent", text);
						const top = border(`╭${"─".repeat(Math.max(0, boxWidth - 2))}╮`);
						const title =
							border("│") +
							fitVisible(
								` ${theme.fg("dim", ">_")} ${theme.bold("CODEX MODE")} ${theme.fg("dim", `(pi ${VERSION})`)}`,
								boxWidth - 2,
							) +
							border("│");
						const gap = border("│") + fitVisible("", boxWidth - 2) + border("│");
						const line2 =
							border("│") +
							fitVisible(
								` ${theme.fg("dim", "model".padEnd(10))}${model} ${theme.fg("accent", "·")} ${thinking}`,
								boxWidth - 2,
							) +
							border("│");
						const line3 =
							border("│") +
							fitVisible(
								` ${theme.fg("dim", "cwd".padEnd(10))}${basename(ctx.cwd)} ${theme.fg("dim", "· /codex-ui for settings")}`,
								boxWidth - 2,
							) +
							border("│");
						const bottom = border(`╰${"─".repeat(Math.max(0, boxWidth - 2))}╯`);
						return [top, title, gap, line2, line3, bottom];
					},
			  })
			: undefined,
	);
	ctx.ui.setFooter(
		prefs.showFooter
			? (_tui, theme) => ({
					invalidate() {},
					render(width: number): string[] {
						const modelId = ctx.model?.id ?? "no-model";
						const thinking = formatThinking(getThinkingLevel());
						const contextUsage = ctx.getContextUsage();
						const line = theme.fg(
							"dim",
							[
								modelId,
								thinking,
								formatContextLeft(contextUsage?.percent),
								basename(ctx.cwd),
							]
								.filter((part): part is string => Boolean(part))
								.join(` ${theme.fg("borderMuted", "·")} `),
						);
						return [truncateToWidth(line, width)];
					},
			  })
			: undefined,
	);
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
		`Footer: ${prefs.showFooter ? "on" : "off"}`,
		`Compact tools: ${prefs.compactTools ? "on" : "off"}`,
		`Prompt prefix: ${prefs.promptPrefix ? "on" : "off"}`,
		`Model: ${ctx.model?.id ?? "none"}`,
		`Context: ${contextUsage?.tokens ?? "unknown"}/${contextUsage?.contextWindow ?? "unknown"}`,
		`CWD: ${ctx.cwd}`,
	].join("\n");
}
