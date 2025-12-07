import { ItemView, WorkspaceLeaf } from "obsidian";
import { PlayerCounter } from "./counter";
import type PlayerStatCounterPlugin from "./main";

export const VIEW_TYPE_PLAYER_STAT = "player-stat-counter";

export class PlayerStatView extends ItemView {
  countersList: HTMLElement | null = null;
  plugin: PlayerStatCounterPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: PlayerStatCounterPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_PLAYER_STAT;
  }

  getDisplayText() {
    return "Player Stat Counter";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.style.padding = "10px";

    // Create header with add button
    const header = container.createDiv("player-stat-header");
    
    const title = header.createEl("h2", { text: "Player Counters" });
    title.style.margin = "0 0 10px 0";
    title.style.fontSize = "18px";

    const addButton = header.createEl("button", { text: "+ Add Counter" });
    addButton.style.padding = "8px 16px";
    addButton.style.backgroundColor = "#007acc";
    addButton.style.color = "white";
    addButton.style.border = "none";
    addButton.style.borderRadius = "4px";
    addButton.style.cursor = "pointer";
    addButton.style.fontSize = "14px";
    addButton.style.marginTop = "10px";
    addButton.style.width = "100%";

    addButton.addEventListener("click", () => {
      this.showAddCounterDialog();
    });

    // Container for counters list
    this.countersList = container.createDiv("counters-list");
    this.countersList.style.marginTop = "20px";

    this.renderCounters();
  }

  private renderCounters() {
    if (!this.countersList) return;

    this.countersList.empty();

    if (this.plugin.counters.length === 0) {
      this.countersList.createEl("p", { 
        text: "No counters yet. Click 'Add Counter' to create one.",
        cls: "placeholder-text"
      });
      this.countersList.style.color = "#888";
      return;
    }

    // Define alternating colors
    const colors = ["#E8F4F8", "#FFF4E6"];

    // Render each counter
    this.plugin.counters.forEach((counter, index) => {
      const bgColor = colors[index % colors.length];
      
      const counterItem = this.countersList!.createDiv("counter-item");
      counterItem.style.marginBottom = "12px";
      counterItem.style.padding = "16px";
      counterItem.style.backgroundColor = bgColor;
      counterItem.style.borderRadius = "8px";
      counterItem.style.border = "none";
      counterItem.style.display = "flex";
      counterItem.style.justifyContent = "space-between";
      counterItem.style.alignItems = "flex-start";
      counterItem.style.minHeight = "60px";
      counterItem.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
      counterItem.style.flexWrap = "wrap";
      counterItem.style.gap = "12px";

      // Left side: Counter name and number
      const leftSection = counterItem.createDiv();
      leftSection.style.display = "flex";
      leftSection.style.flexDirection = "column";
      leftSection.style.justifyContent = "center";
      leftSection.style.flex = "1";

      const nameDiv = leftSection.createDiv();
      nameDiv.style.color = "#000";
      nameDiv.style.fontWeight = "bold";
      nameDiv.style.fontSize = "16px";
      nameDiv.style.marginBottom = "4px";
      nameDiv.textContent = counter.key.charAt(0).toUpperCase() + counter.key.slice(1).replace(/-/g, " ");

      const valueDiv = leftSection.createDiv();
      valueDiv.style.color = "#000";
      valueDiv.style.fontSize = "28px";
      valueDiv.style.fontWeight = "bold";
      valueDiv.style.marginBottom = "8px";
      valueDiv.textContent = String(counter.value);

      // Display latest log entry
      const latestEntryDiv = leftSection.createDiv();
      latestEntryDiv.style.color = "#555";
      latestEntryDiv.style.fontSize = "12px";
      latestEntryDiv.style.fontStyle = "italic";
      latestEntryDiv.style.maxWidth = "200px";
      latestEntryDiv.style.overflow = "hidden";
      latestEntryDiv.style.textOverflow = "ellipsis";
      latestEntryDiv.style.whiteSpace = "nowrap";
      
      if (counter.log) {
        // Split by "-" to get individual entries
        const entries = counter.log.split("-").map(e => e.trim()).filter(e => e);
        if (entries.length > 0) {
          const latestContent = entries[entries.length - 1];
          latestEntryDiv.textContent = latestContent;
        } else {
          latestEntryDiv.textContent = "No log entries";
        }
      } else {
        latestEntryDiv.textContent = "No log entries";
      }

      // Right side: Control buttons
      const rightSection = counterItem.createDiv();
      rightSection.style.display = "flex";
      rightSection.style.gap = "6px";
      rightSection.style.marginLeft = "12px";
      rightSection.style.flexWrap = "wrap";
      rightSection.style.justifyContent = "flex-end";
      rightSection.style.flex = "1 1 auto";
      rightSection.style.minWidth = "0";

      const decrementBtn = rightSection.createEl("button", { text: "−" });
      this.styleSmallButton(decrementBtn, "#dc3545");
      decrementBtn.addEventListener("click", async () => {
        counter.value = Math.max(this.plugin.settings.minValue, counter.value - 1);
        counter.history.push({
          timestamp: new Date().toISOString(),
          value: counter.value
        });
        await this.plugin.saveCounters();
        this.renderCounters();
      });

      const incrementBtn = rightSection.createEl("button", { text: "+" });
      this.styleSmallButton(incrementBtn, "#28a745");
      incrementBtn.addEventListener("click", async () => {
        const maxVal = this.plugin.settings.maxValue || Infinity;
        counter.value = Math.min(maxVal, counter.value + 1);
        counter.history.push({
          timestamp: new Date().toISOString(),
          value: counter.value
        });
        await this.plugin.saveCounters();
        this.renderCounters();
      });

      const deleteBtn = rightSection.createEl("button", { text: "✕" });
      this.styleSmallButton(deleteBtn, "#999");
      deleteBtn.addEventListener("click", async () => {
        if (this.plugin.settings.showDeleteConfirm) {
          if (!confirm(`Delete counter "${counter.key}"?`)) return;
        }
        this.plugin.counters.splice(index, 1);
        await this.plugin.saveCounters();
        this.renderCounters();
      });

      const editBtn = rightSection.createEl("button", { text: "✎" });
      this.styleSmallButton(editBtn, "#0066cc");
      editBtn.addEventListener("click", async () => {
        this.showEditCounterDialog(counter);
      });

      const manualBtn = rightSection.createEl("button", { text: "±" });
      this.styleSmallButton(manualBtn, "#6f42c1");
      manualBtn.addEventListener("click", async () => {
        this.showManualEntryDialog(counter);
      });
    });
  }

  private styleSmallButton(btn: HTMLElement, bgColor: string) {
    btn.style.padding = "6px 12px";
    btn.style.backgroundColor = bgColor;
    btn.style.color = "white";
    btn.style.border = "none";
    btn.style.borderRadius = "4px";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "14px";
    btn.style.fontWeight = "bold";
    btn.style.whiteSpace = "nowrap";
    btn.style.minWidth = "auto";
    btn.style.flex = "0 1 auto";
  }

  private showAddCounterDialog() {
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.backgroundColor = "var(--background-primary)";
    modal.style.border = "1px solid var(--divider-color)";
    modal.style.borderRadius = "8px";
    modal.style.padding = "20px";
    modal.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    modal.style.zIndex = "1000";
    modal.style.minWidth = "300px";
    modal.style.maxHeight = "80vh";
    modal.style.overflowY = "auto";

    const title = modal.createEl("h3", { text: "Add New Counter" });
    title.style.marginTop = "0";

    const form = modal.createDiv("form");

    // Counter Name
    const nameLabel = form.createEl("label", { text: "Counter Name:" });
    nameLabel.style.display = "block";
    nameLabel.style.marginBottom = "5px";
    nameLabel.style.fontWeight = "bold";

    const nameInput = form.createEl("input", {
      type: "text",
      placeholder: "e.g., Health, Mana, Experience"
    }) as HTMLInputElement;
    nameInput.style.width = "100%";
    nameInput.style.padding = "8px";
    nameInput.style.marginBottom = "15px";
    nameInput.style.border = "1px solid var(--divider-color)";
    nameInput.style.borderRadius = "4px";
    nameInput.style.boxSizing = "border-box";

    // Log Field
    const logLabel = form.createEl("label", { text: "Log/Notes:" });
    logLabel.style.display = "block";
    logLabel.style.marginBottom = "5px";
    logLabel.style.fontWeight = "bold";

    const logInput = form.createEl("textarea") as HTMLTextAreaElement;
    logInput.placeholder = "Add notes or log information about this counter";
    logInput.style.width = "100%";
    logInput.style.padding = "8px";
    logInput.style.marginBottom = "15px";
    logInput.style.border = "1px solid var(--divider-color)";
    logInput.style.borderRadius = "4px";
    logInput.style.boxSizing = "border-box";
    logInput.style.minHeight = "100px";
    logInput.style.fontFamily = "monospace";
    logInput.style.fontSize = "12px";

    // Variable Reference Display
    const varLabel = form.createEl("label", { text: "Variable Reference:" });
    varLabel.style.display = "block";
    varLabel.style.marginBottom = "5px";
    varLabel.style.fontWeight = "bold";
    varLabel.style.fontSize = "12px";

    const varDiv = form.createDiv();
    varDiv.style.padding = "8px";
    varDiv.style.backgroundColor = "var(--background-secondary)";
    varDiv.style.borderRadius = "4px";
    varDiv.style.marginBottom = "15px";
    varDiv.style.fontFamily = "monospace";
    varDiv.style.fontSize = "12px";
    varDiv.style.wordBreak = "break-all";
    varDiv.style.cursor = "pointer";
    varDiv.style.userSelect = "all";

    // Function to generate variable reference
    const generateVarRef = (name: string): string => {
      const varName = name.toLowerCase().replace(/\s+/g, "_");
      return `<<${varName}>>`;
    };

    const updateVarDisplay = () => {
      varDiv.textContent = generateVarRef(nameInput.value.trim() || "counter");
    };

    updateVarDisplay();
    nameInput.addEventListener("input", updateVarDisplay);

    varDiv.addEventListener("click", () => {
      const text = varDiv.textContent || "";
      navigator.clipboard.writeText(text).then(() => {
        const originalBg = varDiv.style.backgroundColor;
        varDiv.style.backgroundColor = "#28a745";
        varDiv.style.color = "white";
        setTimeout(() => {
          varDiv.style.backgroundColor = originalBg;
          varDiv.style.color = "";
        }, 200);
      });
    });

    const buttonContainer = form.createDiv();
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.justifyContent = "flex-end";

    const createBtn = buttonContainer.createEl("button", { text: "Create" });
    createBtn.style.padding = "8px 16px";
    createBtn.style.backgroundColor = "#28a745";
    createBtn.style.color = "white";
    createBtn.style.border = "none";
    createBtn.style.borderRadius = "4px";
    createBtn.style.cursor = "pointer";

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.style.padding = "8px 16px";
    cancelBtn.style.backgroundColor = "#6c757d";
    cancelBtn.style.color = "white";
    cancelBtn.style.border = "none";
    cancelBtn.style.borderRadius = "4px";
    cancelBtn.style.cursor = "pointer";

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "999";

    createBtn.addEventListener("click", async () => {
      const counterName = nameInput.value.trim();
      if (counterName) {
        const newCounter: PlayerCounter = {
          key: counterName.toLowerCase().replace(/\s+/g, "-"),
          type: "simple",
          value: 0,
          log: logInput.value.trim(),
          history: [{ timestamp: new Date().toISOString(), value: 0 }]
        };
        this.plugin.counters.push(newCounter);
        console.log("Counter created:", newCounter);
        await this.plugin.saveCounters();
        overlay.remove();
        modal.remove();
        this.renderCounters();
      }
    });

    cancelBtn.addEventListener("click", () => {
      overlay.remove();
      modal.remove();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        modal.remove();
      }
    });

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    nameInput.focus();
  }

  private showEditCounterDialog(counter: PlayerCounter) {
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.backgroundColor = "var(--background-primary)";
    modal.style.border = "1px solid var(--divider-color)";
    modal.style.borderRadius = "8px";
    modal.style.padding = "20px";
    modal.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    modal.style.zIndex = "1000";
    modal.style.minWidth = "300px";
    modal.style.maxHeight = "80vh";
    modal.style.overflowY = "auto";

    const title = modal.createEl("h3", { text: "Edit Counter" });
    title.style.marginTop = "0";

    const form = modal.createDiv("form");

    // Counter Name
    const nameLabel = form.createEl("label", { text: "Counter Name:" });
    nameLabel.style.display = "block";
    nameLabel.style.marginBottom = "5px";
    nameLabel.style.fontWeight = "bold";

    const nameInput = form.createEl("input", {
      type: "text",
      placeholder: "e.g., Health, Mana, Experience"
    }) as HTMLInputElement;
    nameInput.value = counter.key.charAt(0).toUpperCase() + counter.key.slice(1).replace(/-/g, " ");
    nameInput.style.width = "100%";
    nameInput.style.padding = "8px";
    nameInput.style.marginBottom = "15px";
    nameInput.style.border = "1px solid var(--divider-color)";
    nameInput.style.borderRadius = "4px";
    nameInput.style.boxSizing = "border-box";

    // Log Field
    const logLabel = form.createEl("label", { text: "Log/Notes:" });
    logLabel.style.display = "block";
    logLabel.style.marginBottom = "5px";
    logLabel.style.fontWeight = "bold";

    const logInput = form.createEl("textarea") as HTMLTextAreaElement;
    logInput.placeholder = "Add notes or log information about this counter";
    logInput.value = counter.log || "";
    logInput.style.width = "100%";
    logInput.style.padding = "8px";
    logInput.style.marginBottom = "15px";
    logInput.style.border = "1px solid var(--divider-color)";
    logInput.style.borderRadius = "4px";
    logInput.style.boxSizing = "border-box";
    logInput.style.minHeight = "100px";
    logInput.style.fontFamily = "monospace";
    logInput.style.fontSize = "12px";

    // Variable Reference Display
    const varLabel = form.createEl("label", { text: "Variable Reference:" });
    varLabel.style.display = "block";
    varLabel.style.marginBottom = "5px";
    varLabel.style.fontWeight = "bold";
    varLabel.style.fontSize = "12px";

    const varDiv = form.createDiv();
    varDiv.style.padding = "8px";
    varDiv.style.backgroundColor = "var(--background-secondary)";
    varDiv.style.borderRadius = "4px";
    varDiv.style.marginBottom = "15px";
    varDiv.style.fontFamily = "monospace";
    varDiv.style.fontSize = "12px";
    varDiv.style.wordBreak = "break-all";
    varDiv.style.cursor = "pointer";
    varDiv.style.userSelect = "all";

    // Function to generate variable reference
    const generateVarRef = (name: string): string => {
      const varName = name.toLowerCase().replace(/\s+/g, "_");
      return `<<${varName}>>`;
    };

    const updateVarDisplay = () => {
      varDiv.textContent = generateVarRef(nameInput.value.trim() || "counter");
    };

    updateVarDisplay();
    nameInput.addEventListener("input", updateVarDisplay);

    varDiv.addEventListener("click", () => {
      const text = varDiv.textContent || "";
      navigator.clipboard.writeText(text).then(() => {
        const originalBg = varDiv.style.backgroundColor;
        varDiv.style.backgroundColor = "#28a745";
        varDiv.style.color = "white";
        setTimeout(() => {
          varDiv.style.backgroundColor = originalBg;
          varDiv.style.color = "";
        }, 200);
      });
    });

    const buttonContainer = form.createDiv();
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.justifyContent = "flex-end";

    const saveBtn = buttonContainer.createEl("button", { text: "Save" });
    saveBtn.style.padding = "8px 16px";
    saveBtn.style.backgroundColor = "#007bff";
    saveBtn.style.color = "white";
    saveBtn.style.border = "none";
    saveBtn.style.borderRadius = "4px";
    saveBtn.style.cursor = "pointer";

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.style.padding = "8px 16px";
    cancelBtn.style.backgroundColor = "#6c757d";
    cancelBtn.style.color = "white";
    cancelBtn.style.border = "none";
    cancelBtn.style.borderRadius = "4px";
    cancelBtn.style.cursor = "pointer";

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "999";

    saveBtn.addEventListener("click", async () => {
      const newName = nameInput.value.trim();
      if (newName) {
        counter.key = newName.toLowerCase().replace(/\s+/g, "-");
        counter.log = logInput.value.trim();
        await this.plugin.saveCounters();
        overlay.remove();
        modal.remove();
        this.renderCounters();
      }
    });

    cancelBtn.addEventListener("click", () => {
      overlay.remove();
      modal.remove();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        modal.remove();
      }
    });

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    nameInput.focus();
  }

  private showManualEntryDialog(counter: PlayerCounter) {
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.backgroundColor = "var(--background-primary)";
    modal.style.border = "1px solid var(--divider-color)";
    modal.style.borderRadius = "8px";
    modal.style.padding = "20px";
    modal.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    modal.style.zIndex = "1000";
    modal.style.minWidth = "300px";

    const title = modal.createEl("h3", { text: `Adjust ${counter.key.charAt(0).toUpperCase() + counter.key.slice(1).replace(/-/g, " ")}` });
    title.style.marginTop = "0";

    const form = modal.createDiv("form");

    const label = form.createEl("label", { text: "Enter value to add or subtract:" });
    label.style.display = "block";
    label.style.marginBottom = "10px";
    label.style.fontWeight = "bold";

    const input = form.createEl("input", {
      type: "number",
      placeholder: "e.g., 5 or -3"
    }) as HTMLInputElement;
    input.style.width = "100%";
    input.style.padding = "10px";
    input.style.marginBottom = "15px";
    input.style.border = "1px solid var(--divider-color)";
    input.style.borderRadius = "4px";
    input.style.boxSizing = "border-box";
    input.style.fontSize = "16px";

    const currentValueDiv = form.createDiv();
    currentValueDiv.style.marginBottom = "15px";
    currentValueDiv.style.padding = "10px";
    currentValueDiv.style.backgroundColor = "var(--background-secondary)";
    currentValueDiv.style.borderRadius = "4px";
    currentValueDiv.textContent = `Current value: ${counter.value}`;

    const previewDiv = form.createDiv();
    previewDiv.style.marginBottom = "15px";
    previewDiv.style.padding = "10px";
    previewDiv.style.backgroundColor = "var(--background-secondary)";
    previewDiv.style.borderRadius = "4px";
    previewDiv.textContent = `New value will be: ${counter.value}`;

    input.addEventListener("input", () => {
      const num = parseInt(input.value) || 0;
      const newValue = counter.value + num;
      previewDiv.textContent = `New value will be: ${newValue}`;
    });

    const buttonContainer = form.createDiv();
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.justifyContent = "flex-end";

    const confirmBtn = buttonContainer.createEl("button", { text: "Apply" });
    confirmBtn.style.padding = "8px 16px";
    confirmBtn.style.backgroundColor = "#28a745";
    confirmBtn.style.color = "white";
    confirmBtn.style.border = "none";
    confirmBtn.style.borderRadius = "4px";
    confirmBtn.style.cursor = "pointer";

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.style.padding = "8px 16px";
    cancelBtn.style.backgroundColor = "#6c757d";
    cancelBtn.style.color = "white";
    cancelBtn.style.border = "none";
    cancelBtn.style.borderRadius = "4px";
    cancelBtn.style.cursor = "pointer";

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "999";

    confirmBtn.addEventListener("click", async () => {
      const num = parseInt(input.value) || 0;
      const maxVal = this.plugin.settings.maxValue || Infinity;
      const newValue = Math.min(maxVal, Math.max(this.plugin.settings.minValue, counter.value + num));
      counter.value = newValue;
      counter.history.push({
        timestamp: new Date().toISOString(),
        value: counter.value
      });
      await this.plugin.saveCounters();
      overlay.remove();
      modal.remove();
      this.renderCounters();
    });

    cancelBtn.addEventListener("click", () => {
      overlay.remove();
      modal.remove();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        modal.remove();
      }
    });

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    input.focus();
  }

  async onClose() {
    // Cleanup if needed
  }
}