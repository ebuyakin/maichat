## current problem notes and comments.

### pre-release:

1. tutorial / main page
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


'custome models' - doesn't sound right
'setting limits' - explain what they are and that it's user's responsibility
'errors'

token estimator - does it work differently for different providers? OpenAI vs Claude?


about modes:

MaiChat uses vim-inspired modal system. The purpose of modes is to use the same keys for different purposes depending on the situation. In INPUT mode and COMMAND mode (loosely similar to vim input mode and command line) most of the keys are used for typing as in regular text editor, while the commands/actions are typically performed with Ctrl-Key combination. In VIEW mode, there is no typing of the text, so single key presses are used to perform various actions/commands.