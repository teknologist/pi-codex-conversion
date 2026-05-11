import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import codexConversion, { mergeAdapterTools, restoreTools } from "../src/index.ts";
import { normalizeCodexConfig, writeCodexConfig } from "../src/ui/config.ts";

test("mergeAdapterTools replaces Pi core tools but preserves unrelated active tools", () => {
	assert.deepEqual(
		mergeAdapterTools(["read", "bash", "edit", "write", "parallel", "custom_search"], ["exec_command", "write_stdin", "apply_patch"]),
		["exec_command", "write_stdin", "apply_patch", "parallel", "custom_search"],
	);
});

test("restoreTools restores previous tools and keeps custom tools added while adapter mode was enabled", () => {
	assert.deepEqual(
		restoreTools(["read", "bash", "edit", "write", "parallel"], ["exec_command", "write_stdin", "apply_patch", "parallel", "custom_search"]),
		["read", "bash", "edit", "write", "parallel", "custom_search"],
	);
});

test("restoreTools strips adapter tools from mixed startup state while keeping unrelated tools", () => {
	assert.deepEqual(
		restoreTools(["read", "bash", "edit", "write"], ["read", "bash", "edit", "write", "apply_patch", "exec_command", "write_stdin", "codex_web_search", "parallel"]),
		["read", "bash", "edit", "write", "parallel"],
	);
});

test("restoreTools without remembered tools only removes adapter tools", () => {
	assert.deepEqual(
		restoreTools([], ["exec_command", "write_stdin", "apply_patch", "parallel", "custom_search"]),
		["parallel", "custom_search"],
	);
});

test("startup config can disable adapter tool registration", async () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-codex-tools-off-"));
	const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
	try {
		process.env.PI_CODING_AGENT_DIR = dir;
		writeCodexConfig(normalizeCodexConfig({ tools: { registerAdapterTools: false } }), join(dir, "pi-codex-conversion.json"));
		const registeredTools: string[] = [];
		codexConversion({
			registerTool: (tool: { name: string }) => registeredTools.push(tool.name),
			registerProvider: () => undefined,
			registerMessageRenderer: () => undefined,
			registerCommand: () => undefined,
			on: () => undefined,
		} as never);

		assert.deepEqual(registeredTools, []);
	} finally {
		if (previousAgentDir === undefined) {
			delete process.env.PI_CODING_AGENT_DIR;
		} else {
			process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		}
		await rm(dir, { recursive: true, force: true });
	}
});
