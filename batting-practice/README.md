# Batting Practice

A top-down batting practice game. Step into the box, time your swing, and watch the ball fly into the field. It bounces and rolls, and with good timing it clears the wall.

## How to play

Open `index.html` in a browser. Nothing to install and no server needed.

| Key   | Action                              |
|-------|-------------------------------------|
| Space | Start / swing                       |
| P     | Pause / resume (also pauses when the window loses focus) |
| M     | Mute / unmute sound                 |
| R     | Reset stats                         |

## How hitting works

- **Timing** matters most. Swing too early or too late and you miss. Slightly early pulls the ball to left field; slightly late pushes it to right. If you're far off, the ball goes foul.
- **Pitch height** sets the launch angle. Low pitches become ground balls, middle pitches become line drives, and high pitches become fly balls and pop-ups. Middle-up pitches are your home run pitches.
- **Pitch speed** adds a little exit velocity, but fast pitches give you a smaller timing window.
- **Inside/outside** pitches are harder to square up and also push the ball's direction.

The panel in the top right shows where the last pitch crossed the plate and a timing meter (the green band is the contact window).

Pitches you don't swing at are called strikes if they're in the zone and balls if they're not.

## Files

- `game.js`: game flow, ball physics, camera, drawing
- `sfx.js`: sound effects made with the Web Audio API (no audio files)
