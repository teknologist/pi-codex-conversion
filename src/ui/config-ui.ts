import { DynamicBorder, getSettingsListTheme, type Theme } from "@mariozechner/pi-coding-agent";
import { Container, SettingsList, Text, type SettingItem } from "@mariozechner/pi-tui";
import type { CodexConfig } from "./config.ts";

export type CodexUiConfigAction = { type: "close" } | { type: "edit-json" } | { type: "reset" };

export interface CodexUiConfigComponentOptions {
	config: CodexConfig;
	configPath: string;
	theme: Theme;
	onConfigChange: (config: CodexConfig) => void;
	done: (action: CodexUiConfigAction) => void;
}

export class CodexUiConfigComponent extends Container {
	private config: CodexConfig;
	private readonly list: SettingsList;

	constructor(options: CodexUiConfigComponentOptions) {
		super();
		this.config = { ...options.config, ui: { ...options.config.ui }, tools: { ...options.config.tools }, prompt: { ...options.config.prompt } };
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
				this.config = applyConfigSetting(this.config, id, value);
				options.onConfigChange({ ...this.config, ui: { ...this.config.ui }, tools: { ...this.config.tools }, prompt: { ...this.config.prompt } });
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
			setting("ui.enabled", "UI: Mode", this.config.ui.enabled, ["auto", "always", "never"], "When Codex chrome/theme should be active."),
			setting("tools.enabled", "Tools: Mode", this.config.tools.enabled, ["auto", "never"], "When Codex adapter tools should replace Pi tools."),
			setting("prompt.enabled", "Prompt: Mode", this.config.prompt.enabled, ["auto", "always", "never"], "When Codex system-prompt conversion should run."),
			setting("themeName", "UI: Theme", this.config.ui.themeName, ["Codex Dark", "Codex Light"], "Bundled Codex theme variant."),
			setting("forceTheme", "UI: Force theme", boolValue(this.config.ui.forceTheme), ["true", "false"], "Apply the selected Codex theme when UI chrome is active."),
			setting("density", "UI: Density", this.config.ui.density, ["compact", "comfortable"], "Editor horizontal density."),
			setting("showHeader", "UI: Header", boolValue(this.config.ui.showHeader), ["true", "false"], "Show compact Codex header chrome."),
			setting("compactTools", "UI: Compact tools", boolValue(this.config.ui.compactTools), ["true", "false"], "Collapse tool blocks by default."),
			setting("promptPrefix", "UI: Prompt prefix", boolValue(this.config.ui.promptPrefix), ["true", "false"], "Prefix normal user prompts with › in transcript."),
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

export function applyConfigSetting(config: CodexConfig, id: string, value: string): CodexConfig {
	switch (id) {
		case "ui.enabled":
			return value === "always" || value === "never" ? { ...config, ui: { ...config.ui, enabled: value } } : { ...config, ui: { ...config.ui, enabled: "auto" } };
		case "tools.enabled":
			return value === "never" ? { ...config, tools: { enabled: "never" } } : { ...config, tools: { enabled: "auto" } };
		case "prompt.enabled":
			return value === "always" || value === "never" ? { ...config, prompt: { enabled: value } } : { ...config, prompt: { enabled: "auto" } };
		case "themeName":
			return value === "Codex Light" ? { ...config, ui: { ...config.ui, themeName: "Codex Light" } } : { ...config, ui: { ...config.ui, themeName: "Codex Dark" } };
		case "forceTheme":
			return { ...config, ui: { ...config.ui, forceTheme: value === "true" } };
		case "density":
			return value === "comfortable" ? { ...config, ui: { ...config.ui, density: "comfortable" } } : { ...config, ui: { ...config.ui, density: "compact" } };
		case "showHeader":
			return { ...config, ui: { ...config.ui, showHeader: value === "true" } };
		case "compactTools":
			return { ...config, ui: { ...config.ui, compactTools: value === "true" } };
		case "promptPrefix":
			return { ...config, ui: { ...config.ui, promptPrefix: value === "true" } };
		default:
			return config;
	}
}

export const applyUiSetting = applyConfigSetting;
