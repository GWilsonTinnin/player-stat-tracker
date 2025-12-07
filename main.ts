import { Plugin, WorkspaceLeaf, MarkdownPostProcessor, ItemView } from "obsidian";
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
  private variableElements: Map<HTMLElement, string> = new Map(); // Track replaced elements

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

    // Add command to debug counters
    this.addCommand({
      id: "debug-player-stat-counters",
      name: "Debug: Show All Counters",
      callback: () => {
        console.log("Player Stat Tracker - Current Counters:");
        this.counters.forEach((counter) => {
          console.log(`  ${counter.key}: ${counter.value}`);
        });
        console.log("Looking for variables in format: {{counter_key}}");
      },
    });

    // Add command to refresh variable replacements
    this.addCommand({
      id: "refresh-player-stat-variables",
      name: "Refresh Player Stat Variables",
      callback: () => {
        // Force re-render of all markdown to update variables
        this.app.workspace.updateOptions();
      },
    });

    // Register markdown post processor for variable replacement
    this.registerMarkdownPostProcessor((el: HTMLElement, ctx: any) => {
      this.replaceVariablesInElement(el);
    });

    // Periodically refresh variables in active documents
    this.registerInterval(
      window.setInterval(() => {
        this.updateAllVariables();
      }, 1000) // Update every second
    );
  }

  private updateAllVariables() {
    // Find all elements with player-stat-variable class and update their values
    const variableSpans = document.querySelectorAll(".player-stat-variable");
    variableSpans.forEach((span: Element) => {
      // Try to extract the variable name from nearby text or attribute
      const parent = span.parentNode;
      if (!parent) return;

      const text = parent.textContent || "";
      // Match pattern {{variable_name}}
      const regex = /\{\{([\w_]+)\}\}/g;
      let match;

      // Find the variable that corresponds to this span
      while ((match = regex.exec(text)) !== null) {
        const counterKey = match[1];
        const counter = this.counters.find((c) => c.key === counterKey);

        if (counter && span.textContent !== String(counter.value)) {
          // Update the span value
          span.textContent = String(counter.value);
          break;
        }
      }
    });

    // Also do a full refresh of markdown containers
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view && view.containerEl) {
        // Find all player-stat-variable elements and update them
        const containers = view.containerEl.querySelectorAll(
          ".markdown-reading-view, .markdown-preview-view, .cm-content"
        );
        containers.forEach((container) => {
          this.updateVariablesInContainer(container as HTMLElement);
        });
      }
    });
  }

  private updateVariablesInContainer(container: HTMLElement) {
    // Find all text nodes and check for variables that haven't been replaced yet
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const nodesToProcess: Node[] = [];
    let node: Node | null;

    while ((node = walker.nextNode())) {
      if (node.textContent?.includes("{{")) {
        nodesToProcess.push(node);
      }
    }

    nodesToProcess.forEach((node) => {
      this.replaceVariablesInNode(node);
    });
  }

  private replaceVariablesInNode(node: Node) {
    const text = node.textContent || "";
    const parent = node.parentNode;
    if (!parent) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    const regex = /\{\{([\w_]+)\}\}/g;
    let match;
    let hasReplacement = false;

    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex, match.index))
        );
      }

      // Find and replace counter variable
      const counterKey = match[1];
      const counter = this.counters.find((c) => c.key === counterKey);

      if (counter !== undefined) {
        const span = document.createElement("span");
        span.className = "player-stat-variable";
        span.setAttribute("data-counter-key", counterKey);
        span.style.fontWeight = "bold";
        span.style.color = "#0066cc";
        span.style.backgroundColor = "transparent";
        span.textContent = String(counter.value);
        fragment.appendChild(span);
        hasReplacement = true;
      } else {
        // Variable not found - keep original text
        fragment.appendChild(document.createTextNode(match[0]));
      }

      lastIndex = regex.lastIndex;
    }

    // Only replace if we found variables
    if (hasReplacement) {
      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      parent.replaceChild(fragment, node);
    }
  }

  private registerDataviewSource() {
    // Expose counters to Dataview via metadata
    // This allows queries like: from "PlayerStatCounter" where value > 10
    const api = (window as any).DataviewAPI;
    if (api) {
      // Create a virtual source for Dataview
      try {
        // Add custom source for player stat counters
        const counterSource = {
          name: "PlayerStatCounter",
          display: "Player Stat Counters",
          icon: "dice",
          parse: () => {
            return this.counters.map((counter) => ({
              ...counter,
              key: counter.key,
              value: counter.value,
              type: counter.type,
              log: counter.log || "",
              history: counter.history,
            }));
          },
        };
        // Note: Full Dataview integration requires Dataview API access
        // which varies by Dataview version
      } catch (e) {
        console.log("Dataview not available or integration not supported");
      }
    }
  }

  // Helper method to get counter by key (for external access)
  getCounterValue(key: string): number | null {
    const counter = this.counters.find((c) => c.key === key);
    return counter ? counter.value : null;
  }

  async activateView() {
    this.app.workspace.getRightLeaf(false).setViewState({
      type: VIEW_TYPE_PLAYER_STAT,
      active: true,
    });
  }

  async saveCounters() {
    await this.saveData({ counters: this.counters, settings: this.settings });
    // Trigger re-render to update variables in documents
    this.refreshMarkdownVariables();
  }

  async saveSettings() {
    await this.saveData({ counters: this.counters, settings: this.settings });
  }

  private refreshMarkdownVariables() {
    // Force markdown re-processing to update variable replacements
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view && view.containerEl) {
        // Trigger a re-render by updating the view
        (view as any).previewMode?.rerender(true);
      }
    });
  }
}