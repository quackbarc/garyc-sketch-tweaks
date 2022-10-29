
# ![the unofficial sketch mascot, crunge](/crunge.png)&nbsp;garyc.me sketch tweaks

A personal userscript for garyc.me/sketch. Nothing too game-changing, like extra tools on the drawing client. Just a handful of visual tweaks and a plethora of bug fixes.

This script is currently not compatible with older browsers that don't support `async`/`await` syntax, the Fetch API, or CSS grid, e.g. IE.

A complete list of changes by the script is listed below.

## Features

* Dark theme, automatically detected or manually set.
* Drawing client redesigned to imitate the old Flash UI.
* Gallery sketch caching to a configurable limit.
* Additional details on gallery sketches, like ink used.
* Optional auto-skipping and optional replay of sketch animations.

### Bug fixes

* Fixed drawing client and gallery sketches being spiky.
* Fixed swap button getting locked on undo.
* Fixed swap button alternating its text during swaps.
* Corrected button locking after swaps/peeks.

#### Gallery

* Fixed canvas showing up for a split second on page load.
* Fixed canvas being 798x598 instead of 800x600.
* Fixed arrow-key navigation always starting at the latest sketch.
* Fixed a race condition with loading sketches.
* Fixed out-of-bounds sketches causing constant errors on console.
* Fixed duplicate sketches from scrolling down.
* Fixed sketches being saved with a `.jpg` extension despite being PNGs.
* URL changes now navigate sketches.
* Loading the same sketch twice won't redraw the sketch.

### Other technical tweaks

* Sketch stats are fetched every 30 seconds instead of 60.
* Swapping and peeking are properly mutex locked.
* Swapping and peeking now handle request errors.
* Swapping and peeking wouldn't send extra `getStats` requests.
* Gallery immediately refreshes sketches on page load so it's up to date.
* Gallery canvas is focusable by tabbing.
* Viewer uses CSS grid for better alignment.
* Viewer gets hidden by `display: none` instead of having its HTML purged.
* `show()` casts passed-in IDs into a `Number` first since the fire from page load passes them as strings.

### Personal tweaks

* There's a nice little interface for userscript preferences (found in the gallery).
* Pressing left/right in the gallery without the viewer sketch open will show the latest sketch.
* Gallery dims out when viewing sketches. Gary commented this out in his code and I thought it looked nice.
* Gallery viewer has a box shadow so it visually stands out.
* Gallery viewer buttons also dim out when hovered. The close and save buttons now have a pointer too.
* Some personal keybinds for the gallery viewer:
    * `space` to skip animation;
    * `ctrl`-`S` to save a sketch;
    * `ctrl`-`C` to copy the sketch URL; and
    * `ctrl`-`shift`-`C` to copy the sketch canvas.

## Installation

1. Install Violentmonkey or Tampermonkey onto your browser.
2. Simply open up the [raw version of sketch.user.js](https://github.com/quackbarc/garyc-sketch-tweaks/raw/master/sketch.user.js).
3. The extension should automatically install the userscript.
