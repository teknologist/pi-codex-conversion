import { CustomEditor } from "@mariozechner/pi-coding-agent";
import type { CodexUiPrefs } from "./prefs.ts";

export class CodexEditor extends CustomEditor {
	private prefs: CodexUiPrefs | undefined;

	setPrefs(prefs: CodexUiPrefs): void {
		this.prefs = prefs;
		this.setPaddingX(prefs.density === "comfortable" ? 2 : 1);
	}

	override render(width: number): string[] {
		return super.render(width);
	}
}
