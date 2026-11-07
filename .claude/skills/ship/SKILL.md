---
name: ship
description: Commit the current vibegames changes and push them to GitHub, updating the game READMEs and the main README first. Use when the user says ship it, push, update GitHub, commit and push, or publish changes. /bump-version ends by running this.
---

# Ship changes to GitHub

Takes whatever is changed in the working tree, brings the docs up to date, commits, and pushes to `origin main` on github.com/jgabemartin/vibegames. Pushing is automatic: don't stop to ask before pushing.

## 1. See what changed

- Run `git status` and `git diff` (and `git diff --staged`).
- If nothing changed, say so and stop.
- Work out which game folder(s) the changes belong to (`batting-practice-v*`, `platformer-game-v*`, ...), or whether they're repo-wide (main README, `.claude/`, `.gitattributes`).
- Look for stray files that shouldn't be committed (temp files, screenshots, editor files, secrets). Leave them out and mention them.

## 2. Check the game still loads

For each game whose code changed:

- `node --check` every changed `.js` file.
- Make sure every `src`/`href` in its `index.html` points at a file that exists.
- Take a screenshot with headless Edge and look at it (PowerShell; save to the scratchpad, not the repo):

  ```powershell
  $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  Start-Process $edge -ArgumentList "--headless=new","--disable-gpu","--user-data-dir=<scratch>\edgeprof","--window-size=900,700","--virtual-time-budget=3000","--screenshot=<scratch>\shot.png","file:///<repo>/<game-folder>/index.html" -Wait
  ```

If something is broken, stop and tell the user instead of shipping it.

## 3. Update the docs

Each game folder has a README with feature sections, a `## Change log` (newest first, `### X.Y: Short title` headings) and a `## Files` list. Match the existing style: plain, short sentences, describing what the player sees.

- **Game README:** update the feature/rules/controls sections the change affects. Add bullets for the change to the **current** version's change log entry (the version in the folder name). Changes ship under the current version until someone runs /bump-version. Update `## Files` if files were added, removed or renamed.
- **Main README** (`README.md` at the root): update the game's one-paragraph blurb if a headline feature changed. Check the links still point at the right folders.
- Docs-only or repo-wide changes don't need a change log entry.

## 4. Commit

- Stage the files explicitly by path (`git add <paths>`). Don't use `git add -A` unless you've checked every file.
- Renamed or moved files may already be staged (`git mv` stages them). Before each commit, run `git diff --staged --stat` and check that exactly the intended files are staged. When splitting work into several commits, run each `git add` + `git commit` as its own step and stop if any `git add` fails, so one commit can't pick up another's files.
- Message format, matching the history:

  ```
  <Game name> v<X.Y>: <what changed, short>

  - Bullet per notable change, wrapped at about 72 columns.
  - Mention README updates in the last bullet if there were any.
  ```

  Use the game's display name (`Batting Practice`, `SkidRoller`). For repo-wide changes, leave out the game prefix.
- End the message with any Co-Authored-By trailer your harness asks for.

## 5. Push

- `git push origin main`.
- If it's rejected because the remote has new commits: `git pull --rebase origin main`, fix any conflicts, then push again. Never force-push.
- If it's rejected because `main` requires a pull request: push to a new branch named for the change, open a PR with `gh pr create`, and give the user the PR link.

## 6. Report

Give the short commit hash and title, the files that changed, and the commit link: `https://github.com/jgabemartin/vibegames/commit/<hash>`.
