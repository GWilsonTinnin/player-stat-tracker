import { Plugin, WorkspaceLeaf } from "obsidian";
import { PlayerStatView, VIEW_TYPE_PLAYER_STAT } from "./view";
import { PlayerStatSettingTab } from "./settings";
import { PlayerCounter } from "./counter";

export interface PlayerStatSettings {
  displayFormat: "compact" | "full";
  trackHistory: boolean;
  showDeleteConfirm: boolean;
  minValue: number;
  maxValue: number;
  buttonStyle: "default" | "large" | "minimal";
}

const DEFAULT_SETTINGS: PlayerStatSettings = {
  displayFormat: "full",
  trackHistory: true,
  showDeleteConfirm: true,
  minValue: 0,
  maxValue: 0,
  buttonStyle: "default",
};

export default class PlayerStatCounterPlugin extends Plugin {
  private view: PlayerStatView | null = null;
  counters: PlayerCounter[] = [];
  settings: PlayerStatSettings = DEFAULT_SETTINGS;

  async onload() {
    // Load settings
    const savedSettings = await this.loadData();
    if (savedSettings && savedSettings.settings) {
      this.settings = { ...DEFAULT_SETTINGS, ...savedSettings.settings };
    }

    // Load saved counters from plugin data
    if (savedSettings && savedSettings.counters) {
      this.counters = savedSettings.counters;
    }

    // Add settings tab
    this.addSettingTab(new PlayerStatSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_PLAYER_STAT,
      (leaf: WorkspaceLeaf) => {
        this.view = new PlayerStatView(leaf, this);
        return this.view;
      }
    );

    this.addRibbonIcon("dice", "Player Stat Counter", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-player-stat-counter",
      name: "Open Player Stat Counter",
      callback: () => this.activateView(),
    });
  }

  async activateView() {
    this.app.workspace.getRightLeaf(false).setViewState({
      type: VIEW_TYPE_PLAYER_STAT,
      active: true,
    });
  }

  async saveCounters() {
    await this.saveData({ counters: this.counters, settings: this.settings });
  }

  async saveSettings() {
    await this.saveData({ counters: this.counters, settings: this.settings });
  }
}