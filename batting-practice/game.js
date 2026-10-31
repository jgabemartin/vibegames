(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  // ---- World constants (units: feet, seconds) ----
  // Home plate is the origin, +y points to center field, +x toward first base.
  const MPH = 1.4667;
  const G = 32.2;
  const DRAG = 0.0016;
  const STEP = 1 / 120;
  const WALL_H = 10;
  const FOUL_ANGLE = Math.PI / 4;
  const MOUND_Y = 60.5;
  // Players, plate, and batter's boxes are drawn larger than life so they read at this zoom.
  // Home-plate area scales around the plate; the pitcher scales around the mound.
  const HOME_SCALE = 2.3;
  const PITCHER_SCALE = 2.4;
  const RELEASE_LOCAL = { x: -1.0, y: 57.2 }; // pitcher's hand at release, before scaling
  const RELEASE = {
    x: RELEASE_LOCAL.x * PITCHER_SCALE,
    y: MOUND_Y + (RELEASE_LOCAL.y - MOUND_Y) * PITCHER_SCALE,
    z: 6,
  };
  const SWING_DUR = 0.22;
  const CONTACT_DELAY = 0.08; // seconds from keypress until the bat reaches the plate
  const IDLE_CAM = { x: 0, y: 25, zoom: 8.0 }; // tight on the mound-to-plate lane
  const MITT_Y = -2.8 * HOME_SCALE;
  const HOME_DIRT_R = 17; // dirt circle around home, sized to fit the enlarged batter's boxes
  const BASES = [
    { x: 63.64, y: 63.64 },
    { x: 0, y: 127.28 },
    { x: -63.64, y: 63.64 },
  ];
  const ROLL_DECEL = { grass: 22, dirt: 26, track: 32 };
  const BOUNCE = { grass: 0.32, dirt: 0.38, track: 0.36 };

  // ---- Scoring zones ----
  // Angles are degrees from straight-away center (negative = left field).
  const PITCHES_PER_ROUND = 20;
  const OUTFIELD_R = 150; // fly balls landing beyond this are outfield hits
  const INFIELD_CHECK_R = 120; // grounders are judged where they pass the infielders
  const ZONE_INNER_R = 75; // shaded infield zones start beyond the mound
  const LINE_DEG = 37; // within 8° of a foul line counts as down the line
  const FIELDER_DEG = 6; // each imaginary infielder covers ±6°
  // Imaginary fielders. Grounders are judged by the infielders' angles; balls in the air are
  // caught by whoever can run to the spot before it comes down (reaction time + running speed).
  const INFIELDERS = [
    { name: "3B", deg: -31, r: 100, speed: 19, react: 0.45, ring: 22 },
    { name: "SS", deg: -12, r: 140, speed: 20, react: 0.45, ring: 22 },
    { name: "2B", deg: 12, r: 140, speed: 20, react: 0.45, ring: 22 },
    { name: "1B", deg: 31, r: 100, speed: 18, react: 0.45, ring: 22 },
  ];
  const OUTFIELDERS = [
    { name: "LF", deg: -27, r: 280, speed: 25, react: 0.5, ring: 75 },
    { name: "CF", deg: 0, r: 310, speed: 27, react: 0.5, ring: 75 },
    { name: "RF", deg: 27, r: 280, speed: 25, react: 0.5, ring: 75 },
  ];
  const FIELDERS = [...INFIELDERS, ...OUTFIELDERS];
  const CATCH_Z = 5; // fielders catch the ball as it comes down through this height
  const GAPS = [[-25, -18], [-6, 6], [18, 25]];
  // Outfield gaps between LF and CF and between CF and RF: hard-hit balls landing here earn extra
  const OF_GAPS = [[-19, -8], [8, 19]];
  const OF_GAP_R = 230; // gap zone starts this deep
  const GAP_EV = 100; // mph off the bat to count as hard hit
  const ZONES = {
    gap: { label: "IN THE GAP", name: "Infield gap", pts: 2, shade: "rgba(120,190,255,0.28)", color: "#8cc8ff" },
    outfield: { label: "BASE HIT", name: "Base hit", pts: 3, shade: "rgba(255,255,255,0.10)", color: "#e4f5dc" },
    ofgap: { label: "SPLIT THE GAP", name: "Gapper (hard hit)", pts: 5, shade: "rgba(190,140,255,0.22)", color: "#c9a2ff" },
    line: { label: "DOWN THE LINE", name: "Down the line", pts: 5, shade: "rgba(255,214,102,0.30)", color: "#ffd666" },
    wall: { label: "OFF THE WALL", name: "Off the wall", pts: 6, shade: "rgba(255,140,80,0.45)", color: "#ff9a5e" },
    hr: { label: "HOME RUN!", name: "Home run", pts: 10, shade: "rgba(255,90,90,0.20)", color: "#ff6b6b" },
  };
  const LEGEND = ["gap", "outfield", "ofgap", "line", "wall", "hr"]; // scoring zones, in key order
  const BEST_KEY = "battingPractice.bestRound";

  const hud = {
    pitch: document.getElementById("pitch"),
    timing: document.getElementById("timing"),
    result: document.getElementById("result"),
    round: document.getElementById("round"),
    count: document.getElementById("count"),
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    history: document.getElementById("history"),
    sound: document.getElementById("sound"),
    hand: document.getElementById("hand"),
    avg: document.getElementById("avg"),
  };

  // ---- Batter handedness ----
  // Right-handers stand in the third-base box; lefties are mirrored into the first-base box.
  const HAND_KEY = "battingPractice.batterHand";
  let batterHand = "R";
  try {
    if (localStorage.getItem(HAND_KEY) === "L") batterHand = "L";
  } catch (e) { /* storage unavailable */ }
  let pendingHand = null; // a switch requested mid-pitch waits for the next pitch

  function handSide() {
    return batterHand === "R" ? 1 : -1;
  }

  // ---- Helpers ----
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  function gauss() {
    let u = 0;
    while (u === 0) u = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
  }

  function wallDist(theta) {
    return 330 + 70 * Math.cos(2 * theta);
  }
  function angleOf(x, y) {
    return Math.atan2(x, y);
  }
  function polar(r, theta) {
    return { x: r * Math.sin(theta), y: r * Math.cos(theta) };
  }
  function isFair(x, y) {
    return y >= 0 && Math.abs(angleOf(x, y)) <= FOUL_ANGLE;
  }

  // Playing surface outline: outfield wall, foul territory, backstop
  const FIELD = (() => {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const th = -FOUL_ANGLE + (2 * FOUL_ANGLE * i) / 60;
      pts.push(polar(wallDist(th), th));
    }
    const rf = pts[pts.length - 1];
    const lf = pts[0];
    pts.push({ x: rf.x + 28, y: rf.y - 28 });
    for (let i = 0; i <= 20; i++) pts.push(polar(55, Math.PI * 0.75 + (Math.PI * 0.5 * i) / 20));
    pts.push({ x: lf.x - 28, y: lf.y - 28 });
    return pts;
  })();

  function inField(x, y) {
    let inside = false;
    for (let i = 0, j = FIELD.length - 1; i < FIELD.length; j = i++) {
      const a = FIELD[i], b = FIELD[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  function inInnerGrass(x, y) {
    return Math.abs(x) + Math.abs(y - 63.64) <= 49.6;
  }

  function surfaceAt(x, y) {
    const r = Math.hypot(x, y);
    const th = angleOf(x, y);
    if (y > 0 && Math.abs(th) <= FOUL_ANGLE && r > wallDist(th) - 15) return "track";
    if (r < HOME_DIRT_R || Math.hypot(x, y - MOUND_Y) < 9) return "dirt";
    if (Math.hypot(x, y - MOUND_Y) < 95 && Math.abs(th) < FOUL_ANGLE + 0.1 && !inInnerGrass(x, y)) return "dirt";
    return "grass";
  }

  // Which infield zone a direction falls in: down the line, an infielder's area, or a gap
  function infieldZoneAt(d) {
    if (Math.abs(d) >= LINE_DEG) return { kind: "line" };
    const f = INFIELDERS.find((f) => Math.abs(d - f.deg) <= FIELDER_DEG);
    return f ? { kind: "fielder", fielder: f } : { kind: "gap" };
  }

  function fielderHome(f) {
    return polar(f.r, rad(f.deg));
  }

  // Who catches this ball, if anyone. Outfielders catch exactly the balls that land inside
  // their shaded range circles. Infielders handle short balls by whether they can run there in time.
  function findCatch(sim) {
    if (play.launch < 10 || sim.reachesWall || !sim.catchPt) return null;
    const c = sim.catchPt, land = sim.land;
    if (!isFair(land.x, land.y) || !inField(c.x, c.y)) return null;
    let best = null;
    for (const f of OUTFIELDERS) {
      const home = fielderHome(f);
      const d = Math.hypot(land.x - home.x, land.y - home.y);
      if (d <= f.ring * play.rangeK && (!best || d < best.d)) best = { fielder: f, d };
    }
    if (best) return { fielder: best.fielder, x: c.x, y: c.y, t: c.t };
    if (Math.hypot(land.x, land.y) >= OUTFIELD_R) return null;
    for (const f of INFIELDERS) {
      const home = fielderHome(f);
      const need = f.react + Math.hypot(c.x - home.x, c.y - home.y) / f.speed;
      if (need <= c.t && (!best || need < best.need)) best = { fielder: f, need };
    }
    return best && { fielder: best.fielder, x: c.x, y: c.y, t: c.t };
  }

  // The fielder nearest the landing spot chases a ball he can't catch
  function findChaser(sim) {
    if (play.launch < 10 || !isFair(sim.land.x, sim.land.y)) return null;
    let { x, y } = sim.land;
    const r = Math.hypot(x, y), wd = wallDist(angleOf(x, y));
    if (r > wd - 4) {
      x *= (wd - 4) / r;
      y *= (wd - 4) / r;
    }
    let best = null;
    for (const f of OUTFIELDERS) {
      const h = fielderHome(f);
      const d = Math.hypot(x - h.x, y - h.y);
      if (!best || d < best.d) best = { fielder: f, d };
    }
    return best && { fielder: best.fielder, x, y };
  }

  // A grounder hit into an infielder's area: he moves over to the ball's path and fields it there
  function findFielder(b) {
    if (play.launch >= 10) return null;
    const d = toDeg(angleOf(b.vx, b.vy));
    const z = infieldZoneAt(d);
    if (z.kind !== "fielder") return null;
    const home = fielderHome(z.fielder);
    const ux = Math.sin(rad(d)), uy = Math.cos(rad(d));
    const along = (home.x - b.x) * ux + (home.y - b.y) * uy;
    return { fielder: z.fielder, x: b.x + ux * along, y: b.y + uy * along, along, x0: b.x, y0: b.y, ux, uy };
  }

  // How much of an outfielder's circle he covers on this ball. Hard, low line drives give him
  // less time to react (down to 55% for a 110+ mph liner at 10°); high flies that hang in the
  // air give him time to run farther (from 4.5 s of hang time, up to 140% at 6.5 s or more).
  function rangeFactor(ev, launch, hangT) {
    const hard = clamp((ev - 85) / 25, 0, 1);
    const low = clamp((32 - launch) / 22, 0, 1);
    const hang = clamp((hangT - 4.5) / 2, 0, 1);
    return (1 - 0.45 * hard * low) * (1 + 0.4 * hang);
  }

  function fieldingTarget() {
    return play && (play.catch || play.chase || play.field);
  }

  // Where a fielder is drawn right now: at his spot, running toward the ball, or wherever
  // the throw-back left him (he then jogs home)
  function fielderPos(f) {
    if (displaced.has(f)) return displaced.get(f);
    const home = fielderHome(f);
    const target = fieldingTarget();
    if (!target || target.fielder !== f || !(mode === "inplay" || mode === "result")) return home;
    if (play.fielded) return { x: target.x, y: target.y };
    const dx = target.x - home.x, dy = target.y - home.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.01) return home;
    // A catcher paces his run to arrive as the ball comes down; a chaser just runs flat out
    const run = target === play.catch
      ? d * clamp((play.airT - f.react) / Math.max(0.1, target.t - f.react), 0, 1)
      : Math.min(d, Math.max(0, play.airT - f.react) * f.speed);
    return { x: home.x + (dx / d) * run, y: home.y + (dy / d) * run };
  }

  // ---- Throwing the ball back in, like batting practice ----
  // Outfielders hit the nearest infielder as a cutoff; infielders and the catcher throw to the pitcher.
  const PITCHER_GLOVE = { x: 1.2, y: MOUND_Y - 1.5 };
  const CATCHER_HAND = { x: 0, y: MITT_Y };
  const JOG_SPEED = 14; // ft/s, fielders heading back to their spots

  function holderPos(who) {
    if (who === "P") return PITCHER_GLOVE;
    if (who === "C") return CATCHER_HAND;
    return fielderPos(who);
  }

  function nearestFielder(x, y, list) {
    let best = null;
    for (const f of list) {
      const p = fielderPos(f);
      const d = Math.hypot(x - p.x, y - p.y);
      if (!best || d < best.d) best = { f, d };
    }
    return best.f;
  }

  // Once the ball is dead, decide who brings it back in
  function startReturn() {
    for (const f of FIELDERS) {
      const p = fielderPos(f);
      displaced.set(f, { x: p.x, y: p.y });
    }
    if (!play) {
      // Missed or taken pitch: the catcher throws it back
      ret = { phase: "hold", holder: "C", legs: ["P"], t: 0 };
      ball = { x: CATCHER_HAND.x, y: CATCHER_HAND.y, z: 3, vx: 0, vy: 0, vz: 0, phase: "held" };
      return;
    }
    // Home runs and balls in the stands or behind the plate: the pitcher takes a new ball
    if (play.decided === "hr" || !inField(ball.x, ball.y) || ball.y < 10) {
      ret = { phase: "done", t: 0, newBall: true };
      ball = null;
      return;
    }
    let holder, phase = "hold";
    if (play.decided === "out") holder = play.catch.fielder;
    else if (play.fielded) holder = play.field.fielder;
    else {
      holder = nearestFielder(ball.x, ball.y, FIELDERS);
      phase = "fetch";
    }
    const legs = OUTFIELDERS.includes(holder) ? [nearestFielder(ball.x, ball.y, INFIELDERS), "P"] : ["P"];
    ret = { phase, holder, legs, t: 0 };
  }

  function throwTo(target) {
    const from = holderPos(ret.holder), to = holderPos(target);
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    const speed = ret.holder === "C" ? 75 : OUTFIELDERS.includes(ret.holder) ? 125 : 100;
    Object.assign(ret, {
      phase: "throw",
      from: { x: from.x, y: from.y, z: ball.z },
      target,
      dur: Math.max(0.4, d / speed),
      peak: Math.min(30, d * 0.07),
      holder: null,
      t: 0,
      steps: 0,
    });
    trail = [];
    Sfx.throwBall();
  }

  function stepReturn(dt) {
    ret.t += dt;
    if (ret.phase === "fetch") {
      const p = displaced.get(ret.holder);
      const dx = ball.x - p.x, dy = ball.y - p.y, d = Math.hypot(dx, dy);
      const step = ret.holder.speed * 1.2 * dt;
      if (d <= step) {
        p.x = ball.x;
        p.y = ball.y;
        ret.phase = "hold";
        ret.t = 0;
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    } else if (ret.phase === "hold") {
      const p = holderPos(ret.holder);
      Object.assign(ball, { x: p.x, y: p.y, z: ret.holder === "C" ? 3 : 4 });
      if (ret.t >= 0.35) throwTo(ret.legs.shift());
    } else if (ret.phase === "throw") {
      const u = Math.min(1, ret.t / ret.dur);
      const to = holderPos(ret.target); // follow the receiver so it ends in his glove
      ball.x = lerp(ret.from.x, to.x, u);
      ball.y = lerp(ret.from.y, to.y, u);
      ball.z = lerp(ret.from.z, 5, u) + ret.peak * 4 * u * (1 - u);
      if (++ret.steps % 3 === 0) {
        trail.push({ x: ball.x, y: ball.y, z: ball.z });
        if (trail.length > 30) trail.shift();
      }
      if (u >= 1) {
        Sfx.glove();
        trail = [];
        if (ret.target === "P") {
          ret = { phase: "done", t: 0 };
          ball = null;
        } else {
          ret.holder = ret.target;
          ret.target = null;
          ret.phase = "hold";
          ret.t = 0;
        }
      }
    }
  }

  // Fielders not handling the ball jog back to their spots
  function walkHome(dt) {
    for (const [f, p] of displaced) {
      if (ret && (f === ret.holder || f === ret.target)) continue;
      const h = fielderHome(f);
      const dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy);
      const step = JOG_SPEED * dt;
      if (d <= step) displaced.delete(f);
      else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
  }

  // ---- Game state ----
  const round = { num: 0, score: 0, pitch: 0, counts: {}, longest: 0 };
  const history = [];
  let best = 0;
  try {
    best = Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch (e) { /* storage unavailable (e.g. file:// in some browsers) */ }
  let scorePop = null; // floating "+N" on the scoreboard
  const cam = { ...IDLE_CAM };
  let mode = "title"; // title, ready, windup, pitch, inplay, result, roundover
  let modeT = 0;
  let resultDur = 2;
  let pitch = null;
  let ball = null;
  let play = null;
  let ret = null; // ball being thrown back to the pitcher
  const displaced = new Map(); // fielder -> where he is while away from his spot
  let swingT = -1; // time since swing started, -1 = in stance
  let trail = [];
  let banner = null;
  let particles = [];
  let fireworkTimer = 0;
  let lastZone = null;
  let lastTiming = null;
  let paused = false;

  // Pitch heights come from a shuffled bag of 20. Each round picks its own share of middle-height
  // strikes between 50% and 75%; the rest are split evenly between high and low.
  const BALL_CHANCE = 0.12; // share of pitches thrown above or below the zone
  const MID_SHARE = [0.5, 0.75];
  let midShare = 0.75;
  let rowBag = [];
  function nextRow() {
    if (!rowBag.length) {
      const n = 20;
      const mid = Math.round(n * midShare);
      let high = Math.floor((n - mid) / 2);
      if ((n - mid) % 2 && Math.random() < 0.5) high++;
      const low = n - mid - high;
      rowBag = [...Array(low).fill(-1), ...Array(mid).fill(0), ...Array(high).fill(1)];
      for (let i = rowBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rowBag[i], rowBag[j]] = [rowBag[j], rowBag[i]];
      }
    }
    return rowBag.pop();
  }

  function newPitch() {
    const types = [
      { name: "Slow", mph: 70 },
      { name: "Medium", mph: 82 },
      { name: "Fast", mph: 95 },
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    const mph = Math.round(type.mph + rand(-2, 2));
    const hBase = [-1, 0, 1][Math.floor(Math.random() * 3)];
    const h = hBase + rand(-0.35, 0.35);
    let vBase, v;
    if (Math.random() < BALL_CHANCE) {
      // A pitch that misses up or down, outside the zone (doesn't use up a row from the bag)
      vBase = Math.random() < 0.5 ? -1 : 1;
      v = vBase * rand(1.2, 1.45);
    } else {
      // Stays inside its row of the strike zone
      vBase = nextRow();
      v = vBase === 0 ? rand(-0.35, 0.35) : vBase * rand(0.6, 1.05);
    }
    const hName = ["Inside", "Middle", "Outside"][hBase + 1];
    const vName = ["Low", "Middle", "High"][vBase + 1];
    const where = hBase === 0 && vBase === 0 ? "Down the middle" : `${vName}-${hName}`;
    return {
      mph,
      h,
      v,
      label: `${type.name} · ${where} · ${mph} mph`,
      row: Math.abs(v) <= 1.1 ? vBase : null, // bag row, handed back if the pitch is re-aimed
      side: handSide(),
      xp: handSide() * h * 0.75 * HOME_SCALE, // "inside" is toward the batter's box
      zp: 2.5 + v * 0.9,
      breakX: rand(-0.8, 0.8),
      T: RELEASE.y / (mph * MPH),
      windowMs: 150 - (mph - 70) * 1.6,
      t: 0,
      swung: false,
      contactAt: null,
      err: null,
    };
  }

  function pitchPos(p, t) {
    const u = t / p.T;
    const curve = u <= 1 ? u * (1 - u) : 0;
    return {
      x: lerp(RELEASE.x, p.xp, u) + p.breakX * curve,
      y: lerp(RELEASE.y, 0, u),
      z: lerp(RELEASE.z, p.zp, u) + 2 * curve,
    };
  }

  function inZone(p) {
    return Math.abs(p.h) <= 1.1 && Math.abs(p.v) <= 1.1;
  }

  // ---- Flow ----
  function setMode(m) {
    mode = m;
    modeT = 0;
  }

  function startRound() {
    round.num++;
    round.score = 0;
    round.pitch = 0;
    round.longest = 0;
    round.counts = { hr: 0, wall: 0, line: 0, ofgap: 0, outfield: 0, gap: 0, flyout: 0, out: 0, foul: 0, strike: 0, ball: 0 };
    banner = null;
    scorePop = null;
    particles = [];
    fireworkTimer = 0;
    lastZone = null;
    lastTiming = null;
    ret = null;
    displaced.clear();
    rowBag = [];
    midShare = rand(MID_SHARE[0], MID_SHARE[1]); // this round's share of middle-height strikes
    Sfx.stopFlight();
    updateHud();
    startReady();
  }

  function endRound() {
    history.push(round.score);
    round.newBest = round.score > best;
    if (round.newBest) {
      best = round.score;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (e) { /* ignore */ }
    }
    banner = null;
    ball = null;
    play = null;
    ret = null;
    Sfx.roundOver();
    updateHud();
    setMode("roundover");
  }

  function applyHand(hand) {
    batterHand = hand;
    pendingHand = null;
    try {
      localStorage.setItem(HAND_KEY, hand);
    } catch (e) { /* ignore */ }
    updateHud();
  }

  // H key: switch sides. Takes effect now if no pitch is live, otherwise before the next pitch.
  function toggleHand() {
    const next = (pendingHand || batterHand) === "R" ? "L" : "R";
    const word = next === "R" ? "RIGHT-HANDED" : "LEFT-HANDED";
    if (mode === "title" || mode === "roundover" || mode === "result" || mode === "ready") {
      applyHand(next);
      // A pitch that hasn't been thrown yet is re-aimed for the new side
      if (mode === "ready") {
        if (pitch.row !== null) rowBag.push(pitch.row);
        pitch = newPitch();
      }
      if (mode !== "title" && mode !== "roundover") showBanner(`BATTING ${word}`, "", "#ffffff");
    } else {
      pendingHand = next === batterHand ? null : next;
      showBanner(pendingHand ? `${word} NEXT PITCH` : `STAYING ${batterHand === "R" ? "RIGHT" : "LEFT"}-HANDED`, "", "#ffffff");
    }
  }

  function startReady() {
    if (pendingHand) applyHand(pendingHand);
    pitch = newPitch();
    ball = null;
    play = null;
    ret = null;
    trail = [];
    swingT = -1;
    setMode("ready");
  }

  function releasePitch() {
    Sfx.pitchRelease();
    const pos = pitchPos(pitch, 0);
    ball = { ...pos, vx: 0, vy: 0, vz: 0, phase: "pitch" };
    hud.pitch.textContent = pitch.label;
    setMode("pitch");
  }

  function trySwing(nowMs) {
    if (!(mode === "windup" || mode === "pitch") || pitch.swung) return;
    pitch.swung = true;
    swingT = 0;
    Sfx.swing();
    if (mode === "windup") {
      lastTiming = { errMs: -999, windowMs: pitch.windowMs };
      hud.timing.textContent = "Way early";
      return;
    }
    // Interpolate between fixed steps for precise timing
    const t = pitch.t + Math.max(0, (nowMs - simWallTime) / 1000);
    const contactT = t + CONTACT_DELAY;
    const err = contactT - pitch.T;
    const errMs = err * 1000;
    lastTiming = { errMs, windowMs: pitch.windowMs };
    hud.timing.textContent = timingText(errMs);
    if (Math.abs(errMs) < pitch.windowMs) {
      pitch.contactAt = contactT;
      pitch.err = err;
    }
  }

  function timingText(errMs) {
    const ms = Math.round(Math.abs(errMs));
    if (ms <= 20) return "Perfect!";
    return errMs < 0 ? `Early ${ms} ms` : `Late ${ms} ms`;
  }

  function doContact() {
    const p = pitch;
    const errMs = p.err * 1000;
    const timingQ = 1 - Math.abs(errMs) / p.windowMs;
    const locQ = 1 - 0.12 * Math.min(1.3, Math.abs(p.h)) - 0.08 * Math.min(1.3, Math.abs(p.v));
    const quality = clamp(timingQ * locQ, 0, 1);

    let ev = 58 + 46 * quality + p.mph * 0.12;
    // Early pulls and inside pitches get pulled: to left field for a righty, right field for a lefty
    let spray = p.side * (errMs * 0.33 + p.h * 10) + gauss() * 5;
    let launch = 20 + p.v * 22 + gauss() * 6;

    if (quality < 0.3) {
      if (Math.random() < 0.55) {
        launch = -12 + gauss() * 6; // topped into the ground
        ev *= 0.8;
      } else {
        launch = 58 + gauss() * 10; // got under it
        ev *= 0.85;
      }
    }
    if (quality < 0.1 && Math.random() < 0.4) {
      // Foul tip straight back
      spray = (Math.random() < 0.5 ? -1 : 1) * rand(110, 160);
      launch = rand(10, 45);
      ev *= 0.7;
    }

    const pos = pitchPos(p, Math.min(p.contactAt, p.T));
    const speed = ev * MPH;
    const sr = rad(spray), lr = rad(launch);
    ball = {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vx: speed * Math.cos(lr) * Math.sin(sr),
      vy: speed * Math.cos(lr) * Math.cos(sr),
      vz: speed * Math.sin(lr),
      phase: "air",
    };
    play = {
      ev,
      launch,
      spray,
      quality,
      decided: null,
      firstLand: null,
      bounced: false,
      wallFirst: false,
      groundRule: false,
      pastWall: false,
      bounces: 0,
      steps: 0,
      endTimer: null,
      hrDist: 0,
      airT: 0, // seconds since contact
      catch: null,
      chase: null,
      field: null, // grounder an infielder will field
      fielded: false,
      rangeK: 1, // outfield range on this ball, as a share of the full circle
    };
    lastZone = { h: p.h, v: p.v, color: "#5fdc7a" };
    Sfx.hit(quality);

    displaced.clear(); // everyone is set for the new ball
    const sim = presim(ball);
    play.rangeK = rangeFactor(ev, launch, sim.t);
    play.catch = findCatch(sim);
    if (!play.catch) play.chase = findChaser(sim);
    play.field = findFielder(ball);
    const flightT = play.catch ? play.catch.t : sim.t;
    if (launch > 4 && flightT > 0.5) Sfx.ballFlight(flightT, Math.min(1, sim.apex / flightT));
    setMode("inplay");
  }

  // Fly the ball ahead of time (same steps as the real flight) to find where it comes down
  function presim(b) {
    const s = { ...b };
    let t = 0, apex = 0, catchPt = null, reachesWall = false;
    while (t < 12) {
      airStep(s, STEP);
      t += STEP;
      if (!apex && s.vz <= 0) apex = t;
      if (!catchPt && s.vz < 0 && s.z <= CATCH_Z) catchPt = { x: s.x, y: s.y, t };
      if (!reachesWall && isFair(s.x, s.y) && Math.hypot(s.x, s.y) >= wallDist(angleOf(s.x, s.y))) reachesWall = true;
      if (s.z <= 0 && s.vz < 0) break;
    }
    return { t, apex: apex || t / 2, land: { x: s.x, y: s.y }, catchPt, reachesWall };
  }

  function airStep(b, dt) {
    const s = Math.hypot(b.vx, b.vy, b.vz);
    b.vx += -DRAG * s * b.vx * dt;
    b.vy += -DRAG * s * b.vy * dt;
    b.vz += (-G - DRAG * s * b.vz) * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
  }

  function decide(kind) {
    if (play.decided) return;
    play.decided = kind;
    if (kind === "foul") {
      Sfx.foul();
      showBanner("FOUL BALL", "", "#ffd75e");
      play.endTimer = 2.2;
    } else if (kind === "hr") {
      Sfx.homeRun();
      showBanner("HOME RUN!", "", "#ff7a45", true);
      fireworkTimer = 2.8;
    }
  }

  function decideByPosition() {
    decide(isFair(ball.x, ball.y) ? "fair" : "foul");
  }

  // Ball off the outfield wall (or rolling into it)
  function checkWall() {
    const r = Math.hypot(ball.x, ball.y);
    const th = angleOf(ball.x, ball.y);
    if (play.pastWall || ball.y <= 0 || Math.abs(th) > FOUL_ANGLE) return;
    const wd = wallDist(th);
    if (r < wd) return;
    if (ball.z > WALL_H) {
      play.pastWall = true;
      if (play.decided === "foul") return;
      if (play.bounced) {
        play.groundRule = true;
        decide("fair");
      } else {
        decide("hr");
      }
      return;
    }
    const nx = ball.x / r, ny = ball.y / r;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn > 0) {
      ball.vx -= 1.45 * vn * nx;
      ball.vy -= 1.45 * vn * ny;
      ball.vz *= 0.8;
      Sfx.wallHit();
      if (!play.firstLand && !play.decided) {
        play.wallFirst = true;
        play.firstLand = { x: ball.x, y: ball.y, dist: wd };
        play.hang = play.airT;
      }
      if (!play.decided) decide("fair");
    }
    ball.x = nx * (wd - 0.5);
    ball.y = ny * (wd - 0.5);
  }

  function stepBall(dt) {
    play.airT += dt;
    // A fielder gets under it: the ball stops in his glove
    if (play.catch && ball.phase === "air" && play.airT >= play.catch.t - 1e-6) {
      airStep(ball, dt);
      ball.vx = ball.vy = ball.vz = 0;
      ball.z = 0; // drawn tucked in at the fielder
      ball.phase = "stopped";
      play.decided = "out";
      play.hang = play.airT;
      Sfx.stopFlight();
      Sfx.catcherMitt();
      return;
    }
    // A grounder reaches the infielder playing it: it stops in his glove
    const fd = play.field;
    if (fd && (ball.x - fd.x0) * fd.ux + (ball.y - fd.y0) * fd.uy >= fd.along) {
      ball.x = fd.x;
      ball.y = fd.y;
      ball.z = 0;
      ball.vx = ball.vy = ball.vz = 0;
      ball.phase = "stopped";
      play.fielded = true;
      if (!play.decided) play.decided = "fair";
      Sfx.stopFlight();
      Sfx.catcherMitt();
      return;
    }
    // Remember which way the ball was heading as it passed the infielders
    if (!play.infieldCross && Math.hypot(ball.x, ball.y) >= INFIELD_CHECK_R) {
      play.infieldCross = { deg: toDeg(angleOf(ball.x, ball.y)) };
    }
    if (ball.phase === "air") {
      airStep(ball, dt);
      if (++play.steps % 3 === 0) {
        trail.push({ x: ball.x, y: ball.y, z: ball.z });
        if (trail.length > 70) trail.shift();
      }
      checkWall();

      if (ball.z <= 0 && ball.vz < 0) {
        ball.z = 0;
        const impact = -ball.vz;
        const dist = Math.hypot(ball.x, ball.y);
        if (!play.firstLand) {
          play.firstLand = { x: ball.x, y: ball.y, dist };
          play.hang = play.airT;
        }

        if (!inField(ball.x, ball.y)) {
          // Landed in the stands
          if (play.decided === "hr") {
            play.hrDist = dist;
            if (banner) banner.sub = `${Math.round(dist)} ft`;
          } else {
            decideByPosition();
          }
          Sfx.groundImpact(0.25);
          ball.phase = "stopped";
          return;
        }

        if (!play.decided && dist > 95) decideByPosition();
        Sfx.groundImpact(Math.min(1, impact / 70) * Math.pow(0.75, play.bounces));
        play.bounced = true;
        play.bounces++;

        const surf = surfaceAt(ball.x, ball.y);
        ball.vz = impact * BOUNCE[surf];
        ball.vx *= 0.72;
        ball.vy *= 0.72;
        if (ball.vz < 5) {
          ball.vz = 0;
          ball.phase = "roll";
        }
      }
    } else if (ball.phase === "roll") {
      const s = Math.hypot(ball.vx, ball.vy);
      const surf = surfaceAt(ball.x, ball.y);
      const ns = Math.max(0, s - ROLL_DECEL[surf] * dt);
      if (ns < 0.4) {
        ball.phase = "stopped";
        ball.vx = ball.vy = 0;
        return;
      }
      ball.vx *= ns / s;
      ball.vy *= ns / s;
      const px = ball.x, py = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (!play.decided && Math.hypot(ball.x, ball.y) > 90) decideByPosition();
      checkWall();
      if (!inField(ball.x, ball.y)) {
        ball.x = px;
        ball.y = py;
        ball.phase = "stopped";
      }
    }
  }

  // Decide which scoring zone a finished batted ball earned.
  // Returns { zone, label } where zone is a ZONES key, or null for no points.
  function scorePlay() {
    if (play.decided === "out") {
      const name = play.catch.fielder.name;
      if (play.launch >= 50) return { zone: null, label: `POP OUT TO ${name}` };
      if (play.launch < 22) return { zone: null, label: `LINED OUT TO ${name}` };
      return { zone: null, label: `FLY OUT TO ${name}` };
    }
    if (play.decided === "hr") return { zone: "hr", label: ZONES.hr.label };
    if (play.decided === "foul") return { zone: null, label: "FOUL BALL" };
    // Only balls that reach the wall on the fly count; rollers to the wall are scored where they landed
    if (play.wallFirst || play.groundRule) return { zone: "wall", label: ZONES.wall.label };

    if (play.fielded) return { zone: null, label: `GROUNDED OUT TO ${play.field.fielder.name}` };
    if (play.launch < 10) {
      // Grounders count by where they got past the infielders
      const c = play.infieldCross;
      if (!c) return { zone: null, label: "INFIELD OUT" };
      const z = infieldZoneAt(c.deg);
      if (z.kind === "fielder") return { zone: null, label: `GROUNDED OUT TO ${z.fielder.name}` };
      return { zone: z.kind, label: ZONES[z.kind].label };
    }

    // Balls in the air count by where they first land
    const f = play.firstLand;
    if (!f) return { zone: null, label: "OUT" };
    const d = toDeg(angleOf(f.x, f.y));
    if (f.dist >= OUTFIELD_R) {
      const gapper = play.ev >= GAP_EV && f.dist >= OF_GAP_R && OF_GAPS.some(([a, b]) => d >= a && d <= b);
      const zone = Math.abs(d) >= LINE_DEG ? "line" : gapper ? "ofgap" : "outfield";
      return { zone, label: ZONES[zone].label };
    }
    // Short ball nobody could reach: dropped in front of the outfielders
    if (f.dist < ZONE_INNER_R) return { zone: null, label: "EASY OUT" };
    const z = infieldZoneAt(d);
    if (z.kind === "line") return { zone: "line", label: ZONES.line.label };
    return { zone: "gap", label: z.kind === "fielder" ? "BLOOPER" : ZONES.gap.label };
  }

  function hitDescription(dist) {
    if (play.groundRule) return "Ground-rule double";
    if (play.launch < 10) return "Ground ball";
    if (play.launch < 25) return "Line drive";
    if (play.launch < 50) return dist > 300 ? "Deep fly ball" : "Fly ball";
    return "Pop up";
  }

  function addScore(pts) {
    round.score += pts;
    if (pts > 0) scorePop = { pts, t: 0 };
    updateHud();
  }

  function finishPlay() {
    Sfx.stopFlight();
    if (!play.decided) decideByPosition();
    const res = scorePlay();
    const pts = res.zone ? ZONES[res.zone].pts : 0;
    const ptsText = pts > 0 ? `+${pts}` : "No points";
    let dist;

    if (play.decided === "hr") {
      dist = Math.round(play.hrDist || Math.hypot(ball.x, ball.y));
      if (banner) banner.sub = `+${pts} · ${dist} ft`;
      resultDur = 3.5;
    } else if (play.decided === "foul") {
      if (banner) banner.sub = `${ptsText} · doesn't use a pitch`;
      resultDur = 1.6;
    } else {
      const grounder = play.launch < 10;
      dist = Math.round(grounder || !play.firstLand ? Math.hypot(ball.x, ball.y) : play.firstLand.dist);
      const color = res.zone ? ZONES[res.zone].color : "#cfd3da";
      showBanner(res.label, `${ptsText} · ${hitDescription(dist)}, ${dist} ft`, color);
      resultDur = 2.4;
    }
    // Exit velocity, launch angle and hang time (ground balls have no real hang time)
    const stats = `${Math.round(play.ev)} mph · exit angle ${Math.round(play.launch)}°` +
      (play.launch >= 10 && play.hang ? ` · ${play.hang.toFixed(1)} s hang` : "");
    if (banner) banner.stats = stats;

    if (res.zone) round.counts[res.zone]++;
    else if (play.decided === "foul") round.counts.foul++;
    else if (play.decided === "out") round.counts.flyout++;
    else round.counts.out++;
    if (dist && play.decided !== "foul") round.longest = Math.max(round.longest, dist);
    if (play.decided !== "foul") round.pitch++; // fouls don't use up a pitch

    const label = (res.label.charAt(0) + res.label.slice(1).toLowerCase().replace("!", ""))
      .replace(/\b(lf|cf|rf|ss|1b|2b|3b)\b/g, (m) => m.toUpperCase());
    hud.result.textContent = `${label}${dist ? `, ${dist} ft` : ""} (${pts > 0 ? `+${pts}` : "0"}) · ${stats}`;
    addScore(pts);
    setMode("result");
  }

  function finishMiss() {
    Sfx.catcherMitt();
    ball = null;
    if (pitch.swung) {
      round.counts.strike++;
      round.pitch++; // only swings use up a pitch; taken pitches don't
      showBanner("STRIKE!", "Swing and a miss", "#ff6b6b");
      hud.result.textContent = "Swinging strike";
      lastZone = { h: pitch.h, v: pitch.v, color: "#ff6b6b" };
    } else if (inZone(pitch)) {
      round.counts.strike++;
      showBanner("STRIKE!", "Caught looking · doesn't use a pitch", "#ff6b6b");
      hud.result.textContent = "Called strike";
      hud.timing.textContent = "No swing";
      lastTiming = null;
      lastZone = { h: pitch.h, v: pitch.v, color: "#ff6b6b" };
    } else {
      round.counts.ball++;
      showBanner("BALL", "Good eye · doesn't use a pitch", "#8fd3ff");
      hud.result.textContent = "Ball";
      hud.timing.textContent = "No swing";
      lastTiming = null;
      lastZone = { h: pitch.h, v: pitch.v, color: "#8fd3ff" };
    }
    updateHud();
    resultDur = 1.4;
    setMode("result");
  }

  // Batting average: hits divided by fair balls put in play (hits + outs). Fouls, misses and takes don't count.
  function battingAvg() {
    const c = round.counts;
    const hits = LEGEND.reduce((n, k) => n + (c[k] || 0), 0);
    const ab = hits + (c.flyout || 0) + (c.out || 0);
    const avg = ab ? hits / ab : 0;
    return { hits, ab, text: avg >= 1 ? "1.000" : avg.toFixed(3).slice(1) };
  }

  function updateHud() {
    hud.round.textContent = round.num || "-";
    hud.count.textContent = `${round.pitch} / ${PITCHES_PER_ROUND}`;
    if (hud.avg) hud.avg.textContent = battingAvg().text;
    hud.score.textContent = round.score;
    hud.best.textContent = best;
    hud.history.textContent = history.length ? history.join(", ") : "--";
    if (hud.hand) hud.hand.textContent = batterHand === "R" ? "Right" : "Left";
  }

  function showBanner(text, sub, color, big = false) {
    banner = { text, sub, color, big, t: 0 };
  }

  // ---- Fixed-step update ----
  function update(dt) {
    modeT += dt;
    if (swingT >= 0) swingT += dt;
    if (banner) banner.t += dt;
    if (scorePop) scorePop.t += dt;
    walkHome(dt);

    switch (mode) {
      case "ready":
        if (modeT > 1.2) {
          banner = null;
          setMode("windup");
        }
        break;
      case "windup":
        if (modeT > 0.7) releasePitch();
        break;
      case "pitch":
        pitch.t += dt;
        if (pitch.contactAt !== null && pitch.t >= pitch.contactAt) {
          doContact();
          break;
        }
        // Ball settles in the mitt; stay live until the late-swing window closes
        Object.assign(ball, pitchPos(pitch, pitch.t));
        if (ball.y < MITT_Y) Object.assign(ball, { x: pitch.xp, y: MITT_Y, z: pitch.zp });
        if (pitch.contactAt === null && pitch.t >= pitch.T + pitch.windowMs / 1000) finishMiss();
        break;
      case "inplay":
        stepBall(dt);
        if (play.endTimer !== null) play.endTimer -= dt;
        if (ball.phase === "stopped" && play.decided !== "hr" && play.decided !== "foul") finishPlay();
        else if (ball.phase === "stopped" && play.decided === "hr") {
          if (play.endTimer === null) play.endTimer = 1.0;
        }
        if ((play.endTimer !== null && play.endTimer <= 0) || (ball.phase === "stopped" && play.decided === "foul") || modeT > 14) {
          finishPlay();
        }
        break;
      case "result":
        // Let the ball finish rolling, then the fielders throw it back to the pitcher
        if (!ret) {
          if (play && ball && ball.phase !== "stopped") stepBall(dt);
          else startReturn();
        } else if (ret.phase !== "done") stepReturn(dt);
        else ret.t += dt;
        // Next pitch once the banner has shown and the pitcher has had the ball a moment
        if ((modeT > resultDur && ret && ret.phase === "done" && ret.t >= (ret.newBall ? 0.6 : 0.3)) || modeT > 25) {
          if (round.pitch >= PITCHES_PER_ROUND) endRound();
          else startReady();
        }
        break;
    }
  }

  function updateCamera(dt) {
    let tx = IDLE_CAM.x, ty = IDLE_CAM.y, tz = IDLE_CAM.zoom;
    if (play && ball && (mode === "inplay" || mode === "result")) {
      const d = Math.hypot(ball.x, ball.y);
      const lead = ball.phase === "stopped" ? 0 : Math.hypot(ball.vx, ball.vy) * 0.5;
      tz = clamp(H / ((d + lead) * 1.3 + 150), 1.2, IDLE_CAM.zoom);
      tx = ball.x * 0.6;
      ty = IDLE_CAM.y + (ball.y - IDLE_CAM.y) * 0.6;
    }
    const k = 1 - Math.exp(-dt * 2.5);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.zoom += (tz - cam.zoom) * k;
  }

  function updateParticles(dt) {
    if (fireworkTimer > 0) {
      fireworkTimer -= dt;
      if (Math.random() < dt * 4) {
        const cx = rand(120, W - 120), cy = rand(80, 260);
        const color = ["#ff5e5e", "#ffd75e", "#5ee1ff", "#b07bff", "#7dff8a"][Math.floor(Math.random() * 5)];
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * Math.PI * 2, s = rand(60, 200);
          particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.2, color });
        }
      }
    }
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.vx *= 0.98;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  // ---- Rendering ----
  function worldTransform() {
    ctx.setTransform(cam.zoom, 0, 0, -cam.zoom, W / 2 - cam.x * cam.zoom, H / 2 + cam.y * cam.zoom);
  }
  function toScreen(x, y) {
    return { x: W / 2 + (x - cam.x) * cam.zoom, y: H / 2 - (y - cam.y) * cam.zoom };
  }
  function polyPath(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }
  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }

  function drawField() {
    const px = 1 / cam.zoom;

    // Stands
    ctx.fillStyle = "#2b303a";
    ctx.fillRect(-2000, -2000, 4000, 4000);
    ctx.lineWidth = 3;
    for (let r = 60; r < 560; r += 9) {
      ctx.strokeStyle = (r / 9) % 2 < 1 ? "#353b47" : "#30353f";
      circle(0, 0, r);
      ctx.stroke();
    }

    // Grass with mowing stripes
    ctx.save();
    polyPath(FIELD);
    ctx.fillStyle = "#3f8f3a";
    ctx.fill();
    ctx.clip();
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#469b40";
    for (let s = -600; s < 600; s += 30) ctx.fillRect(s, -600, 15, 1200);
    ctx.restore();

    // Warning track
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const th = -FOUL_ANGLE + (2 * FOUL_ANGLE * i) / 60;
      const p = polar(wallDist(th), th);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    for (let i = 60; i >= 0; i--) {
      const th = -FOUL_ANGLE + (2 * FOUL_ANGLE * i) / 60;
      const p = polar(wallDist(th) - 15, th);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = "#b5854f";
    ctx.fill();

    // Infield dirt
    const dirt = "#c4935a";
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const a = polar(250, -FOUL_ANGLE - 0.1), b = polar(250, FOUL_ANGLE + 0.1);
    ctx.lineTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = dirt;
    circle(0, MOUND_Y, 95);
    ctx.fill();
    ctx.restore();

    // Infield grass
    ctx.fillStyle = "#469b40";
    polyPath([{ x: 0, y: 14 }, { x: 49.6, y: 63.64 }, { x: 0, y: 113.2 }, { x: -49.6, y: 63.64 }]);
    ctx.fill();

    // Home plate circle and mound
    ctx.fillStyle = dirt;
    circle(0, 0, HOME_DIRT_R);
    ctx.fill();
    circle(0, MOUND_Y, 9);
    ctx.fill();
    ctx.fillStyle = "#b8864f";
    circle(0, MOUND_Y, 5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-1, MOUND_Y - 0.25, 2, 0.5);

    drawZones();

    // Foul lines
    ctx.strokeStyle = "#f4f4f4";
    ctx.lineWidth = Math.max(0.4, 1.5 * px);
    const lf = polar(wallDist(-FOUL_ANGLE), -FOUL_ANGLE);
    const rf = polar(wallDist(FOUL_ANGLE), FOUL_ANGLE);
    ctx.beginPath();
    ctx.moveTo(lf.x, lf.y);
    ctx.lineTo(0, 0);
    ctx.lineTo(rf.x, rf.y);
    ctx.stroke();

    // Batter's boxes and home plate (drawn at the same exaggerated scale as the players)
    const s = HOME_SCALE;
    ctx.lineWidth = Math.max(0.2, 1 * px);
    ctx.strokeRect(-5.2 * s, -3 * s, 4 * s, 6 * s);
    ctx.strokeRect(1.2 * s, -3 * s, 4 * s, 6 * s);

    // Bases
    ctx.fillStyle = "#fff";
    for (const base of BASES) {
      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-0.75, -0.75, 1.5, 1.5);
      ctx.restore();
    }
    polyPath([{ x: -0.71 * s, y: 0.71 * s }, { x: 0.71 * s, y: 0.71 * s }, { x: 0.71 * s, y: 0 }, { x: 0, y: -0.71 * s }, { x: -0.71 * s, y: 0 }]);
    ctx.fill();

    // Outfield wall and foul poles
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const th = -FOUL_ANGLE + (2 * FOUL_ANGLE * i) / 60;
      const p = polar(wallDist(th) + 1.5, th);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = "#1c4a2a";
    ctx.lineWidth = Math.max(3, 4 * px);
    ctx.stroke();
    ctx.strokeStyle = "#f2c94c";
    ctx.lineWidth = Math.max(0.5, 1.5 * px);
    ctx.stroke();
    ctx.fillStyle = "#f2c94c";
    circle(lf.x, lf.y, Math.max(1.5, 3 * px));
    ctx.fill();
    circle(rf.x, rf.y, Math.max(1.5, 3 * px));
    ctx.fill();

  }

  // Ring segment around home between two radii (or radius functions) and two angles in degrees
  function wedgePath(r0, r1, d0, d1) {
    const rAt = (r, th) => (typeof r === "function" ? r(th) : r);
    const steps = Math.max(4, Math.ceil(Math.abs(d1 - d0) / 2));
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const th = rad(lerp(d0, d1, i / steps));
      const p = polar(rAt(r1, th), th);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    for (let i = steps; i >= 0; i--) {
      const th = rad(lerp(d0, d1, i / steps));
      const p = polar(rAt(r0, th), th);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }

  function shade(r0, r1, d0, d1, color) {
    wedgePath(r0, r1, d0, d1);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Mild tints marking where each kind of hit scores
  function drawZones() {
    const px = 1 / cam.zoom;
    const track = (th) => wallDist(th) - 15;
    const beyond = (th) => wallDist(th) + 40;
    const lineDeg = toDeg(FOUL_ANGLE);

    shade(OUTFIELD_R, track, -LINE_DEG, LINE_DEG, ZONES.outfield.shade);
    for (const [a, b] of OF_GAPS) shade(OF_GAP_R, track, a, b, ZONES.ofgap.shade);
    shade(ZONE_INNER_R, track, -lineDeg, -LINE_DEG, ZONES.line.shade);
    shade(ZONE_INNER_R, track, LINE_DEG, lineDeg, ZONES.line.shade);
    for (const [a, b] of GAPS) shade(ZONE_INNER_R, OUTFIELD_R, a, b, ZONES.gap.shade);
    shade(track, wallDist, -lineDeg, lineDeg, ZONES.wall.shade);
    shade(wallDist, beyond, -lineDeg, lineDeg, ZONES.hr.shade);

    // Dashed edge between infield and outfield scoring
    ctx.setLineDash([4 * px, 4 * px]);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.2 * px;
    ctx.beginPath();
    ctx.arc(0, 0, OUTFIELD_R, Math.PI / 2 - rad(LINE_DEG), Math.PI / 2 + rad(LINE_DEG));
    ctx.stroke();

    // Fielder ranges (f.ring, scaled by play.rangeK for outfielders) decide catches but aren't drawn
    ctx.setLineDash([]);
  }

  // Simple top-down fielders in the home team's colors; they run toward the ball
  function drawFielders() {
    const px = 1 / cam.zoom;
    const s = Math.max(3, 11 * px); // stay visible when zoomed far out
    for (const f of FIELDERS) {
      const p = fielderPos(f);
      const caught = ret
        ? ret.phase === "hold" && ret.holder === f
        : play && ((play.decided === "out" && play.catch.fielder === f) || (play.fielded && play.field.fielder === f));
      // Face home while waiting, the ball while running, and his throwing target while holding it
      const target = fieldingTarget();
      let a;
      if (caught && ret) {
        const t = holderPos(ret.legs[0]);
        a = Math.atan2(t.y - p.y, t.x - p.x);
      } else if (ret && ball) a = Math.atan2(ball.y - p.y, ball.x - p.x);
      else if (target && target.fielder === f && (mode === "inplay" || mode === "result")) a = Math.atan2(target.y - p.y, target.x - p.x);
      else a = Math.atan2(-p.y, -p.x);
      const glove = { x: p.x + Math.cos(a + 0.7) * s * 0.9, y: p.y + Math.sin(a + 0.7) * s * 0.9 };
      blob(p.x, p.y, s * 0.75, s * 0.75, 0, "rgba(244,244,244,0.92)", "#2d5fa8");
      blob(glove.x, glove.y, s * 0.32, s * 0.32, 0, "#6b3f1f");
      blob(p.x, p.y, s * 0.38, s * 0.38, 0, "#1d3c6e");
      if (caught) blob(glove.x, glove.y, s * 0.2, s * 0.2, 0, "#fff", "#c0392b");
    }
  }

  // Point values and fielder names, drawn in screen space so text stays upright
  function drawZoneLabels() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = (r, d, text, color, size = 14) => {
      const p = polar(typeof r === "function" ? r(rad(d)) : r, rad(d));
      const s = toScreen(p.x, p.y);
      if (s.x < -30 || s.x > W + 30 || s.y < -30 || s.y > H + 30) return;
      ctx.font = `bold ${size}px Segoe UI, Arial`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.strokeText(text, s.x, s.y);
      ctx.fillStyle = color;
      ctx.fillText(text, s.x, s.y);
    };
    const lineMid = (LINE_DEG + toDeg(FOUL_ANGLE)) / 2;
    for (const [a, b] of GAPS) label(112, (a + b) / 2, `+${ZONES.gap.pts}`, ZONES.gap.color);
    for (const d of [-14, 14]) label(185, d, `+${ZONES.outfield.pts}`, ZONES.outfield.color);
    for (const [a, b] of OF_GAPS) label(330, (a + b) / 2, `+${ZONES.ofgap.pts}`, ZONES.ofgap.color);
    for (const s of [-1, 1]) label(230, s * lineMid, `+${ZONES.line.pts}`, ZONES.line.color);
    for (const d of [-33, 33]) label((th) => wallDist(th) - 7.5, d, `+${ZONES.wall.pts}`, ZONES.wall.color, 12);
    for (const d of [-30, 0, 30]) label((th) => wallDist(th) + 22, d, `+${ZONES.hr.pts}`, ZONES.hr.color, 16);
    for (const f of FIELDERS) label(f.r - f.ring * 0.55, f.deg, f.name, "rgba(255,255,255,0.7)", 10);
  }

  function drawWallLabels() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = "bold 12px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const th of [-FOUL_ANGLE, -FOUL_ANGLE / 2, 0, FOUL_ANGLE / 2, FOUL_ANGLE]) {
      const d = wallDist(th);
      const p = polar(d - 8, th);
      const s = toScreen(p.x, p.y);
      if (s.x > -20 && s.x < W + 20 && s.y > -20 && s.y < H + 20) ctx.fillText(Math.round(d), s.x, s.y);
    }
  }

  // ---- Figures ----
  const SKIN = "#e0b48c";

  function rotOff(cx, cy, x, y, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: cx + x * c - y * s, y: cy + x * s + y * c };
  }

  function limb(a, b, width, color) {
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  function blob(x, y, rx, ry, rot, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.07;
      ctx.stroke();
    }
  }

  // Interpolate a keyframe list [{t, ...numbers}] at time t
  function keyframe(keys, t) {
    if (t <= keys[0].t) return keys[0];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i].t) {
        const a = keys[i - 1], b = keys[i];
        const u = (t - a.t) / (b.t - a.t);
        const e = u * u * (3 - 2 * u);
        const out = {};
        for (const k in a) out[k] = lerp(a[k], b[k], e);
        return out;
      }
    }
    return keys[keys.length - 1];
  }

  // Right-handed pitcher facing home (-y): throwing hand on the -x side.
  // c = body center, rot = shoulder turn, f/b = front/back foot, h = throwing hand, g = glove
  const PITCHER_KEYS = [
    { t: 0, cx: 0, cy: 60.6, rot: 0, fx: 0.55, fy: 60.5, bx: -0.5, by: 60.8, hx: 0.05, hy: 60.1, gx: 0.2, gy: 60.05 },
    { t: 0.45, cx: 0.05, cy: 60.7, rot: -1.1, fx: 0.3, fy: 61.2, bx: -0.4, by: 60.8, hx: -0.5, hy: 61.5, gx: 0.6, gy: 60.3 },
    { t: 0.75, cx: 0, cy: 60.0, rot: -0.9, fx: 0.4, fy: 57.8, bx: -0.4, by: 60.8, hx: -1.5, hy: 61.9, gx: 1.1, gy: 58.6 },
    { t: 1.0, cx: -0.1, cy: 59.0, rot: 0.2, fx: 0.4, fy: 57.8, bx: -0.4, by: 60.6, hx: RELEASE_LOCAL.x, hy: RELEASE_LOCAL.y, gx: 0.8, gy: 59.5 },
    { t: 1.4, cx: 0, cy: 58.7, rot: 0.6, fx: 0.4, fy: 57.8, bx: -0.55, by: 59.3, hx: 0.9, hy: 58.3, gx: 0.6, gy: 59.0 },
  ];

  function pitcherPhase() {
    if (mode === "windup") return modeT / 0.7;
    if (mode === "pitch") return 1 + 0.4 * Math.min(1, pitch.t / 0.3);
    if (mode === "inplay" || mode === "result") return 1.4;
    return 0;
  }

  function drawPitcher() {
    ctx.save();
    ctx.translate(0, MOUND_Y);
    ctx.scale(PITCHER_SCALE, PITCHER_SCALE);
    ctx.translate(0, -MOUND_Y);
    drawPitcherBody();
    ctx.restore();
  }

  function drawPitcherBody() {
    const k = keyframe(PITCHER_KEYS, pitcherPhase());
    const shoulderR = rotOff(k.cx, k.cy, -0.95, 0, k.rot); // throwing side
    const shoulderL = rotOff(k.cx, k.cy, 0.95, 0, k.rot);
    const hipR = rotOff(k.cx, k.cy, -0.4, 0.1, k.rot * 0.5);
    const hipL = rotOff(k.cx, k.cy, 0.4, 0.1, k.rot * 0.5);

    // Legs and cleats
    limb(hipR, { x: k.bx, y: k.by }, 0.42, "#e8e8e8");
    limb(hipL, { x: k.fx, y: k.fy }, 0.42, "#e8e8e8");
    blob(k.bx, k.by - 0.15, 0.2, 0.32, 0, "#111");
    blob(k.fx, k.fy - 0.15, 0.2, 0.32, 0, "#111");

    // Glove arm
    limb(shoulderL, { x: k.gx, y: k.gy }, 0.28, "#f4f4f4");
    blob(k.gx, k.gy, 0.36, 0.42, k.rot, "#6b3f1f", "#3e2210");

    // Torso: white home jersey with blue trim
    blob(k.cx, k.cy, 1.1, 0.58, k.rot, "#f4f4f4", "#2d5fa8");
    blob(shoulderR.x, shoulderR.y, 0.3, 0.3, 0, "#2d5fa8");
    blob(shoulderL.x, shoulderL.y, 0.3, 0.3, 0, "#2d5fa8");

    // Throwing arm: blue sleeve then forearm
    const hand = { x: k.hx, y: k.hy };
    const elbow = { x: lerp(shoulderR.x, hand.x, 0.45), y: lerp(shoulderR.y, hand.y, 0.45) };
    limb(shoulderR, elbow, 0.3, "#2d5fa8");
    limb(elbow, hand, 0.24, SKIN);
    blob(hand.x, hand.y, 0.15, 0.15, 0, SKIN);

    // Head: navy cap with brim pointing home
    blob(k.cx, k.cy - 0.42, 0.3, 0.2, 0, "#1d3c6e");
    blob(k.cx, k.cy, 0.42, 0.42, 0, "#1d3c6e", "#10223f");
    blob(k.cx, k.cy, 0.1, 0.1, 0, "#f2c94c");

    // Ball in hand before release
    const hasBall = mode === "ready" || mode === "windup" || (mode === "result" && ret && ret.phase === "done");
    if (hasBall) blob(hand.x, hand.y, 0.13, 0.13, 0, "#fff", "#c0392b");
  }

  function drawCatcher() {
    const S = HOME_SCALE;
    const cx = 0, cy = -3.75;
    // Mitt (world coords, so the pitch lands right in it): drifts toward where the pitch will cross
    const restX = 0.25 * S;
    let mx = restX, mz = 2.4;
    if (mode === "pitch") {
      const u = clamp(pitch.t / pitch.T, 0, 1);
      const e = u * u;
      mx = lerp(restX, pitch.xp, e);
      mz = lerp(2.4, pitch.zp, e);
    }
    const mitt = { x: mx, y: MITT_Y + mz * 0.45 };

    ctx.save();
    ctx.scale(S, S);
    // Shin guards and cleats, knees spread in the crouch
    limb({ x: -0.75, y: -3.15 }, { x: -1.05, y: -4.0 }, 0.44, "#2c3e66");
    limb({ x: 0.75, y: -3.15 }, { x: 1.05, y: -4.0 }, 0.44, "#2c3e66");
    blob(-1.1, -4.15, 0.2, 0.28, 0.3, "#111");
    blob(1.1, -4.15, 0.2, 0.28, -0.3, "#111");

    // Throwing hand tucked behind the right leg
    limb({ x: -0.85, y: -3.75 }, { x: -1.2, y: -4.3 }, 0.24, "#24304d");
    blob(-1.2, -4.3, 0.14, 0.14, 0, SKIN);

    // Body with chest protector
    blob(cx, cy, 0.95, 0.6, 0, "#24304d", "#141b2d");
    blob(cx, cy + 0.15, 0.62, 0.36, 0, "#3d5a8a");
    ctx.strokeStyle = "#24304d";
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(cx - 0.5, cy + 0.15);
    ctx.lineTo(cx + 0.5, cy + 0.15);
    ctx.stroke();
    ctx.restore();

    // Glove arm reaching out to the mitt
    limb({ x: 0.85 * S, y: cy * S }, mitt, 0.26 * S, "#24304d");
    blob(mitt.x, mitt.y, 0.45 * S, 0.4 * S, 0, "#7a4a22", "#3e2210");
    blob(mitt.x, mitt.y + 0.05 * S, 0.22 * S, 0.18 * S, 0, "#5a3417");

    // Helmet with face mask bars
    ctx.save();
    ctx.scale(S, S);
    blob(cx, cy + 0.15, 0.44, 0.44, 0, "#111", "#000");
    ctx.strokeStyle = "#9aa0aa";
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.arc(cx, cy + 0.15, 0.4, 0.35, Math.PI - 0.35);
    ctx.moveTo(cx - 0.3, cy + 0.42);
    ctx.lineTo(cx + 0.3, cy + 0.42);
    ctx.moveTo(cx, cy + 0.55);
    ctx.lineTo(cx, cy + 0.3);
    ctx.stroke();
    ctx.restore();
  }

  function batAngle() {
    if (swingT < 0) return rad(-120);
    if (swingT < CONTACT_DELAY) return rad(-120 + 120 * (swingT / CONTACT_DELAY));
    return rad(150 * Math.min(1, (swingT - CONTACT_DELAY) / (SWING_DUR - CONTACT_DELAY)));
  }

  // Right-handed batter in the third-base box, facing the plate (+x).
  // Swing progress: 0 = stance, 0.5 = contact, 1 = follow-through.
  // rot = shoulder turn, hx/hy = hands offset from body center, fy = front foot stride
  const BATTER_KEYS = [
    { t: 0, rot: -0.15, hx: 0.3, hy: -0.75, fy: 1.3 },
    { t: 0.5, rot: 0.55, hx: 0.75, hy: 0.2, fy: 1.75 },
    { t: 1, rot: 1.3, hx: 0.05, hy: 1.05, fy: 1.75 },
  ];

  function swingProgress() {
    if (swingT < 0) return 0;
    if (swingT < CONTACT_DELAY) return 0.5 * (swingT / CONTACT_DELAY);
    return 0.5 + 0.5 * Math.min(1, (swingT - CONTACT_DELAY) / (SWING_DUR - CONTACT_DELAY));
  }

  function drawBat(hands, a) {
    const dx = Math.cos(a), dy = Math.sin(a);
    const nx = -dy, ny = dx;
    const at = (d, w) => ({ x: hands.x + dx * d + nx * w, y: hands.y + dy * d + ny * w });
    const outline = [at(-0.2, 0.07), at(1.1, 0.07), at(2.4, 0.15), at(2.8, 0.14), at(2.8, -0.14), at(2.4, -0.15), at(1.1, -0.07), at(-0.2, -0.07)];
    polyPath(outline);
    ctx.fillStyle = "#d4a764";
    ctx.fill();
    ctx.strokeStyle = "#8a6232";
    ctx.lineWidth = 0.04;
    ctx.stroke();
    const knob = at(-0.22, 0);
    blob(knob.x, knob.y, 0.1, 0.1, 0, "#8a6232");
    // Grip tape
    limb(at(-0.15, 0), at(0.5, 0), 0.15, "#222");
  }

  function drawBatter() {
    ctx.save();
    ctx.scale(HOME_SCALE * handSide(), HOME_SCALE); // mirror lefties into the other box
    drawBatterBody();
    ctx.restore();
  }

  function drawBatterBody() {
    const cx = -2.85, cy = 0;
    const k = keyframe(BATTER_KEYS, swingProgress());
    const hands = { x: cx + k.hx, y: cy + k.hy };
    const shoulderF = rotOff(cx, cy, 0, 0.9, k.rot); // front shoulder, toward the pitcher
    const shoulderB = rotOff(cx, cy, 0, -0.9, k.rot);
    const hipF = rotOff(cx, cy, 0.05, 0.42, k.rot * 0.5);
    const hipB = rotOff(cx, cy, 0.05, -0.42, k.rot * 0.5);
    const footF = { x: cx + 0.2, y: cy + k.fy };
    const footB = { x: cx + 0.15, y: cy - 1.3 };

    // Legs (gray pants) and cleats; back foot pivots during the swing
    limb(hipF, footF, 0.44, "#cfd2d8");
    limb(hipB, footB, 0.44, "#cfd2d8");
    blob(footF.x + 0.12, footF.y, 0.34, 0.18, 0, "#111");
    blob(footB.x + 0.12, footB.y, 0.34, 0.18, k.rot * 0.6, "#111");

    // Torso: red away jersey
    blob(cx, cy, 0.58, 1.08, k.rot, "#c23b3b", "#7d1f1f");
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 0.06;
    const n1 = rotOff(cx, cy, -0.35, -0.5, k.rot), n2 = rotOff(cx, cy, -0.35, 0.5, k.rot);
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.stroke();

    // Arms: red sleeves, then forearms to the hands
    for (const sh of [shoulderF, shoulderB]) {
      const elbow = { x: lerp(sh.x, hands.x, 0.4), y: lerp(sh.y, hands.y, 0.4) };
      limb(sh, elbow, 0.3, "#c23b3b");
      limb(elbow, hands, 0.24, SKIN);
    }

    drawBat(hands, batAngle());
    blob(hands.x, hands.y, 0.19, 0.19, 0, "#f4f4f4", "#999");

    // Helmet with brim, turned to watch the pitcher
    blob(cx + 0.05, cy + 0.42, 0.3, 0.2, 0, "#16203f");
    blob(cx + 0.05, cy, 0.5, 0.5, 0, "#1d2a52", "#0d1430");
    blob(cx - 0.08, cy - 0.12, 0.18, 0.12, -0.6, "rgba(255,255,255,0.35)");
    blob(cx + 0.05, cy, 0.09, 0.09, 0, "#c23b3b");
  }

  function drawBall() {
    if (!ball) return;
    const px = 1 / cam.zoom;
    const baseR = Math.max(3 * px, 0.35);

    // Trail
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      ctx.fillStyle = `rgba(255,255,255,${(0.35 * i) / trail.length})`;
      circle(t.x, t.y + t.z * 0.45, baseR * 0.6 * (1 + t.z / 45));
      ctx.fill();
    }

    // First landing marker
    if (play && play.firstLand && !play.wallFirst) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5 * px;
      const f = play.firstLand, s = 4 * px;
      ctx.beginPath();
      ctx.moveTo(f.x - s, f.y - s);
      ctx.lineTo(f.x + s, f.y + s);
      ctx.moveTo(f.x - s, f.y + s);
      ctx.lineTo(f.x + s, f.y - s);
      ctx.stroke();
    }

    // Held by a fielder: his glove shows the ball instead
    if (ret ? ret.phase === "hold" && ret.holder !== "C" : play && (play.decided === "out" || play.fielded)) return;

    // Shadow stays on the ground
    const z = Math.max(0, ball.z);
    ctx.fillStyle = `rgba(0,0,0,${clamp(0.45 - z / 250, 0.12, 0.45)})`;
    ctx.beginPath();
    ctx.ellipse(ball.x, ball.y, baseR * 1.1, baseR * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball drawn higher and larger the higher it is
    const r = baseR * (1 + z / 45);
    ctx.fillStyle = "#ffffff";
    circle(ball.x, ball.y + z * 0.45, r);
    ctx.fill();
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = r * 0.25;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y + z * 0.45, r * 0.6, 0.3, 2.2);
    ctx.stroke();
  }

  function drawZoneInset() {
    const x0 = W - 170, y0 = 16, w = 154, h = 196;
    ctx.fillStyle = "rgba(10,12,20,0.6)";
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = "#ddd";
    ctx.font = "11px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Last pitch (catcher view)", x0 + w / 2, y0 + 6);

    const zx = x0 + 37, zy = y0 + 32, zw = 80, zh = 96;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(zx, zy, zw, zh);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(zx + (zw * i) / 3, zy);
      ctx.lineTo(zx + (zw * i) / 3, zy + zh);
      ctx.moveTo(zx, zy + (zh * i) / 3);
      ctx.lineTo(zx + zw, zy + (zh * i) / 3);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "9px Segoe UI, Arial";
    // Catcher's view: inside is on the batter's side of the plate
    const side = handSide();
    ctx.fillText(side > 0 ? "IN" : "OUT", zx - 14, zy + zh / 2 - 5);
    ctx.fillText(side > 0 ? "OUT" : "IN", zx + zw + 15, zy + zh / 2 - 5);

    const showCurrent = pitch && mode === "pitch" && pitch.t >= pitch.T;
    const z = showCurrent ? { h: pitch.h, v: pitch.v, color: "#ffffff" } : lastZone;
    if (z) {
      const bx = zx + zw / 2 + ((side * z.h) / 1.5) * (zw / 2);
      const by = zy + zh / 2 - (z.v / 1.5) * (zh / 2);
      ctx.fillStyle = z.color;
      circle(bx, by, 6);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Timing meter: early on the left, late on the right
    const mx = x0 + 14, my = y0 + 152, mw = w - 28;
    ctx.fillStyle = "#ddd";
    ctx.font = "10px Segoe UI, Arial";
    ctx.fillText("EARLY      timing      LATE", x0 + w / 2, my - 14);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(mx, my, mw, 10);
    if (lastTiming) {
      const win = lastTiming.windowMs;
      const half = mw / 2;
      ctx.fillStyle = "rgba(95,220,122,0.35)";
      ctx.fillRect(mx + half - (win / 200) * half, my, (win / 100) * half, 10);
      const e = clamp(lastTiming.errMs / 200, -1, 1);
      ctx.fillStyle = Math.abs(lastTiming.errMs) < win ? "#5fdc7a" : "#ff6b6b";
      ctx.fillRect(mx + half + e * half - 2, my - 3, 4, 16);
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(mx + mw / 2 - 0.5, my, 1, 10);
  }

  function drawBanner() {
    if (!banner) return;
    const t = banner.t;
    const scale = banner.big ? 1 + 0.15 * Math.sin(t * 6) * Math.exp(-t) : 1;
    const alpha = Math.min(1, t * 6);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, H * 0.4);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${banner.big ? 56 : 40}px Segoe UI, Arial`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeText(banner.text, 0, 0);
    ctx.fillStyle = banner.color;
    ctx.fillText(banner.text, 0, 0);
    if (banner.sub) {
      ctx.font = "bold 18px Segoe UI, Arial";
      ctx.lineWidth = 4;
      ctx.strokeText(banner.sub, 0, banner.big ? 44 : 36);
      ctx.fillStyle = "#fff";
      ctx.fillText(banner.sub, 0, banner.big ? 44 : 36);
    }
    // Exit velocity, launch angle and hang time
    if (banner.stats) {
      const y = banner.big ? 68 : 60;
      ctx.font = "bold 15px Segoe UI, Arial";
      ctx.lineWidth = 4;
      ctx.strokeText(banner.stats, 0, y);
      ctx.fillStyle = "#9fe3ff";
      ctx.fillText(banner.stats, 0, y);
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  // Round, score, pitches, and a color key for the scoring zones
  function drawScoreboard() {
    const x0 = 16, y0 = 16, w = 172, h = 86 + LEGEND.length * 18;
    ctx.fillStyle = "rgba(10,12,20,0.6)";
    ctx.fillRect(x0, y0, w, h);
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ddd";
    ctx.font = "11px Segoe UI, Arial";
    ctx.fillText(`ROUND ${round.num || "-"}`, x0 + 10, y0 + 8);
    ctx.textAlign = "right";
    ctx.fillText(`${PITCHES_PER_ROUND - round.pitch} PITCHES LEFT`, x0 + w - 10, y0 + 8);
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 30px Segoe UI, Arial";
    ctx.fillText(round.score, x0 + 10, y0 + 24);
    ctx.fillStyle = "#aaa";
    ctx.font = "11px Segoe UI, Arial";
    ctx.textAlign = "right";
    ctx.fillText(`BEST ${best}`, x0 + w - 10, y0 + 30);
    ctx.fillText(`AVG ${battingAvg().text}`, x0 + w - 10, y0 + 46);

    // Floating "+N" right after scoring
    if (scorePop && scorePop.t < 1.4) {
      ctx.globalAlpha = clamp(1.4 - scorePop.t, 0, 1);
      ctx.fillStyle = "#7dff8a";
      ctx.font = "bold 20px Segoe UI, Arial";
      ctx.textAlign = "left";
      ctx.fillText(`+${scorePop.pts}`, x0 + 70, y0 + 30 - scorePop.t * 14);
      ctx.globalAlpha = 1;
    }

    // Pitches remaining as dots
    for (let i = 0; i < PITCHES_PER_ROUND; i++) {
      ctx.fillStyle = i < round.pitch ? "rgba(255,255,255,0.2)" : "#f2c94c";
      circle(x0 + 12 + i * 7.9, y0 + 66, 2.6);
      ctx.fill();
    }

    ctx.textAlign = "left";
    ctx.font = "12px Segoe UI, Arial";
    LEGEND.forEach((key, i) => {
      const z = ZONES[key];
      const y = y0 + 80 + i * 18;
      ctx.fillStyle = z.color;
      ctx.fillRect(x0 + 10, y + 2, 12, 12);
      ctx.fillStyle = "#eee";
      ctx.fillText(z.name, x0 + 30, y + 1);
      ctx.textAlign = "right";
      ctx.fillText(`+${z.pts}`, x0 + w - 10, y + 1);
      ctx.textAlign = "left";
    });
  }

  function drawRoundOver() {
    ctx.fillStyle = "rgba(10,12,20,0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 40px Segoe UI, Arial";
    ctx.fillText(`ROUND ${round.num} COMPLETE`, W / 2, 110);
    ctx.font = "bold 72px Segoe UI, Arial";
    ctx.fillStyle = round.newBest ? "#ffd666" : "#fff";
    ctx.fillText(round.score, W / 2, 190);
    ctx.font = "16px Segoe UI, Arial";
    ctx.fillStyle = "#ccc";
    ctx.fillText(round.newBest ? "NEW BEST ROUND!" : `Best round: ${best}`, W / 2, 238);
    const ba = battingAvg();
    ctx.fillStyle = "#9fe3ff";
    ctx.font = "bold 17px Segoe UI, Arial";
    ctx.fillText(`Batting average ${ba.text}  (${ba.hits} hits in ${ba.ab} balls in play)`, W / 2, 262);

    // Breakdown by zone
    const rows = LEGEND.slice().reverse().map((k) => ({
      name: ZONES[k].name, color: ZONES[k].color, n: round.counts[k], pts: round.counts[k] * ZONES[k].pts,
    }));
    const c = round.counts;
    rows.push({ name: "Caught (fly / line / pop outs)", color: "#8a8f99", n: c.flyout, pts: 0 });
    rows.push({ name: "Ground outs", color: "#8a8f99", n: c.out, pts: 0 });
    rows.push({ name: "Fouls", color: "#8a8f99", n: c.foul, pts: 0 });
    rows.push({ name: "Strikes / balls", color: "#8a8f99", n: `${c.strike} / ${c.ball}`, pts: 0 });
    ctx.font = "15px Segoe UI, Arial";
    rows.forEach((r, i) => {
      const y = 290 + i * 24;
      ctx.fillStyle = r.color;
      ctx.fillRect(W / 2 - 170, y - 6, 12, 12);
      ctx.textAlign = "left";
      ctx.fillStyle = "#eee";
      ctx.fillText(r.name, W / 2 - 150, y);
      ctx.textAlign = "right";
      ctx.fillText(`× ${r.n}`, W / 2 + 90, y);
      ctx.fillText(r.pts ? `${r.pts} pts` : "-", W / 2 + 170, y);
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "#aaa";
    ctx.font = "14px Segoe UI, Arial";
    if (round.longest) ctx.fillText(`Longest hit: ${round.longest} ft`, W / 2, 290 + rows.length * 24 + 8);
    if (history.length > 1) ctx.fillText(`Rounds so far: ${history.join(", ")}`, W / 2, 290 + rows.length * 24 + 30);
    if (modeT > 1) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px Segoe UI, Arial";
      ctx.fillText("Press Space for the next round", W / 2, H - 40);
    }
    ctx.fillStyle = "#aaa";
    ctx.font = "14px Segoe UI, Arial";
    ctx.fillText(`Batting ${batterHand === "R" ? "right" : "left"}-handed · H to switch`, W / 2, H - 16);
  }

  function drawTitle() {
    ctx.fillStyle = "rgba(10,12,20,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 54px Segoe UI, Arial";
    ctx.fillText("BATTING PRACTICE", W / 2, H / 2 - 60);
    ctx.font = "20px Segoe UI, Arial";
    ctx.fillText("Press Space to step into the box", W / 2, H / 2);
    ctx.font = "15px Segoe UI, Arial";
    ctx.fillStyle = "#ccc";
    ctx.fillText(`${PITCHES_PER_ROUND} pitches per round. Score by placing hits in the shaded zones.`, W / 2, H / 2 + 38);
    ctx.fillText("Space = swing   ·   early pulls, late pushes   ·   low = grounders, high = fly balls", W / 2, H / 2 + 62);
    ctx.fillStyle = "#ffd666";
    ctx.font = "bold 17px Segoe UI, Arial";
    ctx.fillText(`Batting ${batterHand === "R" ? "RIGHT" : "LEFT"}-handed   ·   press H to switch`, W / 2, H / 2 + 104);
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    worldTransform();
    drawField();
    drawPitcher();
    drawCatcher();
    drawBatter();
    drawFielders();
    drawBall();
    drawZoneLabels();
    drawWallLabels();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawZoneInset();
    drawScoreboard();
    drawParticles();
    drawBanner();
    if (mode === "title") drawTitle();
    if (mode === "roundover") drawRoundOver();
    if (paused) drawPaused();
  }

  function drawPaused() {
    ctx.fillStyle = "rgba(10,12,20,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 54px Segoe UI, Arial";
    ctx.fillText("PAUSED", W / 2, H / 2 - 20);
    ctx.font = "18px Segoe UI, Arial";
    ctx.fillStyle = "#ccc";
    ctx.fillText("Press P to resume", W / 2, H / 2 + 28);
  }

  function setPaused(p) {
    if (mode === "title" || paused === p) return;
    paused = p;
    Sfx.setPaused(p);
  }

  // ---- Main loop ----
  let lastFrame = performance.now();
  let acc = 0;
  let simWallTime = lastFrame; // wall-clock time the simulation has reached

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (paused) {
      acc = 0;
      simWallTime = now;
      render();
      requestAnimationFrame(frame);
      return;
    }
    acc += dt;
    while (acc >= STEP) {
      if (mode !== "title") update(STEP);
      acc -= STEP;
    }
    simWallTime = now - acc * 1000;
    updateCamera(dt);
    updateParticles(dt);
    render();
    requestAnimationFrame(frame);
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (e.repeat || paused) return;
      Sfx.unlock();
      if (mode === "title") startRound();
      else if (mode === "roundover") {
        if (modeT > 1) startRound(); // short delay so a late swing doesn't skip the summary
      } else trySwing(performance.now());
    } else if (e.code === "KeyM") {
      Sfx.unlock();
      hud.sound.textContent = Sfx.toggleMute() ? "Off" : "On";
    } else if (e.code === "KeyP") {
      setPaused(!paused);
    } else if (e.code === "KeyH") {
      if (!paused) toggleHand();
    } else if (e.code === "KeyR") {
      // Restart the current round from pitch 1
      if (mode === "title" || paused) return;
      round.num--;
      startRound();
    }
  });
  // Pause automatically when the tab or window loses focus
  window.addEventListener("blur", () => setPaused(true));

  updateHud();
  requestAnimationFrame(frame);
})();
