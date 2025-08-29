# Scroll & Mask Sequence

```mermaid
sequenceDiagram
  autonumber
  User->>HistoryPane: Scroll (wheel / key)
  HistoryPane->>ScrollController: scroll event
  ScrollController->>ScrollController: measure parts (offsetTop, heights)
  ScrollController->>ScrollController: compute anchor S (mode-specific)
  ScrollController->>MaskController: applyMasks(pane, mode, G)
  MaskController->>MaskController: detect clipped / intruding parts
  MaskController-->>HistoryPane: update top/bottom mask styles
  ScrollController->>HUD: debugInfo()
  HUD-->>User: updated metrics (positions, masks, anchor)
```

Anchor Formulas (pre-clamp):
- Top: S = start_part_k
- Bottom: S = start_part_k + p_k - (H_total - G)
- Center: S = start_part_k + p_k/2 - H_total/2

Mask Logic Summary:
- Top mode: (to be unified) overlay gap + bottom clipped mask.
- Bottom mode: fixed bottom gap; top overlay expands to cover G + intruding slices.
- Center mode: symmetric overlay (top like bottom mode) + dynamic bottom clipped mask.
```
