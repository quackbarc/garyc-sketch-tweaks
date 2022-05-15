
# garyc.me sketch tweaks

A personal userscript for garyc.me/sketch, consisting of QoL tweaks and bug fixes.

This might not work for IE since this utilizes template strings, `let`/`const`, and the CSS grid layout for gallery and viewer alignment, both of which IE has very weak support of.
<!-- just say ES6 -->

## Features

* Dark theme, automatically detected or manually set.
* Gallery sketch caching to a configurable limit.
* Additional details on gallery sketches, like ink used.

### Bug fixes

* Fixed drawing client and gallery sketches being spiky.
* Fixed canvas showing up for a split second on page load.
* Fixed canvas being 798x598 instead of 800x600.
* Fixed arrow-key navigation always starting at the latest sketch.
* Fixed a race condition with loading sketches.
* Fixed out-of-bounds sketches causing constant errors on console.
* Fixed URL changes not navigating to that sketch.
* Fixed duplicate sketches from scrolling down.
* Fixed sketches being saved as `.jpg` despite being PNGs.
* Loading the same sketch twice won't redraw the sketch.

### Other technical tweaks

* Gallery canvas is focusable by tabbing.
* Gallery uses CSS grid to fix the padding error with new sketches.
* Viewer uses CSS grid for better alignment.
* Viewer doesn't regenerate its HTML everytime.
* `show()` casts passed-in IDs into a `Number` first since the fire from page load passes them as strings.

### Personal tweaks

* Pressing left/right in the gallery without the viewer sketch open will show the latest sketch.
* Gallery dims out when viewing sketches. Gary commented this out in his code and I thought it looked nice.
* Gallery viewer buttons also dim out when hovered. The close and save buttons now have a pointer too.
* DOM manipulation with jQuery is done with arrays.
* Some personal keybinds for the gallery viewer:
    * `space` to skip animation;
    * `ctrl`-`C` to copy the sketch URL; and
    * `ctrl`-`shift`-`C` to copy the sketch canvas.

<!-- todo: add license.txt, AGPL? -->
<!-- todo? add installation section -->
