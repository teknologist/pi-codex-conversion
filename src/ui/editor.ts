import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type { CodexUiPrefs } from "./prefs.ts";

export class CodexEditor extends CustomEditor {
	private prefs: CodexUiPrefs | undefined;

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
		return super.render(width);
	}
}
