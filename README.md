# Gilded

**A Renaissance gem-merchant game for the browser.** Collect gems, buy development cards for permanent discounts, attract patrons, and be the first merchant to the prestige goal. Gilded is a fast, tactile take on the engine-building classic — no accounts, no installs, no build step.

> Single-page app. Zero dependencies. Just open `index.html`.

---

## Highlights

- **Play now** — one HTML file and a handful of assets; nothing to compile or install.
- **Vs AI** — 1–3 computer rivals across **Easy / Normal / Hard**, each with distinct buying, reserving, and gem-taking behaviour.
- **Vs Player** — local pass-and-play for **2–4** people on one device.
- **Save & resume** — up to **3 saved sessions** with autosave after every round; pick up exactly where you left off.
- **Round-stamped ledger** — a sliding drawer records every move, grouped by round.
- **Built for everyone** — light/dark themes, colour-vision (protanopia / deuteranopia / tritanopia) palettes, keyboard-free touch play, and full `prefers-reduced-motion` support.
- **Adjustable goal** — race to **10, 15, or 20** prestige.

---

## Play

Open the game and choose a mode from the start menu:

- **Vs AI** — set the number of rivals and their difficulty, or **load a saved game**.
- **Vs Player** — choose 2–4 seats and pass the device between turns.

A random player starts each match (the **1st** badge marks who), so you won't always go first.

### Running locally

Because everything is static, you can simply **double-click `index.html`** — or, if your browser is strict about local files, serve the folder:

```bash
# from the repository root
python -m http.server 8000
# then visit http://localhost:8000
```

No dependencies, no bundler, no network required after load.

---

## How to play

On your turn, do **exactly one** of the following:

| Action | Details |
| --- | --- |
| **Take 3 gems** | Three tokens of **different** colours. |
| **Take 2 gems** | Two of the **same** colour — only if that pile has **4 or more**. |
| **Reserve a card** | Set a card aside for later and take a **gold** (wild) token. Hold up to **3**. |
| **Buy a card** | Purchase from the table or from your reserve. |

A few rules to keep in mind:

- **Gold is wild** — it stands in for any colour when buying.
- **Ten-token limit** — you can never end a turn holding more than 10 tokens; you'll be prompted to return the excess.
- **Cards are permanent discounts** — every card grants a coloured bonus, so a green card makes all future purchases cost one less green. Stack them and expensive cards become cheap. The corner number is prestige.
- **Patrons** — the tiles up top are worth **3 prestige** each. When your *card bonuses* (not tokens) meet a patron's requirement, they visit you automatically.
- **Winning** — the instant anyone reaches the goal, the round is played out so everyone has taken the same number of turns. Highest prestige wins; ties go to whoever owns **fewer cards**.

New to the genre? The in-game **How to play** dialog walks you through all of this and appears automatically on your first visit.

---

## Project structure

Gilded is deliberately dependency-free. The markup, styles, and logic are separated into focused files that load as ordinary `<script>`/`<link>` tags:

```
gilded/
├── index.html            # Markup + favicon; links the stylesheet and modules
└── assets/
    ├── site.webmanifest    # PWA manifest
    ├── audio/                # Background music (see Credits)
    │   ├── lord-of-the-land.js  # Track embedded as a data URI (plays from file://)
    │   └── lord-of-the-land.mp3 # Same track as a file (http fallback)
    ├── css/
    │   └── styles.css        # All styling (theme, layout, responsive, animations)
    ├── images/               # Icons and favicons (png/svg)
    └── js/
        ├── constants.js    # Game data, deck/noble generation, state, startGame()
        ├── game.js         # Rules engine: payments, actions, turn/round flow
        ├── interactions.js # Human input handlers
        ├── ai.js           # Computer-rival policy and heuristics
        ├── render.js       # View layer — rebuilds the board/HUD from state
        ├── ui.js           # Modals, menu, settings, save/load sessions
        ├── audio.js        # Synthesised sound effects + looping music track
        ├── animations.js   # Optional visual effects + reserved-card tooltip
        └── events.js       # Delegated event handling, ledger drawer, boot
```

### How it fits together

- The modules load in order as **classic scripts** that share one global scope, so state and functions are visible across files without a bundler or module system. `events.js` loads last and boots the app.
- **State lives in two objects.** `G` holds the whole match (players, bank, decks, board, patrons, turn/round); `UI` holds transient interaction state (current selection, phase). Both are reassigned wholesale by `startGame()` / `loadSession()`.
- **One-way data flow.** The rules engine mutates `G`, then `render()` rebuilds the DOM from state. Input handlers translate clicks into rules-engine calls — they never touch the DOM directly.
- **A single delegated click handler** in `events.js` maps every `[data-action]` attribute to its function.
- **Persistence** uses `localStorage` (`gilded_sessions`, capped at 3, plus `gilded_settings`), with a silent autosave after each round and at game end.

---

## Accessibility & options

Open **Settings** any time to adjust:

- **Prestige to win** — 10, 15, or 20 (applies immediately and to new games).
- **Colour-vision mode** — recolours gems for protanopia, deuteranopia, or tritanopia.
- **Theme** — light or dark, toggled from the header.

Animations automatically respect your system's **reduce-motion** preference, and all settings are saved on the device.

---

## Browser support

Any modern evergreen browser (Chrome, Edge, Firefox, Safari). The layout is responsive and touch-friendly, so it plays well on phones, tablets, and desktops alike.

---

## Credits

- **Music:** *"Lord of the Land"* by Kevin MacLeod ([incompetech.com](https://incompetech.com/)) — licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Source: [incompetech.com](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400022).
- **Sound effects** are synthesised live in the browser via the Web Audio API (no asset files).

---

## License

No license has been chosen yet. Until one is added, all rights are reserved by the author.

The bundled music track is © Kevin MacLeod and is used under CC BY 3.0 (see **Credits**); that attribution must be preserved regardless of the project's own license.
