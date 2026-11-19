# Icons of Porsche 2026 Fan Field Guide

A fan-made Icons of Porsche 2026 field guide. The site is designed for visitors who already have a ticket, with a clear checklist, possible keepsakes, Porsche facts, and one secondary link to the official ticket registration page.

The visual direction pairs an original red brick-built 911 illustration with Porsche-inspired colour, clear editorial layout, and restrained brick details. This is an independent fan project, not an official Porsche or LEGO collaboration.

## Run locally

This is a static website with no build step, package install, backend, or database. Open `index.html` in a browser, or serve this folder with a static file server.

## Checklist behaviour

Checklist progress saves in the visitor's browser under the existing `brick-by-brick-iop26-v1` local storage key. Saturday and Sunday are stored separately. The selected day and checklist category also return after a refresh. The combined view lets a visitor update each day independently. The reset controls use a confirmation dialog. If browser storage is unavailable, the checklist remains usable for the open page and explains that ticks will not persist after refresh.

## Files

- `index.html` contains the page content, checklist and engine detail panel.
- `styles.css` contains the responsive layout, colour system, brick-inspired details and reduced-motion behaviour.
- `app.js` handles saved checklist state, progress, reset controls, the engine interaction and scroll-following car.
- `sports-car.svg` is original fan art for the red brick-built 911-inspired car.

Printed items and promotional giveaways in the checklist are possibilities remembered from past visits, not guaranteed event inclusions. Food, drinks, artwork and official merchandise may cost extra.
