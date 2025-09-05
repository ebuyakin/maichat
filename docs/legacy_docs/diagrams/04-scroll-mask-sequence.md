# Scroll & Fading Sequence

```mermaid
sequenceDiagram
  autonumber
  User->>HistoryPane: Scroll (wheel / key)
  HistoryPane->>ScrollController: scroll event
  ScrollController->>ScrollController: measure parts (offsetTop, heights)
  ScrollController->>ScrollController: compute anchor S (mode-specific)
  ScrollController->>Fading: compute intruding edges
  Fading-->>HistoryPane: apply edge opacities
  ScrollController->>HUD: debugInfo()
  HUD-->>User: updated metrics (positions, fading, anchor)
```

Anchor Formulas (pre-clamp):
- Top: S = start_part_k
- Bottom: S = start_part_k + p_k - (H_total - G)
- Center: S = start_part_k + p_k/2 - H_total/2

Fading Logic Summary:
- Top mode: fade intrusions top/bottom.
- Bottom mode: fade intrusions top/bottom.
- Center mode: symmetric fading both edges.
```
