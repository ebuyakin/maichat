## current problem notes and comments.

### pre-release:

2. discoverability of the app.

#### initialization for new users:
2. model catalogue - usage limits defaults?
3. default settings - double check they match my current settings
4. default topic tree - prepare initial topic tree for new users
5. first message / greeting.
6. Double check keyboard reference / F1 help - to make sure they reflect the latest changes.

#### code polish:
1. remove debug code
2. readme, changelog - consider this the first real public beta.

#### push/production/release steps:
- publish on github pages (as current version) - generally should work automatically after push
- launch on vercel


# MaiChat Tutorial

## Quick start
## Navigation
## Topics & topic tree
## Search & Filtering language
## Context management
## API keys & Model catalogue
## Settings & Tools
## Common Errors & Solutions
## Tips & Best Practices (deferred)


token estimator - does it work differently for different providers? OpenAI vs Claude?

## Agreed Model List (this is TRUE, latest list of models available and selected by us):
model                          | cw    | TPM    | RPM   | TPD       | OTPM      | RPD
__OpenAI (4 models) tier 1:__
GPT-5                           400000  500000  500     1500000
GPT-5 mini                      400000  500000  500     5000000
GPT-5 nano                      400000  200000  500     2000000
o4-mini                         128000  200000  500     2000000
__Anthropic (3 models) tier 1:__
Claude Sonnet 4.5               200000  30000   50                  8000
Claude Opus 4.1                 200000  30000   50                  8000
Claude 3.5 Haiku                200000  50000   50                  10000
__Google (3 models):__
Gemini 2.5 Pro                  1000000 125000  2                               50
Gemini 2.5 Flash                1000000 250000  10                              250
Gemini 2.0 Flash                1000000 1000000 15                              200


GPT-5
GPT-5 mini
GPT-5 nano
o4-mini 
Claude Sonnet 4.5
Claude Opus 4.1
Claude 3.5 Haiku
Gemini 2.5 Pro
Gemini 2.5 Flash
Gemini 2.0 Flash