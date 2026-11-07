// SkyRaider pixel art. Sprites are drawn from grids of palette letters ('.' is clear)
// or from small shape functions, and turned into canvases once when the page loads.
const Sprites = (() => {
  const PAL = {
    k: "#1b1b26", // outline
    w: "#f2efe4", // white
    s: "#c9c6b8", // light grey
    G: "#7d7a70", // grey
    D: "#4a4842", // dark grey
    m: "#a9b3b8", // light metal
    M: "#5e686e", // metal
    r: "#c0443a", // red
    R: "#7c2a20", // dark red
    o: "#e08a3a", // orange
    y: "#f2d16b", // brass yellow
    b: "#8a5a32", // wood
    B: "#5a3a22", // dark wood
    t: "#d8c89a", // canvas
    T: "#a8975f", // canvas shade
    c: "#857646", // canvas in deep shade (a wing tipped away)
    l: "#ece2bd", // canvas catching the light (a wing tipped up)
    v: "#6f7a3e", // olive drab
    V: "#48522a", // dark olive
    u: "#3a5da8", // roundel blue
    U: "#263f75", // dark blue
    h: "#b0503a", // red roof tile
    H: "#7e3424", // red roof shade
    q: "#7a8094", // slate
    Q: "#525769", // slate shade
    g: "#86b452", // leaf highlight
    e: "#55873a", // leaf
    E: "#36602a", // leaf shade
    z: "#203d1c", // tree outline
    W: "#ffffff", // cloud
    C: "#d6dce6", // cloud shade
  };

  // What each color turns into when a target is destroyed
  const BURN = {
    w: "G", s: "G", m: "G", M: "D", G: "D", t: "B", T: "k", b: "B", B: "k",
    v: "D", V: "k", h: "R", H: "k", R: "k", q: "D", Q: "k", y: "B", o: "R",
    r: "R", u: "D", U: "k", g: "D", e: "D", E: "k",
  };

  function canvasOf(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function build(rows) {
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    const c = canvasOf(w, h);
    const g = c.getContext("2d");
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = PAL[row[x]];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    });
    return c;
  }

  // Left half including the center column -> full symmetric rows. Short rows are padded on the left.
  function mirror(half) {
    const w = Math.max(...half.map((r) => r.length));
    return half.map((r) => {
      const row = r.padStart(w, ".");
      return row + row.slice(0, -1).split("").reverse().join("");
    });
  }

  function recolor(rows, map) {
    return rows.map((r) => r.replace(/./g, (ch) => (ch in map ? map[ch] : ch)));
  }

  function setChar(rows, x, y, ch) {
    rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
  }

  // A copy of the sprite in one flat color (for shadows)
  function tint(src, color) {
    const c = canvasOf(src.width, src.height);
    const g = c.getContext("2d");
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // inside(x, y) picks the pixels, color(x, y) paints them, and an outline goes around the edge
  function shape(w, h, inside, color, outline = "k") {
    const rows = [];
    for (let y = 0; y < h; y++) {
      let row = "";
      for (let x = 0; x < w; x++) {
        if (inside(x, y)) row += color(x, y);
        else if (outline && (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1))) row += outline;
        else row += ".";
      }
      rows.push(row);
    }
    return rows;
  }

  // Intact and destroyed versions of a target
  function pair(rows) {
    return { img: build(rows), burnt: build(recolor(rows, BURN)) };
  }

  // ---- The biplane, nose up ----
  const PLANE_ROWS = mirror([
    "..........kkk",
    ".........kDMM",
    "kkkkkkkkkkMmm",
    "ktttttttttttt",
    "kttuuuttttttt",
    "ktuwwwutttttt",
    "ktuwrwutttttt",
    "ktuwwwutttttt",
    "kttuuuttttttt",
    "kTTTTTTTTTTTT",
    ".kTTTTTTTTkvv",
    ".kkkkkkkkkkvv",
    "..........kvv",
    "..........kvB",
    "..........kvv",
    "...........kv",
    "...........kv",
    "......kkkkkkv",
    "......ktttttR",
    "......kTTTTTk",
    "......kkkkkkk",
  ]);

  // Climbing tips the nose toward the viewer: a taller engine, a shorter body and a smaller tail.
  // Diving does the opposite. Rows 0-1 are the engine, 2-9 the wing, 10-16 the body, 17-20 the tail.
  function scaleRow(row, k) {
    const c = 12;
    let out = "";
    for (let x = 0; x < row.length; x++) out += row[Math.round(c + (x - c) / k)] || ".";
    return out;
  }

  function pitchRows(rows, pitch) {
    if (pitch === 0) return rows.slice();
    const pickRows = (ids) => ids.map((i) => rows[i]);
    const body = pickRows([10, 11, 13, 14, 16]);
    if (pitch > 0) return [...pickRows([0, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9]), ...body, ...pickRows([17, 18, 20]).map((r) => scaleRow(r, 0.8))];
    return [...pickRows([0, 2, 3, 4, 5, 6, 7, 8, 9]), ...body, ...pickRows([17, 18, 18, 19, 20]).map((r) => scaleRow(r, 1.15))];
  }

  // Banking left by n (1 or 2): the lowered left wing shrinks and darkens, the raised right wing
  // brightens and grows a little, and the right side of the body shows. Columns 10-14 are the body.
  function bankLeftRows(rows, n) {
    const DARK = { t: "c", T: "c", w: "s", u: "U", r: "R", v: "V", M: "D", m: "M" };
    const lw = n === 1 ? 8 : 6;
    return rows.map((row) => {
      let left = "";
      for (let j = 0; j < lw; j++) {
        const ch = row[Math.round((j * 9) / (lw - 1))];
        left += DARK[ch] || ch;
      }
      const side = row[14] === "k" && row[15] === "." ? "V" : row[14];
      // At a steep bank the raised wing grows one column, copied from just inside its tip
      let right = row.slice(15).replace(/t/g, "l");
      if (n === 2) right = right.slice(0, -1) + right.slice(-2);
      return left + row.slice(10, 14) + side.repeat(n) + row[14] + right;
    });
  }

  // Every pose: bank -2..2 (negative is left) by pitch -1..1. cx is the body's center column
  const planeFrames = {};
  for (let pitch = -1; pitch <= 1; pitch++) {
    const base = pitchRows(PLANE_ROWS, pitch);
    for (let bank = -2; bank <= 2; bank++) {
      let rows = base;
      let cx = 12;
      if (bank !== 0) {
        rows = bankLeftRows(base, Math.abs(bank));
        cx = (Math.abs(bank) === 1 ? 8 : 6) + 2;
        if (bank > 0) {
          rows = rows.map((r) => r.split("").reverse().join(""));
          cx = rows[0].length - 1 - cx;
        }
      }
      const img = build(rows);
      planeFrames[bank + "," + pitch] = { img, shadow: tint(img, "rgba(16,24,12,0.38)"), cx };
    }
  }
  const planeFrame = (bank, pitch) => planeFrames[bank + "," + pitch];
  const planeIcon = build(mirror(["....k", "ktttt", "kTTTT", "...kv", "...kv", "..kkv"]));

  const bombL = build([".k.", "kmk", "kGk", "kGk", "kGk", ".k.", "k.k"]);
  const bombM = build([".k.", "kGk", "kGk", ".k."]);
  const bombS = build(["kk", "kk"]);

  // ---- Buildings: gable roofs seen from above ----
  function roofRows(w, h, c) {
    const rows = [];
    const mid = Math.floor(h / 2);
    for (let y = 0; y < h; y++) {
      let row = "";
      for (let x = 0; x < w; x++) {
        if (x === 0 || x === w - 1 || y === 0 || y === h - 1) row += "k";
        else if (y === mid) row += c.ridge;
        else if (y < mid) row += y % 2 === 0 && (x + y) % 4 === 0 ? c.dot : c.lit;
        else row += y % 2 === 1 && (x + y) % 4 === 0 ? c.shadeDot : c.shade;
      }
      rows.push(row);
    }
    return rows;
  }

  const RED = { lit: "h", dot: "H", ridge: "B", shade: "H", shadeDot: "R" };
  const SLATE = { lit: "q", dot: "Q", ridge: "k", shade: "Q", shadeDot: "D" };
  const CANVAS = { lit: "t", dot: "t", ridge: "b", shade: "T", shadeDot: "T" };

  function house(w, h, c, chx, chy) {
    const rows = roofRows(w, h, c);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setChar(rows, chx + dx, chy + dy, "D");
    const p = pair(rows);
    p.chimney = { x: chx + 1 - w / 2, y: chy + 1 - h / 2 };
    return p;
  }

  const houses = [house(11, 9, RED, 7, 1), house(13, 10, SLATE, 2, 2), house(9, 8, RED, 5, 1), house(15, 9, RED, 10, 1)];

  function churchRows() {
    const rows = [];
    for (let y = 0; y < 18; y++) {
      let row = "";
      for (let x = 0; x < 11; x++) {
        if (x === 0 || x === 10 || y === 0 || x === 5) row += "k";
        else if (x < 5) row += y % 3 === 0 ? "Q" : "q";
        else row += y % 3 === 0 ? "D" : "Q";
      }
      rows.push(row);
    }
    // Square tower with a pyramid roof at the near end
    for (let y = 0; y < 9; y++) {
      let row = ".";
      for (let x = 0; x < 9; x++) {
        const dx = x - 4;
        const dy = y - 4;
        if (x === 0 || x === 8 || y === 0 || y === 8 || (dx === 0 && dy === 0)) row += "k";
        else if (Math.abs(dy) >= Math.abs(dx)) row += dy < 0 ? "m" : "M";
        else row += dx < 0 ? "m" : "M";
      }
      rows.push(row + ".");
    }
    return rows;
  }
  const church = pair(churchRows());
  church.chimney = null;

  // ---- Military targets ----
  const tent = pair(roofRows(15, 9, CANVAS));
  const bell = pair(
    shape(11, 11, (x, y) => (x - 5) ** 2 + (y - 5) ** 2 <= 20, (x, y) => (x === 5 && y === 5 ? "b" : x + y < 10 ? "t" : "T"))
  );

  const TRUCK_ROWS = mirror([".kkk", "kVvv", "kVvv", "kmmm", "kVvv", "kkkk", "kTtt", "kTTt", "kTtt", "kTTt", "kTtt", "kkkk"]);
  const truck = pair(TRUCK_ROWS);
  truck.imgDown = build(TRUCK_ROWS.slice().reverse());
  truck.burntDown = build(recolor(TRUCK_ROWS, BURN).reverse());

  const gun = pair(
    mirror([
      "....k",
      "...kM",
      "...kM",
      "...kM",
      "...kM",
      "...kM",
      ".kkkM",
      "kVVVv",
      "kVvvv",
      "DDkVv",
      "DDkVv",
      "...kV",
      "...kV",
      "...kk",
    ])
  );

  // Anti-aircraft gun: a ring of sandbags round the mount. The barrel is drawn in the game, aimed at the plane
  const aa = pair(
    shape(
      15,
      15,
      (x, y) => (x - 7) ** 2 + (y - 7) ** 2 <= 46,
      (x, y) => {
        const d2 = (x - 7) ** 2 + (y - 7) ** 2;
        if (d2 <= 2) return "M";
        if (d2 <= 5) return "V";
        if (d2 <= 20) return "B";
        return (Math.round(Math.atan2(y - 7, x - 7) * 2.5) % 2 === 0) === y < 7 ? "t" : "T";
      }
    )
  );

  const ammo = pair([
    "kkkkkkkkk..r.",
    "kbbbkbbbk.yy.",
    "kBBBkBBBk.yy.",
    "kbbbkbbbk....",
    "kkkkkkkkk.yy.",
    "kbbbkbbbk.yy.",
    "kBBBkBBBk....",
    "kbbbkbbbk.yy.",
    "kkkkkkkkk.yy.",
  ]);

  function bridgeRows(broken) {
    const rows = [];
    for (let y = 0; y < 24; y++) {
      if (broken && y >= 9 && y <= 14) rows.push(y === 9 || y === 14 ? "kk........kk" : "............");
      else if (y === 0 || y === 23) rows.push("kkkkkkkkkkkk");
      else rows.push("kB" + (y % 3 === 0 ? "BBBBBBBB" : "bbbbbbbb") + "Bk");
    }
    return rows;
  }
  const bridge = { img: build(bridgeRows(false)), burnt: build(recolor(bridgeRows(true), BURN)) };

  const winch = pair([".kkkkk.", "kDGGGDk", "kGmmmGk", "kGmkmGk", "kGmmmGk", "kDGGGDk", ".kkkkk."]);

  // ---- Barrage blimp, nose up, with three tail fins ----
  const blimpBody = (x, y) => ((x - 7) / 6.2) ** 2 + ((y - 12.5) / 12.2) ** 2 <= 1;
  const blimp = build(
    shape(
      15,
      32,
      (x, y) => blimpBody(x, y) || ((x === 2 || x === 3 || x === 11 || x === 12) && y >= 21 && y <= 29) || (x === 7 && y >= 24 && y <= 30),
      (x, y) => {
        if (!blimpBody(x, y)) return "G";
        if (y === 6) return "R";
        const nx = (x - 7) / 6.2;
        const ny = (y - 12.5) / 12.2;
        const l = -0.55 * nx - 0.45 * ny + 0.7 * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        return l > 0.78 ? "w" : l > 0.48 ? "s" : l > 0.12 ? "G" : "D";
      }
    )
  );
  const blimpShadow = tint(blimp, "rgba(16,24,12,0.3)");

  // ---- Trees and clouds ----
  function tree(r, seed) {
    const n = 2 * r + 3;
    const c = r + 1;
    return build(
      shape(
        n,
        n,
        (x, y) => {
          const dx = x - c;
          const dy = y - c;
          const rr = r + 0.6 * Math.sin(Math.atan2(dy, dx) * 5 + seed);
          return dx * dx + dy * dy <= rr * rr;
        },
        (x, y) => {
          const l = -(x - c) - (y - c);
          return l > r * 0.9 ? "g" : l > -r * 0.4 ? "e" : "E";
        },
        "z"
      )
    );
  }
  const trees = [tree(3, 0.5), tree(4, 2), tree(5, 1), tree(6, 3.5)];

  function cloud(w, h, blobs) {
    const inside = (x, y) => blobs.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
    return build(shape(w, h, inside, (x, y) => (inside(x + 1, y + 2) ? "W" : "C"), null));
  }
  const clouds = [
    cloud(46, 24, [[10, 12, 7], [20, 9, 9], [31, 11, 8], [38, 14, 5], [16, 15, 6], [27, 15, 6]]),
    cloud(34, 20, [[8, 10, 6], [16, 8, 7], [24, 10, 6], [14, 12, 5]]),
    cloud(58, 28, [[10, 15, 8], [22, 11, 10], [34, 12, 9], [45, 15, 7], [28, 18, 7], [16, 18, 6]]),
  ];
  const cloudShadows = clouds.map((c) => tint(c, "rgba(10,24,10,0.16)"));

  // ---- 5x7 bitmap font ----
  const FONT_SRC = {
    A: ".###. #...# #...# ##### #...# #...# #...#",
    B: "####. #...# #...# ####. #...# #...# ####.",
    C: ".###. #...# #.... #.... #.... #...# .###.",
    D: "####. #...# #...# #...# #...# #...# ####.",
    E: "##### #.... #.... ####. #.... #.... #####",
    F: "##### #.... #.... ####. #.... #.... #....",
    G: ".###. #...# #.... #.### #...# #...# .####",
    H: "#...# #...# #...# ##### #...# #...# #...#",
    I: ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.",
    J: "..### ...#. ...#. ...#. ...#. #..#. .##..",
    K: "#...# #..#. #.#.. ##... #.#.. #..#. #...#",
    L: "#.... #.... #.... #.... #.... #.... #####",
    M: "#...# ##.## #.#.# #.#.# #...# #...# #...#",
    N: "#...# #...# ##..# #.#.# #..## #...# #...#",
    O: ".###. #...# #...# #...# #...# #...# .###.",
    P: "####. #...# #...# ####. #.... #.... #....",
    Q: ".###. #...# #...# #...# #.#.# #..#. .##.#",
    R: "####. #...# #...# ####. #.#.. #..#. #...#",
    S: ".#### #.... #.... .###. ....# ....# ####.",
    T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..",
    U: "#...# #...# #...# #...# #...# #...# .###.",
    V: "#...# #...# #...# #...# #...# .#.#. ..#..",
    W: "#...# #...# #...# #.#.# #.#.# #.#.# .#.#.",
    X: "#...# #...# .#.#. ..#.. .#.#. #...# #...#",
    Y: "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..",
    Z: "##### ....# ...#. ..#.. .#... #.... #####",
    0: ".###. #...# #..## #.#.# ##..# #...# .###.",
    1: "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.",
    2: ".###. #...# ....# ...#. ..#.. .#... #####",
    3: "####. ....# ....# .###. ....# ....# ####.",
    4: "...#. ..##. .#.#. #..#. ##### ...#. ...#.",
    5: "##### #.... ####. ....# ....# #...# .###.",
    6: ".###. #.... #.... ####. #...# #...# .###.",
    7: "##### ....# ...#. ..#.. .#... .#... .#...",
    8: ".###. #...# #...# .###. #...# #...# .###.",
    9: ".###. #...# #...# .#### ....# ....# .###.",
    ":": "..... ..#.. ..#.. ..... ..#.. ..#.. .....",
    ".": "..... ..... ..... ..... ..... .##.. .##..",
    ",": "..... ..... ..... ..... .##.. ..#.. .#...",
    "-": "..... ..... ..... .###. ..... ..... .....",
    "+": "..... ..#.. ..#.. ##### ..#.. ..#.. .....",
    "!": "..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..",
    "?": ".###. #...# ....# ...#. ..#.. ..... ..#..",
    "/": "....# ....# ...#. ..#.. .#... #.... #....",
    "%": "##..# ##..# ...#. ..#.. .#... #..## #..##",
    "'": "..#.. ..#.. .#... ..... ..... ..... .....",
    "(": "...#. ..#.. .#... .#... .#... ..#.. ...#.",
    ")": ".#... ..#.. ...#. ...#. ...#. ..#.. .#...",
  };
  const FONT = {};
  for (const [ch, src] of Object.entries(FONT_SRC)) FONT[ch] = src.split(" ");

  const glyphCache = new Map();
  function glyph(ch, color) {
    const key = ch + color;
    let c = glyphCache.get(key);
    if (!c) {
      const rows = FONT[ch] || FONT["?"];
      c = canvasOf(5, 7);
      const g = c.getContext("2d");
      g.fillStyle = color;
      rows.forEach((row, y) => {
        for (let x = 0; x < 5; x++) if (row[x] === "#") g.fillRect(x, y, 1, 1);
      });
      glyphCache.set(key, c);
    }
    return c;
  }

  function textWidth(str, scale = 1) {
    return String(str).length * 6 * scale - scale;
  }

  // Draws upper-case text with a drop shadow. opts: scale, align ("left" | "center" | "right"), shadow (color or false)
  function text(ctx, str, x, y, color, opts = {}) {
    const scale = opts.scale || 1;
    str = String(str).toUpperCase();
    let x0 = x;
    if (opts.align === "center") x0 = x - Math.floor(textWidth(str, scale) / 2);
    else if (opts.align === "right") x0 = x - textWidth(str, scale);
    x0 = Math.round(x0);
    y = Math.round(y);
    const shadow = opts.shadow === undefined ? "#1b1b26" : opts.shadow;
    const passes = shadow ? [[shadow, scale], [color, 0]] : [[color, 0]];
    for (const [col, off] of passes) {
      for (let i = 0; i < str.length; i++) {
        if (str[i] === " ") continue;
        ctx.drawImage(glyph(str[i], col), x0 + i * 6 * scale + off, y + off, 5 * scale, 7 * scale);
      }
    }
  }

  return {
    planeFrame, planeIcon,
    bombL, bombM, bombS,
    houses, church, tent, bell, truck, gun, aa, ammo, bridge, winch,
    blimp, blimpShadow, trees, clouds, cloudShadows,
    text, textWidth,
  };
})();
