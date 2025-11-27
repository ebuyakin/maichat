## current tasks, notes and comments. scope for 1.2.5.

### V1.2.5 roadmap 
Accurate context assembly (focus on token usage counts for different scenarios - images, long context, assistant responses, thoughts), performance optimization, debugging/tracking tools/infrastructure via localStorage. Cleaning the code. Some refactoring to improve performance and maintainence. Specifically refactoring of the new message routine.

### Work approach, constraints:
1. Adhere to the architectural principles of the app. Prior to any update make special in-depth analysis whether the suggested changes match / align with the existing architecture and do not violate separation of concerns, layered organization, code isolation, no-duplication, simplicity and transparency criteria.
2. Minimize code changes. The app has complex dependencies so any change can have potential side effects. Prior to making changes assess possible risks and impact on other components of the app.
3. Performance is the core benefit of the app. Avoid any recommendations that may impact routine operation of the app. Specifically DOM mutations, heavy computations, indexedDB transactions, Network operations. Pay special attention to message history rendering and dynamic updates of the history view - they should be designed to minimize latency, ensure smooth and visually pleasing user experience with minimum distractions. No interface flickeging, flashing or vibrating is acceptable.
4. Implement changes in small steps preferably with one file per edit changes. Coordinate steps with User and let User test intermediate step where appropriate and manage repository commits.

### Raw problems & bugs (unsorted, non-prioritized):
1. UI: context boundary rendering - via DOM mutation (performace impact). Marking of off-context messages (color dimming - to settings, badge)  [x]
2. Attachments - only included from the current request. Not all history [x]
3. Messages with variants marking [?]
5. dbg_pipeline_presend - include: token coun (system, user, history), message_count, attachments count.
6. swapping messages - swapping budget counts. - newMessage routine, big one! [x]
7. AI is thinking to show [x]
8. update in case of reAsk error - preserve existing answer [x]
9. feature flag - instead of ctrl-G [x]
10. sendNewMessage() - returns the value, none taken in inputKeys.js [x]
11. clean pendingImages after send. [x]
12. context budget. MessagePair structure supplementation. [x]
13. duplication of hardcoded provider list (adapters vs providers) - single source of truth [~] deferred
14. boundary update on pending model change [x]
15. TotalTokens reported - store it to compare vs estimated. store both estimaterd total. [x]
16. recalculation of the estimated budgets upon settings changes or algo changes. [x]
17. topic summary in activity stat.
18. grok - web/twitter search. is twitter separate tool? [~]
19. image icon - open overlay on click. [x]
20. f1 view mode - Ctrl_Shift_O - view draft images - view attached images [x]
21. gemini - citations in the assistant body [x]
22. new model addition - doesn't work. [~]
23. documentation update - architecutre.md, docs-inventory.md, changelog/readme
24. base models list update (hardcoded)[x]
25. URA vs User assumed tokens [x]
26. max attempts hardcoded in newMessage (should be taken from settings) [x]
27. abort controller [x]
28. Topic editor - remember expand/collapse state.