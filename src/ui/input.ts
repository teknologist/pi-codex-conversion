export const CODEX_PROMPT_PREFIX = "› ";

export function shouldPrefixUserInput(text: string): boolean {
	const trimmed = text.trim();
	return Boolean(trimmed) && !trimmed.startsWith("/") && !trimmed.startsWith("!") && !trimmed.startsWith(CODEX_PROMPT_PREFIX);
}

export function prefixUserInput(text: string): string {
	return shouldPrefixUserInput(text) ? `${CODEX_PROMPT_PREFIX}${text}` : text;
}

export function stripUserInputPrefix(text: string): string {
	return text.startsWith(CODEX_PROMPT_PREFIX) ? text.slice(CODEX_PROMPT_PREFIX.length) : text;
}
