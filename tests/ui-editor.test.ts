import test from "node:test";
import assert from "node:assert/strict";
import { CustomEditor } from "@mariozechner/pi-coding-agent";
import { CodexEditor } from "../src/ui/editor.ts";

function withMockedBaseRender(lines: string[], run: (editor: CodexEditor) => void): void {
	const originalRender = CustomEditor.prototype.render;
	CustomEditor.prototype.render = function mockedRender() {
		return [...lines];
	};

	try {
		const editor = Object.create(CodexEditor.prototype) as CodexEditor;
		run(editor);
	} finally {
		CustomEditor.prototype.render = originalRender;
	}
}

test("CodexEditor strips paired top/bottom editor chrome lines", () => {
	withMockedBaseRender([
		"────────────────────",
		"normal content",
		"────────────────────",
	], (editor) => {
		(editor as any).prefs = { density: "compact" };
		assert.deepEqual(editor.render(40), ["normal content"]);
	});
});

test("CodexEditor preserves a user-authored top rule when the bottom line is a real scroll indicator", () => {
	withMockedBaseRender([
		"────────────────────",
		"  real content line",
		"─── ↓ 3 more ───────",
	], (editor) => {
		(editor as any).prefs = { density: "compact" };
		assert.deepEqual(editor.render(40), ["────────────────────", "  real content line"]);
	});
});

test("CodexEditor preserves user-authored horizontal rules when they are content", () => {
	withMockedBaseRender([
		"────────────────────",
		"  real content line",
	], (editor) => {
		(editor as any).prefs = { density: "compact" };
		assert.deepEqual(editor.render(40), ["────────────────────", "  real content line"]);
	});
});

test("CodexEditor preserves user-authored indicator-like text when it is content", () => {
	withMockedBaseRender([
		"  first line",
		"─── ↓ 3 more thoughts about spacing",
	], (editor) => {
		(editor as any).prefs = { density: "compact" };
		assert.deepEqual(editor.render(80), ["  first line", "─── ↓ 3 more thoughts about spacing"]);
	});
});
