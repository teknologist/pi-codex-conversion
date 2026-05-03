import assert from "node:assert/strict";
import test from "node:test";
import { type ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import {
	applyCodexChrome,
	patchToolBackgroundAliases,
} from "../src/ui/chrome.ts";
import { DEFAULT_CODEX_UI_PREFS } from "../src/ui/prefs.ts";

function createTheme() {
	return {
		getBgAnsi: (key: string) => {
			if (key === "toolSuccessBg") return "\u001b[48;2;0;0;0m";
			throw new Error(`Unknown theme background color: ${key}`);
		},
	};
}

test("applyCodexChrome can skip editor replacement to preserve modal focus", () => {
	const calls: string[] = [];
	const ctx = {
		cwd: "/tmp/project",
		model: { id: "codex" },
		ui: {
			theme: createTheme(),
			setTheme: () => calls.push("theme"),
			setToolsExpanded: () => calls.push("tools"),
			setEditorComponent: () => calls.push("editor"),
			setHeader: () => calls.push("header"),
		},
	} as unknown as ExtensionContext;

	applyCodexChrome(ctx, DEFAULT_CODEX_UI_PREFS, () => "off", { editor: false });

	assert.deepEqual(calls, ["theme", "tools", "header"]);
});

test("applyCodexChrome replaces editor by default", () => {
	const calls: string[] = [];
	const ctx = {
		cwd: "/tmp/project",
		model: { id: "codex" },
		ui: {
			theme: createTheme(),
			setTheme: () => calls.push("theme"),
			setToolsExpanded: () => calls.push("tools"),
			setEditorComponent: () => calls.push("editor"),
			setHeader: () => calls.push("header"),
		},
	} as unknown as ExtensionContext;

	applyCodexChrome(ctx, DEFAULT_CODEX_UI_PREFS, () => "off");

	assert.deepEqual(calls, ["theme", "tools", "editor", "header"]);
});

test("patchToolBackgroundAliases maps pi-pretty aliases to pure black tool background", () => {
	const theme = createTheme();

	patchToolBackgroundAliases(theme);

	assert.equal(theme.getBgAnsi("toolBg"), "\u001b[48;2;0;0;0m");
	assert.equal(theme.getBgAnsi("background"), "\u001b[48;2;0;0;0m");
});

test("patchToolBackgroundAliases patches real Theme instances for pi-pretty truecolor parsing", () => {
	const theme = new Theme(
		{ text: "#ffffff" } as never,
		{ toolSuccessBg: "#000000" } as never,
		"dark" as never,
	);

	patchToolBackgroundAliases(theme);

	assert.equal(theme.getBgAnsi("toolBg" as never), "\u001b[48;2;0;0;0m");
	assert.equal(theme.getBgAnsi("background" as never), "\u001b[48;2;0;0;0m");
	assert.equal(theme.getBgAnsi("toolSuccessBg"), "\u001b[48;5;16m");
});
