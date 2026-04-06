import test from "node:test";
import assert from "node:assert/strict";
import { CODEX_PROMPT_PREFIX, prefixUserInput, shouldPrefixUserInput, stripUserInputPrefix } from "../src/ui/input.ts";

test("shouldPrefixUserInput only prefixes normal prompts", () => {
	assert.equal(shouldPrefixUserInput("hello"), true);
	assert.equal(shouldPrefixUserInput("/help"), false);
	assert.equal(shouldPrefixUserInput("!ls"), false);
	assert.equal(shouldPrefixUserInput(`${CODEX_PROMPT_PREFIX}already`), false);
});

test("prefixUserInput and stripUserInputPrefix roundtrip", () => {
	const prefixed = prefixUserInput("hello");
	assert.equal(prefixed, `${CODEX_PROMPT_PREFIX}hello`);
	assert.equal(stripUserInputPrefix(prefixed), "hello");
	assert.equal(stripUserInputPrefix("plain"), "plain");
});
