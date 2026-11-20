# Behaviour map

Each user-visible feature, from the visitor's point of view, and the test that guards it. Use these names when you talk about the page. `bun run e2e <name>` runs one journey; `bun test` runs `tools/site.test.js`.

| Feature | What the visitor sees | Guarded by |
| --- | --- | --- |
| Day and list switches | One thumb slides between segments. A drag from the selected segment moves it with the finger or mouse and the release picks the nearest segment; the thumb lifts to glass while held. A tap and the keyboard still select. | `segment` |
| Checklist ticks and days | 23 items in two lists (tabs on a phone). Saturday and Sunday are separate lists; Both shows Sat and Sun buttons per item. Ticks survive a reload; reset asks first. A corrupt or blocked store does not break the list. | `checklist` |
| Progress and build model | The count and meter update on each tick; the brick 911 gains a part per tick. When the day is complete, the label says "Ready to go" and the car revs once: the nose lifts on the rear tyre, settles, and the exhaust puffs. No rev with reduced motion. | `checklist` |
| Part flight | A tick sends one plate from the box to its slot in the model; the count does not wait for it. | `checklist` |
| Paint picker and tooltips | Eight paints on the hero car; the choice survives a reload. Hover (after a wait), keyboard focus and a long press on touch show the paint's story; Escape closes it; a long press does not change the paint. | `paint` |
| Repaint wave and settle | Rows repaint from the base up, the body sways once and the wheels roll with it; fast taps end on the last paint. | `paint` |
| Story image and share fallback | A 1080 x 1920 story image of the visitor's 911 with their name; where files cannot be shared, the page offers the image to save. The image is never blank or clear. | `share`, `story-export` |
| Name | The name is cut to 24 characters and is back in the field after a reload. The field shows a hint, fits a 24-character name, and has a clear button that shows only with text. | `share` |
| Plan link and banner | Copy a link to the list; a friend who opens it sees a banner, adds the ticks, and can undo or dismiss. A broken link is ignored and removed from the address bar. | `share`, `bun test` (codec) |
| Offline | After one visit the page and a plan link open with no signal, with the self-hosted fonts. | `offline` |
| Engine | Each cylinder fires at top dead centre in the order 1-6-2-4-3-5, opposed pairs mirror, and the run button starts and pauses it. | `engine` |
| Tyre-mark links | Links that go somewhere draw a tyre tread instead of an underline, never both. | `layout` |
| Scroll rail and exhaust | From 53.75rem wide, a small 911 drives down the right edge and wipes on each paint in turn; a firm flick puffs exhaust, reading and keys do not. | `rail` |
| Car cursor | With a mouse, the car cursor shows over the hero car and the swatches; text keeps its own cursor; touch shows no change. | `rail` |
| Smooth scroll | Anchor links glide to the section and land below the header. | `rail` |
| Reduced motion | The repaint is instant, anchor links jump, the rail is hidden, and no part flies. | `paint`, `rail` |
| Header and fold | No sideways scroll from 320 to 1920 px; on a 360 x 660 phone the header stays two rows and the first paint swatch is on the first screen. | `layout` |
| Foldables | On a 344 px cover screen nothing scrolls sideways and the first swatch is on the first screen. Open and flat from 40rem, both lists sit side by side. Folded like a book, the hero and paint sit on the left pane and the checklist on the right; folded like a laptop, the hero stays in the top pane and the page scrolls in the bottom pane. No text, button or car sits on the hinge. Browsers without the Viewport Segments API keep the normal layout. | `foldable` |
| Accessibility | No axe WCAG 2.x A or AA violations, fresh and with a saved list, at phone and desktop sizes. | `a11y` |
| Console greeting | One short ASCII 911 with the source link in the console. | `layout` |
| Deploys | Every `?v=` matches the cache name, every module and precached file exists, and no text has an em dash, en dash or emoji. | `bun test`, `offline`, `tools/check-text.js` |

## Pinned regressions (19 November)

Each test fails with its fix reverted.

| Bug | Test |
| --- | --- |
| Blank or clear story export when `drawElementImage` draws nothing | `story-export` |
| Doubled underline under the ticket link's tyre mark | `layout` |
| Header grew to three rows at 360 x 660 and hid the first swatch | `layout` |
| A missing precache file blocked the service worker install | `offline` |
| The list has 23 items | `checklist` |
| The saved name was missing from the field after a reload (found in this cleanup) | `share` |
