# Data Model

```mermaid
classDiagram
  class MessagePair {
    +string id
    +string topicId
    +string model
    +string userText
    +string assistantText
    +number star
  +string colorFlag  // 'b' or 'g'
    +number createdAt
  }

  class Topic {
    +string id
    +string parentId
    +string name
    +number createdAt
  }

  class Part {
    +string id  // pairId:role:index
    +string pairId
    +string role  // user|assistant|meta
    +number index // within pair role segment
    +string text  // null for meta
    +number maxLinesUsed
    +number lineCount
  }

  class Store {
    +Map<string,MessagePair> pairs
    +Map<string,Topic> topics
    +getAllPairs()
    +addMessagePair(...)
    +updatePair(id, patch)
  }

  Store --> MessagePair : manages *
  Store --> Topic : manages *
  MessagePair --> Topic : topicId
  MessagePair --> Part : partitions into 1..*
```

Notes:
- Parts are computed (partitioning) artifacts, not persisted.
- Meta parts (role=meta) inject per-pair metadata rows.
- Indexes supply derived lookup structures (omitted here for brevity).
