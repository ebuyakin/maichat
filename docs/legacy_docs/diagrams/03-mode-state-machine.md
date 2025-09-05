# Mode State Machine

```mermaid
stateDiagram-v2
  [*] --> VIEW
  VIEW --> INPUT: Enter
  VIEW --> COMMAND: Escape
  VIEW --> VIEW: j / k (navigate)\nR (cycle reading mode)

  INPUT --> VIEW: Escape (implicit via modeManager elsewhere)
  INPUT --> INPUT: Enter (send message) / text input
  INPUT --> COMMAND: Escape (if implemented)

  COMMAND --> VIEW: Enter (after successful filter apply)\nEscape (clear filter, stay or switch)
  COMMAND --> COMMAND: typing / parsing

  state VIEW {
    [*] --> Idle
    Idle --> Navigating: j/k or Arrow keys
    Navigating --> Idle: no key for interval
  }
```

Events:
- Enter in VIEW: switch to INPUT.
- Escape in VIEW: switch to COMMAND.
- Enter in COMMAND: parse & evaluate filter; on success → VIEW.
- R in VIEW: cycles reading position (top/center/bottom).
