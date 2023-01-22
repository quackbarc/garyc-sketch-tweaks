
# ![the unofficial sketch mascot, crunge](/crunge.png)&nbsp;garyc.me sketch tweaks

A personal userscript for garyc.me/sketch. Nothing too game-changing, like extra tools on the drawing client. Just a handful of visual tweaks and a plethora of bug fixes.

This script is currently not compatible with older browsers that don't support `async`/`await` syntax, the Fetch API, or CSS grid, e.g. IE.

## Installation

1. Install Violentmonkey or Tampermonkey onto your browser.
2. Open up [sketch.user.js](https://github.com/quackbarc/garyc-sketch-tweaks/raw/master/sketch.user.js) onto the browser.
3. The extension should automatically prompt to install the userscript.

-----

A complete list of changes by the script is listed below.

## Features

* Dark theme, automatically detected or manually set.
* Drawing client redesigned to imitate the old Flash UI.
* Gallery sketch caching to a configurable limit.
* A slightly better-looking details section on gallery sketches, with extra info like "ink used".
* Optional auto-skipping and replay of sketch animations in the gallery.

### Bug fixes

#### Drawing client

* Fixed drawing client and gallery sketches being spiky.
* Fixed swap button getting locked on undo.
* Fixed swap button alternating its text during swaps.
* Corrected button locking after swaps/peeks.

#### Gallery

* Fixed canvas showing up for a split second on page load.
* Fixed canvas being 798x598 instead of 800x600.
* Fixed arrow-key navigation always starting at the latest sketch.
* Fixed a race condition with loading sketches.
* Fixed sketch animations ending one line too early.
* Fixed duplicate sketches from scrolling down.
* Fixed sketches being saved with a `.jpg` extension despite being PNGs.
* Handled silent errors from parsing unreachable sketches as JSON, as it's actually sent as raw text.
* URL changes now navigate sketches.
* Concurrent fetches of sketches will only animate the sketch once.
* Pressing `escape` on the gallery while images are still loading will keep them loading.
* The left button on the sketch viewer automatically appears when the gallery gets updated.
* Gallery wouldn't load old sketches that are unreachable (sketches that would show up as X's), by default at least.

### Other technical tweaks 🤓

* Sketch stats are fetched every 30 seconds instead of 60.
* Swapping and peeking are properly mutex locked.
* Swapping and peeking now handle request errors.
* Swapping and peeking wouldn't send extra `getStats` requests.
* Sketch animations are now drawn as entire lines than as small segments.
* Viewer uses CSS grid for better alignment.
* Viewer gets hidden by `display: none` instead of having its HTML purged.
* Viewer canvas is focusable by tabbing.
* Viewer buttons aren't user-selectable.
* `show()` casts passed-in IDs into a `Number` first since the fire from page load passes them as strings.
* `show()` ignores non-numerical IDs.

### Personal tweaks

* There's a nice little interface for userscript preferences (found in the gallery).
* Thumbnails can be shown in different qualities: default (100%), downscaled (40%), rasterized (20.1%) and the old default (20%).
* Pressing left/right in the gallery without the viewer sketch open will show the latest sketch.
* Gallery dims out when viewing sketches. Gary commented this out in his code and I thought it looked nice.
* Gallery viewer has a box shadow so it visually stands out.
* Gallery viewer buttons also dim out when hovered. The close and save buttons now have a pointer too.
* Some personal keybinds for the gallery viewer:
    * `space` to skip (or replay) sketch animation;
    * `ctrl`-`S` to save a sketch;
    * `ctrl`-`C` to copy the sketch URL; and
    * `ctrl`-`shift`-`C` to copy the sketch canvas.
* Hovering on sketch timestamps will show its full date and time.
* Sketch timestamps may show dates as "Today" or "Yesterday".
    * This can be disabled, mainly because I can't be bothered localizing those words for other time locales.

---
