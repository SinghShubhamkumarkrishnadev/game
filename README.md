# 💖 Jodi Sync — Mobile Game Suite for Indian Couples

> A warm, playful, mobile-first web app and multiplayer game suite crafted specifically for Indian couples (dating, live-in, engaged, newlyweds, and long-term partners).

---

## 🎮 Game Suite Overview

### 1. 🧩 Two Minds, One Word (*Do Dil, Ek Shabd*)
A cooperative word puzzle where couples work as a unified team to decode intimate, relatable, and culturally rich words.
- **Dual Collaborative Clues:** Both partners see Category, Word Length, Romantic Prompt, and both **Clue 1 & Clue 2** together so there are no informational blindspots.
- **Assigned Slot Ownership:** Slots are explicitly tagged with `[Aap]` and `[Partner]` labels with distinctive visual highlights (Pink for Host, Teal for Guest). Eliminates turn confusion — each player knows exactly where their letters belong.
- **Tactile Tile Interactions:** Tap a tile from your personal rack to place it into your next assigned slot (or select a slot first). Tap any of your placed letters on the board to recall it back to your rack.
- **Partner Progress Strip:** Real-time visibility into partner letter status (e.g. `2/3 letters placed`). In Solo Mode, includes a 1-tap `🤖 AI Akshar Rakho` button for instant partner placement.
- **Team SYNC Combos:** No single winner — solving words continuously earns **🔥 2X, 3X TEAM SYNC** multipliers!

### 2. ⭕ Tic-Tac-Toe (*Dil Ki Baazi*)
Classic Xs and Os reinvented for couples:
- **X (Pink) vs O (Teal):** Clean, tactile mobile-first touch grid.
- **Dynamic Animated Win-Line:** Immediately cuts through the three winning cells with a smooth line draw animation for horizontal, vertical, and diagonal wins.
- **Celebration Sprinklers & Result Popup:** Bottom-up confetti blast with a victory banner, stats breakdown, and 1-tap Rematch or Exit actions.

### 3. 🎨 Scribble Showdown (*Draw & Guess*)
Turn-based collaborative drawing game featuring culturally grounded Bollywood, chai-time, and relationship prompts with live stroke sync, hints, and scoring.

### 4. 🏍️ Couples 3D Bike Racing
A Three.js powered 3D highway racer:
- Choose from 4 bikes: Royal Bullet, Neon Sport, Teal Turbo, and Cafe Racer.
- 3 Laps with steering, gas, nitro boost, and takedown collisions (+50 PTS with auto-respawn).

### 5. 🕹️ Solo Arcade Mode
Accessible directly from the lobby below the room code input. Allows a single player to test, practice, and experience all games with AI before inviting their real partner.

---

## 🛠️ Architecture & Code Organization (SOLID Principles)

The codebase strictly adheres to modular separation of concerns:

- `js/two-minds.js`: Pure puzzle generation, deterministic slot partitioning, validation, and AI simulation.
- `js/two-minds-ui.js`: Two Minds UI renderer, tactile slot interactions, tile rack bindings, and partner status bar.
- `js/tictactoe.js`: Tic-Tac-Toe state machine, win checking, win-line vector calculation, and SVG animation rendering.
- `js/scribble.js`: Canvas drawing engine and real-time stroke serialization.
- `js/race-engine.js`: Three.js rendering loop, physics, bike models, and lap tracking.
- `js/solo-arcade.js`: Solo experience controller and AI orchestration.
- `js/lobby.js`: Lobby view, room creation, avatar selection, and game navigation.
- `js/modals.js`: Centralized guide modal, installation guide, and exit dialogs.
- `js/app.js`: Master application coordinator, WebRTC/WebSocket peer networking, and routing.
- `css/tokens.css` & `css/style.css`: Curated bespoke color system (Rani Pink, Mor Peacock Teal, Plum, Genda Gold) with zero generic AI tells.

---

## 🚀 Getting Started

### Local Development
Serve the files with any static HTTP server:
```bash
# Python 3
python -m http.server 8080 --bind 127.0.0.1
```
Open `http://127.0.0.1:8080` in your mobile browser or emulator.

### Progressive Web App (PWA)
- Installable on Android (via Chrome Install Banner).
- Installable on iOS (via Safari Share ⎋ -> Add to Home Screen ➕).
- Offline asset caching via `sw.js`.