import assert from "node:assert/strict";
import test from "node:test";
import {
	applyToolSuccessSurface,
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

function createSurfaceTheme() {
	return {
		...createTheme(),
		bg: (role: "toolSuccessBg", text: string) => `<${role}>${text}</${role}>`,
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

test("compact bash renderer paints self-rendered lines with the tool surface", () => {
	const theme = createSurfaceTheme();
	const call = renderCompactBashCall({ command: "npm test" }, theme);
	const result = renderCompactBashResult(
		{ content: [{ type: "text", text: "one\ntwo" }] },
		{ expanded: false, isPartial: false },
		theme,
	);

	assert.match(call.render(80)[0], /^<toolSuccessBg>/);
	assert.ok(
		result.render(80).every((line) => line.startsWith("<toolSuccessBg>")),
	);
});

test("compact surface helper paints components that support custom backgrounds", () => {
	let painted = "";
	const component = {
		setCustomBgFn: (bg: (text: string) => string) => {
			painted = bg("content");
		},
	};

	assert.equal(
		applyToolSuccessSurface(component, createSurfaceTheme()),
		component,
	);
	assert.equal(painted, "<toolSuccessBg>content</toolSuccessBg>");
});

test("compact built-in renderers make bash, read, and write self-rendered", () => {
	const registered: any[] = [];
	const pi = {
		registerTool: (tool: { name: string; renderShell?: string }) =>
			registered.push(tool),
	};
	const ctx = { cwd: process.cwd() };

	registerCompactBuiltinToolRenderers(pi as never, ctx as never, true);

	const read = registered.find((tool) => tool.name === "read");
	const write = registered.find((tool) => tool.name === "write");
	const renderContext = {
		args: {},
		argsComplete: true,
		expanded: false,
		isPartial: false,
		state: {},
		showImages: false,
	};

	assert.equal(
		registered.find((tool) => tool.name === "bash")?.renderShell,
		"self",
	);
	assert.equal(read?.renderShell, "self");
	assert.equal(write?.renderShell, "self");
	assert.match(
		read
			.renderCall({ path: "src/index.ts" }, createSurfaceTheme(), renderContext)
			.render(80)[0],
		/^<toolSuccessBg>/,
	);
	assert.match(
		write
			.renderCall(
				{ path: "tmp.txt", content: "hello" },
				createSurfaceTheme(),
				renderContext,
			)
			.render(80)[0],
		/^<toolSuccessBg>/,
	);
});
