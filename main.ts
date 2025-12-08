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
    this.addPluginStyles();

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
        console.log("=== Player Stat Tracker - Current Counters ===");
        console.log(`Total counters: ${this.counters.length}`);
        this.counters.forEach((counter) => {
          console.log(`  ${counter.key}: ${counter.value} (type: ${counter.type})`);
        });
        console.log("Looking for variables in format: <<counter_key>>");
        
        // Also check if post-processor was registered
        console.log("[PlayerStat] Post-processor should be active");
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
    console.log("[PlayerStat] Registering markdown post-processor...");
    this.registerMarkdownPostProcessor((el: HTMLElement, ctx: any) => {
      console.log("[PlayerStat] ✓✓✓ POST-PROCESSOR CALLED ✓✓✓");
      console.log("  tagName:", el.tagName);
      console.log("  innerHTML:", el.innerHTML?.substring(0, 100));
      
      // Process element to replace variables
      this.replaceVariablesInElement(el);
    });
    console.log("[PlayerStat] ✓ Post-processor registered successfully");
    
    // ALSO try to scan existing markdown immediately (in case it's already rendered)
    console.log("[PlayerStat] Attempting initial scan of existing markdown...");
    setTimeout(() => {
      this.scanAndReplaceVariables();
    }, 500);

    // Also scan on a delay for any updates
    this.registerInterval(
      window.setInterval(() => {
        this.updateAllVariables();
      }, 500) // Update variable values every 500ms
    );
  }

  private replaceVariablesInElement(element: HTMLElement) {
    console.log(`[PlayerStat] Replace variables in element, tagName: ${element.tagName}`);
    console.log(`[PlayerStat] Element content: "${element.textContent?.substring(0, 100)}"`);
    
    // Get all text content and look for variable patterns
    const fullText = element.textContent || "";
    const variableMatches = fullText.match(/<<[\w_]+>>/g) || [];
    
    console.log(`[PlayerStat] Full text analysis found ${variableMatches.length} potential variables: ${variableMatches.join(", ")}`);
    
    // Process each potential variable by searching the DOM
    variableMatches.forEach((varRef) => {
      const key = varRef.slice(2, -2); // Remove << and >>
      console.log(`[PlayerStat] Attempting to replace variable: ${varRef} (key: ${key})`);
      this.findAndReplaceVariable(element, varRef, key);
    });
  }

  private findAndReplaceVariable(container: HTMLElement, varRef: string, key: string) {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node: Node | null;
    const nodesToProcess: Array<{node: Node, varRef: string, key: string}> = [];

    // First, collect all nodes that might contain the variable (fragmented or whole)
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      
      // Skip if already processed
      if (parent?.classList.contains("player-stat-variable")) {
        continue;
      }
      
      // Check if this node or nearby nodes contain the variable
      const text = node.textContent || "";
      if (text.includes("<") || text === key || text.includes(">")) {
        nodesToProcess.push({node, varRef, key});
      }
    }

    // If we found nodes, try to reconstruct and replace the variable
    if (nodesToProcess.length > 0) {
      console.log(`[PlayerStat] Found ${nodesToProcess.length} nodes that might be part of variable ${varRef}`);
      
      // Try the simple case first: look for the whole variable in a single node
      const wholeMatch = nodesToProcess.find(({node}) => 
        (node.textContent || "").includes(varRef)
      );
      
      if (wholeMatch) {
        console.log(`[PlayerStat] Found whole variable in single node: ${varRef}`);
        this.replaceVariablesInNode(wholeMatch.node);
      } else {
        // Variable is fragmented - need to reconstruct it
        console.log(`[PlayerStat] Variable ${varRef} is fragmented across multiple nodes, attempting reconstruction...`);
        this.reconstructAndReplaceFragmentedVariable(container, varRef, key);
      }
    }
  }

  private reconstructAndReplaceFragmentedVariable(container: HTMLElement, varRef: string, key: string) {
    console.log(`[PlayerStat] Attempting to reconstruct fragmented variable: ${varRef}`);
    
    // Get the counter
    const counter = this.counters.find((c) => c.key === key);
    if (!counter) {
      console.log(`[PlayerStat] Counter not found: ${key}`);
      return;
    }
    
    console.log(`[PlayerStat] ✓ Found counter: ${key} = ${counter.value}`);
    
    // Create the replacement link
    const link = document.createElement("a");
    link.className = "player-stat-variable internal-link";
    link.setAttribute("data-counter-key", key);
    link.setAttribute("href", `#${key}`);
    link.textContent = String(counter.value);

    // Find the fragment nodes and replace them
    // This is tricky - we look for nodes containing < followed by < and key and >
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const fragmentNodes: Node[] = [];
    let node: Node | null;
    let foundStart = false;

    while ((node = walker.nextNode())) {
      const text = node.textContent || "";
      
      if (!foundStart && text === "<<") {
        foundStart = true;
        fragmentNodes.push(node);
      } else if (foundStart) {
        fragmentNodes.push(node);
        
        // Check if this completes the variable
        if (text === ">>") {
          // Verify this is actually our variable by checking all fragments
          const reconstructed = fragmentNodes.map(n => n.textContent).join("");
          if (reconstructed === varRef) {
            console.log(`[PlayerStat] ✓ Reconstructed variable from ${fragmentNodes.length} fragments`);
            
            // Replace all fragment nodes with the link (first node) and text nodes (rest as empty)
            const parent = fragmentNodes[0].parentNode;
            if (parent) {
              parent.insertBefore(link, fragmentNodes[0]);
              fragmentNodes.forEach(n => {
                if (n.parentNode) {
                  n.parentNode.removeChild(n);
                }
              });
              this.attachLinkListeners(link);
              return;
            }
          }
          
          foundStart = false;
          fragmentNodes.length = 0;
        }
      }
    }
  }

  private scanAndReplaceVariables() {
    console.log("[PlayerStat] Scanning DOM for markdown containers...");
    
    // Find all markdown preview elements
    const previews = document.querySelectorAll(".markdown-preview-view, .markdown-rendered, .cm-content");
    console.log(`[PlayerStat] Found ${previews.length} potential markdown containers`);
    
    previews.forEach((preview, idx) => {
      console.log(`[PlayerStat] Scanning container ${idx}...`);
      const text = (preview as HTMLElement).textContent || "";
      console.log(`[PlayerStat] Container ${idx} text preview: "${text.substring(0, 150)}"`);
      
      // Look for unreplaced variables
      const unreplacedVars = text.match(/<<[\w_]+>>/g);
      if (unreplacedVars) {
        console.log(`[PlayerStat] Found unreplaced variables in container ${idx}: ${unreplacedVars.join(", ")}`);
      }
      
      this.replaceVariablesInElement(preview as HTMLElement);
    });
  }

  private updateAllVariables() {
    // Find all elements with player-stat-variable class and update their values
    const variableLinks = document.querySelectorAll(".player-stat-variable");
    
    if (variableLinks.length > 0) {
      console.log(`[PlayerStat] updateAllVariables: Found ${variableLinks.length} variable links`);
    }
    
    variableLinks.forEach((link: Element, idx: number) => {
      const counterKey = link.getAttribute("data-counter-key");
      if (!counterKey) {
        console.log(`[PlayerStat] Link ${idx}: No data-counter-key attribute`);
        return;
      }

      const counter = this.counters.find((c) => c.key === counterKey);
      const currentText = link.textContent || "";
      const expectedValue = counter ? String(counter.value) : "NOT FOUND";
      
      if (counter && link.textContent !== String(counter.value)) {
        console.log(`[PlayerStat] Updating link ${idx}: "${currentText}" -> "${counter.value}"`);
        link.textContent = String(counter.value);
      } else if (!counter) {
        console.log(`[PlayerStat] Link ${idx}: Counter "${counterKey}" not found. Current text: "${currentText}"`);
      }
    });
  }

  private replaceVariablesInNode(node: Node) {
    const text = node.textContent || "";
    const parent = node.parentNode;
    if (!parent) return;

    console.log(`[PlayerStat] Replacing in node: "${text}"`);
    console.log(`[PlayerStat] Available counters: ${this.counters.map(c => `${c.key}=${c.value}`).join(", ")}`);

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    const regex = /<<([\w_]+)>>/g;
    let match;
    let hasReplacement = false;
    const createdLinks: HTMLElement[] = [];

    while ((match = regex.exec(text)) !== null) {
      console.log(`[PlayerStat] Found variable match: "${match[0]}" -> key: "${match[1]}"`);
      
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
        console.log(`[PlayerStat] ✓ Found counter: ${counterKey} = ${counter.value}`);
        
        // Create a link-like element
        const link = document.createElement("a");
        link.className = "player-stat-variable internal-link";
        link.setAttribute("data-counter-key", counterKey);
        link.setAttribute("href", `#${counterKey}`);
        link.textContent = String(counter.value);

        fragment.appendChild(link);
        createdLinks.push(link);
        hasReplacement = true;
      } else {
        console.log(`[PlayerStat] ✗ Counter NOT found: ${counterKey}`);
        // Variable not found - keep original text
        fragment.appendChild(document.createTextNode(match[0]));
      }

      lastIndex = regex.lastIndex;
    }

    // Only replace if we found variables
    if (hasReplacement) {
      console.log(`[PlayerStat] ✓ Replacing node with ${createdLinks.length} variable links`);
      
      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      parent.replaceChild(fragment, node);
      
      createdLinks.forEach((link) => {
        this.attachLinkListeners(link);
      });
    } else {
      console.log(`[PlayerStat] ✗ No replacements made for this node`);
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

  private addPluginStyles() {
    const css = `
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
    
    // Direct DOM injection
    const style = document.createElement("style");
    style.id = "player-stat-tracker-styles";
    style.textContent = css;
    document.head.appendChild(style);
    
    console.log("[PlayerStat] CSS styles injected into document");
    
    // Verify the styles are in the DOM
    setTimeout(() => {
      const injectedStyle = document.getElementById("player-stat-tracker-styles");
      if (injectedStyle) {
        console.log("[PlayerStat] ✓ CSS style element found in DOM");
        const rules = injectedStyle.sheet?.cssRules?.length || 0;
        console.log(`[PlayerStat] ✓ CSS rules loaded: ${rules}`);
      } else {
        console.log("[PlayerStat] ✗ CSS style element NOT found in DOM");
      }
    }, 100);
  }
}