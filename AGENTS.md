# Project rules

A static fan site: `index.html`, CSS in `tokens.css`, `base.css` and `styles.css`, ES modules in `js/`, the plan-link codec in `plan.js`, and the service worker in `sw.js`. No build step. `README.md` describes the features; `tools/e2e/BEHAVIOUR.md` maps each one to its test.

## Tools

- JavaScript: `bun` and `bunx --bun` only. Never npm, npx, yarn or pnpm.
- Python: `uv` and `uvx` only (`uv run script.py`). Never pip or a bare `python3`.

## Checks

Run all four before you commit. CI runs the same.

```sh
bun test                 # plan link, paint swap, item order, asset versions, precache, text-check matcher
bun run e2e              # browser journeys and axe; bun run e2e <name> runs one; CHROME_PATH picks the browser
bun tools/check-text.js  # no em dash, en dash or emoji in tracked text
bunx --bun html-validate@11.21.1 index.html
```

A failing check is a finding: find the cause. Never change a test only to make it pass. When you fix a bug, add a test that fails with the fix reverted.

## Deploys

- Each deploy bumps the cache name in `sw.js` (`iop26-vN`) and every `?v=N` in `index.html` and `js/*.js` to the same N. `bun test` fails if they differ.
- A new page file goes in `PRECACHE` in `sw.js` and in the stage step of `.github/workflows/site.yml`. The `offline` journey fails if a precached path does not return 200.
- The live site (iop.csk.fyi) is GitHub Pages from `main` of the upstream repo, and the owner also pushes to `main`. Before a PR, merge the latest `upstream/main` and set the cache name and `?v` above the live value.
- Experimental browser APIs (HTML-in-Canvas in `js/story.js`) differ between the explainer and shipping Chrome. Local Chromium can lack them; the CI Chrome is the real test. Set every known attribute form and catch a throw into the drawn fallback.

## Generated files: never edit by hand

| File | Rebuild |
| --- | --- |
| `sports-car.svg`, and the hero car, ruler and build model blocks in `index.html` | `bun tools/build-car.js` (CI fails if they differ) |
| `og-v3.png` | `bun tools/build-og.js`, then the Chromium screenshot command in `README.md`; give a new image a new file name |
| `icons/*.png` | `rsvg-convert` from the SVG sources (`README.md` lists the commands) |

## Data that must not break

- The local storage key `brick-by-brick-iop26-v1` and its fields keep old ticks. Do not rename them.
- `PLAN_ITEMS` in `plan.js`: append new items only. Never rename, remove or reorder an id; retire it in `RETIRED_ITEMS`.

## Writing

- ASD-STE100 Simplified Technical English for docs, comments and commit messages. No em dashes, en dashes or emoji anywhere (`tools/check-text.js` enforces it).
- A comment gives a reason the code cannot show (a source, a browser workaround, a WCAG rule). Delete comments that restate the code.
- Motion uses transform and opacity, has a `prefers-reduced-motion` path, and hover effects sit under `(hover: hover) and (pointer: fine)`. Keep WCAG 2.x AA.
- Conventional Commits, signed. Subject at most 50 characters, body lines at most 72.
- When you correct an agent, turn the correction into a check. Do not add a rule here for something a check can catch.
