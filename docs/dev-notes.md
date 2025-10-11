## current problem notes and comments.


scrolling/anchoring of the new message in case pre-sending is not G. [x]
filtering upon changing the topic in the input box.[x]
smooth scrolling for j/k [x]
margin for the equations (top.bottom) [x]

fade visibility code - remove - what is fade visibility?
context boundary - o key, greying off-topic[x]
- 
scrolling bar - color [x]
e (re-ask) - alignment and model/topic parameters (don't change them) [x]

copy tables - ...
copy messages in full
free refresh


settings:

remove legacy settings, redundant settings
equation size
line height
margins
smooth scrolling
refresh/re-rerender history on exit from settings.

more text editing keybindings (emac style Ctrl-A/E Ctrl-R) [x]

Ctrl-N - shall be deleted from the input mode keys.
how Ctrl-P should work in view mode:
it opens chronoTopicPicker and allows to choose one of the topic in history
On Enter topic is selected (and pending topic updated) and then if naked t is in in the filter (command zone)
the message history shall be refreshed/ re-rendered and the last message in the new selection shall be activated and anchored to the bottom
If, however, there is no naked t (t without an argument) in the current filter (no re-rendering, scrolling or changing active message should happen) 

- update help, update key shortcuts, update tutorial.
- default settings = double check. 
- model catalogue - default

- gemini sending


curl -X POST \
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDW__NlsCUGYdexRrGHxzyD3Y6pJtSL6hc' \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "Hello, how are you?"
          }
        ]
      }
    ]
  }'

curl -X POST \
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyDW__NlsCUGYdexRrGHxzyD3Y6pJtSL6hc' \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hello, how are you?"}]}]}'

curl 'https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyDW__NlsCUGYdexRrGHxzyD3Y6pJtSL6hc'


  documents            csh-vscode.md             Oct  5 15:38
  eb-dev               test.txt                  Sep 29 11:57    '''bash
  homebrew             csh-git.md                Sep 29 11:51    grep "pattern" file_name.txt
  my_trash             csh.md                    Sep 27 11:04    grep "pattern" * # all files in the current folder
  icloud-business      csh-word.txt              Sep 26 11:24    grep "pattern" *.md # all markdown files
  backup               csh-htmlcss.md            Sep 23 18:03    grep pattrn * | grep pattern2 # AND - consecutive search
  icloud               csh-nodejs.md             Sep 12 17:26    grep -E pattern|pattern * # OR, -E - flag for regular expressio
                       csh-network.md            Aug 21 17:08    gretp -r pattern * # recursive search
                                                                 '''

                                                                 '''bash
                                                                 less # inspect output line by line. q - quit, j/k u/d - navigat
-rw-r--r-- 1 eugenebuyakin staff 1.8K Fri Oct  3 11:44:48 2025                                                          3   3/11
==================== ~ : lf
==================== ~ : vim
==================== ~ : clear
 15 npm run some_script # run the script from scripts section of package.json
 16 '''
 17
 18 Development server
 19 '''bash
 20 npm run dev # dev - is a standard script automatically creacted at product initialization. default port 5170
 21 npm nun dev -- --port 5171 # change the port
 22 '''
 23
 24 How to generate a production build and test it:
 25 '''bash
 26 npm run build # generates production build in dist/
















E325: ATTENTION
Found a swap file by the name ".csh-vscode.md.swp"
          owned by: eugenebuyakin   dated: Sun Oct 05 15:38:20 2025
         file name: ~eugenebuyakin/Dev/_vault/csh-vscode.md
          modified: no
 75 git diff --cached --file.txt # compare to the index (staged version)
  1 Certainly! Here’s a concise overview of the history of England:
  2 Ancient and Roman Times
  9 Anglo-Saxon Period: After Romans withdrew, Anglo-Saxon kingdoms were established.
 14
 19
  1 Certainly! Here’s a concise overview of the history of England:
  2 Ancient and Roman Times
  7 Early Middle Ages
  8
  9 Anglo-Saxon Period: After Romans withdrew, Anglo-Saxon kingdoms were established.
 22
 28
 29 Contemporary England
 30
 37
 38 ## 1. **Vector Space Structure vs. Representation Structure**
 46
 50 - SU(2) is a subset of these operators: the set of all \(2 \times 2\) unitary matrices with determinant 1.
 57
 64
 65 ---
 66
 67 ## 4. **Why is "spinor space" a term at all?**
 76 - Out of all possible ways to have linear operations on a vector space \(V\), *specifying* that we are interested in how SU(    2) elements act on \(V\) — and that we interpret this as physically corresponding to rotations for spin-½ objects — is what     **turns** the abstract vector space into “the spinor representation.”
 77 - **If you just have \(V=\mathbb{C}^2\), but there’s no physical or mathematical specification of which matrices "mean" a ro    tation, it’s just an abstract vector space.**
 78 - When you **declare** that SU(2) elements correspond to specific linear operators on \(V\), now you have a representation,     and *now* your vectors are "spinors" under that representation.
 79
 80 ---
 81
 82 ## **Summary/Table**
 83 | Concept                   | What it is            | Is V special here?                  | What’s required?                     |
 84 |---------------------------|-----------------------|-------------------------------------|---------------------------------    --|
    @
==================== ~ : cd dev/_vault
==================== ~/dev/_vault : ls
arj		csh-htmlcss.md	csh-network.md	csh-vscode.md	csh.md		test.txt
csh-git.md	csh-linux.md	csh-nodejs.md	csh-word.txt	lf
==================== ~/dev/_vault : vim csh-nodejs.md
==================== ~/dev/_vault : vim csh-vscode.md
==================== ~/dev/_vault : vim csh-git.md
==================== ~/dev/_vault : vim
==================== ~/dev/_vault : curl -X POST \
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDW__NlsCUGYdexRrGHxzyD3Y6pJtSL6hc' \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "Hello, how are you?"
          }
        ]
      }
    ]
  }'
{
  "error": {
    "code": 404,
    "message": "models/gemini-1.5-flash is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.",
    "status": "NOT_FOUND"
  }
}
==================== ~/dev/_vault : curl 'https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyDW__NlsCUGYdexRrGHxzyD3Y6pJtSL6hc'
{
  "models": [
    {
      "name": "models/embedding-gecko-001",
      "version": "001",
      "displayName": "Embedding Gecko",
      "description": "Obtain a distributed representation of a text.",
      "inputTokenLimit": 1024,
      "outputTokenLimit": 1,
      "supportedGenerationMethods": [
        "embedText",
        "countTextTokens"
      ]
    },
    {
      "name": "models/gemini-2.5-pro-preview-03-25",
      "version": "2.5-preview-03-25",
      "displayName": "Gemini 2.5 Pro Preview 03-25",
      "description": "Gemini 2.5 Pro Preview 03-25",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-flash-preview-05-20",
      "version": "2.5-preview-05-20",
      "displayName": "Gemini 2.5 Flash Preview 05-20",
      "description": "Preview release (April 17th, 2025) of Gemini 2.5 Flash",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-flash",
      "version": "001",
      "displayName": "Gemini 2.5 Flash",
      "description": "Stable version of Gemini 2.5 Flash, our mid-size multimodal model that supports up to 1 million tokens, released in June of 2025.",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-flash-lite-preview-06-17",
      "version": "2.5-preview-06-17",
      "displayName": "Gemini 2.5 Flash-Lite Preview 06-17",
      "description": "Preview release (June 11th, 2025) of Gemini 2.5 Flash-Lite",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-pro-preview-05-06",
      "version": "2.5-preview-05-06",
      "displayName": "Gemini 2.5 Pro Preview 05-06",
      "description": "Preview release (May 6th, 2025) of Gemini 2.5 Pro",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-pro-preview-06-05",
      "version": "2.5-preview-06-05",
      "displayName": "Gemini 2.5 Pro Preview",
      "description": "Preview release (June 5th, 2025) of Gemini 2.5 Pro",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-pro",
      "version": "2.5",
      "displayName": "Gemini 2.5 Pro",
      "description": "Stable release (June 17th, 2025) of Gemini 2.5 Pro",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.0-flash-exp",
      "version": "2.0",
      "displayName": "Gemini 2.0 Flash Experimental",
      "description": "Gemini 2.0 Flash Experimental",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "bidiGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.0-flash",
      "version": "2.0",
      "displayName": "Gemini 2.0 Flash",
      "description": "Gemini 2.0 Flash",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.0-flash-001",
      "version": "2.0",
      "displayName": "Gemini 2.0 Flash 001",
      "description": "Stable version of Gemini 2.0 Flash, our fast and versatile multimodal model for scaling across diverse tasks, released in January of 2025.",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.0-flash-lite-001",
      "version": "2.0",
      "displayName": "Gemini 2.0 Flash-Lite 001",
      "description": "Stable version of Gemini 2.0 Flash-Lite",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.0-flash-lite",
      "version": "2.0",
      "displayName": "Gemini 2.0 Flash-Lite",
      "description": "Gemini 2.0 Flash-Lite",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.0-flash-lite-preview-02-05",
      "version": "preview-02-05",
      "displayName": "Gemini 2.0 Flash-Lite Preview 02-05",
      "description": "Preview release (February 5th, 2025) of Gemini 2.0 Flash-Lite",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.0-flash-lite-preview",
      "version": "preview-02-05",
      "displayName": "Gemini 2.0 Flash-Lite Preview",
      "description": "Preview release (February 5th, 2025) of Gemini 2.0 Flash-Lite",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 40,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.0-pro-exp",
      "version": "2.5-exp-03-25",
      "displayName": "Gemini 2.0 Pro Experimental",
      "description": "Experimental release (March 25th, 2025) of Gemini 2.5 Pro",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.0-pro-exp-02-05",
      "version": "2.5-exp-03-25",
      "displayName": "Gemini 2.0 Pro Experimental 02-05",
      "description": "Experimental release (March 25th, 2025) of Gemini 2.5 Pro",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-exp-1206",
      "version": "2.5-exp-03-25",
      "displayName": "Gemini Experimental 1206",
      "description": "Experimental release (March 25th, 2025) of Gemini 2.5 Pro",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.0-flash-thinking-exp-01-21",
      "version": "2.5-preview-05-20",
      "displayName": "Gemini 2.5 Flash Preview 05-20",
      "description": "Preview release (April 17th, 2025) of Gemini 2.5 Flash",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.0-flash-thinking-exp",
      "version": "2.5-preview-05-20",
      "displayName": "Gemini 2.5 Flash Preview 05-20",
      "description": "Preview release (April 17th, 2025) of Gemini 2.5 Flash",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.0-flash-thinking-exp-1219",
      "version": "2.5-preview-05-20",
      "displayName": "Gemini 2.5 Flash Preview 05-20",
      "description": "Preview release (April 17th, 2025) of Gemini 2.5 Flash",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-flash-preview-tts",
      "version": "gemini-2.5-flash-exp-tts-2025-05-19",
      "displayName": "Gemini 2.5 Flash Preview TTS",
      "description": "Gemini 2.5 Flash Preview TTS",
      "inputTokenLimit": 8192,
      "outputTokenLimit": 16384,
      "supportedGenerationMethods": [
        "countTokens",
        "generateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2
    },
    {
      "name": "models/gemini-2.5-pro-preview-tts",
      "version": "gemini-2.5-pro-preview-tts-2025-05-19",
      "displayName": "Gemini 2.5 Pro Preview TTS",
      "description": "Gemini 2.5 Pro Preview TTS",
      "inputTokenLimit": 8192,
      "outputTokenLimit": 16384,
      "supportedGenerationMethods": [
        "countTokens",
        "generateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2
    },
    {
      "name": "models/learnlm-2.0-flash-experimental",
      "version": "2.0",
      "displayName": "LearnLM 2.0 Flash Experimental",
      "description": "LearnLM 2.0 Flash Experimental",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 32768,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2
    },
    {
      "name": "models/gemma-3-1b-it",
      "version": "001",
      "displayName": "Gemma 3 1B",
      "inputTokenLimit": 32768,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64
    },
    {
      "name": "models/gemma-3-4b-it",
      "version": "001",
      "displayName": "Gemma 3 4B",
      "inputTokenLimit": 32768,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64
    },
    {
      "name": "models/gemma-3-12b-it",
      "version": "001",
      "displayName": "Gemma 3 12B",
      "inputTokenLimit": 32768,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64
    },
    {
      "name": "models/gemma-3-27b-it",
      "version": "001",
      "displayName": "Gemma 3 27B",
      "inputTokenLimit": 131072,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64
    },
    {
      "name": "models/gemma-3n-e4b-it",
      "version": "001",
      "displayName": "Gemma 3n E4B",
      "inputTokenLimit": 8192,
      "outputTokenLimit": 2048,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64
    },
    {
      "name": "models/gemma-3n-e2b-it",
      "version": "001",
      "displayName": "Gemma 3n E2B",
      "inputTokenLimit": 8192,
      "outputTokenLimit": 2048,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64
    },
    {
      "name": "models/gemini-flash-latest",
      "version": "Gemini Flash Latest",
      "displayName": "Gemini Flash Latest",
      "description": "Latest release of Gemini Flash",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-flash-lite-latest",
      "version": "Gemini Flash-Lite Latest",
      "displayName": "Gemini Flash-Lite Latest",
      "description": "Latest release of Gemini Flash-Lite",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-pro-latest",
      "version": "Gemini Pro Latest",
      "displayName": "Gemini Pro Latest",
      "description": "Latest release of Gemini Pro",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-flash-lite",
      "version": "001",
      "displayName": "Gemini 2.5 Flash-Lite",
      "description": "Stable version of Gemini 2.5 Flash-Lite, released in July of 2025",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-flash-image-preview",
      "version": "2.0",
      "displayName": "Nano Banana",
      "description": "Gemini 2.5 Flash Preview Image",
      "inputTokenLimit": 32768,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 1
    },
    {
      "name": "models/gemini-2.5-flash-image",
      "version": "2.0",
      "displayName": "Nano Banana",
      "description": "Gemini 2.5 Flash Preview Image",
      "inputTokenLimit": 32768,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 1
    },
    {
      "name": "models/gemini-2.5-flash-preview-09-2025",
      "version": "Gemini 2.5 Flash Preview 09-2025",
      "displayName": "Gemini 2.5 Flash Preview Sep 2025",
      "description": "Gemini 2.5 Flash Preview Sep 2025",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-flash-lite-preview-09-2025",
      "version": "2.5-preview-09-25",
      "displayName": "Gemini 2.5 Flash-Lite Preview Sep 2025",
      "description": "Preview release (Septempber 25th, 2025) of Gemini 2.5 Flash-Lite",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens",
        "createCachedContent",
        "batchGenerateContent"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-robotics-er-1.5-preview",
      "version": "1.5-preview",
      "displayName": "Gemini Robotics-ER 1.5 Preview",
      "description": "Gemini Robotics-ER 1.5 Preview",
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/gemini-2.5-computer-use-preview-10-2025",
      "version": "Gemini 2.5 Computer Use Preview 10-2025",
      "displayName": "Gemini 2.5 Computer Use Preview 10-2025",
      "description": "Gemini 2.5 Computer Use Preview 10-2025",
      "inputTokenLimit": 131072,
      "outputTokenLimit": 65536,
      "supportedGenerationMethods": [
        "generateContent",
        "countTokens"
      ],
      "temperature": 1,
      "topP": 0.95,
      "topK": 64,
      "maxTemperature": 2,
      "thinking": true
    },
    {
      "name": "models/embedding-001",
      "version": "001",
      "displayName": "Embedding 001",
      "description": "Obtain a distributed representation of a text.",
      "inputTokenLimit": 2048,
      "outputTokenLimit": 1,
      "supportedGenerationMethods": [
        "embedContent"
      ]
    },
    {
      "name": "models/text-embedding-004",
      "version": "004",
      "displayName": "Text Embedding 004",
      "description": "Obtain a distributed representation of a text.",
      "inputTokenLimit": 2048,
      "outputTokenLimit": 1,
      "supportedGenerationMethods": [
        "embedContent"
      ]
    },
    {
      "name": "models/gemini-embedding-exp-03-07",
      "version": "exp-03-07",
      "displayName": "Gemini Embedding Experimental 03-07",
      "description": "Obtain a distributed representation of a text.",
      "inputTokenLimit": 8192,
      "outputTokenLimit": 1,
      "supportedGenerationMethods": [
        "embedContent",
        "countTextTokens",
        "countTokens"
      ]
    },
    {
      "name": "models/gemini-embedding-exp",
      "version": "exp-03-07",
      "displayName": "Gemini Embedding Experimental",
      "description": "Obtain a distributed representation of a text.",
      "inputTokenLimit": 8192,
      "outputTokenLimit": 1,
      "supportedGenerationMethods": [
        "embedContent",
        "countTextTokens",
        "countTokens"
      ]
    },
    {
      "name": "models/gemini-embedding-001",
      "version": "001",
      "displayName": "Gemini Embedding 001",
      "description": "Obtain a distributed representation of a text.",
      "inputTokenLimit": 2048,
      "outputTokenLimit": 1,
      "supportedGenerationMethods": [
        "embedContent",
        "countTextTokens",
        "countTokens",
        "asyncBatchEmbedContent"
      ]
    },
    {
      "name": "models/aqa",
      "version": "001",
      "displayName": "Model that performs Attributed Question Answering.",
      "description": "Model trained to return answers to questions that are grounded in provided sources, along with estimating answerable probability.",
      "inputTokenLimit": 7168,
      "outputTokenLimit": 1024,
      "supportedGenerationMethods": [
        "generateAnswer"
      ],
      "temperature": 0.2,
      "topP": 1,
      "topK": 40
    },
    {
      "name": "models/imagen-3.0-generate-002",
      "version": "002",
      "displayName": "Imagen 3.0",
      "description": "Vertex served Imagen 3.0 002 model",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predict"
      ]
    },
    {
      "name": "models/imagen-4.0-generate-preview-06-06",
      "version": "01",
      "displayName": "Imagen 4 (Preview)",
      "description": "Vertex served Imagen 4.0 model",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predict"
      ]
    },
    {
      "name": "models/imagen-4.0-ultra-generate-preview-06-06",
      "version": "01",
      "displayName": "Imagen 4 Ultra (Preview)",
      "description": "Vertex served Imagen 4.0 ultra model",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predict"
      ]
    },
    {
      "name": "models/imagen-4.0-generate-001",
      "version": "001",
      "displayName": "Imagen 4",
      "description": "Vertex served Imagen 4.0 model",
      "inputTokenLimit": 480,
      "outputTokenLimit": 8192,
      "supportedGenerationMethods": [
        "predict"
      ]
    }
  ],
  "nextPageToken": "Ch5tb2RlbHMvaW1hZ2VuLTQuMC1nZW5lcmF0ZS0wMDE="
}
==================== ~/dev/_vault : curl 'https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyDW__NlsCUGYdexRrGHxzyD3Y6pJtSL6hc' | gem_models.txt
zsh: command not found: gem_models.txt
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
  1
                                 Dload  Upload   Total   Spent    Left  Speed
100 16384    0 16384    0     0   119k      0 --:--:-- --:--:-- --:--:--  120k
curl: (56) Failure writing output to destination, passed 134 returned 0
==================== ~/dev/_vault : curl 'https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyDW__NlsCUGYdexRrGHxzyD3Y6pJtSL6hc'| vim -c
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
















"-stdin-" 821L, 23743B
806       ]
807     },
808     {
809       "name": "models/imagen-4.0-generate-001",
810       "version": "001",
811       "displayName": "Imagen 4",
812       "description": "Vertex served Imagen 4.0 model",
813       "inputTokenLimit": 480,
814       "outputTokenLimit": 8192,
815       "supportedGenerationMethods": [
816         "predict"
817       ]
818     }
819   ],
820   "nextPageToken": "Ch5tb2RlbHMvaW1hZ2VuLTQuMC1nZW5lcmF0ZS0wMDE="
821 }
-- VISUAL LINE --