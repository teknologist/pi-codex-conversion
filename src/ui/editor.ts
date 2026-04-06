import { CustomEditor } from "@mariozechner/pi-coding-agent";
import type { CodexUiPrefs } from "./prefs.ts";

function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "").replace(/\x1b\_[^\x07]*(?:\x07|\x1b\\)/g, "");
}

function isHorizontalRule(line: string): boolean {
	const plain = stripAnsi(line).trimEnd();
	return /^─+$/.test(plain);
}

function isScrollIndicator(line: string): boolean {
	const plain = stripAnsi(line).trimEnd();
	return /^─── [↑↓] \d+ more ─*$/.test(plain);
}

function shouldStripTopChrome(lines: string[]): boolean {
	if (lines.length < 2) return false;
	return isHorizontalRule(lines[0]) && isHorizontalRule(lines[lines.length - 1]);
}

function shouldStripBottomChrome(lines: string[]): boolean {
	if (lines.length < 2) return false;
	return isHorizontalRule(lines[0]) && (isHorizontalRule(lines[lines.length - 1]) || isScrollIndicator(lines[lines.length - 1]));
}

export class CodexEditor extends CustomEditor {
	private prefs: CodexUiPrefs | undefined;

	setPrefs(prefs: CodexUiPrefs): void {
		this.prefs = prefs;
		this.setPaddingX(prefs.density === "comfortable" ? 1 : 0);
	}

	override render(width: number): string[] {
		const lines = super.render(width);
		if (lines.length === 0) return lines;

		const compacted = [...lines];
		const stripTopChrome = shouldStripTopChrome(compacted);
		const stripBottomChrome = shouldStripBottomChrome(compacted);
		if (stripTopChrome) {
			compacted.shift();
		}
		if (stripBottomChrome) {
			compacted.pop();
		}

		return compacted;
	}
}
