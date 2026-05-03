import assert from "node:assert/strict";
import test from "node:test";
import {
	registerCompactBuiltinToolRenderers,
	renderCompactBashCall,
	renderCompactBashResult,
} from "../src/tools/bash-tool-rendering.ts";

function createTheme() {
	return {
		fg: (_role: string, text: string) => text,
		bold: (text: string) => text,
	};
}

function trimRenderedLines(lines: string[]): string {
	return lines.map((line) => line.trimEnd()).join("\n");
}

test("compact bash renderer uses a flat self-rendered label", () => {
	const theme = createTheme();
	const call = renderCompactBashCall(
		{ command: "glab pipeline list --ref deslop", timeout: 20 },
		theme,
	);
	const result = renderCompactBashResult(
		{ content: [{ type: "text", text: "Pipelines\n[run] #1" }] },
		{ expanded: false, isPartial: false },
		theme,
	);

	assert.equal(
		trimRenderedLines(call.render(120)),
		"Bash: glab pipeline list --ref deslop (20s timeout)",
	);
	assert.equal(
		trimRenderedLines(result.render(120)),
		"✓ exit 0 (2 lines)\n\nPipelines\n[run] #1",
	);
});

test("compact built-in renderers make bash, read, and write self-rendered", () => {
	const registered: Array<{ name: string; renderShell?: string }> = [];
	const pi = {
		registerTool: (tool: { name: string; renderShell?: string }) =>
			registered.push(tool),
	};
	const ctx = { cwd: process.cwd() };

	registerCompactBuiltinToolRenderers(pi as never, ctx as never, true);

	assert.equal(
		registered.find((tool) => tool.name === "bash")?.renderShell,
		"self",
	);
	assert.equal(
		registered.find((tool) => tool.name === "read")?.renderShell,
		"self",
	);
	assert.equal(
		registered.find((tool) => tool.name === "write")?.renderShell,
		"self",
	);
});
