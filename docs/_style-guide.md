# JavaScript Style Guide  

## 1. General Principles
- Favor readability over cleverness
- Be consistent above all else
- Keep functions small (max 50 lines)
- One responsibility per function

## 2. Function Structure

- Maximum size: 50 lines. If longer, extract to separate functions with descriptive names.
- Use JSDoc as a documentation standard.
- Leave white space between function code for navigation.
- Maximum 2-3 levels of nesting. (SIC!) 
- Techniques to reduce nesting:
    - early returns / guard clauses
    - extract nested logic to separate functions
    - use array methods instead of nested loops
    - flatten conditionals with logical operators

## 3. Factory pattern (preferred for objects with state):

3.1. When to use factories:
- Functions need to share private state (most common in this app)
- Need multiple independent instances with their own state
- Need true encapsulation (hide internal variables)

3.2. When NOT to use factories:
- Simple utility functions with no state
- Only need one instance (use plain object instead)
- Functions don't share any data

3.3. Naming
- factories: createSomething()
- instances: drop 'create' prefix. keep base name consistent with factory.
- multiple instances: add descriptor to the base name

## 4. Module Structure

4.1. Organize files in the following order:
- import,
- constants,
- private functions,
- public (export) function.

4.2. Module size guidelines:
- Standard modules: 3-7 related functions (100-300 lines)
- Large modules: If > 300 lines, split into multiple modules
- Factory modules: for large (>100 lines) factories - one factory per module

## 5. Folder structure

5.1. No orphan folder - don't create a folder for 1 file
5.2. Try to keep up to 10 folders per level before nesting

## 6. Code Style

6.1. Destructuring:
**Use destructuring for:**
- ✅ Function parameters: `function createUser({ name, age }) { ... }`
- ✅ Plain data objects: `const { name, age } = userData;`
- ✅ Array values: `const [first, second] = array;`
- ✅ Import statements: `import { createCounter } from './utils.js';`
**Avoid destructuring for:**
- ❌ Factory instances: use `instance.method()` not `const { method } = instance`
- ❌ When it obscures where values come from
- ❌ When you'll reference the object anyway

6.2. Comments
- WHY something is done, not WHAT (code should be self-explanatory)
- Complex algorithms or business logic
- Non-obvious decisions or workarounds
- TODOs and FIXMEs with context

## 7. Debugging Strategy

In order of preference:
7.1. Console logs (for existing functions, objects) exposed via window.debug = {objectOfInterest,...}
7.2. Store object in localStorage (preferred for large data objects, like message history pairs)
7.3. Add separate functions calculating values of interest and expose them in console
7.4. HUD, for cases with repeated inspection of multiple variables (exposed via url ?Query)
