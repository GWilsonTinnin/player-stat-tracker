# Contributing to Player Stat Tracker

Thank you for your interest in contributing to Player Stat Tracker! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a new branch for your feature/fix
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## Development Setup

```bash
git clone https://github.com/YOUR_USERNAME/player-stat-tracker.git
cd player-stat-tracker
uv run npm install
uv run npm run build
```

## Commit Guidelines

- Use clear, descriptive commit messages
- Reference issues when applicable (e.g., "Fix #123")
- Follow conventional commits when possible (feat:, fix:, docs:, etc.)

## Pull Request Process

1. Update the README.md with any new features or changes
2. Test the plugin thoroughly in Obsidian
3. Ensure all code follows the existing style
4. Provide a clear description of the changes
5. Link any related issues

## Code Style

- Follow TypeScript best practices
- Use meaningful variable names
- Add comments for complex logic
- Format code with consistent indentation (2 spaces)

## Testing

Before submitting:
1. Rebuild the plugin: `uv run npm run build`
2. Test in Obsidian with sample data
3. Test edge cases (empty data, max values, etc.)
4. Verify settings persist across restarts

## Reporting Bugs

Include:
- Clear description of the issue
- Steps to reproduce
- Obsidian version
- Plugin version
- Expected vs actual behavior
- Screenshots if applicable

## Feature Requests

Describe:
- The feature and its use case
- Why it would be valuable
- How it might be implemented
- Any potential drawbacks

## Questions?

Feel free to open an issue with your question. We're happy to help!

---

Thank you for contributing! 🎲
