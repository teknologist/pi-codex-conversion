import { Type } from "typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";
import { executePatch } from "../patch/core.ts";
import { ExecutePatchError, type ExecutePatchResult } from "../patch/types.ts";
import { formatApplyPatchSummary, formatPatchTarget, renderApplyPatchCall } from "./apply-patch-rendering.ts";

const APPLY_PATCH_PARAMETERS = Type.Object({
	input: Type.String({
		description: "Full patch text. Use *** Begin Patch / *** End Patch with Add/Update/Delete File sections.",
	}),
});

interface ApplyPatchRenderState {
	cwd: string;
	patchText: string;
	collapsed: string;
	expanded: string;
	status: "pending" | "partial_failure" | "failed";
	failedTarget?: string;
}

interface ApplyPatchSuccessDetails {
	status: "success";
	result: ExecutePatchResult;
	preview: ApplyPatchPreview;
}

interface ApplyPatchPartialFailureDetails {
	status: "partial_failure";
	result: ExecutePatchResult;
	error: string;
	failedTarget?: string;
	appliedFiles: string[];
	failedFiles: string[];
	preview: ApplyPatchPreview;
	recoveryInstructions: {
		mustReadFiles: string[];
		mustNotReadFiles: string[];
	};
}

type ApplyPatchToolDetails = ApplyPatchSuccessDetails | ApplyPatchPartialFailureDetails;

interface ApplyPatchPreview {
	collapsed: string;
	expanded: string;
}

const applyPatchRenderStates = new Map<string, ApplyPatchRenderState>();

interface ApplyPatchRenderContextLike {
	toolCallId?: string;
	cwd?: string;
	expanded?: boolean;
	argsComplete?: boolean;
}

function parseApplyPatchParams(params: unknown): { patchText: string } {
	if (!params || typeof params !== "object" || !("input" in params) || typeof params.input !== "string") {
		throw new Error("apply_patch requires a string 'input' parameter");
	}
	return { patchText: params.input };
}

function isApplyPatchToolDetails(details: unknown): details is ApplyPatchToolDetails {
	if (typeof details !== "object" || details === null || !("status" in details) || !("result" in details)) {
		return false;
	}
	const preview = (details as { preview?: unknown }).preview;
	return (
		typeof preview === "object" &&
		preview !== null &&
		typeof (preview as { collapsed?: unknown }).collapsed === "string" &&
		typeof (preview as { expanded?: unknown }).expanded === "string"
	);
}

function setApplyPatchRenderState(
	toolCallId: string,
	patchText: string,
	cwd: string,
	status: "pending" | "partial_failure" | "failed" = "pending",
	failedTarget?: string,
): void {
	const collapsed = formatApplyPatchSummary(patchText, cwd);
	const expanded = renderApplyPatchCall(patchText, cwd);
	applyPatchRenderStates.set(toolCallId, {
		cwd,
		patchText,
		collapsed,
		expanded,
		status,
		failedTarget,
	});
}

function getApplyPatchPreview(toolCallId: string, patchText: string, cwd: string): ApplyPatchPreview {
	const cached = applyPatchRenderStates.get(toolCallId);
	if (cached) {
		return { collapsed: cached.collapsed, expanded: cached.expanded };
	}
	return {
		collapsed: formatApplyPatchSummary(patchText, cwd),
		expanded: renderApplyPatchCall(patchText, cwd),
	};
}

function markApplyPatchPartialFailure(toolCallId: string, failedTarget?: string): void {
	markApplyPatchFailure(toolCallId, "partial_failure", failedTarget);
}

function markApplyPatchFailure(toolCallId: string, status: "partial_failure" | "failed", failedTarget?: string): void {
	const existing = applyPatchRenderStates.get(toolCallId);
	if (!existing) {
		return;
	}
	applyPatchRenderStates.set(toolCallId, {
		...existing,
		status,
		failedTarget,
	});
}

function renderPartialFailureCall(
	text: string,
	theme: { fg(role: string, text: string): string },
	failedTarget?: string,
): string {
	const lines = text.split("\n");
	if (lines.length === 0) {
		return theme.fg("muted", "edit incomplete");
	}
	lines[0] = `${lines[0]} ${theme.fg("muted", "(incomplete)")}`;
	const failedLineIndexes = new Set<number>();
	if (failedTarget) {
		for (let i = 0; i < lines.length; i += 1) {
			const failedLine = markFailedTargetLine(lines[i], failedTarget);
			if (failedLine) {
				lines[i] = failedLine;
				failedLineIndexes.add(i);
			}
		}
	}
	return lines
		.map((line, index) => {
			if (failedLineIndexes.has(index)) {
				return theme.fg("muted", line);
			}
			return line;
		})
		.join("\n");
}

function renderFailedCall(
	text: string,
	theme: { fg(role: string, text: string): string },
	failedTarget?: string,
): string {
	const lines = text.split("\n");
	if (lines.length === 0) {
		return theme.fg("muted", "edit failed");
	}
	lines[0] = `${lines[0]} ${theme.fg("muted", "(failed)")}`;
	const failedLineIndexes = new Set<number>();
	if (failedTarget) {
		for (let i = 0; i < lines.length; i += 1) {
			const failedLine = markFailedTargetLine(lines[i], failedTarget);
			if (failedLine) {
				lines[i] = failedLine;
				failedLineIndexes.add(i);
			}
		}
	}
	return lines
		.map((line, index) => {
			if (failedLineIndexes.has(index)) {
				return theme.fg("muted", line);
			}
			return line;
		})
		.join("\n");
}

function markFailedTargetLine(line: string, failedTarget: string): string | undefined {
	const suffixMatch = line.match(/(?: (?:added|deleted|edited))? (\(\+\d+ -\d+\))$/);
	if (!suffixMatch) {
		return undefined;
	}
	const suffix = ` ${suffixMatch[1]}`;
	const prefixAndTarget = line.slice(0, -suffix.length);
	const candidatePrefixes = [" ", "  ", "    "];
	for (const prefix of candidatePrefixes) {
		const operationMatch = prefixAndTarget.match(
			new RegExp(`^${prefix.replace(/ /g, "\\s")}${escapeRegExp(failedTarget)} (added|deleted|edited)$`),
		);
		if (operationMatch) {
			return `${prefix}${failedTarget} failed${suffix}`;
		}
		if (prefixAndTarget === `${prefix}${failedTarget}`) {
			return `${prefix}${failedTarget} failed${suffix}`;
		}
	}
	return undefined;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summarizePatchCounts(result: ExecutePatchResult): string {
	return [
		`changed ${result.changedFiles.length} file${result.changedFiles.length === 1 ? "" : "s"}`,
		`created ${result.createdFiles.length}`,
		`deleted ${result.deletedFiles.length}`,
		`moved ${result.movedFiles.length}`,
	].join(", ");
}

function uniqueStrings(values: Array<string | undefined>): string[] {
	return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

function buildPartialFailureMessage(message: string, failedTarget: string | undefined, result: ExecutePatchResult): string {
	const failedFiles = uniqueStrings([failedTarget]);
	const appliedFiles = result.changedFiles.filter((path) => !failedFiles.includes(path));
	const lines = [message];
	if (failedFiles.length > 0) {
		lines.push(`Failed file: ${failedFiles.join(", ")}`);
		lines.push(`Recovery: MUST read ${failedFiles.join(", ")} before retrying.`);
	}
	if (appliedFiles.length > 0) {
		lines.push(`Applied files: ${appliedFiles.join(", ")}`);
		lines.push(`Recovery: MUST NOT reread ${appliedFiles.join(", ")} unless a specific dependency requires it.`);
	}
	return lines.join("\n");
}

function describeFailedAction(error: ExecutePatchError, cwd: string): string | undefined {
	if (!error.failedAction) {
		return undefined;
	}
	return formatPatchTarget(error.failedAction.path, error.failedAction.type === "update" ? error.failedAction.movePath : undefined, cwd);
}

export type { ExecutePatchResult } from "../patch/types.ts";

export function clearApplyPatchRenderState(): void {
	applyPatchRenderStates.clear();
}

const renderApplyPatchCallWithOptionalContext: any = (
	args: { input?: unknown },
	theme: { fg(role: string, text: string): string; bold(text: string): string },
	context?: ApplyPatchRenderContextLike,
) => {
	if (context?.argsComplete === false) {
		return new Text(theme.fg("dim", "applying patch"), 0, 0);
	}
	const patchText = typeof args.input === "string" ? args.input : "";
	if (patchText.trim().length === 0) {
		return new Text(theme.fg("dim", "applying patch"), 0, 0);
	}
	const cached = context?.toolCallId ? applyPatchRenderStates.get(context.toolCallId) : undefined;
	const cwd = context?.cwd ?? cached?.cwd;
	const effectivePatchText = cached?.patchText ?? patchText;
	const baseText = context?.expanded
		? cached?.expanded ?? renderApplyPatchCall(effectivePatchText, cwd)
		: cached?.collapsed ?? formatApplyPatchSummary(effectivePatchText, cwd);
	if (baseText.trim().length === 0) {
		if (cached?.status === "failed") {
			return new Text(theme.fg("muted", "edit failed"), 0, 0);
		}
		return new Text(theme.fg("dim", "applying patch"), 0, 0);
	}
	const text =
		cached?.status === "partial_failure"
			? renderPartialFailureCall(baseText, theme, cached.failedTarget)
			: cached?.status === "failed"
				? renderFailedCall(baseText, theme, cached.failedTarget)
				: baseText;
	return new Text(text, 0, 0);
};

export function registerApplyPatchTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "apply_patch",
		label: "apply_patch",
		description: "Use `apply_patch` to edit files. Send the full patch in `input`.",
		promptSnippet: "Edit files with a patch.",
		promptGuidelines: [
			"Prefer apply_patch for focused textual edits instead of rewriting whole files.",
			"When one task needs coordinated edits across multiple files, send them in a single apply_patch call when one coherent patch will do.",
		],
		parameters: APPLY_PATCH_PARAMETERS,
		async execute(toolCallId, params, signal, _onUpdate, ctx) {
			if (signal?.aborted) {
				throw new Error("apply_patch aborted");
			}

			const typedParams = parseApplyPatchParams(params);
			setApplyPatchRenderState(toolCallId, typedParams.patchText, ctx.cwd);
			let result: ExecutePatchResult;
			try {
				result = executePatch({ cwd: ctx.cwd, patchText: typedParams.patchText });
			} catch (error) {
				if (error instanceof ExecutePatchError) {
					const partial = error.hasPartialSuccess();
					const failedTarget = describeFailedAction(error, ctx.cwd);
					const prefix = partial
						? `apply_patch partially failed after ${summarizePatchCounts(error.result)}`
						: "apply_patch failed";
					const message = failedTarget ? `${prefix} while patching ${failedTarget}: ${error.message}` : `${prefix}: ${error.message}`;
					if (partial) {
						const failedFiles = uniqueStrings([failedTarget]);
						const appliedFiles = error.result.changedFiles.filter((path) => !failedFiles.includes(path));
						const recoveryMessage = buildPartialFailureMessage(message, failedTarget, error.result);
						markApplyPatchPartialFailure(toolCallId, failedTarget);
						const preview = getApplyPatchPreview(toolCallId, typedParams.patchText, ctx.cwd);
						return {
							content: [{ type: "text", text: recoveryMessage }],
							details: {
								status: "partial_failure",
								result: error.result,
								error: recoveryMessage,
								failedTarget,
								appliedFiles,
								failedFiles,
								preview,
								recoveryInstructions: {
									mustReadFiles: failedFiles,
									mustNotReadFiles: appliedFiles,
								},
							} satisfies ApplyPatchPartialFailureDetails,
						};
					}
					markApplyPatchFailure(toolCallId, "failed", failedTarget);
					throw new Error(message);
				}
				markApplyPatchFailure(toolCallId, "failed");
				throw error;
			}
			const summary = [
				"Applied patch successfully.",
				`Changed files: ${result.changedFiles.length}`,
				`Created files: ${result.createdFiles.length}`,
				`Deleted files: ${result.deletedFiles.length}`,
				`Moved files: ${result.movedFiles.length}`,
				`Fuzz: ${result.fuzz}`,
			].join("\n");

			return {
				content: [{ type: "text", text: summary }],
				details: {
					status: "success",
					result,
					preview: getApplyPatchPreview(toolCallId, typedParams.patchText, ctx.cwd),
				} satisfies ApplyPatchSuccessDetails,
			};
		},
		renderCall: renderApplyPatchCallWithOptionalContext,
		renderResult(result, { isPartial, expanded }, theme) {
			if (isPartial) {
				return new Text(theme.fg("dim", "applying patch"), 0, 0);
			}

			if (!isApplyPatchToolDetails(result.details)) {
				return new Container();
			}

			if (result.details.status === "partial_failure") {
				if (expanded && result.details.preview.expanded.trim().length > 0) {
					return new Text(renderPartialFailureCall(result.details.preview.expanded, theme, result.details.failedTarget), 0, 0);
				}
				return new Container();
			}

			if (expanded && result.details.preview.expanded.trim().length > 0) {
				return new Text(result.details.preview.expanded, 0, 0);
			}

			return new Container();
		},
	});
}
