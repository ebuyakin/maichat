# MaiChat Tutorial System

This directory contains the source files and build system for the MaiChat tutorial page.

## 📁 Structure

```
src/tutorial/
├── README.md                  # This file
├── tutorial-content.md        # Tutorial content (Markdown) - EDIT THIS
├── tutorial-styles.css        # Tutorial styles
└── tutorial-generator.js      # Build script (Markdown → HTML)
```

## 🔄 Workflow

### 1. Edit Content

Edit the tutorial content in **`tutorial-content.md`**. This is a clean Markdown file with:
- Standard Markdown syntax
- Heading IDs for navigation (e.g., `{#overview}`)
- Keyboard shortcuts in backticks (auto-converted to `<kbd>` tags)
- Blockquotes for tips (auto-styled)

### 2. Build Static HTML

Run the build script to generate `/tutorial.html`:

```bash
# Single build
npm run tutorial:build

# Watch mode (auto-rebuild on changes) - requires nodemon
npm run tutorial:watch
```

### 3. Commit Changes

Commit both the source (`.md`) and generated (`.html`) files:

```bash
git add src/tutorial/tutorial-content.md tutorial.html
git commit -m "docs: update tutorial content"
```

## 🎨 Styling

All styles are in **`tutorial-styles.css`**. Changes to styles require rebuilding:

```bash
npm run tutorial:build
```

## 🏗️ How It Works

1. **`tutorial-generator.js`** reads `tutorial-content.md`
2. Converts Markdown to HTML using `marked` library
3. Auto-detects keyboard shortcuts (e.g., `Ctrl+K`) and converts to `<kbd>` tags
4. Generates navigation sidebar from heading structure
5. Inlines CSS from `tutorial-styles.css`
6. Outputs complete static `tutorial.html` in root

## 🎯 Navigation Structure

The navigation sidebar is auto-generated from the Markdown headings. The structure is defined in `tutorial-generator.js` and matches:

- **Getting Started**: Overview, Quickstart, Modes, Keyboard
- **Core Concepts**: Topics, Filtering (with sub-items), Context
- **Advanced**: Workflow, Settings, Models
- **Reference**: Troubleshooting, Tips

## ✨ Features

### Automatic Processing

- **Keyboard shortcuts**: Backticks around shortcuts like `Ctrl+K` → `<kbd>Ctrl+K</kbd>`
- **Code blocks**: Regular code → `<code>` tags
- **Blockquotes**: Markdown `>` → styled tip boxes
- **Section wrapping**: H2 headings create `<section>` containers
- **Collapsible nav**: Sections can be collapsed/expanded
- **Scroll spy**: Active section highlights in sidebar
- **Mobile responsive**: Hamburger menu on small screens

### Static Output Benefits

- ✅ Fast load time (no runtime JS needed for content)
- ✅ SEO-friendly (full HTML for crawlers)
- ✅ Offline-ready (self-contained file)
- ✅ Easy deployment (single HTML file)

## 📝 Content Guidelines

### Keyboard Shortcuts

Use backticks for keyboard shortcuts - they'll auto-convert:

```markdown
Press `Ctrl+K` to open API Keys.
Use `j`/`k` to navigate.
```

### Tips and Notes

Use blockquotes for tips:

```markdown
> **Tip:** Press `F1` anytime for help.
```

### Section IDs

Add IDs to headings for navigation:

```markdown
## What is MaiChat {#overview}
```

### Code vs Keyboard

- Keyboard: `Ctrl+K`, `Enter`, `j`/`k` → becomes `<kbd>`
- Code: `t'work'`, `r30 & s>=2` → stays as `<code>`

## 🔧 Maintenance

### Update Navigation

Edit the `navStructure` array in `tutorial-generator.js` if you add/remove major sections.

### Update Styles

Edit `tutorial-styles.css` and rebuild to apply changes.

### Add New Sections

1. Add content to `tutorial-content.md` with heading ID
2. Update `navStructure` in `tutorial-generator.js` if it's a major section
3. Run `npm run tutorial:build`

## 🐛 Troubleshooting

**Build fails:**
- Check Markdown syntax in `tutorial-content.md`
- Ensure `marked` is installed: `npm install`

**Styles not updating:**
- Remember to rebuild after CSS changes
- Clear browser cache if testing

**Navigation broken:**
- Check heading IDs match between `.md` and `navStructure`
- Rebuild to regenerate nav

## 📦 Dependencies

- `marked` - Markdown parser (already in package.json)
- Node.js - For running the build script
- `nodemon` - Optional, for watch mode

---

**Last updated:** October 2025
