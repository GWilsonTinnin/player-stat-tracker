import { Plugin, WorkspaceLeaf, MarkdownPostProcessor, ItemView } from "obsidian";
import { PlayerStatView, VIEW_TYPE_PLAYER_STAT } from "./view";
import { PlayerStatSettingTab } from "./settings";
import { PlayerCounter } from "./counter";
import { createPlayerStatViewPlugin } from "./cm6-plugin";

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

    // Add CSS styling for variable links using Obsidian's style injection
    this.addPluginStyles();

    // Register CodeMirror 6 View Plugin for live preview (viewport) rendering
    console.log("[PlayerStat] Registering CodeMirror 6 View Plugin...");
    this.registerEditorExtension([createPlayerStatViewPlugin(this)]);
    console.log("[PlayerStat] ✓ CodeMirror 6 View Plugin registered");

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

    // Add command to inspect DOM rendering
    this.addCommand({
      id: "debug-player-stat-dom",
      name: "Debug: Inspect DOM for variables",
      callback: () => {
        console.log("=== Inspecting DOM for variable references ===");
        
        const container = document.querySelector(".markdown-preview-view");
        if (!container) {
          console.log("No markdown preview container found");
          return;
        }
        
        console.log("Container HTML:", container.innerHTML.substring(0, 500));
        
        // Look for all text that might be a variable
        const walker = document.createTreeWalker(
          container,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node: Node | null;
        let nodeCount = 0;
        while ((node = walker.nextNode())) {
          const text = node.textContent || "";
          if (text.includes("<") || text.includes(">") || text.includes("health") || text.includes("dean") || text.includes("mana")) {
            console.log(`Text node ${nodeCount}: "${text}"`);
          }
          nodeCount++;
        }
        
        // Also check for any elements with specific classes
        const varLinks = container.querySelectorAll(".player-stat-variable-link");
        console.log(`Found ${varLinks.length} .player-stat-variable-link elements`);
        varLinks.forEach((el, i) => {
          console.log(`  Link ${i}: key="${el.getAttribute("data-counter-key")}", text="${el.textContent}"`);
        });
      },
    });

    // Add command to debug CSS variables
    this.addCommand({
      id: "debug-player-stat-css",
      name: "Debug: Check Variable Links in DOM",
      callback: () => {
        console.log("=== DEBUG: Searching for variable links ===");
        const links = document.querySelectorAll(".player-stat-variable-link");
        console.log(`Found ${links.length} variable links in the DOM`);
        
        // Also search by the internal-link class to see if they're there
        const internalLinks = document.querySelectorAll(".internal-link");
        console.log(`Found ${internalLinks.length} total internal links`);
        
        // Search specifically in markdown containers
        const mdContainers = document.querySelectorAll(".markdown-reading-view, .markdown-preview-view");
        console.log(`Found ${mdContainers.length} markdown containers`);
        mdContainers.forEach((container, i) => {
          const varLinksInContainer = container.querySelectorAll(".player-stat-variable-link");
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
    const variableMatches = fullText.match(/{{[\w_]+}}/g) || [];
    
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
      if (parent?.classList.contains("player-stat-variable-link")) {
        continue;
      }
      
      // Check if this node or nearby nodes contain the variable
      const text = node.textContent || "";
      if (text.includes("{") || text === key || text.includes("}") || text.includes(varRef)) {
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
    
    // Create the replacement link as a span element to avoid Obsidian's internal link behavior
    const link = document.createElement("span");
    link.className = "player-stat-variable-link";
    link.setAttribute("data-counter-key", key);
    link.textContent = String(counter.value);
    
    // Apply styles immediately
    this.styleVariableLink(link);

    // Strategy: Find all text nodes and search for fragments
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const allNodes: Node[] = [];
    let node: Node | null;
    
    // Collect all text nodes first
    while ((node = walker.nextNode())) {
      allNodes.push(node);
    }

    console.log(`[PlayerStat] Collected ${allNodes.length} text nodes for fragmented search`);
    allNodes.forEach((n, idx) => {
      console.log(`  Node ${idx}: "${n.textContent}"`);
    });

    // Now search for the pattern by looking for the key text
    for (let i = 0; i < allNodes.length; i++) {
      const currentText = allNodes[i].textContent || "";
      
      // Look for the key or opening markers
      if (currentText.includes(key) || currentText === "{" || currentText.includes("{")) {
        console.log(`[PlayerStat] Node ${i} might contain variable: "${currentText}"`);
        
        // Try to reconstruct from this point backward and forward
        let startIdx = i;
        let endIdx = i;
        
        // Search backward for {{
        for (let j = i; j >= Math.max(0, i - 5); j--) {
          const text = allNodes[j].textContent || "";
          if (text.includes("{{") || (j < i && (text === "{" || text === "{{"))) {
            startIdx = j;
            break;
          }
        }
        
        // Search forward for }}
        for (let j = i; j <= Math.min(allNodes.length - 1, i + 5); j++) {
          const text = allNodes[j].textContent || "";
          if (text.includes("}}") || (j > i && (text === "}" || text === "}}"))) {
            endIdx = j;
            break;
          }
        }
        
        // Reconstruct the full string
        let reconstructed = "";
        for (let j = startIdx; j <= endIdx; j++) {
          reconstructed += allNodes[j].textContent;
        }
        
        console.log(`[PlayerStat] Reconstructed from nodes ${startIdx}-${endIdx}: "${reconstructed}"`);
        
        if (reconstructed.includes(varRef)) {
          console.log(`[PlayerStat] ✓ Match found! Replacing nodes ${startIdx} to ${endIdx}`);
          
          const parent = allNodes[startIdx].parentNode;
          if (parent) {
            // Insert the link before the first fragment node
            parent.insertBefore(link, allNodes[startIdx]);
            
            // Remove all fragment nodes
            for (let j = startIdx; j <= endIdx; j++) {
              if (allNodes[j].parentNode) {
                allNodes[j].parentNode.removeChild(allNodes[j]);
              }
            }
            
            this.attachLinkListeners(link);
            console.log(`[PlayerStat] ✓ Successfully replaced fragmented variable ${varRef}`);
            return;
          }
        }
      }
    }
    
    console.log(`[PlayerStat] ✗ Could not reconstruct fragmented variable: ${varRef}`);
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
      const unreplacedVars = text.match(/{{[\w_]+}}/g);
      if (unreplacedVars) {
        console.log(`[PlayerStat] Found unreplaced variables in container ${idx}: ${unreplacedVars.join(", ")}`);
      }
      
      this.replaceVariablesInElement(preview as HTMLElement);
    });
  }

  private updateAllVariables() {
    // Find all elements with player-stat-variable-link class and update their values
    const variableLinks = document.querySelectorAll(".player-stat-variable-link");
    
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

    // Notify all editors to update their viewport (for CodeMirror 6)
    this.notifyEditorsToUpdate();

    // Also scan for any unreplaced variables in the DOM
    this.scanAndReplaceVariables();
  }

  private notifyEditorsToUpdate() {
    // Trigger an update to all editor views to re-render decorations
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view && (view as any).editor) {
        const editor = (view as any).editor;
        const editorView = editor.cm;
        if (editorView) {
          // Force a full update of the editor viewport
          editorView.dispatch({});
        }
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
    const regex = /{{([\w_]+)}}/g;
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
        
        // Create a span element to display counter value (not a link to avoid Obsidian's hover preview)
        const link = document.createElement("span");
        link.className = "player-stat-variable-link";
        link.setAttribute("data-counter-key", counterKey);
        link.textContent = String(counter.value);
        
        // Apply styles immediately
        this.styleVariableLink(link);

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

  private styleVariableLink(link: HTMLElement) {
    // Don't apply inline styles - rely on CSS classes only
    // Obsidian sanitizes inline styles, so we just ensure the class is set
    if (!link.classList.contains("player-stat-variable-link")) {
      link.classList.add("player-stat-variable-link");
    }
    
    console.log(`[PlayerStat] Styled element with class: ${link.className}`);
  }

  private attachLinkListeners(link: HTMLElement) {
    // Apply inline styles (may already be applied, but ensure they are)
    this.styleVariableLink(link);
    
    // Add click handler to open plugin sidebar
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const counterKey = link.getAttribute("data-counter-key");
      if (!counterKey) return;
      
      console.log(`[PlayerStat] Clicked counter variable: ${counterKey}`);
      // Open the plugin's sidebar to show all counters
      await this.activateView();
    });
    
    // Add hover handler to show popup
    let hoverTimeout: number | null = null;
    let popup: HTMLElement | null = null;
    
    link.addEventListener("mouseenter", (e) => {
      const counterKey = link.getAttribute("data-counter-key");
      if (!counterKey) return;
      
      // Show popup after a brief delay
      hoverTimeout = window.setTimeout(() => {
        popup = this.showCounterPopup(counterKey, link);
      }, 300); // 300ms delay before showing popup
    });
    
    link.addEventListener("mouseleave", () => {
      // Cancel popup if mouse leaves before delay
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      // Remove popup if it exists
      if (popup) {
        popup.remove();
        popup = null;
      }
    });
    
    console.log(`[PlayerStat] Attached listeners to variable link: ${link.getAttribute("data-counter-key")}`);
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

  private async createOrNavigateToCounterDocument(counterKey: string) {
    // Create a filename based on the counter key
    const fileName = `Counter-${counterKey.charAt(0).toUpperCase() + counterKey.slice(1).replace(/_/g, "-")}.md`;
    
    // Check if the file already exists
    const file = this.app.vault.getAbstractFileByPath(fileName);
    
    if (file) {
      // File exists, navigate to it
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file as any);
      console.log(`[PlayerStat] Navigated to existing counter document: ${fileName}`);
    } else {
      // File doesn't exist, create it
      const counter = this.counters.find((c) => c.key === counterKey);
      if (!counter) {
        console.log(`[PlayerStat] Counter not found: ${counterKey}`);
        return;
      }
      
      // Create document content
      const content = `# ${counterKey.charAt(0).toUpperCase() + counterKey.slice(1).replace(/_/g, " ")}

Current Value: {{${counterKey}}}

## Log
${counter.log || "No log entries yet."}

## History
${counter.history.map((h) => `- ${new Date(h.timestamp).toLocaleString()}: ${h.value}`).join("\n")}
`;
      
      // Create the file
      const newFile = await this.app.vault.create(fileName, content);
      
      // Open it
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(newFile);
      console.log(`[PlayerStat] Created new counter document: ${fileName}`);
    }
  }

  private showCounterPopup(counterKey: string, anchorElement: HTMLElement): HTMLElement {
    const counter = this.counters.find((c) => c.key === counterKey);
    if (!counter) {
      console.log(`[PlayerStat] Counter not found for popup: ${counterKey}`);
      const emptyPopup = document.createElement("div");
      return emptyPopup;
    }
    
    // Create popup container
    const popup = document.createElement("div");
    popup.className = "player-stat-popup";
    popup.style.position = "fixed";
    popup.style.backgroundColor = "var(--background-primary)";
    popup.style.border = "1px solid var(--divider-color)";
    popup.style.borderRadius = "8px";
    popup.style.padding = "16px";
    popup.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    popup.style.zIndex = "1000";
    popup.style.minWidth = "250px";
    popup.style.maxWidth = "350px";
    
    // Position popup near the anchor element
    const rect = anchorElement.getBoundingClientRect();
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 5}px`;
    
    // Counter name
    const nameDiv = popup.createDiv();
    nameDiv.style.fontWeight = "bold";
    nameDiv.style.fontSize = "16px";
    nameDiv.style.marginBottom = "8px";
    nameDiv.style.color = "var(--text-normal)";
    nameDiv.textContent = counter.key.charAt(0).toUpperCase() + counter.key.slice(1).replace(/_/g, " ");
    
    // Current value
    const valueDiv = popup.createDiv();
    valueDiv.style.fontSize = "24px";
    valueDiv.style.fontWeight = "bold";
    valueDiv.style.marginBottom = "12px";
    valueDiv.style.color = "var(--text-accent)";
    valueDiv.textContent = `Value: ${counter.value}`;
    
    // Latest log entry
    if (counter.log) {
      const logDiv = popup.createDiv();
      logDiv.style.fontSize = "12px";
      logDiv.style.color = "var(--text-muted)";
      logDiv.style.fontStyle = "italic";
      logDiv.style.marginBottom = "8px";
      logDiv.style.maxHeight = "60px";
      logDiv.style.overflowY = "auto";
      
      const entries = counter.log.split("-").map(e => e.trim()).filter(e => e);
      if (entries.length > 0) {
        const latestContent = entries[entries.length - 1];
        logDiv.textContent = `Latest: ${latestContent}`;
      }
    }
    
    // Recent history
    if (counter.history && counter.history.length > 0) {
      const historyDiv = popup.createDiv();
      historyDiv.style.fontSize = "11px";
      historyDiv.style.color = "var(--text-muted)";
      historyDiv.style.marginTop = "8px";
      historyDiv.style.paddingTop = "8px";
      historyDiv.style.borderTop = "1px solid var(--divider-color)";
      
      const historyTitle = historyDiv.createDiv();
      historyTitle.style.fontWeight = "bold";
      historyTitle.style.marginBottom = "4px";
      historyTitle.textContent = "Recent History:";
      
      const recentEntries = counter.history.slice(-3).reverse();
      recentEntries.forEach((entry) => {
        const entryDiv = historyDiv.createDiv();
        entryDiv.style.marginLeft = "8px";
        entryDiv.textContent = `${new Date(entry.timestamp).toLocaleString()}: ${entry.value}`;
      });
    }
    
    // Add to document
    document.body.appendChild(popup);
    
    // Remove popup when clicking outside
    const removePopup = (e: MouseEvent) => {
      if (!popup.contains(e.target as Node) && e.target !== anchorElement) {
        popup.remove();
        document.removeEventListener("click", removePopup);
      }
    };
    
    // Add click listener after a brief delay to prevent immediate removal
    setTimeout(() => {
      document.addEventListener("click", removePopup);
    }, 100);
    
    return popup;
  }

  async activateView() {
    const rightLeaf = this.app.workspace.getRightLeaf(false);
    if (rightLeaf) {
      await rightLeaf.setViewState({
        type: VIEW_TYPE_PLAYER_STAT,
        active: true,
      });
    }
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
    // Use Obsidian's CSS injection for styling
    const css = `
/* Player Stat Tracker Plugin Styles */

/* Counter variable links - works in both Reading and Live Preview modes */
.player-stat-variable-link {
  color: var(--text-accent);
  text-decoration: underline;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
  background-color: transparent;
  display: inline;
}

/* Hover state */
.player-stat-variable-link:hover {
  background-color: var(--text-accent-hover);
  color: var(--text-on-accent);
}

/* Live Preview specific styling */
.cm-line .player-stat-variable-link {
  font-weight: 500;
}

/* Reading mode specific styling */
.markdown-preview-view .player-stat-variable-link {
  font-weight: 500;
}

/* Make sure the styling persists in different themes */
body.theme-dark .player-stat-variable-link {
  color: var(--text-accent);
}

body.theme-light .player-stat-variable-link {
  color: var(--text-accent);
}

body.theme-dark .player-stat-variable-link:hover {
  background-color: var(--text-accent-hover);
  color: var(--text-on-accent);
}

body.theme-light .player-stat-variable-link:hover {
  background-color: var(--text-accent-hover);
  color: var(--text-on-accent);
}
`;
    
    // Create and inject the style element
    const styleEl = document.createElement("style");
    styleEl.id = "player-stat-tracker-styles";
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    
    console.log("[PlayerStat] CSS styles injected into document");
  }
}