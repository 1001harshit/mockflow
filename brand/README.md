# Brand marks

Three candidates, each 512×512 with a rounded-square ground so they work as an
application icon. Amber `#f0a52a` through ember `#f2683c` — the palette the
dashboard uses.

| File | Idea | Reads best as |
|------|------|---------------|
| `logo-1-split` | One request in, two ways out: one served, one deliberately broken | Wide marks, docs headers |
| `logo-2-pulse` | A steady response stream with one beat dropped | Wordmark lockups |
| `logo-3-braces` | JSON braces around a bolt — a response, and the fault you put in it | **App icon** — symmetrical and readable small |

Each has an `.svg` (the source, edit this) and a `.png` (rendered at 512).

Gradients use `gradientUnits="userSpaceOnUse"`. A horizontal path has a
zero-height bounding box, and an `objectBoundingBox` gradient collapses to
nothing on one — which silently erased a stroke the first time round.
