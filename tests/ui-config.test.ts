import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CODEX_UI_PREFS } from "../src/ui/prefs.ts";
import { DEFAULT_CODEX_CONFIG, formatCodexConfigInfo, getCodexConfigPath, loadCodexConfig, normalizeCodexConfig, writeCodexConfig } from "../src/ui/config.ts";
import { applyConfigSetting } from "../src/ui/config-ui.ts";
import { readCodexConfigEditorPrefill, shouldActivatePrompt, shouldActivateTools, shouldActivateUi } from "../src/index.ts";

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
		assert.equal(loaded.config.ui.enabled, "auto");
		assert.equal(loaded.config.ui.themeName, "Codex Light");
		assert.equal(loaded.config.tools.enabled, "auto");
		assert.equal(loaded.config.prompt.enabled, "auto");
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
			enabled: "auto",
			...DEFAULT_CODEX_UI_PREFS,
			density: "comfortable",
			compactTools: false,
		});

		writeFileSync(path, "{ nope", "utf8");
		const malformed = loadCodexConfig(DEFAULT_CODEX_UI_PREFS, path);
		assert.equal(malformed.exists, true);
		assert.match(malformed.warning ?? "", /Invalid Codex config ignored/);
		assert.deepEqual(malformed.config, DEFAULT_CODEX_CONFIG);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("loadCodexConfig warns when explicit invalid fields are normalized", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-codex-config-"));
	try {
		const path = join(dir, "pi-codex-conversion.json");
		writeFileSync(path, JSON.stringify({ ui: { enabled: "sometimes", forceTheme: "false" }, tools: { enabled: "always" }, prompt: { enabled: "later" } }), "utf8");
		const loaded = loadCodexConfig(DEFAULT_CODEX_UI_PREFS, path);
		assert.match(loaded.warning ?? "", /Invalid Codex config fields normalized/);
		assert.equal(loaded.config.ui.enabled, "auto");
		assert.equal(loaded.config.ui.forceTheme, DEFAULT_CODEX_CONFIG.ui.forceTheme);
		assert.equal(loaded.config.tools.enabled, "auto");
		assert.equal(loaded.config.prompt.enabled, "auto");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("loadCodexConfig lets durable config win over stale session prefs", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-codex-config-"));
	try {
		const path = join(dir, "pi-codex-conversion.json");
		writeFileSync(path, JSON.stringify({ ui: { enabled: "always", themeName: "Codex Light", density: "comfortable" }, tools: { enabled: "never" }, prompt: { enabled: "never" } }), "utf8");
		const loaded = loadCodexConfig({ ...DEFAULT_CODEX_UI_PREFS, themeName: "Codex Dark", density: "compact" }, path);
		assert.equal(loaded.config.ui.enabled, "always");
		assert.equal(loaded.config.ui.themeName, "Codex Light");
		assert.equal(loaded.config.ui.density, "comfortable");
		assert.equal(loaded.config.tools.enabled, "never");
		assert.equal(loaded.config.prompt.enabled, "never");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("existing durable config does not use stale session prefs as fallback", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-codex-config-"));
	try {
		const path = join(dir, "pi-codex-conversion.json");
		writeFileSync(path, JSON.stringify({ version: 1 }), "utf8");
		const loaded = loadCodexConfig({ ...DEFAULT_CODEX_UI_PREFS, themeName: "Codex Light", density: "comfortable" }, path);
		assert.equal(loaded.config.ui.themeName, DEFAULT_CODEX_CONFIG.ui.themeName);
		assert.equal(loaded.config.ui.density, DEFAULT_CODEX_CONFIG.ui.density);
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
		assert.equal(JSON.parse(text).tools.enabled, "auto");
		assert.equal(JSON.parse(text).prompt.enabled, "auto");
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

test("applyConfigSetting constrains mode and UI values", () => {
	assert.equal(applyConfigSetting(DEFAULT_CODEX_CONFIG, "ui.enabled", "always").ui.enabled, "always");
	assert.equal(applyConfigSetting(DEFAULT_CODEX_CONFIG, "tools.enabled", "never").tools.enabled, "never");
	assert.equal(applyConfigSetting(DEFAULT_CODEX_CONFIG, "prompt.enabled", "never").prompt.enabled, "never");
	assert.equal(applyConfigSetting(DEFAULT_CODEX_CONFIG, "themeName", "Codex Light").ui.themeName, "Codex Light");
	assert.equal(applyConfigSetting(DEFAULT_CODEX_CONFIG, "density", "comfortable").ui.density, "comfortable");
	assert.equal(applyConfigSetting(DEFAULT_CODEX_CONFIG, "promptPrefix", "true").ui.promptPrefix, true);
	assert.deepEqual(applyConfigSetting(DEFAULT_CODEX_CONFIG, "unknown", "true"), DEFAULT_CODEX_CONFIG);
});

test("activation helpers implement configured mode semantics", () => {
	assert.equal(shouldActivateUi("auto", true), true);
	assert.equal(shouldActivateUi("auto", false), false);
	assert.equal(shouldActivateUi("always", false), true);
	assert.equal(shouldActivateUi("never", true), false);

	assert.equal(shouldActivateTools("auto", true), true);
	assert.equal(shouldActivateTools("auto", false), false);
	assert.equal(shouldActivateTools("never", true), false);

	assert.equal(shouldActivatePrompt("auto", true), true);
	assert.equal(shouldActivatePrompt("auto", false), false);
	assert.equal(shouldActivatePrompt("always", false), true);
	assert.equal(shouldActivatePrompt("never", true), false);
});
