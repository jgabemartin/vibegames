# Western NY Farm BMX Dash

A simple browser platformer: ride a BMX bike across Western New York farmland, hopping dogs, pumpkins, hay bales, and a wagon, through five weather zones, chasing your best completion time.

## Controls

- Arrow keys / A D — pedal left/right
- Space / Up / W — hop
- R — restart
- M — toggle music

## Music

The soundtrack is an original swamp-rock instrumental in the spirit of Creedence Clearwater Revival, generated procedurally in the browser with the Web Audio API (`music.js`) — no audio files to download. It starts on your first key press (browsers require a user interaction before audio can play) and your mute preference is remembered via `localStorage`.

## Running it locally

No build step, no dependencies — it's plain HTML/CSS/JavaScript using Canvas and the Web Audio API.

1. Download the files in this folder: `index.html`, `style.css`, `game.js`, `music.js` (or clone the whole repo and open this folder).
2. Double-click `index.html` to open it in your browser. It runs directly from disk (`file://`) — no local server needed.

Your best completion time is saved in the browser's `localStorage`, so it persists between plays as long as you keep opening the file from the same path in the same browser.
