# Western NY Farm BMX Dash

A simple browser platformer: ride a BMX bike across Western New York farmland, hopping dogs, pumpkins, hay bales, and a wagon, through five weather zones, chasing your best completion time.

## Download and play

You don't need to install anything. The game is plain HTML, CSS and JavaScript, and it runs in any modern browser (Chrome, Edge, Firefox or Safari).

### Option 1: Download the whole repo (easiest)

1. Download [vibegames-main.zip](https://github.com/jgabemartin/vibegames/archive/refs/heads/main.zip). You can also get it from the repo page by clicking the green **Code** button, then **Download ZIP**.
2. Unzip it.
3. Open the `platformer-game` folder and double-click `index.html`.

### Option 2: Download only the game files

Download these five files from this folder and put them **all in the same folder**:

| File | What it does |
|---|---|
| `index.html` | The page you open |
| `style.css` | Page layout and colors |
| `game.js` | The game: levels, physics and drawing |
| `music.js` | The background music |
| `sfx.js` | The sound effects |

Then double-click `index.html`. If any file is missing, the game won't work properly. For example, without `sfx.js` it stops the first time a sound plays.

### Notes

- The game runs straight from your disk (`file://`), so you don't need a local server or an internet connection.
- Sound starts on your first key press, because browsers block audio until you interact with the page.
- Your best time and music on/off setting are saved in your browser. They stay as long as you keep opening the game from the same folder in the same browser.

## Levels

There are three levels, each a full ride through all five weather zones:

1. **Day**
2. **Sunset**: a low sun sinking behind the hills, and slightly faster dogs
3. **Night**: stars, a moon, a bike headlight, and the fastest dogs

Lives and the timer carry over between levels, and your best time is for a full run through all three. Press R to start over from Level 1.

## Controls

- Arrow keys / A D — pedal left/right
- Space / Up / W — hop
- R — restart from Level 1
- M — toggle music (sound effects stay on)

## Music

The soundtrack is an original swamp-rock instrumental in the spirit of Creedence Clearwater Revival, generated procedurally in the browser with the Web Audio API (`music.js`) — no audio files to download. It starts on your first key press (browsers require a user interaction before audio can play) and your mute preference is remembered via `localStorage`.

## Sound effects

Jumps, coins, bumping into obstacles, hopping on dogs, getting knocked down by dogs, and falling into pits all have sound effects, also synthesized with the Web Audio API (`sfx.js`). The M key mutes only the music; sound effects keep playing.

