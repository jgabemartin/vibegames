# SkyRaider v1.0

A World War I bombing run with 16-bit-style pixel art. Fly a biplane up the screen over farmland, the front-line trenches and army camps, and drop bombs on military targets. Where a bomb lands depends on where you are, when you let go, how high you fly and which way the wind is blowing. You have 60 seconds and 2 planes per run.

## How to play

You don't need to install anything. The game is plain HTML, CSS and JavaScript, and it runs in any modern browser.

1. Download [vibegames-main.zip](https://github.com/jgabemartin/vibegames/archive/refs/heads/main.zip), or click the green **Code** button on the repo page, then **Download ZIP**.
2. Unzip it.
3. Open the `skyraider-v1.0` folder and double-click `index.html`.

Sound starts on your first key press, because browsers block audio until you interact with the page.

### Controls

| Key | Action |
|---|---|
| Left / Right (or A / D) | Steer |
| Up / Down (or W / S) | Climb / dive |
| Space | Drop a bomb (start the game, fly again) |
| P | Pause (the game also pauses when the window loses focus) |
| M | Sound on or off (remembered) |

## Rules

### The run

- Each run lasts 60 seconds. The map is new every run, in three parts:
  1. **Farmland:** fields, villages, a river with a bridge, and supply depots.
  2. **The front:** two lines of zig-zag trenches with barbed wire, shell-cratered no man's land and artillery behind the lines.
  3. **Army camps:** fenced camps full of tents, trucks, guns and ammo dumps.
- You get 2 planes. The run ends when time runs out or both planes are shot down.

### Dropping bombs

- Bombs fall straight down from the plane, but they keep most of the plane's forward speed. **Drop before the target reaches you.** The bomb lands close to where the plane is when it hits the ground, slightly behind.
- The **bombsight**, a set of corner marks on the ground ahead of the plane, shows roughly where a bomb dropped right now would land in still air. It moves with your altitude and steering, but it **ignores the wind**, so aim upwind of the target to allow for drift. It dims while you reload.
- The falling bomb's shadow shows where it's heading. Bomb and shadow meet where it lands.
- One bomb every 0.7 seconds, with no limit. The bomb icon by the altitude gauge lights up when you can drop again.
- If you're steering when you let go, the bomb keeps half of your sideways speed.

### Wind

- The wind blows left or right. Its strength shifts during the run. The **WIND** box shows the direction and strength, and chimney smoke and camp flags lean with it.
- Bombs drift with the wind as they fall. The longer the fall, the further they drift.
- The wind also pushes your plane and the blimps a little.

### Altitude and points

- Up and Down change your altitude, shown on the **ALT** gauge. The plane's shadow moves further away the higher you fly.
- From low down a bomb takes 0.8 seconds to land. From the top it takes 2 seconds, so it drifts much further in the wind.
- Higher drops score more: points are multiplied by **x1.0** at the lowest altitude, up to **x2.0** at the highest. The gauge shows the current multiplier.

### Targets

| Target | Points |
|---|---|
| Trench section | 25 |
| Truck (some drive along the roads) | 50 |
| Tent | 75 |
| Artillery gun | 100 |
| Anti-aircraft gun (stops its fire) | 125 |
| Ammo dump (sets off a big secondary explosion that can take out nearby targets too) | 150 |
| Bridge | 200 |
| Blimp winch (brings its blimp down) | 250 |
| **Village house or church** | **-100** |

- Target points are multiplied by the altitude multiplier at the moment you dropped the bomb. House penalties are not.
- Each plane still flying at the end of the 60 seconds is worth **+200**.
- Your best score is saved in your browser.

### Blimps, AA guns and flak

- Barrage blimps float above the map, moored by cables to winches on the ground. They drift with the wind.
- Anti-aircraft guns sit in sandbagged rings on the ground: a couple in the farmland, more at the front and in the camps. Their barrels swing to follow you, and they fire while you're coming toward them.
- Blimp gunners and AA guns fire flak shells. You can see each shell fly toward you, with a smoke trail and a glowing fuse, and it bursts where it stops. Ground shells grow as they climb. Steer away from where a shell is heading.
- Flying into a blimp, or into a flak burst, costs a plane. Low down, the mooring cables are dangerous too.
- Bomb a blimp's winch to bring it down in flames. Bomb an AA gun to silence it.
- There are more blimps, and they fire faster, the further you get.

### Losing a plane

- Your plane spins down and crashes. The next one flies in from the bottom of the screen and blinks for a couple of seconds, while it can't be hit. The clock keeps running.

### Tips

- Fly high over targets in the open, where drift is easy to judge, and low when the wind is strong or houses are close by.
- Keep steady for a moment before you drop, so the bomb doesn't fly off sideways.
- A moving truck needs a lead: drop ahead of where it's going.
- Ammo dumps sit among other targets, so one good hit can score several times over.

## Change log

### 1.0: First release

- Biplane bombing run over farmland, the front and army camps, with a new map every run.
- Bombs keep the plane's forward speed and drift with the wind. Altitude sets the fall time and a score multiplier of up to x2.
- Targets: trenches, trucks (some moving), tents, guns, ammo dumps with chain explosions, the bridge and blimp winches. Houses cost points.
- Barrage blimps with mooring cables and flak gunners, and anti-aircraft guns that track the plane. Flak shells are shown flying to their burst.
- A bombsight shows where a bomb would land in still air.
- 60-second runs with 2 planes, a plane bonus, a run summary and a saved best score.
- Pixel art, a bitmap font, clouds, smoke and fire. The plane banks as it steers, lowering one wing and showing the side of the body, and tips its nose up to climb or down to dive.
- Recorded sounds for the falling-bomb whistle, timed to each fall, and the explosions: three blasts picked at random, at a slightly different pitch each time. Other sound effects are made in code: engine, flak, bugle calls.

## Files

- `index.html`: page layout
- `game-v1.0.js`: map generation, flying, bombs and the bombsight, blimps, AA guns and flak, scoring, screens and drawing
- `sprites-v1.0.js`: the color palette, pixel-art sprites and the bitmap font
- `sfx-v1.0.js`: sound effects, made with the Web Audio API. Plays the recorded clips below, or coded stand-ins until they're ready
- `bomb-whistle.mp3`, `explosion-1.mp3`, `explosion-2.mp3`, `explosion-3.mp3`: the recorded sounds
- `bomb-whistle-v1.0.js`, `explosion-1-v1.0.js`, `explosion-2-v1.0.js`, `explosion-3-v1.0.js`: the same sounds embedded as base64, so they play when `index.html` is opened straight from disk
- `style-v1.0.css`: page styling

The folder and the `-v1.0` file names include the version number. For a new version:

- Rename the folder and those files.
- Update `VERSION` at the top of the game file.
- Regenerate the embedded sound files from the mp3s.
- Update the `<title>`, heading and script/style links in `index.html`.
- Update the folder name under "How to play" above.
- Add a change log entry.
- Update the link in the main README.

### Test flags

Adding these to the end of the `index.html` address helps with testing. Players don't need them.

- `?autostart`: skip the title screen.
- `?demo`: the plane flies and bombs on its own, and can't be shot down.
- `&t=30`: start 30 seconds into the run.
- `&seed=7`: use the same map every time.
- `&sim=5`: play 5 seconds instantly before the first frame, and put the run's stats in the page title. Used for screenshots in a headless browser.

For example: `index.html?demo&seed=7&t=30&sim=4`.
