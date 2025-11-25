# new message routine dev notes

1. We don't touch existing infrastructure including Enter handler (in inputKeys.js) until we designed and tested the new routine in full. The app works and the current Enter handler is the critical component of it, do not touch it.  We are creating the new routine in parallel. It is triggered by a different key (Ctrl-G).  For a while we can use both old and new routines. The old is triggered by Enter, the new by Ctrl-G. When we finish the new, polish it, we wire it to Enter instead of Ctrl-G.

2. General scheme.

SendNewMessage()

loadPairsAndConfig()

if ReAskFlag {{userRequest, reaskedVisiblePairs} = prepareAndStoreReAsk}
else {{userRequest} = prepareUserRequest}

selectedHistoryPairs = selectContextPairs(reaskedVisiblePairs,userRequest)
requestParts = buildRequestParts(selectedHistoryPairs, userRequest)
rawResponse = sendWithRetry(requestParts)
parsedResponse = parseResponse(rawResponse)

storeResponse(parsedResponse)
updateInterface()




---
