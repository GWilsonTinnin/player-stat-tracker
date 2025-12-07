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

    // Also monitor for DOM changes and update variables
    const observer = new MutationObserver(() => {
      const activeView = this.app.workspace.getActiveViewOfType(ItemView);
      if (activeView && activeView.containerEl) {
        this.replaceVariablesInElement(activeView.containerEl);
      }
    });

    // Start observing after a short delay to ensure DOM is ready
    setTimeout(() => {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }, 1000);

    this.registerInterval(
      window.setInterval(() => {
        // Periodically refresh variables in active documents
        const leaves = this.app.workspace.getLeavesOfType("markdown");
        leaves.forEach((leaf) => {
          const view = leaf.view;
          if (view && view.containerEl) {
            this.replaceVariablesInElement(view.containerEl);
          }
        });
      }, 2000)
    );

    // Register Dataview source if available
    this.registerDataviewSource();
  }

  private replaceVariablesInElement(el: HTMLElement) {
    // Get all text nodes
    const textNodes: Node[] = [];
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes("{{")) {
        textNodes.push(node);
      }
    }

    // Process each text node
    textNodes.forEach((node) => {
      const text = node.textContent || "";
      const parent = node.parentNode;
      if (!parent) return;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      const regex = /\{\{([\w_]+)\}\}/g;
      let match;

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
          span.style.fontWeight = "bold";
          span.style.color = "#0066cc";
          span.style.backgroundColor = "transparent";
          span.textContent = String(counter.value);
          fragment.appendChild(span);
        } else {
          // Variable not found - keep original text
          fragment.appendChild(document.createTextNode(match[0]));
        }

        lastIndex = regex.lastIndex;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      parent.replaceChild(fragment, node);
    });
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