# MaiChat Refactoring Plan - Table of Contents

## 1. Executive Summary
   - 1.1 Refactoring Goals
   - 1.2 Key Changes Overview
   - 1.3 Timeline Summary

## 2. Current Architecture Analysis
   - 2.1 Problems with interaction.js
   - 2.2 Other Problematic Areas
   - 2.3 Technical Debt Assessment

## 3. Proposed Module Structure
   - 3.1 Directory Reorganization
   - 3.2 Module Responsibilities
   - 3.3 Dependency Graph

## 4. Fragment-Based Navigation Design
   - 4.1 Concept Overview
   - 4.2 Fragment vs Part Comparison
   - 4.3 Visual Highlighting System
   - 4.4 Navigation Behavior Specification

## 5. Implementation Phases
   - 5.1 Phase 1: Code Organization
   - 5.2 Phase 2: Fragment Navigation
   - 5.3 Phase 3: Cleanup & Optimization

## 6. Module Extraction Strategy
   - 6.1 From interaction.js
   - 6.2 From historyView.js
   - 6.3 New Modules Creation

## 7. Migration & Compatibility
   - 7.1 Backward Compatibility Plan
   - 7.2 Data Migration Strategy
   - 7.3 Settings Migration

## 8. Testing Strategy
   - 8.1 Unit Tests
   - 8.2 Integration Tests
   - 8.3 Manual Testing Checklist

## 9. Risk Management
   - 9.1 High Risk Areas
   - 9.2 Mitigation Strategies
   - 9.3 Rollback Plan

## 10. Success Criteria
   - 10.1 Performance Metrics
   - 10.2 User Experience Goals
   - 10.3 Code Quality Metrics


# MaiChat Refactoring Plan

## 1. Executive Summary

### 1.1 Refactoring Goals
The primary goals of this refactoring initiative are:

1. **Decompose Monolithic Files**: Break down oversized files (primarily `interaction.js` at ~1100 lines) into focused, single-responsibility modules
2. **Enable Fragment-Based Navigation**: Replace the current part-based message splitting with a visual fragment system that preserves content integrity
3. **Improve Code Maintainability**: Establish clear module boundaries, reduce coupling, and eliminate technical debt
4. **Preserve User Experience**: Maintain all existing keyboard-driven functionality while improving content accessibility

### 1.2 Key Changes Overview
- **Navigation Paradigm**: Transition from DOM-based parts to virtual fragments with gutter highlighting
- **Content Display**: Preserve inline code blocks and equations instead of forcing overlay access
- **Module Architecture**: Extract 7+ focused modules from `interaction.js`
- **State Management**: Centralize navigation state in dedicated controllers
- **Rendering Strategy**: Single DOM element per message with CSS-based highlighting

### 1.3 Timeline Summary
- **Phase 1 (Code Organization)**: 2-3 days - Extract modules, maintain functionality
- **Phase 2 (Fragment Navigation)**: 3-4 days - Implement new navigation system
- **Phase 3 (Cleanup & Optimization)**: 1-2 days - Remove legacy code, optimize performance
- **Total Duration**: 6-9 days with testing and validation

## 2. Current Architecture Analysis

### 2.1 Problems with interaction.js

**Size and Complexity**
- 1,100+ lines of code in a single file
- Handles 9+ distinct responsibilities simultaneously
- Difficult to test individual components in isolation
- High risk of introducing bugs when making changes

**Mixed Responsibilities**
Current `interaction.js` violates Single Responsibility Principle by handling:
1. **Mode Management**: Input/view/command state transitions
2. **Message Lifecycle**: Send process, API communication, response handling
3. **Content Processing**: Code extraction, equation extraction, sanitization
4. **Navigation Control**: Active part management, scrolling logic
5. **Event Handling**: Keyboard routing for all three modes
6. **UI Coordination**: Overlay triggers, topic selection, ratings
7. **Context Management**: Filter application, token counting
8. **State Synchronization**: Between UI components and data store

**Coupling Issues**
- Navigation logic tightly coupled to DOM structure (parts)
- API communication mixed with UI event handling
- Content processing embedded in user interaction flow
- Difficult to modify one aspect without affecting others

### 2.2 Other Problematic Areas

**historyView.js (~500 lines)**
- Mixes rendering logic with event handling
- Contains scrolling logic that duplicates interaction.js functionality
- Part creation logic embedded in display rendering
- Difficult to test rendering separately from behavior

**codeExtractor.js**
- Contains unused legacy functions (`processMessagePair`)
- Inconsistent API between extraction functions
- Processing logic scattered across multiple entry points

**store.js**
- Growing with mixed concerns (data storage + business logic)
- Some operations better suited for dedicated service modules
- Lacks clear separation between persistence and computation

### 2.3 Technical Debt Assessment

**High Priority Issues**
1. **Code Duplication**: Similar logic for code/equation processing in multiple places
2. **Unused Code**: Legacy functions and dead branches from iterative development
3. **Inconsistent Patterns**: Different modules follow different architectural approaches
4. **Testing Gaps**: Monolithic structure makes unit testing nearly impossible

**Medium Priority Issues**
1. **Performance**: Redundant DOM queries and calculations
2. **Memory Management**: Event listeners not properly cleaned up
3. **Error Handling**: Inconsistent error propagation and recovery

**Root Cause Analysis**
The current architecture emerged from rapid prototyping without upfront design. Key decisions were made incrementally, leading to:
- Feature additions patched onto existing code rather than proper integration
- Navigation system built around DOM structure rather than data model
- Content processing as an afterthought rather than core architectural concern

**Impact on Fragment Navigation**
The current part-based approach creates artificial content boundaries that:
- Force users to use overlays for content that should be readable inline
- Require multiple keystrokes to access semantically connected information
- Break the visual flow of messages with arbitrary splits
- Complicate the mental model for users (geometric vs semantic navigation)