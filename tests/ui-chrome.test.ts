import test from "node:test";
import assert from "node:assert/strict";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { applyCodexChrome } from "../src/ui/chrome.ts";
import { DEFAULT_CODEX_UI_PREFS } from "../src/ui/prefs.ts";

test("applyCodexChrome can skip editor replacement to preserve modal focus", () => {
	const calls: string[] = [];
	const ctx = {
		cwd: "/tmp/project",
		model: { id: "codex" },
		ui: {
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
			setTheme: () => calls.push("theme"),
			setToolsExpanded: () => calls.push("tools"),
			setEditorComponent: () => calls.push("editor"),
			setHeader: () => calls.push("header"),
		},
	} as unknown as ExtensionContext;

	applyCodexChrome(ctx, DEFAULT_CODEX_UI_PREFS, () => "off");

	assert.deepEqual(calls, ["theme", "tools", "editor", "header"]);
});
