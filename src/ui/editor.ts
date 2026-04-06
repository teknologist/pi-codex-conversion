import { CustomEditor } from "@mariozechner/pi-coding-agent";
import type { CodexUiPrefs } from "./prefs.ts";

const PROMPT_BG_BY_THEME = {
	"Codex Dark": "#2f3742",
	"Codex Light": "#f2f5f8",
} as const;

function hexToAnsiBackground(hex: string, text: string): string {
	const normalized = hex.replace(/^#/, "");
	const red = Number.parseInt(normalized.slice(0, 2), 16);
	const green = Number.parseInt(normalized.slice(2, 4), 16);
	const blue = Number.parseInt(normalized.slice(4, 6), 16);
	return `\x1b[48;2;${red};${green};${blue}m${text}\x1b[0m`;
}

function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function isEditorBorderLine(line: string): boolean {
	const plain = stripAnsi(line).trim();
	if (!plain) return false;
	if (/^[─]+$/.test(plain)) return true;
	return /^─── [↑↓] \d+ more /.test(plain);
}

export class CodexEditor extends CustomEditor {
	private prefs: CodexUiPrefs | undefined;

	private getPromptBackground(): ((text: string) => string) | undefined {
		const themeName = this.prefs?.themeName ?? "Codex Dark";
		const color = PROMPT_BG_BY_THEME[themeName];
		if (!color) return undefined;
		return (text: string) => hexToAnsiBackground(color, text);
	}

	private applyPromptBackground(lines: string[]): string[] {
		const background = this.getPromptBackground();
		if (!background || lines.length <= 1) return lines;

		return lines.filter((line) => !isEditorBorderLine(line)).map((line) => background(line));
	}

	private getDesiredPaddingX(): number {
		return this.prefs?.density === "comfortable" ? 1 : 0;
	}

	private ensurePreferredPadding(): void {
		const desired = this.getDesiredPaddingX();
		if (this.getPaddingX() !== desired) {
			(this as unknown as { paddingX: number }).paddingX = desired;
		}
	}

	setPrefs(prefs: CodexUiPrefs): void {
		this.prefs = prefs;
		this.ensurePreferredPadding();
	}

	override render(width: number): string[] {
		this.ensurePreferredPadding();
		return this.applyPromptBackground(super.render(width));
	}
}
