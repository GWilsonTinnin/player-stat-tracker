# Troubleshooting: Variable Styling Not Showing

## Quick Checklist

1. **Reload the Plugin**
   - Open Obsidian Settings → Community Plugins
   - Toggle "Player Stat Tracker" OFF then ON
   - Or press `Ctrl/Cmd + R` to reload Obsidian

2. **Verify Plugin Files Are Updated**
   - Check that `main.js` in your vault matches the repo
   - File location: `.obsidian/plugins/player_stat_tracker/main.js`

3. **Check Variable Syntax**
   - Use `{{variable_name}}` format (double curly braces)
   - Counter keys are lowercase with underscores
   - Example: `{{health}}`, `{{banana_count}}`, `{{dean_follower}}`

## Debugging Steps

### Step 1: Open Developer Console
1. In Obsidian, press `Ctrl/Cmd + Shift + I` (or `Cmd + Option + I` on Mac)
2. Go to the Console tab
3. Look for `[PlayerStat]` messages

### Step 2: Check if Variables Are Being Detected
In the console, you should see messages like:
```
[PlayerStat] POST-PROCESSOR CALLED
[PlayerStat] Replacing {{health}} with 11
```

If you don't see these messages, the markdown post-processor isn't running.

### Step 3: Use Debug Commands
1. Open Command Palette (`Ctrl/Cmd + P`)
2. Search for and run these commands:
   - **Debug: Check Variable Links in DOM** - Shows if variable links exist
   - **Debug: Inspect DOM for variables** - Shows raw HTML
   - **Force Replace All Variables Now** - Manually trigger replacement

### Step 4: Inspect the Rendered HTML
1. In Developer Console, go to Elements tab
2. Find your variable in the HTML
3. Check if it has the class `player-stat-variable`
4. Verify the computed styles

Expected HTML:
```html
<a class="player-stat-variable external-link" 
   data-counter-key="health" 
   href="obsidian://player-stat/health"
   style="color: var(--external-link-color, #705dcf); font-weight: 600; border-bottom: 1px solid currentColor;">
  11
</a>
```

### Step 5: Check CSS Variables
In the Console, run:
```javascript
getComputedStyle(document.body).getPropertyValue('--external-link-color')
```

This should return a color value (e.g., `#705dcf` or `rgb(112, 93, 207)`).

## Common Issues

### Issue 1: Variables Show as Plain Text
**Symptoms:** You see `{{health}}` instead of the number
**Cause:** Plugin not processing the markdown
**Fix:** 
- Reload the plugin
- Try switching between Reading and Editing view
- Run "Force Replace All Variables Now" command

### Issue 2: Numbers Show But No Styling
**Symptoms:** Numbers appear but are black, not purple/bold/underlined
**Cause:** CSS not loading or being overridden
**Fix:**
- Check Developer Console for CSS errors
- Verify the `<style>` tag with id `player-stat-tracker-styles` exists in `<head>`
- Check if another theme/snippet is overriding the styles

### Issue 3: Styling Works in One View But Not Another
**Symptoms:** Works in Reading view but not Edit/Live Preview
**Cause:** Different CSS selectors needed
**Fix:** The plugin already has selectors for all views, but you may need to reload

## Manual CSS Check

1. Open Developer Console
2. Run this in the Console:
```javascript
const style = document.getElementById('player-stat-tracker-styles');
if (style) {
  console.log('✓ CSS found');
  console.log('Rules:', style.sheet.cssRules.length);
} else {
  console.log('✗ CSS NOT found');
}
```

If CSS is not found, the plugin didn't inject styles properly. Reload the plugin.

## Force Reinstall

If nothing works:
1. Close Obsidian
2. Delete `.obsidian/plugins/player_stat_tracker` folder
3. Copy files from repo:
   ```bash
   cd /Users/gary/Documents/repos/obsidian_plugins/player_stat_tracker
   npm run build
   cp main.js manifest.json package.json /Users/gary/Documents/obsidian/Testing_Vault/Testing-Vault/.obsidian/plugins/player_stat_tracker/
   ```
4. Reopen Obsidian
5. Enable the plugin

## Check if It's Actually Working

Create a new note with this content:
```markdown
# Test
Health: {{health}}
Mana: {{mana}}
```

Then:
1. Open the note in Reading View
2. Right-click on where the number should appear
3. Select "Inspect Element"
4. Look at the HTML structure

## Expected Behavior

When working correctly:
- ✓ Variables replaced with numbers
- ✓ Numbers are purple/violet color
- ✓ Numbers are bold (font-weight: 600)
- ✓ Numbers have underline (border-bottom)
- ✓ Hovering makes opacity 0.7 and thicker underline
- ✓ Clicking opens the Player Stat Counter panel

## Still Not Working?

Run this diagnostic in the Developer Console:
```javascript
// Check if plugin is loaded
console.log('Plugin loaded:', app.plugins.plugins['player-stat-tracker']);

// Check counters
const plugin = app.plugins.plugins['player-stat-tracker'];
console.log('Counters:', plugin?.counters);

// Check for variable links
const links = document.querySelectorAll('.player-stat-variable');
console.log('Variable links found:', links.length);
links.forEach((link, i) => {
  console.log(`Link ${i}:`, {
    key: link.getAttribute('data-counter-key'),
    text: link.textContent,
    color: getComputedStyle(link).color,
    fontWeight: getComputedStyle(link).fontWeight,
    borderBottom: getComputedStyle(link).borderBottom
  });
});
```

This will give you detailed information about what's happening.
