import { DynamicBorder, getSettingsListTheme, type Theme } from "@mariozechner/pi-coding-agent";
import { Container, SettingsList, Text, type SettingItem } from "@mariozechner/pi-tui";
import type { CodexUiPrefs } from "./prefs.ts";

export type CodexUiConfigAction = { type: "close" } | { type: "edit-json" } | { type: "reset" };

export interface CodexUiConfigComponentOptions {
	prefs: CodexUiPrefs;
	configPath: string;
	theme: Theme;
	onPrefsChange: (prefs: CodexUiPrefs) => void;
	done: (action: CodexUiConfigAction) => void;
}

export class CodexUiConfigComponent extends Container {
	private prefs: CodexUiPrefs;
	private readonly list: SettingsList;

	constructor(options: CodexUiConfigComponentOptions) {
		super();
		this.prefs = { ...options.prefs };
		this.addChild(new DynamicBorder((text) => options.theme.fg("borderMuted", text)));
		this.addChild(new Text(options.theme.fg("customMessageLabel", options.theme.bold("Codex UI config")), 0, 0));
		this.addChild(new Text(options.theme.fg("dim", options.configPath), 0, 0));
		this.list = new SettingsList(
			this.buildItems(),
			11,
			getSettingsListTheme(),
			(id, value) => {
				if (id === "edit-json") {
					options.done({ type: "edit-json" });
					return;
				}
				if (id === "reset") {
					options.done({ type: "reset" });
					return;
				}
				this.prefs = applyUiSetting(this.prefs, id, value);
				options.onPrefsChange({ ...this.prefs });
			},
			() => options.done({ type: "close" }),
			{ enableSearch: false },
		);
		this.addChild(this.list);
		this.addChild(new DynamicBorder((text) => options.theme.fg("borderMuted", text)));
	}

	handleInput(data: string): void {
		this.list.handleInput(data);
	}

	private buildItems(): SettingItem[] {
		return [
			setting("themeName", "UI: Theme", this.prefs.themeName, ["Codex Dark", "Codex Light"], "Bundled Codex theme variant."),
			setting("forceTheme", "UI: Force theme", boolValue(this.prefs.forceTheme), ["true", "false"], "Apply the selected Codex theme when UI chrome is active."),
			setting("density", "UI: Density", this.prefs.density, ["compact", "comfortable"], "Editor horizontal density."),
			setting("showHeader", "UI: Header", boolValue(this.prefs.showHeader), ["true", "false"], "Show compact Codex header chrome."),
			setting("compactTools", "UI: Compact tools", boolValue(this.prefs.compactTools), ["true", "false"], "Collapse tool blocks by default."),
			setting("promptPrefix", "UI: Prompt prefix", boolValue(this.prefs.promptPrefix), ["true", "false"], "Prefix normal user prompts with › in transcript."),
			setting("edit-json", "Open/edit config JSON", "open", ["open"], "Edit the backing JSON file in a text editor."),
			setting("reset", "Reset all settings", "reset", ["reset"], "Restore package defaults."),
		];
	}
}

function setting(id: string, label: string, currentValue: string, values: string[], description: string): SettingItem {
	return { id, label, currentValue, values, description };
}

function boolValue(value: boolean): string {
	return value ? "true" : "false";
}

export function applyUiSetting(prefs: CodexUiPrefs, id: string, value: string): CodexUiPrefs {
	switch (id) {
		case "themeName":
			return value === "Codex Light" ? { ...prefs, themeName: "Codex Light" } : { ...prefs, themeName: "Codex Dark" };
		case "forceTheme":
			return { ...prefs, forceTheme: value === "true" };
		case "density":
			return value === "comfortable" ? { ...prefs, density: "comfortable" } : { ...prefs, density: "compact" };
		case "showHeader":
			return { ...prefs, showHeader: value === "true" };
		case "compactTools":
			return { ...prefs, compactTools: value === "true" };
		case "promptPrefix":
			return { ...prefs, promptPrefix: value === "true" };
		default:
			return prefs;
	}
}
