import { App, PluginSettingTab, Setting } from "obsidian";
import type PlayerStatCounterPlugin from "./main";

export class PlayerStatSettingTab extends PluginSettingTab {
  plugin: PlayerStatCounterPlugin;

  constructor(app: App, plugin: PlayerStatCounterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Player Stat Counter Settings" });

    new Setting(containerEl)
      .setName("Counter display format")
      .setDesc("Choose how counters are displayed")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("compact", "Compact (value only)")
          .addOption("full", "Full (name + value)")
          .setValue(this.plugin.settings.displayFormat)
          .onChange(async (value) => {
            this.plugin.settings.displayFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable counter history")
      .setDesc("Keep track of all counter changes with timestamps")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.trackHistory)
          .onChange(async (value) => {
            this.plugin.settings.trackHistory = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show delete confirmation")
      .setDesc("Ask for confirmation before deleting a counter")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showDeleteConfirm)
          .onChange(async (value) => {
            this.plugin.settings.showDeleteConfirm = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Minimum counter value")
      .setDesc("Set the minimum value counters can reach")
      .addText((text) =>
        text
          .setPlaceholder("0")
          .setValue(String(this.plugin.settings.minValue))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num)) {
              this.plugin.settings.minValue = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Maximum counter value")
      .setDesc("Set the maximum value counters can reach (leave empty for unlimited)")
      .addText((text) =>
        text
          .setPlaceholder("unlimited")
          .setValue(this.plugin.settings.maxValue ? String(this.plugin.settings.maxValue) : "")
          .onChange(async (value) => {
            const num = value === "" ? 0 : parseInt(value);
            if (value === "" || !isNaN(num)) {
              this.plugin.settings.maxValue = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Button style")
      .setDesc("Choose button appearance")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("default", "Default")
          .addOption("large", "Large")
          .addOption("minimal", "Minimal")
          .setValue(this.plugin.settings.buttonStyle)
          .onChange(async (value) => {
            this.plugin.settings.buttonStyle = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("hr");

    containerEl.createEl("h3", { text: "Data Management" });

    new Setting(containerEl)
      .setName("Export counters")
      .setDesc("Download your counter data as JSON")
      .addButton((button) =>
        button
          .setButtonText("Export")
          .onClick(() => {
            const dataStr = JSON.stringify(this.plugin.counters, null, 2);
            const dataBlob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `player-counters-${new Date().toISOString().split("T")[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
          })
      );

    new Setting(containerEl)
      .setName("Clear all counters")
      .setDesc("WARNING: This will delete all counters permanently")
      .addButton((button) =>
        button
          .setButtonText("Clear All")
          .setWarning()
          .onClick(async () => {
            if (confirm("Are you sure you want to delete all counters? This cannot be undone.")) {
              this.plugin.counters = [];
              await this.plugin.saveCounters();
              this.display(); // Refresh display
            }
          })
      );
  }
}
