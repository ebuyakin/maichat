# Tutorial Updates for v1.1

## 1. What is MaiChat
**MODIFY:** Update provider list to include xAI/Grok (4 providers, not 3)

## 2. Quickstart (5 minutes)

### 2.1 Step 1: Set up your API key
**MODIFY:** Add xAI to provider list and link

### 2.2 Step 2: Choose a model
**MODIFY:** Add xAI models (Grok Beta, grok-vision-beta) to available models list

### 2.7 What's next?
**ADD:** Mention "Working with Images" in the list

## 3. Navigation: Understanding Modes

### 3.5 View Mode Actions
**MODIFY:** Add image viewing shortcuts (i/i1-9, Ctrl+Shift+O) and link shortcuts (l, Ctrl+Shift+S)

### 3.6 Input Mode Shortcuts
**ADD:** Image attachment shortcuts (Ctrl+F, Cmd/Ctrl+V, Ctrl+Shift+O)

## 5. Search and Filtering Language

### 5.2 Basic Filters
**ADD:** Document `i` filter (attachments/images) in the basic filters list

### 5.5 Model Patterns (Case-Insensitive)
**MODIFY:** Add xAI/Grok models to examples

### 5.7 Practical Examples
**MODIFY:** Add examples using `i` filter (e.g., finding/deleting attachments)

**ADD NEW SUBSECTION 5.7.1:** Deletion Examples - Document `:delete` command with examples

## 7. Working with Images (NEW SECTION)

### 7.1 Overview
Vision-capable models, use cases, limits (4 images, 30MB)

### 7.2 Attaching Images (Input Mode)
Ctrl+F (file picker), Cmd/Ctrl+V (paste), drag-drop

### 7.3 Managing Draft Images
Ctrl+Shift+O (view/remove before sending)

### 7.4 Viewing Message Images (View Mode)
i/i1-9 shortcuts, immediate view for single image

### 7.5 Image Overlay Navigation
j/k, 1-9, Delete/x, Esc

### 7.6 Image Limits and Storage
Technical limits, local storage (IndexedDB)

### 7.7 Common Workflows
Screenshot → paste → send, multiple images, cleanup

## 8. Web Search & Sources (NEW SECTION)

### 8.1 Overview
What models support search, use cases

### 8.2 Enabling Web Search
Model Editor → "Search Enabled" checkbox

### 8.3 Viewing Citations (View Mode)
Ctrl+Shift+S (Sources overlay), navigation, copy URLs

### 8.4 Link Hints
l shortcut, 1-9 to open links

### 8.5 How It Works
Search during generation, citation format [1] [2], performance impact

## 9. API Keys and Model Catalogue

### 9.1 Setting Up API Keys
**MODIFY:** Update "three major providers" → "four major providers", add xAI section with key link and models

### 9.2 Understanding the Model Catalogue
**MODIFY:** Add xAI/Grok models to model categories

### 9.3 Managing Models
**MODIFY:** Add note about "Search Enabled" checkbox in Model Editor

### 9.4 Adding More Models
**MODIFY:** Update "three supported providers" → "four supported providers"

### 9.6 Understanding Rate Limits (TPM vs Context Window)
**MODIFY:** Add xAI rate limit explanation (similar to OpenAI)

### 9.8 Best Practices
**MODIFY:** Update "all three providers" → "all four providers"

## 10. Settings and Tools

### 10.2 Daily Statistics
**MODIFY:** Update to "Activity Statistics" with two tabs (By Date / By Model)

