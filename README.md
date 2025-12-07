# Player Stat Tracker

A powerful Obsidian plugin for tracking player statistics, counters, and game metrics in real-time. Perfect for D&D campaigns, RPGs, and any tabletop gaming session where you need to manage multiple counters with detailed logging.

## Features

✨ **Core Features**
- 📊 Create unlimited counters for any stat (Health, Mana, Experience, etc.)
- ➕➖ Increment and decrement counters with single clicks
- 🎨 Alternating colored rectangles for easy visual distinction
- 📝 Add and edit log/notes for each counter
- 🔄 Track full history of all counter changes with timestamps
- 💾 Automatic data persistence across sessions
- ⚙️ Comprehensive settings page in Community Plugins

**Counter Management**
- ✎ Edit counter name and notes anytime
- 🗑️ Delete counters with optional confirmation
- 📋 Export counter data as JSON for backup
- 🔄 Clear all counters (with confirmation)

**Settings & Customization**
- Display format options (compact/full)
- Configurable min/max counter values
- Delete confirmation toggle
- Counter history tracking
- Button style options
- Data export/import capabilities

## Installation

### From Obsidian Community Plugins
1. Open Obsidian Settings
2. Go to **Community Plugins** → **Browse**
3. Search for "Player Stat Tracker"
4. Click **Install**
5. Enable the plugin

### Manual Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/player-stat-tracker
   cd player-stat-tracker
   ```

2. Install dependencies:
   ```bash
   uv run npm install
   ```

3. Build the plugin:
   ```bash
   uv run npm run build
   ```

4. Copy to your vault:
   ```bash
   mkdir -p <vault>/.obsidian/plugins/player-stat-tracker
   cp main.js manifest.json package.json <vault>/.obsidian/plugins/player-stat-tracker/
   ```

5. Restart Obsidian and enable the plugin

## Usage

### Opening the Plugin
- Click the **dice icon** (🎲) in the left ribbon
- Or use the command palette: `Open Player Stat Counter`

### Creating a Counter
1. Click the **"+ Add Counter"** button
2. Enter the counter name (e.g., "Health", "Mana")
3. (Optional) Add notes in the Log/Notes field
4. Click **Create**

### Managing Counters
- **➕ Plus button**: Increase counter value
- **➖ Minus button**: Decrease counter value (won't go below minimum)
- **✎ Edit button**: Modify counter name and notes
- **✕ Delete button**: Remove the counter
- **± Manual button**: Enter a value to add or subtract from the counter

### Variable References
Each counter automatically generates a variable reference that can be used in your notes and documents.

**How to Use:**
1. When editing or creating a counter, you'll see a "Variable Reference" section
2. The reference format is `{{counter_name}}` where the counter name is converted to lowercase with underscores
3. Example: "My Health" → `{{my_health}}`
4. Click on the variable reference to copy it to your clipboard

**In Your Documents:**
Simply write `{{counter_name}}` anywhere in your document, and the current counter value will appear:

```markdown
## Character Sheet
Health: {{health}}
Mana: {{mana}}
Experience: {{experience}}
```

The values will display in **blue bold text** and update whenever the counter values change.

### Dataview Integration
The plugin supports Dataview queries to access counter data.

**Available Query:**
```dataview
table key, value, log, type from "PlayerStatCounter"
where value > 5
sort value desc
```

**Query Fields:**
- `key` - Counter identifier (e.g., "health")
- `value` - Current counter value
- `log` - Notes/log content
- `type` - Counter type ("simple" or "plot")
- `history` - Array of all changes with timestamps

### Settings
Access plugin settings via: **Settings** → **Community Plugins** → **Player Stat Tracker**

**Available Settings:**
| Setting | Description | Default |
|---------|-------------|---------|
| Counter display format | Choose between compact or full display | Full |
| Enable counter history | Track all changes with timestamps | On |
| Show delete confirmation | Ask before deleting counters | On |
| Minimum counter value | Lowest value a counter can reach | 0 |
| Maximum counter value | Highest value a counter can reach (0 = unlimited) | 0 |
| Button style | Choose button appearance | Default |

**Data Management:**
- **Export**: Download your counter data as JSON
- **Clear All**: Delete all counters permanently

## Development

### Prerequisites
- Node.js 18+
- npm or uv
- TypeScript

### Setup
```bash
# Clone the repository
git clone <repo-url>
cd player-stat-tracker

# Install dependencies
uv run npm install

# Or with npm directly
npm install
```

### Building
```bash
# Development build
uv run npm run dev

# Production build
uv run npm run build

# Build and install to vault
uv run npm run install-plugin
```

### Project Structure
```
player-stat-tracker/
├── main.ts              # Plugin entry point
├── view.ts              # Right panel UI and counter display
├── settings.ts          # Settings page implementation
├── counter.ts           # Counter interface definitions
├── storage.ts           # Data storage utilities (stub)
├── manifest.json        # Plugin metadata
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── esbuild.config.mjs   # Build configuration
└── main.js              # Compiled plugin (generated)
```

### Key Files

**main.ts** - Plugin bootstrap
- Loads/saves plugin data
- Registers views and commands
- Manages plugin lifecycle

**view.ts** - Main UI Component
- Renders counter rectangles
- Handles counter interactions
- Manages modals for add/edit

**settings.ts** - Settings Tab
- Plugin configuration UI
- Data export functionality
- Settings persistence

**counter.ts** - Type Definitions
```typescript
interface PlayerCounter {
  key: string;                    // Unique counter identifier
  type: "plot" | "simple";       // Counter type
  value: number;                 // Current value
  comment?: string;              // Legacy comment field
  log?: string;                  // Notes/log for the counter
  history: Array<{
    timestamp: string;           // ISO timestamp
    value: number;               // Value at this point
    comment?: string;            // Optional change note
  }>;
}
```

## Architecture

### Data Flow
```
User Action
    ↓
View Component (view.ts)
    ↓
Update Counter State
    ↓
Call plugin.saveCounters()
    ↓
Obsidian saveData()
    ↓
Render Updated UI
```

### Plugin Lifecycle
1. **onload()** - Initialize plugin
   - Load saved data from Obsidian storage
   - Register view type
   - Add ribbon icon and commands
   - Initialize settings tab

2. **View Rendering** - Display counters
   - Render each counter as colored rectangle
   - Show name and current value
   - Display control buttons

3. **User Interaction** - Handle changes
   - Increment/decrement counters
   - Edit counter properties
   - Delete counters
   - Save to storage

## Building from Source

### Using uv (Recommended)
```bash
# Install dependencies
uv run npm install

# Build production version
uv run npm run build

# Build and copy to vault
uv run npm run install-plugin
```

### Using npm directly
```bash
npm install
npm run build
```

## Storage Format

Counter data is stored in Obsidian's plugin data directory as JSON:

```json
{
  "counters": [
    {
      "key": "health",
      "type": "simple",
      "value": 45,
      "log": "Started at 50, took 5 damage from goblin",
      "history": [
        {
          "timestamp": "2025-12-06T18:00:00.000Z",
          "value": 50
        },
        {
          "timestamp": "2025-12-06T18:05:00.000Z",
          "value": 45
        }
      ]
    }
  ],
  "settings": {
    "displayFormat": "full",
    "trackHistory": true,
    "showDeleteConfirm": true,
    "minValue": 0,
    "maxValue": 0,
    "buttonStyle": "default"
  }
}
```

## Troubleshooting

### Plugin not showing up
- **Solution**: Restart Obsidian completely
- **Reason**: Obsidian caches plugins on startup

### Changes not saved
- **Solution**: Ensure plugin is enabled in Community Plugins settings
- **Reason**: Plugin must be active to save data

### Edit button/Log field not visible
- **Solution**: Rebuild and reinstall the plugin
- **Reason**: Cached plugin files may be outdated

### Data lost after update
- **Solution**: Export your data before updating
- **Steps**: Settings → Player Stat Tracker → Export

## Keyboard Shortcuts

Currently, the plugin uses mouse/touch interaction. Keyboard shortcuts can be added via the command palette.

## API Reference

### Plugin Class Methods

```typescript
// Save counter data
await plugin.saveCounters(): Promise<void>

// Save settings
await plugin.saveSettings(): Promise<void>

// Activate the view
await plugin.activateView(): Promise<void>
```

### Counter Methods

```typescript
// Add to counter
counter.value++;

// Subtract from counter
counter.value = Math.max(plugin.settings.minValue, counter.value - 1);

// Add history entry
counter.history.push({
  timestamp: new Date().toISOString(),
  value: counter.value,
  comment: "Optional note"
});
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Test all new features in Obsidian
- Update README if adding new features
- Keep code modular and documented

## Known Limitations

- Maximum value constraint currently doesn't prevent manual overflow
- Keyboard shortcuts not yet implemented
- Counter history cannot be manually edited
- No built-in undo/redo system

## Roadmap

- [ ] Keyboard shortcuts for common actions
- [ ] Import from JSON file
- [ ] Counter templates
- [ ] Conditional counter actions
- [ ] Counter persistence in frontmatter
- [ ] Export to CSV
- [ ] Mobile app support
- [ ] Counter widgets for different themes

## License

MIT License - See LICENSE file for details

## Support

For issues, feature requests, or questions:
1. Check existing GitHub issues
2. Create a new issue with:
   - Clear description
   - Steps to reproduce (if bug)
   - Obsidian version
   - Plugin version

## Credits

Built with:
- [Obsidian API](https://docs.obsidian.md/)
- [TypeScript](https://www.typescriptlang.org/)
- [esbuild](https://esbuild.github.io/)

## Changelog

### v1.0.0 (2025-12-06)
- Initial release
- Core counter functionality
- Settings page
- Data persistence
- Edit functionality with log notes
- History tracking

---

**Made with ❤️ for tabletop gamers and Obsidian enthusiasts**

## File Structure

```
player_stat_tracker/
  main.ts         # Plugin entry point
  view.ts         # Sidebar panel UI
  counter.ts      # Counter model/types
  storage.ts      # Persistence and logging
  dataview.md     # Dataview query example
  README.md       # This documentation
```

## Development

- Written in TypeScript for Obsidian’s plugin API.
- Extend or customize counter types and logging as needed.

## License

MIT