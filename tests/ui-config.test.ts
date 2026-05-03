import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CODEX_UI_PREFS } from "../src/ui/prefs.ts";
import { formatCodexConfigInfo, getCodexConfigPath, loadCodexConfig, normalizeCodexConfig, writeCodexConfig } from "../src/ui/config.ts";
import { applyUiSetting } from "../src/ui/config-ui.ts";
import { readCodexConfigEditorPrefill } from "../src/index.ts";

test("getCodexConfigPath respects PI_CODING_AGENT_DIR", () => {
	assert.equal(
		getCodexConfigPath({ PI_CODING_AGENT_DIR: "/tmp/pi-agent" } as NodeJS.ProcessEnv),
		"/tmp/pi-agent/pi-codex-conversion.json",
	);
});

test("loadCodexConfig does not create missing config and falls back to session UI prefs", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-codex-config-"));
	try {
		const path = join(dir, "pi-codex-conversion.json");
		const loaded = loadCodexConfig({ ...DEFAULT_CODEX_UI_PREFS, themeName: "Codex Light" }, path);
		assert.equal(loaded.exists, false);
		assert.equal(loaded.config.ui.themeName, "Codex Light");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("loadCodexConfig normalizes partial valid config and warns on malformed JSON", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-codex-config-"));
	try {
		const path = join(dir, "pi-codex-conversion.json");
		writeFileSync(path, JSON.stringify({ ui: { density: "comfortable", compactTools: false } }), "utf8");
		assert.deepEqual(loadCodexConfig(DEFAULT_CODEX_UI_PREFS, path).config.ui, {
			...DEFAULT_CODEX_UI_PREFS,
			density: "comfortable",
			compactTools: false,
		});

		writeFileSync(path, "{ nope", "utf8");
		const malformed = loadCodexConfig(DEFAULT_CODEX_UI_PREFS, path);
		assert.equal(malformed.exists, true);
		assert.match(malformed.warning ?? "", /Invalid Codex config ignored/);
		assert.deepEqual(malformed.config.ui, DEFAULT_CODEX_UI_PREFS);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("loadCodexConfig lets durable config win over stale session prefs", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-codex-config-"));
	try {
		const path = join(dir, "pi-codex-conversion.json");
		writeFileSync(path, JSON.stringify({ ui: { themeName: "Codex Light", density: "comfortable" } }), "utf8");
		const loaded = loadCodexConfig({ ...DEFAULT_CODEX_UI_PREFS, themeName: "Codex Dark", density: "compact" }, path);
		assert.equal(loaded.config.ui.themeName, "Codex Light");
		assert.equal(loaded.config.ui.density, "comfortable");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("writeCodexConfig writes normalized JSON with trailing newline", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-codex-config-"));
	try {
		const path = join(dir, "nested", "pi-codex-conversion.json");
		writeCodexConfig(normalizeCodexConfig({ ui: { themeName: "Codex Light" } }), path);
		const text = readFileSync(path, "utf8");
		assert.equal(text.endsWith("\n"), true);
		assert.equal(JSON.parse(text).ui.themeName, "Codex Light");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("writeCodexConfig reports write failures", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-codex-config-"));
	try {
		const path = join(dir, "pi-codex-conversion.json");
		mkdirSync(path);
		assert.throws(() => writeCodexConfig(normalizeCodexConfig({ ui: { themeName: "Codex Light" } }), path));
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("readCodexConfigEditorPrefill falls back when config path cannot be read", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-codex-config-"));
	try {
		const config = normalizeCodexConfig({ ui: { themeName: "Codex Light" } });
		const missing = readCodexConfigEditorPrefill(join(dir, "missing.json"), config);
		assert.equal(missing.warning, undefined);
		assert.equal(JSON.parse(missing.text).ui.themeName, "Codex Light");

		const directoryPath = join(dir, "config-as-directory.json");
		mkdirSync(directoryPath);
		const unreadable = readCodexConfigEditorPrefill(directoryPath, config);
		assert.match(unreadable.warning ?? "", /Codex UI config not read/);
		assert.equal(JSON.parse(unreadable.text).ui.themeName, "Codex Light");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("formatCodexConfigInfo includes path, existence, warnings, and JSON", () => {
	const text = formatCodexConfigInfo({
		path: "/tmp/config.json",
		exists: true,
		warning: "bad config",
		config: normalizeCodexConfig({ ui: { promptPrefix: true } }),
	});
	assert.match(text, /Path: \/tmp\/config\.json/);
	assert.match(text, /Exists: yes/);
	assert.match(text, /Warning: bad config/);
	assert.match(text, /"promptPrefix": true/);
});

test("applyUiSetting constrains UI values", () => {
	assert.equal(applyUiSetting(DEFAULT_CODEX_UI_PREFS, "themeName", "Codex Light").themeName, "Codex Light");
	assert.equal(applyUiSetting(DEFAULT_CODEX_UI_PREFS, "density", "comfortable").density, "comfortable");
	assert.equal(applyUiSetting(DEFAULT_CODEX_UI_PREFS, "promptPrefix", "true").promptPrefix, true);
	assert.deepEqual(applyUiSetting(DEFAULT_CODEX_UI_PREFS, "unknown", "true"), DEFAULT_CODEX_UI_PREFS);
});
