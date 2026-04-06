import test from "node:test";
import assert from "node:assert/strict";
import { CustomEditor } from "@mariozechner/pi-coding-agent";
import { CodexEditor } from "../src/ui/editor.ts";

function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

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

test("CodexEditor preserves user-authored paired horizontal rules", () => {
	withMockedBaseRender([
		"────────────────────",
		"normal content",
		"────────────────────",
	], (editor) => {
		(editor as any).prefs = { density: "compact", themeName: "Codex Dark" };
		assert.deepEqual(editor.render(40).map(stripAnsi), ["normal content"]);
	});
});

test("CodexEditor preserves scroll-indicator-like lines when they are content", () => {
	withMockedBaseRender([
		"────────────────────",
		"  real content line",
		"─── ↓ 3 more ───────",
	], (editor) => {
		(editor as any).prefs = { density: "compact", themeName: "Codex Dark" };
		assert.deepEqual(editor.render(40).map(stripAnsi), ["  real content line"]);
	});
});

test("CodexEditor preserves user-authored horizontal rules when they are content", () => {
	withMockedBaseRender([
		"────────────────────",
		"  real content line",
	], (editor) => {
		(editor as any).prefs = { density: "compact", themeName: "Codex Dark" };
		assert.deepEqual(editor.render(40).map(stripAnsi), ["  real content line"]);
	});
});

test("CodexEditor preserves user-authored indicator-like text when it is content", () => {
	withMockedBaseRender([
		"  first line",
		"─── ↓ 3 more thoughts about spacing",
	], (editor) => {
		(editor as any).prefs = { density: "compact", themeName: "Codex Dark" };
		assert.deepEqual(editor.render(80).map(stripAnsi), ["  first line"]);
	});
});

test("CodexEditor reapplies compact padding if Pi startup settings override it", () => {
	withMockedBaseRender(["content"], (editor) => {
		editor.setPrefs({ density: "compact" } as any);
		(editor as any).paddingX = 2;
		editor.render(80);
		assert.equal(editor.getPaddingX(), 0);
	});
});

test("CodexEditor reapplies comfortable padding if Pi startup settings override it", () => {
	withMockedBaseRender(["content"], (editor) => {
		editor.setPrefs({ density: "comfortable" } as any);
		(editor as any).paddingX = 3;
		editor.render(80);
		assert.equal(editor.getPaddingX(), 1);
	});
});

test("CodexEditor applies user-message background to the prompt slab contents", () => {
	withMockedBaseRender([
		"────────────────────",
		"prompt body",
		"autocomplete row",
	], (editor) => {
		(editor as any).prefs = { density: "compact", themeName: "Codex Dark" };

		const rendered = editor.render(40);
		assert.match(rendered[0], /\x1b\[48;2;52;60;72mprompt body\x1b\[0m/);
		assert.match(rendered[1], /\x1b\[48;2;52;60;72mautocomplete row\x1b\[0m/);
	});
});

test("CodexEditor leaves editor border lines unfilled", () => {
	withMockedBaseRender([
		"────────────────────",
		"prompt body",
		"─── ↓ 3 more ───────",
	], (editor) => {
		(editor as any).prefs = { density: "compact", themeName: "Codex Dark" };

		const rendered = editor.render(40).map(stripAnsi);
		assert.deepEqual(rendered, ["prompt body"]);
	});
});
