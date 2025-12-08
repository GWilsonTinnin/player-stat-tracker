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

    // Add CSS styling for variable links
    this.addStyle();

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

    // Add command to debug CSS variables
    this.addCommand({
      id: "debug-player-stat-css",
      name: "Debug: Check Variable Links in DOM",
      callback: () => {
        console.log("=== DEBUG: Searching for variable links ===");
        const links = document.querySelectorAll(".player-stat-variable");
        console.log(`Found ${links.length} variable links in the DOM`);
        
        // Also search by the internal-link class to see if they're there
        const internalLinks = document.querySelectorAll(".internal-link");
        console.log(`Found ${internalLinks.length} total internal links`);
        
        // Search specifically in markdown containers
        const mdContainers = document.querySelectorAll(".markdown-reading-view, .markdown-preview-view");
        console.log(`Found ${mdContainers.length} markdown containers`);
        mdContainers.forEach((container, i) => {
          const varLinksInContainer = container.querySelectorAll(".player-stat-variable");
          console.log(`  Container ${i}: ${varLinksInContainer.length} variable links`);
        });
        
        links.forEach((link, i) => {
          const key = link.getAttribute("data-counter-key");
          const value = link.textContent;
          const computedStyle = window.getComputedStyle(link);
          console.log(`Link ${i}: key="${key}", value="${value}", color="${computedStyle.color}", background="${computedStyle.backgroundColor}"`);
        });
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
      console.log("[PlayerStat] Post-processor called");
      console.log("  tagName:", el.tagName);
      console.log("  classes:", el.className);
      console.log("  innerHTML:", el.innerHTML?.substring(0, 100));
      console.log("  textContent:", el.textContent?.substring(0, 100));
      // Process the element directly - this is called for each rendered block
      this.processMarkdownElement(el);
    });

    // Periodically scan all markdown containers for variables
    this.registerInterval(
      window.setInterval(() => {
        this.scanAllMarkdownContainers();
      }, 2000) // Scan every 2 seconds
    );
  }

  private scanAllMarkdownContainers() {
    const containers = document.querySelectorAll(".markdown-reading-view, .markdown-preview-view");
    console.log(`[PlayerStat] Scanning ${containers.length} markdown containers`);
    
    // Also check for editor mode containers
    const editors = document.querySelectorAll(".cm-content, .CodeMirror");
    console.log(`[PlayerStat] Found ${editors.length} editor containers`);
    editors.forEach((editor, idx) => {
      console.log(`[PlayerStat] Editor ${idx} text preview: "${(editor as HTMLElement).textContent?.substring(0, 100)}"`);
    });
    
    containers.forEach((container, idx) => {
      console.log(`[PlayerStat] Scanning container ${idx}, HTML length: ${(container as HTMLElement).innerHTML?.length}`);
      this.processMarkdownElement(container as HTMLElement);
    });
  }

  private processMarkdownElement(element: HTMLElement) {
    console.log(`[PlayerStat] Processing element, tagName: ${element.tagName}`);
    console.log(`[PlayerStat] Element innerHTML: ${element.innerHTML?.substring(0, 200)}`);
    console.log(`[PlayerStat] Element textContent: ${element.textContent?.substring(0, 200)}`);
    
    // Find all text nodes and replace variables
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const nodesToProcess: Node[] = [];
    let node: Node | null;
    let allTextFound = "";

    while ((node = walker.nextNode())) {
      allTextFound += node.textContent + " | ";
      
      // Skip nodes that are already inside variable links
      const parent = node.parentElement;
      if (parent?.classList.contains("player-stat-variable")) {
        console.log(`[PlayerStat] Skipping node already in player-stat-variable`);
        continue;
      }
      
      if (node.textContent?.includes("<<")) {
        console.log(`[PlayerStat] Found variable text node: "${node.textContent}"`);
        nodesToProcess.push(node);
      }
    }
    
    console.log(`[PlayerStat] All text nodes found: ${allTextFound}`);
    console.log(`[PlayerStat] Nodes to process: ${nodesToProcess.length}`);
    
    nodesToProcess.forEach((node, idx) => {
      console.log(`[PlayerStat] Processing node ${idx}`);
      this.replaceVariablesInNode(node);
    });

    // Update all existing variable links with current values
    console.log(`[PlayerStat] After replacement, updating all variable links`);
    this.updateAllVariables();
  }

  private updateAllVariables() {
    // Find all elements with player-stat-variable class and update their values
    const variableLinks = document.querySelectorAll(".player-stat-variable");
    variableLinks.forEach((link: Element) => {
      const counterKey = link.getAttribute("data-counter-key");
      if (!counterKey) return;

      const counter = this.counters.find((c) => c.key === counterKey);
      if (counter && link.textContent !== String(counter.value)) {
        // Update the link text content with new value
        link.textContent = String(counter.value);
      }
    });
  }

  private replaceVariablesInNode(node: Node) {
    const text = node.textContent || "";
    const parent = node.parentNode;
    if (!parent) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    const regex = /<<([\w_]+)>>/g;
    let match;
    let hasReplacement = false;
    const createdLinks: HTMLElement[] = [];

    while ((match = regex.exec(text)) !== null) {
      console.log(`[PlayerStat] Found variable match: ${match[0]} -> key: ${match[1]}`);
      // Add text before match
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex, match.index))
        );
      }

      // Find and replace counter variable
      const counterKey = match[1];
      const counter = this.counters.find((c) => c.key === counterKey);
      console.log(`[PlayerStat] Looking for counter: ${counterKey}, found: ${counter ? 'YES' : 'NO'}`);

      if (counter !== undefined) {
        // Create a link-like element
        const link = document.createElement("a");
        link.className = "player-stat-variable internal-link";
        link.setAttribute("data-counter-key", counterKey);
        link.setAttribute("href", `#${counterKey}`);
        link.textContent = String(counter.value);
        console.log(`[PlayerStat] Created variable link for ${counterKey} with value ${counter.value}`);

        fragment.appendChild(link);
        createdLinks.push(link);
        hasReplacement = true;
      } else {
        // Variable not found - keep original text
        fragment.appendChild(document.createTextNode(match[0]));
      }

      lastIndex = regex.lastIndex;
    }

    // Only replace if we found variables
    if (hasReplacement) {
      console.log(`[PlayerStat] Replacing node, hasReplacement: true`);
      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      parent.replaceChild(fragment, node);
      console.log(`[PlayerStat] Successfully replaced node in DOM`);
      
      // Verify the links are now in the DOM
      const linkCount = parent.querySelectorAll(".player-stat-variable").length;
      console.log(`[PlayerStat] After replacement, parent container has ${linkCount} variable links`);
      console.log(`[PlayerStat] Found ${createdLinks.length} variable links to attach listeners to`);
      createdLinks.forEach((link) => {
        console.log(`[PlayerStat] Attaching listener to link: ${link.getAttribute("data-counter-key")}`);
        this.attachLinkListeners(link);
      });
    } else {
      console.log(`[PlayerStat] No replacements found in this node`);
    }
  }

  private attachLinkListeners(link: HTMLElement) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const counterKey = link.getAttribute("data-counter-key");
      // Open the player stat counter view
      this.activateView();
      console.log(`Clicked counter variable: ${counterKey}`);
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

  private addStyle() {
    const style = document.createElement("style");
    style.textContent = `
      /* Player Stat Tracker - Variable Link Styling */

      /* Main variable link styling */
      .markdown-reading-view a.player-stat-variable,
      .markdown-preview-view a.player-stat-variable,
      a.player-stat-variable {
        font-weight: bold !important;
        color: #0066cc !important;
        cursor: pointer !important;
        text-decoration: none !important;
        border-bottom: 1px solid #0066cc !important;
        padding: 0 2px !important;
        border-radius: 2px !important;
        transition: all 0.15s ease !important;
        display: inline-block !important;
        background-color: transparent !important;
      }

      /* Hover state - light blue background */
      .markdown-reading-view a.player-stat-variable:hover,
      .markdown-preview-view a.player-stat-variable:hover,
      a.player-stat-variable:hover {
        background-color: rgba(0, 102, 204, 0.2) !important;
        border-bottom-width: 2px !important;
        padding-bottom: 1px !important;
        box-shadow: 0 0 6px rgba(0, 102, 204, 0.3) !important;
      }

      /* Active/click state - darker blue background */
      .markdown-reading-view a.player-stat-variable:active,
      .markdown-preview-view a.player-stat-variable:active,
      a.player-stat-variable:active {
        background-color: rgba(0, 102, 204, 0.3) !important;
        border-bottom-width: 2px !important;
      }

      /* Dark mode support */
      body.theme-dark .markdown-reading-view a.player-stat-variable,
      body.theme-dark .markdown-preview-view a.player-stat-variable,
      body.theme-dark a.player-stat-variable {
        color: #5c9cff !important;
        border-bottom-color: #5c9cff !important;
      }

      body.theme-dark .markdown-reading-view a.player-stat-variable:hover,
      body.theme-dark .markdown-preview-view a.player-stat-variable:hover,
      body.theme-dark a.player-stat-variable:hover {
        background-color: rgba(92, 156, 255, 0.2) !important;
        box-shadow: 0 0 6px rgba(92, 156, 255, 0.3) !important;
      }

      body.theme-dark .markdown-reading-view a.player-stat-variable:active,
      body.theme-dark .markdown-preview-view a.player-stat-variable:active,
      body.theme-dark a.player-stat-variable:active {
        background-color: rgba(92, 156, 255, 0.3) !important;
      }
    `;
    document.head.appendChild(style);
  }
}