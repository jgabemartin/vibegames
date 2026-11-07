---
name: bump-version
description: Move a vibegames game to a new version number (rename its versioned folder and files, update the in-game version, index.html, the change log and the READMEs), then ship it with /ship. Use when the user says bump the version, new version, make this v2.0, or release a new build of Batting Practice or SkidRoller.
argument-hint: "<game> [new version]"
---

# Bump a game's version

Each game lives in a folder named with its version (`batting-practice-v1.9`, `platformer-game-v1.5`), and its script and style files carry the same suffix (`game-v1.9.js`, `style-v1.9.css`). The game's README ends with a `## Files` section that lists the exact steps for that game. Treat that list as the source of truth, and the steps below as the general recipe.

## 1. Pick the game and the number

- Find the game's folder: `ls -d *-v*/`. Match the user's wording (Batting Practice → `batting-practice-v*`, SkidRoller or the platformer → `platformer-game-v*`).
- If the user gave a version, use it. If not, use the next minor number (1.5 → 1.6, 1.9 → 1.10). Moving to a new major number (2.0) is the user's call: ask if they've hinted at a big release.
- Below, `OLD` is the current version (e.g. `1.9`) and `NEW` is the new one.

## 2. Rename the folder and files

Use `git mv` so history follows the files:

- The folder: `<name>-vOLD` → `<name>-vNEW`.
- Every file in it whose name ends in `-vOLD.<ext>` → `-vNEW.<ext>`.
- Leave unversioned files alone (`index.html`, `README.md`, `*.mp3`).

## 3. Update the version everywhere

- `VERSION` near the top of the game script (`const VERSION = "OLD";`).
- `index.html`: the `<title>`, the `<h1>` (`<small>vOLD</small>`), and every script/style link.
- Comments that name versioned files (Batting Practice's `sfx-v*.js` names its embedded-audio files).
- The game README: the `# Title vOLD` heading, the folder and file names under "Download and play", and the `## Files` list.
- The main `README.md`: the link text, the link target, the bolded name and version, and the README link. It also names a folder as an example under "How to play"; update it if it's this game.

Then search for leftovers: `grep -rn "vOLD\|-vOLD\|\"OLD\"" <new-folder> README.md`. Hits in the change log describing older versions are history; keep them. Skip the base64 audio files (`*-v*.js` that start with `const ..._MP3 =`), which are too big to grep usefully.

## 4. Embedded audio

Batting Practice keeps base64 copies of its mp3s (`bat-hit-vX.js`, `organ-intro-vX.js`) so the sounds play from `file://`. Step 2 renamed them. If an mp3 was added or changed since the last commit (`git status`), regenerate its copy:

```bash
bash .claude/skills/bump-version/embed-audio.sh <folder>/bat-hit.mp3 <folder>/bat-hit-vNEW.js BAT_HIT_MP3
```

Use the const name the existing file uses (look at its second line). For a new mp3, add a `<script>` tag for it in `index.html` before the sfx script, and list both files in `## Files`.

## 5. Change log entry

At the top of the game README's `## Change log`, add:

```
### NEW: Short title of what's new

- What the player will notice, one bullet each.
```

If the version is going up together with feature work, describe the features. If the bump only renames things, say so briefly. The 1.8 and 1.5 entries are examples.

## 6. Check it

- `node --check` each `.js` file in the new folder (skip the base64 audio files).
- Screenshot it with headless Edge (see /ship step 2) and confirm the new version shows in the heading and in the game.

## 7. Ship

Follow the /ship skill to update any remaining docs, commit (`<Game> vNEW: ...`) and push.
