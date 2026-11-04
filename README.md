# Blob & Block Battle

A lightweight falling-puzzle versus game for the browser. Each player picks a mode:

- **Blocks**: classic line-clearing with 7 piece shapes, hold, ghost piece and next queue.
- **Blobs**: connect 4+ same-coloured blobs to pop them and build chain reactions.

Blocks can fight Blobs. Clearing lines or chaining blobs sends garbage to the opponent, and your attacks cancel incoming garbage first.

Plain HTML, CSS and JavaScript with no dependencies and no build step.

## Run it

Double-click `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Modes

- **Solo**: set Player 2 to *Off*.
- **vs CPU**: Easy, Normal or Hard.
- **2 players, one keyboard**: set both to *Human*.
- **CPU vs CPU**: set both to *CPU* and watch.

## Controls

| Action        | Solo / vs CPU   | P1 (2 humans) | P2 (2 humans) |
|---------------|-----------------|---------------|---------------|
| Move          | ← → or A D      | A D           | ← →           |
| Soft drop     | ↓ or S          | S             | ↓             |
| Hard drop     | Space or W      | W             | ↑             |
| Rotate ↻      | ↑ / X / E       | E             | .             |
| Rotate ↺      | Z / Q           | Q             | ,             |
| Hold (blocks) | C / Shift       | Left Shift    | Right Shift   |

P pauses, Esc returns to the menu, and Enter starts a rematch.

## Project layout

```
index.html        menu + canvas
css/style.css
js/config.js      all tunable numbers (speeds, attack tables, CPU, key bindings)
js/input.js       keyboard, auto-repeat, seeded RNG
js/draw.js        shared canvas drawing helpers
js/blockGame.js   block mode logic + rendering
js/puyoGame.js    blob mode logic + rendering
js/ai.js          CPU players
js/main.js        menu, match setup, game loop, layout
```

Every board exposes the same interface (`update`, `handleInput`, `move`, `rotate`, `hardDrop`, `receiveGarbage`, `onAttack`, `draw`), so adding a new mode means writing one new class.

## Balancing

Change the values in `js/config.js`:
- `attack.blockLines`: garbage sent for 1–4 lines
- `attack.puyoChainPower`: garbage per chain step
- `puyo.nuisancePerLine`: how many grey blobs one "line" of attack becomes

## Publish on GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/blob-block-battle.git
git push -u origin main
```

Then go to repo **Settings → Pages**, set Source to `main` / root, and the game goes live at `https://<you>.github.io/blob-block-battle/`.

## Ideas / roadmap

- [ ] Online versus: Node.js + WebSocket server that relays inputs and garbage events
- [ ] Sound effects and music
- [ ] Smooth fall/pop animations for blobs
- [ ] Full SRS rotation and T-spin detection
- [ ] Rebindable keys and gamepad support
- [ ] Smarter blob CPU that deliberately builds chains
