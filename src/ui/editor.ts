import { CustomEditor } from "@mariozechner/pi-coding-agent";
import type { CodexUiPrefs } from "./prefs.ts";

export class CodexEditor extends CustomEditor {
	private prefs: CodexUiPrefs | undefined;

	private getPromptBackground(): ((text: string) => string) | undefined {
		const theme = (this as unknown as { theme?: { bg?: (role: string, text: string) => string } }).theme;
		if (!theme?.bg) return undefined;
		return (text: string) => theme.bg?.("userMessageBg", text) ?? text;
	}

	private applyPromptBackground(lines: string[]): string[] {
		const background = this.getPromptBackground();
		if (!background || lines.length <= 1) return lines;

		return lines.map((line, index) => {
			if (index === 0) return line;
			return background(line);
		});
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
