import {
	createBashToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
	type ExtensionAPI,
	type ExtensionContext,
	SettingsManager,
	type ToolDefinition,
	type ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

interface RenderTheme {
	fg(role: string, text: string): string;
	bold(text: string): string;
}

interface BashArgs {
	command?: unknown;
	timeout?: unknown;
}

interface BashResultLike {
	content: Array<{ type: string; text?: string }>;
	isError?: boolean;
}

interface BashRenderContextLike {
	isError?: boolean;
}

const PREVIEW_LINES = 5;

function plainText(result: BashResultLike): string {
	return result.content
		.filter((item) => item.type === "text" && typeof item.text === "string")
		.map((item) => item.text ?? "")
		.join("\n")
		.trim();
}

function lineCount(text: string): number {
	if (!text || text === "(no output)") return 0;
	return text.split("\n").length;
}

function preview(
	text: string,
	expanded: boolean,
): { text: string; skipped: number } {
	if (expanded || !text) return { text, skipped: 0 };
	const lines = text.split("\n");
	const visible = lines.slice(-PREVIEW_LINES);
	return {
		text: visible.join("\n"),
		skipped: Math.max(0, lines.length - visible.length),
	};
}

function shortCommand(command: string, max = 120): string {
	const singleLine = command.replace(/\s+/g, " ").trim();
	if (singleLine.length <= max) return singleLine;
	return `${singleLine.slice(0, max - 1)}…`;
}

function extractExitCode(text: string): number | undefined {
	const match = text.match(/Command exited with code (\d+)/);
	return match ? Number(match[1]) : undefined;
}

export function renderCompactBashCall(
	args: BashArgs,
	theme: RenderTheme,
): Text {
	const command =
		typeof args.command === "string" && args.command.trim().length > 0
			? shortCommand(args.command)
			: "…";
	const timeout =
		typeof args.timeout === "number"
			? theme.fg("muted", ` (${args.timeout}s timeout)`)
			: "";
	return new Text(
		`${theme.bold("Bash:")} ${theme.fg("muted", command)}${timeout}`,
		0,
		0,
	);
}

export function renderCompactBashResult(
	result: BashResultLike,
	options: ToolRenderResultOptions,
	theme: RenderTheme,
	context: BashRenderContextLike = {},
): Text {
	const output = plainText(result);
	const lines = lineCount(output);
	const countLabel = lines === 1 ? "1 line" : `${lines} lines`;
	const isError = Boolean(context.isError || result.isError);
	const exitCode = isError ? extractExitCode(output) : 0;
	const status = options.isPartial
		? theme.fg("muted", `running (${countLabel})`)
		: isError
			? theme.fg("error", `exit ${exitCode ?? 1} (${countLabel})`)
			: `${theme.fg("success", "✓")} ${theme.fg("muted", `exit 0 (${countLabel})`)}`;
	const shown = preview(output, options.expanded);
	const outputLines: string[] = [status];
	if (shown.skipped > 0) {
		outputLines.push(theme.fg("muted", `… ${shown.skipped} earlier lines`));
	}
	if (shown.text) {
		outputLines.push("", theme.fg("toolOutput", shown.text));
	}
	return new Text(outputLines.join("\n"), 0, 0);
}

export function registerCompactBuiltinToolRenderers(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	compact: boolean,
): void {
	const settings = SettingsManager.create(ctx.cwd);
	registerBashToolRenderer(pi, ctx, settings, compact);
	registerReadToolRenderer(pi, ctx, settings, compact);
	registerWriteToolRenderer(pi, ctx, compact);
}

function registerBashToolRenderer(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	settings: SettingsManager,
	compact: boolean,
): void {
	const base = createBashToolDefinition(ctx.cwd, {
		commandPrefix: settings.getShellCommandPrefix(),
		shellPath: settings.getShellPath(),
	});

	if (!compact) {
		pi.registerTool(base);
		return;
	}

	pi.registerTool({
		...base,
		renderShell: "self",
		renderCall: (args, theme) => renderCompactBashCall(args as BashArgs, theme),
		renderResult: (result, options, theme, context) =>
			renderCompactBashResult(result, options, theme, context),
	} satisfies ToolDefinition<any, any, any>);
}

function registerReadToolRenderer(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	settings: SettingsManager,
	compact: boolean,
): void {
	const base = createReadToolDefinition(ctx.cwd, {
		autoResizeImages: settings.getImageAutoResize(),
	});

	if (!compact) {
		pi.registerTool(base);
		return;
	}

	pi.registerTool({
		...(base as ToolDefinition<any, any, any>),
		renderShell: "self",
	});
}

function registerWriteToolRenderer(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	compact: boolean,
): void {
	const base = createWriteToolDefinition(ctx.cwd);

	if (!compact) {
		pi.registerTool(base);
		return;
	}

	pi.registerTool({
		...(base as ToolDefinition<any, any, any>),
		renderShell: "self",
	});
}
