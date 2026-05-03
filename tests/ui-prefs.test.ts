import test from "node:test";
import assert from "node:assert/strict";
import {
	CODEX_UI_PREFS_ENTRY,
	DEFAULT_CODEX_UI_PREFS,
	isCodexTheme,
	loadCodexUiPrefs,
	normalizeCodexUiPrefs,
	resolveSessionCodexUiPrefs,
} from "../src/ui/prefs.ts";

test("normalizeCodexUiPrefs falls back to defaults for invalid input", () => {
	assert.deepEqual(normalizeCodexUiPrefs(null), DEFAULT_CODEX_UI_PREFS);
	assert.deepEqual(normalizeCodexUiPrefs({ themeName: "nope" }), DEFAULT_CODEX_UI_PREFS);
	assert.deepEqual(
		normalizeCodexUiPrefs({ forceTheme: "false", showHeader: "true", compactTools: 0, promptPrefix: 1 }),
		DEFAULT_CODEX_UI_PREFS,
	);
});

test("loadCodexUiPrefs loads the most recent matching custom entry", () => {
	assert.deepEqual(
		loadCodexUiPrefs([
			{ type: "custom", customType: CODEX_UI_PREFS_ENTRY, data: { themeName: "Codex Light", compactTools: false } },
			{ type: "custom", customType: CODEX_UI_PREFS_ENTRY, data: { density: "comfortable", promptPrefix: false } },
		]),
		{
			...DEFAULT_CODEX_UI_PREFS,
			density: "comfortable",
			promptPrefix: false,
		},
	);
});

test("isCodexTheme recognizes packaged themes", () => {
	assert.equal(isCodexTheme("Codex Dark"), true);
	assert.equal(isCodexTheme("Codex Light"), true);
	assert.equal(isCodexTheme("dark"), false);
});

test("resolveSessionCodexUiPrefs reloads prefs for each session independently", () => {
	const lightCompact = resolveSessionCodexUiPrefs([
		{ type: "custom", customType: CODEX_UI_PREFS_ENTRY, data: { themeName: "Codex Light", promptPrefix: false } },
	]);
	const darkDefault = resolveSessionCodexUiPrefs([]);

	assert.deepEqual(lightCompact, {
		...DEFAULT_CODEX_UI_PREFS,
		themeName: "Codex Light",
		promptPrefix: false,
	});
	assert.deepEqual(darkDefault, DEFAULT_CODEX_UI_PREFS);
});
