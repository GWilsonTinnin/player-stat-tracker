import { ViewPlugin, ViewUpdate, EditorView, Decoration, DecorationSet, WidgetType, PluginValue } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type PlayerStatCounterPlugin from "./main";

/**
 * A CodeMirror 6 View Plugin that handles variable replacement in the editor viewport.
 * This is necessary for Obsidian's live preview (CodeMirror 6) to properly render
 * player stat variables without stripping numbers or text.
 */

class VariableWidget extends WidgetType {
  constructor(readonly value: string, readonly key: string, readonly plugin: PlayerStatCounterPlugin) {
    super();
  }

  eq(other: WidgetType) {
    return other instanceof VariableWidget && other.value === this.value && other.key === this.key;
  }

  toDOM() {
    const link = document.createElement("span");
    link.className = "player-stat-variable-link";
    link.setAttribute("data-counter-key", this.key);
    link.textContent = this.value;
    link.style.cursor = "pointer";
    link.style.color = "var(--text-accent)";
    link.style.textDecoration = "none";
    link.style.fontWeight = "600";
    
    // Add click handler to show counter details in sidebar
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Open the plugin's sidebar view to show counter details
      await (this.plugin as any).activateView();
    });
    
    // Add hover handler to show popup
    let hoverTimeout: number | null = null;
    let popup: HTMLElement | null = null;
    
    link.addEventListener("mouseenter", () => {
      hoverTimeout = window.setTimeout(() => {
        popup = (this.plugin as any).showCounterPopup(this.key, link);
      }, 300);
    });
    
    link.addEventListener("mouseleave", () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      if (popup) {
        popup.remove();
        popup = null;
      }
    });
    
    return link;
  }

  ignoreEvent() {
    return false;
  }
}

export class PlayerStatViewPlugin implements PluginValue {
  decorations: DecorationSet;

  constructor(readonly view: EditorView, readonly plugin: PlayerStatCounterPlugin) {
    this.decorations = this.buildDecorations();
  }

  update(update: ViewUpdate) {
    // Rebuild decorations when document changes, viewport changes, or if we need to update values
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations();
    }
  }

  private buildDecorations() {
    const builder = new RangeSetBuilder<Decoration>();
    const doc = this.view.state.doc;
    
    console.log("[PlayerStatCM6] Building decorations for viewport");

    // Scan through all lines in the document for variable patterns
    for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
      const line = doc.line(lineNum);
      const lineText = line.text;
      const variableMatches = lineText.matchAll(/\{\{([\w_]+)\}\}/g);

      for (const match of variableMatches) {
        const key = match[1];
        const counter = this.plugin.counters.find((c) => c.key === key);
        
        if (counter !== undefined) {
          const matchStart = line.from + match.index;
          const matchEnd = matchStart + match[0].length;
          
          console.log(`[PlayerStatCM6] Found variable {{${key}}} at ${matchStart}-${matchEnd}, value: ${counter.value}`);

          const deco = Decoration.replace({
            widget: new VariableWidget(String(counter.value), key, this.plugin),
            side: -1,
          });

          builder.add(matchStart, matchEnd, deco);
        }
      }
    }

    return builder.finish();
  }
}

export function createPlayerStatViewPlugin(plugin: PlayerStatCounterPlugin) {
  return ViewPlugin.fromClass(
    class extends PlayerStatViewPlugin {
      constructor(view: EditorView) {
        super(view, plugin);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}
