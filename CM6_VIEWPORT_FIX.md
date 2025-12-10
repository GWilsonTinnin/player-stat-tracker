# Player Stat Tracker - CodeMirror 6 Viewport Integration Fix

## Problem
Numbers and text were being stripped from player stat variables in Obsidian's live preview mode because the plugin was only using a markdown post-processor. CodeMirror 6 (used in Obsidian's live preview) requires special handling via View Plugins to properly integrate with the viewport system.

## Solution
Implemented a **CodeMirror 6 View Plugin** that properly handles variable replacement using the viewport decoration system.

## Changes Made

### 1. New File: `cm6-plugin.ts`
Created a new CodeMirror 6 view plugin that:
- Extends `ViewPlugin` and implements `PluginValue`
- Uses `Decoration.replace()` with custom `WidgetType` to replace variables
- Scans the document viewport for `{{variable}}` patterns
- Creates styled anchor elements that preserve all text (no stripping)
- Updates decorations when the document or viewport changes
- Properly handles variable value updates

**Key Components:**
- `VariableWidget`: Custom widget that renders the counter value as a styled link
- `PlayerStatViewPlugin`: Main view plugin class that manages decorations
- `createPlayerStatViewPlugin()`: Factory function for plugin registration

### 2. Updated: `main.ts`

#### Import Addition
```typescript
import { createPlayerStatViewPlugin } from "./cm6-plugin";
```

#### Plugin Registration (in `onload()`)
```typescript
// Register CodeMirror 6 View Plugin for live preview (viewport) rendering
console.log("[PlayerStat] Registering CodeMirror 6 View Plugin...");
this.registerEditorExtension([createPlayerStatViewPlugin(this)]);
```

#### New Method: `notifyEditorsToUpdate()`
```typescript
private notifyEditorsToUpdate() {
  // Trigger an update to all editor views to re-render decorations
  const leaves = this.app.workspace.getLeavesOfType("markdown");
  leaves.forEach((leaf) => {
    const view = leaf.view;
    if (view && (view as any).editor) {
      const editor = (view as any).editor;
      const editorView = editor.cm;
      if (editorView) {
        editorView.dispatch({});
      }
    }
  });
}
```

#### Enhanced: `updateAllVariables()`
Now calls `notifyEditorsToUpdate()` to trigger viewport re-renders when counter values change.

## How It Works

1. **Registration**: The CM6 View Plugin is registered with Obsidian during plugin load
2. **Viewport Scanning**: When the editor viewport renders or changes, the plugin scans for `{{variableName}}` patterns
3. **Decoration Replacement**: Each variable is replaced with a `WidgetType` decoration that renders as a styled link
4. **Value Preservation**: The widget's `toDOM()` method creates a proper DOM element with:
   - All text content preserved (no stripping)
   - Proper CSS classes for styling
   - Data attributes for tracking counter keys
   - Click handlers for interactivity

5. **Update Triggering**: When counters change, `notifyEditorsToUpdate()` forces the viewport to re-render

## Benefits

✅ **No More Stripped Numbers**: Uses proper CodeMirror 6 decorations instead of DOM manipulation
✅ **Viewport Integration**: Respects Obsidian's viewport system for performance
✅ **Live Updates**: Counters update in real-time as values change
✅ **Both Modes**: Works in both reading mode (post-processor) and live preview (CM6)
✅ **Styled Links**: Variables appear as clickable, styled links
✅ **Backward Compatible**: Keeps the existing markdown post-processor for reading mode

## CSS Styling

The existing `.player-stat-variable-link` CSS class provides styling:
```css
.player-stat-variable-link {
  color: var(--text-accent);
  text-decoration: underline;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0 2px;
  border-radius: 2px;
}
```

## Testing

The plugin is now built and ready to test. Variables should:
1. Render without text stripping in live preview
2. Update values when counters are modified
3. Appear as styled, clickable links in both reading and live preview modes
4. Respond to hover states with the theme's accent colors
