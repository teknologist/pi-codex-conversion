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

test("CodexEditor preserves user-authored paired horizontal rules", () => {
	withMockedBaseRender([
		"────────────────────",
		"normal content",
		"────────────────────",
	], (editor) => {
		(editor as any).prefs = { density: "compact" };
		assert.deepEqual(editor.render(40), ["────────────────────", "normal content", "────────────────────"]);
	});
});

test("CodexEditor preserves scroll-indicator-like lines when they are content", () => {
	withMockedBaseRender([
		"────────────────────",
		"  real content line",
		"─── ↓ 3 more ───────",
	], (editor) => {
		(editor as any).prefs = { density: "compact" };
		assert.deepEqual(editor.render(40), ["────────────────────", "  real content line", "─── ↓ 3 more ───────"]);
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
		(editor as any).prefs = { density: "compact" };
		(editor as any).theme = {
			bg: (role: string, text: string) => `[${role}]${text}`,
		};

		assert.deepEqual(editor.render(40), [
			"────────────────────",
			"[userMessageBg]prompt body",
			"[userMessageBg]autocomplete row",
		]);
	});
});
