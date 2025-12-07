#!/bin/bash

# Copy built plugin files to the vault's plugins directory
VAULT_PATH="../Testing-Vault/.obsidian/plugins/player_stat_tracker"
BUILD_FILES=("manifest.json" "main.js" "package.json")

echo "Copying plugin files to vault..."

# Create plugins directory if it doesn't exist
mkdir -p "$VAULT_PATH"

# Copy files
for file in "${BUILD_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$VAULT_PATH/"
        echo "  ✓ Copied $file"
    else
        echo "  ✗ Warning: $file not found"
    fi
done

echo "Done! Plugin installed to: $VAULT_PATH"
