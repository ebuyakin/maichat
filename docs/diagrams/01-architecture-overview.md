# MaiChat Architecture Overview

```mermaid
flowchart LR
  %% Simplified version to resolve parse error
  subgraph UI[UI Layer]
    CMD[Command Input]
    VIEW[History View]
    INPUT[Message Input]
    HUD[Debug HUD]
  end

  subgraph CTRL[Controllers]
    MODES[Mode Manager]
    SCROLL[Scroll Controller]
  FADING[Visibility Fading]
    PARTS[Active Part Controller]
    FILTER[Filter Parser and Evaluator]
    LIFECYCLE[New Message Lifecycle]
  end

  subgraph DATA[Data and State]
    STORE[In-Memory Store]
    INDEXES[Indexes]
    SETTINGS[Settings]
    PERSIST[Content Persistence / IndexedDB]
  end

  CMD --> FILTER
  FILTER --> VIEW
  CMD --> MODES
  INPUT --> LIFECYCLE
  LIFECYCLE --> STORE
  STORE --> VIEW
  STORE --> INDEXES
  INDEXES --> FILTER
  VIEW --> SCROLL
  SCROLL --> FADING
  FADING --> HUD
  SCROLL --> PARTS
  PARTS --> VIEW
  SETTINGS --> SCROLL
  SETTINGS --> FADING
  SETTINGS --> VIEW
  SETTINGS --> PARTS
  PERSIST --- STORE
  MODES --> VIEW
  MODES --> CMD
  MODES --> INPUT
```

Key Notes:
- UI components are thin; controllers encapsulate logic.
- Store is the source of truth; persistence syncs opportunistically.
- Scroll Controller owns measurement + anchor math; Fading logic applies edge opacity.
