# Working agreements

Read `docs/design.md` (what the game is) and `docs/architecture.md` (how the code is built) before changing anything.

## How we work

- **Proposal first.** When asked something, give feedback and a proposal first. Build only after approval.
- **Nothing new without discussion.** Do not add features, interface elements or game elements that were not agreed. The game stays small and lonely; atmosphere comes first.
- **Explore in conversation, decide in the repository.** Exploring (style rounds, ideas) happens in the session. Decisions and results go into `docs/design.md`, and into `docs/architecture.md` when they affect the code. Keep both current. Every feature that gets built is also explained for players in `README.md` (*How to play* and *Controls*), in plain words.
- **Every push that delivers something gets a new version:** bump `src/version.js` and `package.json`, give it a short name, and add an entry to the release log in `docs/versions.md`.
- **Keep the plan current:** `docs/handover.md` is the planning: what is live, what is being built, and what is agreed next, in order, with version numbers and names. Update it with every push and whenever something new is agreed, together with `docs/versions.md`, so the repository always matches the conversation.
- **Everything in English:** game text, code, comments, documentation and commit messages.
- **No personal data** in the repository: no names, e-mail addresses, private links or account details.
- **Delegate the hands-on work to cheaper subagents.** The main session plans, reviews and pushes; the actual tool calls and implementation go to subagents on Sonnet, or Haiku for very simple tasks.
- **Work directly on `main`.** No feature branches or pull requests. Every push to `main` goes live (see `docs/architecture.md`), so run `npm test` (and for visual changes the smoke test) before pushing.

## Code

- Respect the layers: `core` ← `world` ← `game`, and `render` reads `world` and game state. `world` and `game` stay pure (no DOM, no WebGL).
- Every module starts with a header: what it does, what it exports, what it depends on. Update it when the module changes.
- Add or update tests with every change: `npm test`. For visual changes also run `npm run build && npm run smoke` and look at the screenshots.
- `tests/world.test.js` guards seed 1337 against the style prototype. If it fails, the island changed: only accept that on purpose, and regenerate the fixture with `prototypes/make-golden.js` after changing the prototype the same way.
- Three.js stays at r128 (the shaders depend on its shader chunks).
