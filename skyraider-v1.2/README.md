# SkyRaider v1.2

A World War I bombing run with 16-bit-style pixel art. Fly a biplane up the screen over farmland, the front-line trenches and army camps, and drop bombs on military targets. Where a bomb lands depends on where you are, when you let go, how fast you're flying and which way the wind is blowing. You have 60 seconds and 2 planes per run.

## How to play

You don't need to install anything. The game is plain HTML, CSS and JavaScript, and it runs in any modern browser.

1. Download [vibegames-main.zip](https://github.com/jgabemartin/vibegames/archive/refs/heads/main.zip), or click the green **Code** button on the repo page, then **Download ZIP**.
2. Unzip it.
3. Open the `skyraider-v1.2` folder and double-click `index.html`.

The game opens on a title screen. Press Enter to see your mission orders, and a march starts playing. Press Enter again to accept the mission and take off.

### Controls

| Key | Action |
|---|---|
| Left / Right (or A / D) | Steer |
| Up / Down (or W / S) | Fly forward up the screen, or drop back |
| Enter | See your mission, then accept it and take off (or fly again) |
| Space | Drop a bomb (or fly again) |
| P | Pause (the game also pauses when the window loses focus) |
| M | Sound on or off (remembered) |

## Rules

### The run

- Each run lasts 60 seconds. The map is new every run, in three parts:
  1. **Farmland:** fields, villages, a river with a bridge, and supply depots. An air-raid siren wails as you fly over each village.
  2. **The front:** two lines of zig-zag trenches with barbed wire, shell-cratered no man's land and artillery behind the lines.
  3. **Army camps:** fenced camps full of tents, trucks, guns and ammo dumps. An alarm sounds as each camp comes into view.
- You get 2 planes. The run ends when time runs out or both planes are shot down.

### Dropping bombs

- Bombs fall straight down from the plane, but they keep most of the plane's forward speed. **Drop before the target reaches you.** The bomb lands close to where the plane is when it hits the ground, slightly behind.
- Every bomb takes 1.4 seconds to land.
- If you're flying forward when you let go, the bomb carries further ahead. If you're dropping back, it lands shorter.
- The **bombsight**, a set of corner marks on the ground ahead of the plane, shows roughly where a bomb dropped right now would land in still air. It moves as you speed up, drop back and steer, but it **ignores the wind**, so aim upwind of the target to allow for drift. It dims while you're out of bombs.
- The falling bomb's shadow shows where it's heading. Bomb and shadow meet where it lands.
- You carry **5 bombs** at a time and can drop them as fast as you can press Space.
- **3 seconds** after your last drop, you're back to a full load of 5. If you still have bombs left, you can keep dropping, but each drop starts the 3 seconds again. If you're out, you have to wait. There's no limit on reloads.
- The **BOMBS** box in the bottom-right corner shows how many bombs you have left, and a bar fills up as the reload counts down. The label turns red when you're out.
- If you're steering when you let go, the bomb keeps half of your sideways speed.

### Wind

- The wind blows left or right. Its strength shifts during the run. The **WIND** box shows the direction and strength, and chimney smoke and camp flags lean with it.
- Bombs drift with the wind as they fall.
- The wind also pushes your plane and the blimps a little.

### Flying forward and back

- Up flies the plane forward, up the screen, as far as about a third of the way down from the top. Down drops it back toward the bottom.
- The plane tips its nose down as it speeds forward and up as it drops back, and the engine revs up when you push forward.
- Flying forward gets you to targets sooner and shows you less of what's coming. Dropping back gives you more warning of flak and blimps.

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

- Each plane still flying at the end of the 60 seconds is worth **+200**.
- Your best score is saved in your browser.

At the end of each run you're awarded a rank for your score:

| Score | Rank |
|---|---|
| Up to 500 | Meritorious Airman |
| 501 to 1000 | Courageous Captain |
| 1001 to 2000 | Squadron Leader |
| 2001 to 3000 | Wing Commander |
| 3001 or more | Supreme Air Marshal |

### Blimps, AA guns and flak

- Barrage blimps float above the map, moored by cables to winches on the ground. They drift with the wind.
- Anti-aircraft guns sit in sandbagged rings on the ground: a couple in the farmland, more at the front and in the camps. Their barrels swing to follow you, and they fire while you're coming toward them.
- Blimp gunners and AA guns fire flak shells. You can see each shell fly toward you, with a smoke trail and a glowing fuse, and it bursts where it stops. Ground shells grow as they climb. Steer away from where a shell is heading.
- A flak burst damages your plane. Each plane survives **1 hit**, and a second hit brings it down.
- Flying into a blimp costs a plane straight away. You fly above the mooring cables, so they're safe.
- Bomb a blimp's winch to bring it down in flames. Bomb an AA gun to silence it.
- There are more blimps, and they fire faster, the further you get.

### Damage and losing a plane

- The two pips next to the plane icons at the top show your plane's condition: green when it's undamaged, and one red pip after a hit.
- A damaged plane pours black smoke with sparks of fire, as a reminder that the next hit is fatal.
- A hit makes the plane blink for a second, while it can't be hit again.
- When a plane goes down, it spins and crashes. The next one flies in from the bottom of the screen and blinks for a couple of seconds, while it can't be hit. The clock keeps running.

### Tips

- Keep steady for a moment before you drop, so the bomb doesn't fly off sideways.
- Quick drops make a stick of bombs along your path, good for a row of tents or a line of trucks. Fly forward while you drop to spread them out. Once all 5 are gone you have 3 seconds with no bombs, so don't waste them.
- A moving truck needs a lead: drop ahead of where it's going.
- Ammo dumps sit among other targets, so one good hit can score several times over.

## Change log

### 1.2: Forward and back flying, mission orders and bigger blasts

- No more altitude. Up and Down now fly the plane forward and back on the screen. A bomb's forward speed comes partly from yours, and every bomb takes the same time to fall. The altitude gauge and score multiplier are gone.
- Bomb loads go up from 3 to 5, shown in a BOMBS box in the bottom-right corner.
- Blimp mooring cables are no longer a hazard.
- A new title screen. Press Enter to see your mission orders on a "TOP SECRET" sheet, then Enter again to accept the mission.
- A march starts with the mission orders and fades out as you take off.
- A rank at the end of each run, from Meritorious Airman up to Supreme Air Marshal, based on your score.
- Bigger bomb blasts, with a shock wave ring, more flying debris and a larger crater. Each crater keeps burning and smoking for several seconds afterwards.

### 1.1: Bomb loads, plane damage, alarms and more recorded sounds

- Bombs come in loads of 3 that drop as fast as you press Space. The load refills 3 seconds after the last drop, shown in a BOMB box by the altitude gauge.
- A plane survives one flak hit and goes down on the second, with a damage meter and a smoke trail once it's hit.
- An alarm and a flashing "ENEMY BASE AHEAD!" warning as each army camp comes into view.
- An air-raid siren starts as you near each village and fades out once it's behind you.
- Down climbs and Up dives, like pulling back and pushing forward on a flight stick.
- Recorded engine sound: skips the clip's first 2 seconds of start-up and loops the rest, revving up as you climb.
- Each flak shot, from a blimp or an AA gun, plays one of two recorded gunshots picked at random.

### 1.0: First release

- Biplane bombing run over farmland, the front and army camps, with a new map every run.
- Bombs keep the plane's forward speed and drift with the wind. Altitude sets the fall time and a score multiplier of up to x2.
- A bombsight shows where a bomb would land in still air.
- Targets: trenches, trucks (some moving), tents, guns, ammo dumps with chain explosions, the bridge and blimp winches. Houses cost points.
- Barrage blimps with mooring cables and flak gunners, and anti-aircraft guns that track the plane. Flak shells are shown flying to their burst.
- 60-second runs with 2 planes, a plane bonus, a run summary and a saved best score.
- Pixel art, a bitmap font, clouds, smoke and fire. The plane banks as it steers, lowering one wing and showing the side of the body, and tips its nose up to climb or down to dive.
- Recorded sounds for the falling-bomb whistle, timed to each fall, and the explosions: three blasts picked at random, at a slightly different pitch each time. Other sound effects are made in code: flak, scoring chimes, bugle calls.

## Files

- `index.html`: page layout
- `game-v1.2.js`: map generation, flying, bombs and the bombsight, blimps, AA guns and flak, scoring, screens and drawing
- `sprites-v1.2.js`: the color palette, pixel-art sprites and the bitmap font
- `sfx-v1.2.js`: sound effects, made with the Web Audio API. Plays the recorded clips below, or coded stand-ins until they're ready. Also plays the title music
- `title-music.mp3`: the march on the title card. It's too long to embed, so it plays from the file through an `<audio>` element, which works from disk
- `engine.mp3`, `bomb-whistle.mp3`, `explosion-1.mp3`, `explosion-2.mp3`, `explosion-3.mp3`, `flak-fire-1.mp3`, `flak-fire-2.mp3`, `base-alarm.mp3`, `siren.mp3`: the recorded sounds
- `engine-v1.2.js`, `bomb-whistle-v1.2.js`, `explosion-1-v1.2.js`, `explosion-2-v1.2.js`, `explosion-3-v1.2.js`, `flak-fire-1-v1.2.js`, `flak-fire-2-v1.2.js`, `base-alarm-v1.2.js`, `siren-v1.2.js`: the same sounds embedded as base64, so they play when `index.html` is opened straight from disk
- `style-v1.2.css`: page styling

The folder and the `-v1.2` file names include the version number. For a new version:

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
- `&hp=1`: each plane starts with only 1 hit left, to see the damage smoke.
- `&sim=5`: play 5 seconds instantly before the first frame, and put the run's stats in the page title. Used for screenshots in a headless browser.

For example: `index.html?demo&seed=7&t=30&sim=4`.
