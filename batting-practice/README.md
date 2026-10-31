# Batting Practice

A top-down baseball hitting game. Step into the box, time your swing, and try to put the ball where the fielders aren't. Each round is 20 pitches. You score points by placing hits in the shaded zones on the field.

## How to play

Open `index.html` in a browser. Nothing to install and no server needed.

| Key   | Action                              |
|-------|-------------------------------------|
| Space | Start / swing / next round          |
| H     | Switch between right- and left-handed batter |
| P     | Pause / resume (also pauses when the window loses focus) |
| M     | Mute / unmute sound                 |
| R     | Restart the current round           |

## Rules

### Rounds

- A round is **20 pitches**. Only pitches you swing at and don't foul off use one up: fair balls (hits and outs) and swinging strikes.
- **Taken pitches** (balls and called strikes) and **foul balls** don't count, so you get another pitch. The scoreboard shows how many pitches you have left.
- Your score is the total points from your 20 pitches. Nothing takes points away, so a strike or an out just means that pitch scored nothing.
- When the 20th pitch is done, a summary shows:
  - your score
  - your batting average
  - a breakdown by zone
  - your longest hit
  - your earlier rounds

  Press Space to start the next round.

### Batting average and hit stats

- **Batting average** = hits ÷ fair balls put in play (hits plus outs). Fouls, misses and taken pitches don't count. It shows on the scoreboard during the round and on the summary at the end.
- After every batted ball, the banner and the HUD show:
  - the **exit velocity**, how hard the ball came off the bat in mph
  - the **launch angle** in degrees
  - the **hang time**, the seconds until the ball first came down. Hang time is left off for ground balls.
- Your best round is saved in the browser and kept between visits.
- Pressing **R** restarts the current round from pitch 1. The round you abandoned isn't recorded.

### Pitches

- Each pitch is random:
  - **Speed:** slow (about 70 mph), medium (about 82 mph) or fast (about 95 mph).
  - **Location:** one of nine spots, inside/middle/outside × high/middle/low, with a little variation.
  - **Mostly middle height:** 75% of strikes are middle height, 12.5% high and 12.5% low, which gives you more hittable pitches. Every stretch of eight strikes has exactly six middle, one high and one low. Separately, about one pitch in eight misses above or below the zone for a ball.
- The HUD under the field names the pitch once it's thrown, for example "Fast · High-Inside · 94 mph".
- You get **one swing per pitch**.
- If you don't swing, a pitch in the strike zone is a **called strike** and one outside it is a **ball**. Neither scores points.

### Right- or left-handed

- Press **H** to switch sides. The game remembers your choice.
- A **right-handed** batter stands in the third-base-side box. A **left-handed** batter stands in the first-base-side box.
- If you switch during a pitch, the change takes effect before the next pitch.
- Everything about direction flips with the batter:
  - "Inside" means the side of the plate closest to the batter.
  - **Pulling the ball** goes to left field for a righty and to right field for a lefty.
  - **Going the other way** goes to right field for a righty and to left field for a lefty.

### Swinging and contact

- Timing decides whether you hit the ball. The contact window is about **150 ms** wide for slow pitches, shrinking to about **110 ms** for fast ones. Outside the window you swing and miss.
- **Timing also aims the ball:**
  - Right on time sends it up the middle.
  - Early pulls it: to left field for a righty, right field for a lefty.
  - Late pushes it the other way.
  - At the edges of the window it can go foul.
- **Pitch height** sets the launch angle:
  - Low pitches become ground balls.
  - Middle pitches become line drives.
  - High pitches become fly balls and pop-ups.
- **Contact quality** sets how hard the ball comes off the bat. Better timing and pitches over the middle hit harder. Poor contact tops the ball into the ground or pops it up.
- **Inside and outside pitches** are harder to hit squarely. Inside pitches tend to be pulled, outside pitches pushed the other way.
- The panel in the top right shows where the last pitch crossed the plate and a timing meter. The green band is the contact window and the marker is your swing.

### Fair and foul

- The white lines from home plate to the foul poles are the foul lines.
- A ball that lands **past first or third base** is fair or foul depending on where it lands.
- A ball that stays **in front of the bases** is judged by where it passes the bag or comes to rest.
- Foul balls score nothing.

### Scoring zones

The field is shaded to show what each kind of hit is worth:

| Zone | Color | Points | How to earn it |
|------|-------|--------|----------------|
| Infield gap | Blue | +2 | A ground ball that gets between two infielders, or a short ball in the air that drops in before the outfield (a "blooper") |
| Base hit | Light green | +3 | A ball in the air that lands in the outfield without being caught |
| Gapper | Purple | +5 | A hard-hit ball (100+ mph off the bat) that drops in deep, more than 230 ft out, between LF and CF or between CF and RF |
| Down the line | Yellow | +5 | A hit within about 8° of the first- or third-base line, past the infield |
| Off the wall | Orange | +6 | The ball hits the outfield wall on the fly, or bounces over it (a ground-rule double) |
| Home run | Red | +10 | The ball clears the 10-ft wall in fair territory without bouncing |

How a hit is scored:

- **Ground balls** count by where they pass the infielders, about 120 ft from home.
- **Balls in the air** count by where they first land.
- **Balls that roll to the wall** don't count as off the wall. They score by where they first landed.
- **The wall** is 330 ft down each line and 400 ft to center.

### Fielders and outs

Seven imaginary fielders play defense:

- **Infield:** 3B, SS, 2B and 1B.
- **Outfield:** LF, CF and RF.

Each fielder covers an unseen circle of range around his spot, about 22 ft for infielders and 75 ft for outfielders. A ball in the air that lands inside an outfielder's range is caught, and one that lands outside all of them is a hit. There's no pitcher or catcher fielding. All outs score **0 points**:

- **Ground out:** a ground ball hit toward an infielder. He moves over to the ball's path and the ball stops in his glove.
- **Infield out:** a ground ball that stops before it gets past the infielders.
- **Fly out, line out or pop out:** a fielder catches the ball in the air.
  - **Outfielders** catch any ball that would land inside their range.
  - **Hard, low line drives shrink that circle.** The harder the ball is hit (above about 85 mph) and the flatter it's hit (below about 30°), the less time the outfielders have to react. A 110 mph liner cuts their range to just over half.
  - **High flies that hang in the air grow it.** A ball that stays up longer than about 4.5 seconds gives the outfielders time to run farther, up to 40% more range at 6.5 seconds or more.
  - **Infielders** catch short balls in the air (landing within about 150 ft) if they can run there in time. Each reacts in about half a second, then runs about 18–20 ft/s, so the longer a pop-up hangs, the more ground they cover.
- **Easy out:** a short ball in the air that comes down within about 75 ft of home.

A ball that reaches the wall or goes over it can't be caught.

### Throwing the ball back

As in real batting practice, the ball comes back in after every pitch:

- A fielder who caught or fielded the ball already has it. Otherwise the nearest fielder runs to it.
- **Outfielders** throw to the nearest infielder, who relays it to the pitcher.
- **Infielders** throw straight to the pitcher.
- On a **miss or a taken pitch**, the catcher throws it back.
- Home runs and balls into the stands or the backstop aren't chased. The pitcher just takes a new ball.
- The next pitch comes once the pitcher has the ball and a short pause has passed. Fielders jog back to their spots.

### Tips

- Hard line drives shrink the outfielders' range and open up the purple gaps for +5.
- Lay off pitches you don't like. Taken pitches and fouls don't use up any of your 20.
- Aim for the open grass between, in front of, or behind the outfielders. High fly balls are usually caught. Line drives and well-placed grounders are more reliable ways to score.
- Hitting the ball straight up the middle sends it toward CF. Swing a little early or late to aim for the gaps and the lines.
- Middle-high pitches hit squarely are your best chance at the wall or a home run.

## Change log

### 1.7: Hit stats, batting average and counting only real swings

- Every batted ball shows its exit velocity, launch angle and hang time in the banner and the HUD.
- Batting average (hits ÷ balls in play) appears on the scoreboard, the HUD and the end-of-round summary.
- Only fair balls and swinging strikes use up one of the 20 pitches. Taken pitches and fouls are free, and the scoreboard now shows pitches left.
- Strikes now come in at 75% middle height, 12.5% high and 12.5% low, so there are more pitches to drive for hits.
- Fielder range circles are no longer drawn. The range logic is unchanged, including the shrink on hard liners and the growth on high flies.

### 1.6: Throwing the ball back and more range on high flies

- Fielders now throw every ball back to the pitcher. Outfielders relay through the nearest infielder, infielders throw straight to the mound, and the catcher returns missed and taken pitches. The next pitch waits until the pitcher has the ball. Throws and catches have their own sounds.
- The outfield range circles are hidden until the ball is hit. Then they expand (sky blue) for high flies or shrink (gold) for hard liners.
- New +5 "Gapper" zone (purple): a 100+ mph ball that drops in deep between LF and CF or between CF and RF.
- High, middle and low strikes are now evenly spread over each round. High and low pitches stay inside the zone, and about one pitch in eight is a deliberate ball above or below it.

- Fly balls that hang in the air longer than about 4.5 seconds now grow the outfielders' range, by up to 40%. A sky-blue ring shows the bigger range while the ball is in play.

### 1.5: Infielders field grounders

- A ground ball hit at an infielder now stops in his glove instead of rolling on through him.
- The outfielders' shaded circles are now their exact range. A ball in the air that lands inside one is caught, and anything outside them is a hit. The circles are larger (75 ft) and darker so they're easier to see.
- Outfielders pace their run so they reach the ball just as it comes down.
- Hard, low line drives shrink the outfielders' range, down to about 55% for the hardest liners. A gold ring shows the smaller range while that ball is in play.

### 1.4: Left-handed batting and louder hits

- Press H to bat right- or left-handed. The batter, pitch locations, pull direction and the strike-zone panel all mirror, and the choice is remembered.
- The bat crack and the ball-in-flight whistle are louder, and the crack has more low end. A limiter keeps loud moments from distorting.

### 1.3: Outfielders and catches

- Added LF, CF and RF, plus dashed range circles for all seven fielders.
- Fielders now run toward the ball, and a ball they can reach in time is caught in the air. That counts as a fly out, line out or pop out and scores 0.
- More fly balls to the outfield are now outs. Line drives, gap shots and balls down the lines still drop in.
- Short balls that drop in front of the outfield now score +2 as "bloopers".
- The round summary separates caught balls from ground outs.

### 1.2: Scoring and rounds

- Added 20-pitch rounds with a scoreboard, a dot for each pitch left, a color key, a round-over summary and a best score saved between visits.
- Added shaded scoring zones: infield gap +2, base hit +3, down the line +5, off the wall +6, home run +10.
- Added four imaginary infielders. Ground balls hit at them are outs.
- R now restarts the current round. Added an organ riff at the end of each round.
- Ground balls now roll less far, and only balls that hit the wall on the fly count as off the wall.

### 1.1: Pause, closer camera and players

- Added pause (P). The game also pauses on its own when the window loses focus.
- The pitch camera is twice as close.
- More detailed pitcher, batter and catcher:
  - **Pitcher:** a full delivery.
  - **Batter:** strides into the swing with a turning torso and a tapered bat.
  - **Catcher:** crouched, with a mitt that moves to where the pitch crosses.
- Players and home plate are drawn larger than life so they're easy to see.

### 1.0: First release

- A top-down field where the camera follows the ball and zooms out for deep hits.
- Random pitches at three speeds and nine locations.
- Swing timing and pitch location decide where the ball goes. The ball flies, bounces off the ground and the wall, and rolls.
- Foul balls, home runs with fireworks, and a strike-zone and timing panel.
- Sound effects made in code: pitch, swing, hit, ball in flight, ground bounces, wall, catcher's mitt, foul, crowd.

## Files

- `index.html`: page layout and the HUD under the field
- `game.js`: game flow, ball physics, fielders, scoring, camera and drawing
- `sfx.js`: sound effects made with the Web Audio API (no audio files)
