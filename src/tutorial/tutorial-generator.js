#!/usr/bin/env node

/**
 * MaiChat Tutorial Generator
 * 
 * Builds a static HTML tutorial page from Markdown content.
 * 
 * Usage: node src/tutorial/tutorial-generator.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const rootDir = path.join(__dirname, '../..');
const contentPath = path.join(__dirname, 'tutorial-content.md');
const stylesPath = path.join(__dirname, 'tutorial-styles.css');
const outputPath = path.join(rootDir, 'tutorial.html');

// Helper to generate ID from title - replicates marked's default slugger
function generateId(title) {
  return title.toLowerCase()
    .trim()
    .replace(/<[!/a-z].*?>/ig, '') // remove html tags
    .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,.\/:;<=>?@\[\]^`{|}~']/g, '') // remove punctuation
    .replace(/\s/g, '-'); // replace spaces with hyphens
}

// Scope CSS to prevent contamination of other pages
function scopeCSS(css) {
  const scope = 'html[data-page="tutorial"]';
  const lines = css.split('\n');
  const output = [];
  
  let inMediaQuery = false;
  let mediaQueryDepth = 0;
  let braceDepth = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Track brace depth
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    braceDepth += openBraces - closeBraces;
    
    // Handle media queries
    if (trimmed.startsWith('@media')) {
      inMediaQuery = true;
      mediaQueryDepth = braceDepth;
      output.push(line);
      continue;
    }
    
    // Exit media query when we close its braces
    if (inMediaQuery && braceDepth < mediaQueryDepth) {
      inMediaQuery = false;
      mediaQueryDepth = 0;
    }
    
    // Handle comments
    if (trimmed.startsWith('/*') || trimmed.startsWith('//') || trimmed === '' || trimmed.endsWith('*/')) {
      output.push(line);
      continue;
    }
    
    // Handle closing braces
    if (trimmed === '}' || trimmed.startsWith('}')) {
      output.push(line);
      continue;
    }
    
    // Scope selectors (lines that end with { or contain {)
    if (line.includes('{') && !trimmed.startsWith('@') && !inMediaQuery) {
      const parts = line.split('{');
      const selector = parts[0].trim();
      const rest = parts.slice(1).join('{');
      
      // Don't double-scope
      if (selector.includes(scope)) {
        output.push(line);
        continue;
      }
      
      // Special handling for :root
      if (selector === ':root') {
        const indent = line.match(/^\s*/)[0];
        output.push(`${indent}${scope} {${rest}`);
        continue;
      }
      
      // Scope all other selectors
      const indent = line.match(/^\s*/)[0];
      output.push(`${indent}${scope} ${selector} {${rest}`);
      continue;
    }
    
    // Property lines and everything else
    output.push(line);
  }
  
  return output.join('\n');
}

// Parse markdown structure to extract headers
function parseMarkdownStructure(markdownContent) {
  const lines = markdownContent.split('\n');
  const structure = [];
  let currentH2 = null;
  let currentH3 = null;
  
  lines.forEach(line => {
    // Match ## Header {#id} or ## Header
    const h2Match = line.match(/^## (.+?)(?:\s*\{#([a-z0-9-]+)\})?$/);
    if (h2Match) {
      currentH2 = {
        level: 2,
        title: h2Match[1].trim(),
        id: h2Match[2] || generateId(h2Match[1]),
        children: []
      };
      structure.push(currentH2);
      currentH3 = null;
      return;
    }
    
    // Match ### Header {#id} or ### Header
    const h3Match = line.match(/^### (.+?)(?:\s*\{#([a-z0-9-]+)\})?$/);
    if (h3Match && currentH2) {
      currentH3 = {
        level: 3,
        title: h3Match[1].trim(),
        id: h3Match[2] || generateId(h3Match[1]),
        children: []
      };
      currentH2.children.push(currentH3);
      return;
    }
    
    // Match #### Header {#id} or #### Header
    const h4Match = line.match(/^#### (.+?)(?:\s*\{#([a-z0-9-]+)\})?$/);
    if (h4Match && currentH3) {
      currentH3.children.push({
        level: 4,
        title: h4Match[1].trim(),
        id: h4Match[2] || generateId(h4Match[1]),
        children: [] // H4 can't have children in nav
      });
      return;
    }
    
    // H5+ headers are ignored in navigation (only in content)
  });
  
  return structure;
}

// Configure marked with extensions
const renderer = {
  heading(token) {
    const text = token.text;
    const level = token.depth;
    
    // Extract ID from text like "What is MaiChat {#overview}"
    const idMatch = text.match(/^(.+?)\s*\{#([a-z0-9-]+)\}\s*$/i);
    
    if (idMatch) {
      const cleanText = idMatch[1].trim();
      const id = idMatch[2];
      return `<h${level} id="${id}">${cleanText}</h${level}>\n`;
    }
    
    // Default behavior - use our generateId function for consistency
    const id = generateId(text);
    return `<h${level} id="${id}">${text}</h${level}>\n`;
  },
  
  codespan(token) {
    const text = token.text;
    
    // Check if it looks like a keyboard shortcut
    const kbdPattern = /^(Ctrl|Shift|Alt|Esc|Enter|Space|Tab|F\d+)(\+[\w.]+)*$|^[a-z]$|^[0-9]$/i;
    const hasPlus = text.includes('+');
    const hasModifier = /Ctrl|Shift|Alt/.test(text);
    
    if (kbdPattern.test(text) || (hasPlus && hasModifier)) {
      return `<kbd>${text}</kbd>`;
    }
    
    return `<code>${text}</code>`;
  }
};

marked.use({ renderer });

// Generate navigation HTML from structure
function generateNav(structure) {
  let html = '<ul class="sidebar-nav">\n';
  
  // Add "Top" link first (hardcoded, doesn't correspond to content)
  html += '  <li class="nav-item nav-top">\n';
  html += '    <a href="#top">↑ Top</a>\n';
  html += '  </li>\n';
  
  structure.forEach(item => {
    const hasChildren = item.children && item.children.length > 0;
    const itemClass = hasChildren ? 'nav-item has-children collapsed' : 'nav-item';
    
    html += `  <li class="${itemClass}">\n`;
    
    if (hasChildren) {
      html += '    <div class="nav-item-header">\n';
      html += '      <span class="nav-item-toggle">›</span>\n';
      html += `      <a href="#${item.id}">${item.title}</a>\n`;
      html += '    </div>\n';
      html += '    <ul class="nav-sub-items">\n';
      
      // Generate h3 children
      item.children.forEach(child => {
        const hasGrandchildren = child.children && child.children.length > 0;
        const childClass = hasGrandchildren ? 'nav-item has-children collapsed' : 'nav-item';
        
        html += `      <li class="${childClass}">\n`;
        
        if (hasGrandchildren) {
          html += '        <div class="nav-item-header">\n';
          html += '          <span class="nav-item-toggle">›</span>\n';
          html += `          <a href="#${child.id}">${child.title}</a>\n`;
          html += '        </div>\n';
          html += '        <ul class="nav-sub-items">\n';
          
          // Generate h4 children
          child.children.forEach(grandchild => {
            html += `          <li class="nav-item"><a href="#${grandchild.id}">${grandchild.title}</a></li>\n`;
          });
          
          html += '        </ul>\n';
          html += '      </li>\n';
        } else {
          html += `        <a href="#${child.id}">${child.title}</a>\n`;
          html += '      </li>\n';
        }
      });
      
      html += '    </ul>\n';
      html += '  </li>\n';
    } else {
      html += `    <a href="#${item.id}">${item.title}</a>\n`;
      html += '  </li>\n';
    }
  });
  
  html += '</ul>';
  return html;
}

// Generate the full HTML page
function generateHTML(content, styles, nav) {
  return `<!DOCTYPE html>
<html lang="en" data-page="tutorial">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MaiChat Tutorial - Getting Started Guide</title>
  <meta name="description" content="Learn to use MaiChat: a keyboard-first interface for ChatGPT, Claude, and Gemini with topic organization and powerful filtering." />
  <link rel="icon" type="image/x-icon" href="/maichat-logo.ico" />
  <style>
${styles}
  </style>
</head>
<body>
  <button class="mobile-menu-btn">
    <span>☰</span> Menu
  </button>
  
  <!-- Sidebar Navigation -->
  <nav class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-title">MaiChat Tutorial</div>
      <div class="sidebar-subtitle">Table of Contents</div>
    </div>
    
${nav}
  </nav>
  
  <!-- Main Content -->
  <div class="main-content">
    <main class="container" id="top">
      <header>
        <a href="index.html" class="back-link">← Back to Home</a>
        <h1>MaiChat Tutorial</h1>
        <p class="subtitle">Master MaiChat: keyboard-first interface for ChatGPT, Claude, and Gemini</p>
      </header>

${content}

      <div class="footer">
        <p><a href="index.html">← Home</a> | <a href="https://github.com/ebuyakin/maichat">GitHub</a></p>
        <p class="small">MaiChat Tutorial • Last updated ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      </div>

    </main>
  </div>

  <script>
    // Sidebar navigation and scroll spy
    document.addEventListener('DOMContentLoaded', () => {
      const sections = document.querySelectorAll('h2[id], h3[id], h4[id]');
      const navLinks = document.querySelectorAll('.nav-item a');
      
      // Collapsible nav items with children
      const toggles = document.querySelectorAll('.nav-item-toggle');
      toggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Get the parent nav-item-header first, then its parent nav-item
          // This ensures we only toggle the item that owns this toggle
          const header = toggle.parentElement;
          const navItem = header.parentElement;
          
          // Only toggle if this is actually a nav-item with children
          if (navItem && navItem.classList.contains('nav-item') && navItem.classList.contains('has-children')) {
            navItem.classList.toggle('collapsed');
            
            // Save state to localStorage
            const link = navItem.querySelector(':scope > .nav-item-header > a');
            if (link) {
              const id = link.getAttribute('href').substring(1);
              const isCollapsed = navItem.classList.contains('collapsed');
              localStorage.setItem(\`nav-collapsed-\${id}\`, isCollapsed);
            }
          }
        });
      });
      
      // Restore collapsed state from localStorage
      document.querySelectorAll('.nav-item.has-children').forEach(navItem => {
        const link = navItem.querySelector('a');
        if (link) {
          const id = link.getAttribute('href').substring(1);
          const savedState = localStorage.getItem(\`nav-collapsed-\${id}\`);
          if (savedState === 'true') {
            navItem.classList.add('collapsed');
          }
        }
      });
      
      // Improved scroll spy - find the closest visible header
      let activeId = null;
      
      const updateActiveNav = () => {
        const scrollPos = window.scrollY + 150; // Offset for fixed header
        let currentId = null;
        let closestTop = -1;
        
        // Find the header closest to (but above) scroll position
        sections.forEach(section => {
          const top = section.offsetTop;
          if (top <= scrollPos && top > closestTop) {
            currentId = section.getAttribute('id');
            closestTop = top;
          }
        });
        
        // Only update if changed
        if (currentId && currentId !== activeId) {
          activeId = currentId;
          
          // Clear all active states first
          navLinks.forEach(link => link.classList.remove('active'));
          
          // Find the link for the current section
          const activeLink = Array.from(navLinks).find(
            link => link.getAttribute('href') === \`#\${currentId}\`
          );
          
          if (activeLink) {
            // Check if the active link is inside .nav-sub-items of a collapsed parent
            // (Links in .nav-item-header are always visible, even if that item is collapsed)
            const subItemsList = activeLink.closest('.nav-sub-items');
            
            if (subItemsList) {
              // This link is a sub-item (h3/h4) - check if its parent section is collapsed
              const collapsedParent = subItemsList.closest('.nav-item.has-children.collapsed');
              
              if (collapsedParent) {
                // Link is hidden inside collapsed sub-items - find the nearest visible parent link
                let parentNavItem = collapsedParent;
                let parentLink = null;
                
                // Walk up the tree to find the first visible parent nav item
                while (parentNavItem) {
                  if (parentNavItem.classList.contains('nav-item') && 
                      parentNavItem.classList.contains('has-children')) {
                    parentLink = parentNavItem.querySelector(':scope > .nav-item-header > a');
                    if (parentLink) {
                      // Check if this parent's link is also hidden in collapsed sub-items
                      const parentSubItems = parentLink.closest('.nav-sub-items');
                      if (parentSubItems) {
                        const parentCollapsed = parentSubItems.closest('.nav-item.has-children.collapsed');
                        if (!parentCollapsed) {
                          // Found a visible parent - highlight it
                          parentLink.classList.add('active');
                          break;
                        }
                      } else {
                        // Parent link is in a header (always visible) - highlight it
                        parentLink.classList.add('active');
                        break;
                      }
                    }
                  }
                  // Move up to the next parent
                  parentNavItem = parentNavItem.parentElement?.closest('.nav-item.has-children');
                }
              } else {
                // Sub-item link is visible (parent is expanded) - highlight it normally
                activeLink.classList.add('active');
              }
            } else {
              // Link is in a header (h2 level) - always visible, highlight it normally
              activeLink.classList.add('active');
            }
          }
        }
      };
      
      // Update on scroll
      window.addEventListener('scroll', updateActiveNav);
      // Update on load
      updateActiveNav();
      
      // Auto-expand when clicking nav links
      navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          // Don't prevent default - we want the anchor scroll behavior
          
          // Expand all parent collapsed items for this link
          let parentItem = link.closest('.nav-item.has-children.collapsed');
          while (parentItem) {
            parentItem.classList.remove('collapsed');
            
            // Update localStorage to reflect the expansion
            const parentLink = parentItem.querySelector(':scope > .nav-item-header > a');
            if (parentLink) {
              const id = parentLink.getAttribute('href').substring(1);
              localStorage.setItem(\`nav-collapsed-\${id}\`, false);
            }
            
            // Move up to the next collapsed parent
            parentItem = parentItem.parentElement.closest('.nav-item.has-children.collapsed');
          }
        });
      });
      
      // Mobile menu toggle
      const menuBtn = document.querySelector('.mobile-menu-btn');
      const sidebar = document.querySelector('.sidebar');
      
      if (menuBtn) {
        menuBtn.addEventListener('click', () => {
          sidebar.classList.toggle('open');
        });
        
        // Close sidebar when clicking a link on mobile
        navLinks.forEach(link => {
          link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
              sidebar.classList.remove('open');
            }
          });
        });
      }
    });
  </script>
</body>
</html>
`;
}

// Process markdown to add section wrappers
function processMarkdown(html) {
  // Split by h2 headings to create sections
  const parts = html.split(/(<h2 id="[^"]+">)/);
  
  if (parts.length === 1) {
    // No h2 headings found, wrap everything in one section
    return `      <section id="overview">\n${indentContent(parts[0])}\n      </section>`;
  }
  
  let result = '';
  let currentSection = '';
  let sectionId = '';
  let isFirstSection = true;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Check if this is an h2 heading
    const h2Match = part.match(/<h2 id="([^"]+)">/);
    
    if (h2Match) {
      // Close previous section if we have content and it's not the first
      if (!isFirstSection && currentSection.trim()) {
        result += `      <section id="${sectionId}">\n${indentContent(currentSection)}\n      </section>\n\n`;
      }
      
      // Start new section
      sectionId = h2Match[1];
      currentSection = part;
      isFirstSection = false;
    } else if (!isFirstSection) {
      // Only accumulate content after we've seen the first h2
      currentSection += part;
    }
    // Skip content before the first h2
  }
  
  // Close final section
  if (currentSection.trim() && sectionId) {
    result += `      <section id="${sectionId}">\n${indentContent(currentSection)}\n      </section>`;
  }
  
  return result;
}

// Helper to indent content
function indentContent(html) {
  return html.split('\n')
    .map(line => line.trim() ? '        ' + line : '')
    .join('\n')
    .trim();
}

// Main build function
async function build() {
  try {
    console.log('📖 Building MaiChat Tutorial...\n');
    
    // Read source files
    console.log('Reading source files...');
    const markdownContent = fs.readFileSync(contentPath, 'utf8');
    const rawStyles = fs.readFileSync(stylesPath, 'utf8');
    
    // Scope CSS to prevent contamination
    console.log('Scoping CSS...');
    const styles = scopeCSS(rawStyles);
    
    // Parse markdown structure for navigation
    console.log('Parsing markdown structure...');
    const navStructure = parseMarkdownStructure(markdownContent);
    
    // Convert Markdown to HTML
    console.log('Converting Markdown to HTML...');
    let htmlContent = marked.parse(markdownContent);
    
    // Process HTML structure
    console.log('Processing HTML structure...');
    htmlContent = processMarkdown(htmlContent);
    
    // Generate navigation
    console.log('Generating navigation...');
    const nav = generateNav(navStructure);
    
    // Generate full HTML
    console.log('Generating full HTML page...');
    const fullHTML = generateHTML(htmlContent, styles, nav);
    
    // Write output
    console.log('Writing output file...');
    fs.writeFileSync(outputPath, fullHTML, 'utf8');
    
    console.log('\n✅ Tutorial built successfully!');
    console.log(`📄 Output: ${outputPath}`);
    console.log(`📦 Size: ${(fullHTML.length / 1024).toFixed(1)} KB\n`);
    
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run build
build();

export { build };
