# SkidRoller

A browser BMX platformer: ride across Western New York farmland, hopping dogs, pumpkins, hay bales, and a wagon through five weather zones. Beat a boss at the end of each of three levels, and chase your best completion time.

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

## Bosses

After the five weather zones, the skies clear and you reach the boss arena. Reaching the arena sets a checkpoint, so if you lose a life there you restart at the arena, not at the beginning of the level.

- **Level 1, The Great Oak:** a giant angry oak whose trunk is too tall to hop over. Climb its branches (you can hop up through them from below), ride over the top of the trunk, and drop down the other side to beat it. While you climb, it drops apples on you. Watch for their shadows on the ground. Then ride to the flag.
- **Level 2, The Burn Barrel:** a rusty burn barrel that puffs out columns of smoke. Hop up the hay bale onto the stack of pallets, then jump over the barrel onto the down ramp. If you touch the smoke or the barrel, you cough and start over at the beginning of the arena. You don't lose a life. Timing is everything:
  - **Low flames:** the smoke is clearing. Once the column has drifted up, it's your chance to jump.
  - **Big flare with sparks:** a fresh burst of smoke is coming. Jump now or wait for the next gap.
  - **Thick smoke:** wait.
- **Level 3, The Warehouse Crew:** rival BMX kids keep launching off the roof of the BMX Depot warehouse, riding down its ramp, and dropping into a pit below ground. Jump the pit, then hop over the oncoming riders. Their headlights show them coming in the dark. You can also bounce off their helmets. Ride up the ramp to the roof. Getting hit costs a life. Reaching the roof wins the game with a big fireworks celebration.

## Controls

- Arrow keys / A D — pedal left/right
- Space / Up / W — hop
- Press hop again in mid-air — **SuperHop**: a second hop before you land, with its own sound and a puff of air. You get one per jump, and it recharges when you touch the ground. It also works if you roll off a ledge, which can save you from a pit.
- R — restart from Level 1
- M — toggle music (sound effects stay on)

## Music

The soundtrack is an original swamp-rock instrumental in the spirit of Creedence Clearwater Revival, generated procedurally in the browser with the Web Audio API (`music.js`) — no audio files to download. It starts on your first key press (browsers require a user interaction before audio can play) and your mute preference is remembered via `localStorage`.

## Sound effects

Jumps, coins, bumping into obstacles, hopping on dogs, getting knocked down by dogs, and falling into pits all have sound effects, also synthesized with the Web Audio API (`sfx.js`). The M key mutes only the music; sound effects keep playing.

