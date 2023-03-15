
# ![the unofficial sketch mascot, crunge](/crunge.png)&nbsp;garyc.me sketch tweaks

A personal userscript for garyc.me/sketch.
Nothing too game-changing, like extra tools on the drawing client.
Just a handful of visual tweaks and a plethora of bug fixes.
<!-- you know, I think that's starting to become a lie -->

This script is currently not compatible with older browsers that don't support
`async`/`await` syntax, the Fetch API, or CSS grid, e.g. IE.

## Installation

1. Install Violentmonkey, Tampermonkey, or any other userscript extension onto your browser.
2. Open up [sketch.user.js](https://github.com/quackbarc/garyc-sketch-tweaks/raw/master/sketch.user.js)
onto the browser.
3. The extension should automatically prompt to install the userscript.

Updates to the userscript are regularly checked and handled by the extension,
so re-installing it just to update won't be very necessary.

-----

A complete list of changes by the script is listed below.

## Main features

* Dark theme, automatically detected or manually set.
* Drawing client redesigned to imitate the old Flash UI.
* A slightly better-looking sketch viewer, with extra details like "ink used".
* Optional auto-skipping and replay of sketch animations in the gallery.
* Optional spiky line style for sketches.
* Support for [noz.rip/sketch](https://noz.rip/sketch/) and [noz.rip/sketch_bunker](https://noz.rip/sketch_bunker/).

## Tweaks and bug fixes

### Drawing client

* Fixed swap button getting locked on undo.
* Fixed swap button alternating its text during swaps.
* Fixed button locking from swaps/peeks.
* Swapping and peeking now handle request errors.
* Swapping and peeking won't immediately reload stats.
* Sketch stats are fetched every 30 seconds instead of 60.

### Gallery

* Fixed canvas showing up for a split second on page load.
* Fixed canvas being 798x598 instead of 800x600.
* Fixed arrow-key navigation always starting at the latest sketch.
* Fixed sketch animations ending one line too early.
* Fixed duplicate sketches from scrolling down.
* Fixed sketches being saved with a `.jpg` extension despite being PNGs.
* Fixed URL changes not navigating sketches.
* Fixed a race condition with loading different sketches.
* Fixed concurrent fetches of sketch data causing a sketch to animate more than once.
* Fixed silent errors from parsing unreachable sketches as JSON, as it's actually sent as raw text.
* Fixed pressing `escape` on the gallery aborting a page load.
* Sketch thumbnails are no longer data URIs, which made loading them very slow.
* The left button on the sketch viewer automatically appears when the gallery gets updated.
* Gallery won't load old, unreachable sketches (sketches that show up as X's).
* New sketches will only show up when the page is fully scrolled down.
    * This was the old scrolling behavior; not a huge fan of the new one that adds sketches midway through the page.
      This was probably done for mobile support, which I'll get to working on sometime in the future.

##### noz.rip

* Fixed canvas' box shadow causing a white border around it.

#### Very technical tweaks

* Sketches are cached to a configurable limit.
* Sketch animations are now drawn as entire lines than as small segments.
* Viewer uses CSS grid for better alignment.
* Viewer gets hidden by `display: none` instead of having its HTML purged.
* Viewer canvas is tab-focusable.
* Viewer buttons aren't user-selectable.
* `show()` casts passed-in IDs into a `Number` first since the fire from page load passes them as strings.
* `show()` ignores non-numerical IDs.

##### noz.rip
* Viewer canvas is centered with `place-self` instead of `position: absolute`.
* Viewer button SVGs are recreated due to how large their codes are.

### Personal tweaks

* There's a nice little interface for userscript preferences (found in the gallery).
* Pressing `right` in the gallery when no sketch is open shows the latest sketch.
* Sketches can be saved in either the `getIMG.php` quality or gallery-viewer quality.
* Gallery thumbnails can be shown in different qualities: default, downscaled, rasterized, and the old default.
* Gallery dims out when viewing sketches. Gary commented this out in his code and I thought it looked nice.
* Gallery viewer has a box shadow so it visually stands out.
* Gallery viewer buttons also dim out when hovered. The close and save buttons now have a pointer too.
* Some personal keybinds for the gallery viewer:
    * `space` to skip (or replay) sketch animation;
    * `ctrl`-`S` to save a sketch;
    * `ctrl`-`C` to copy the sketch URL; and
    * `ctrl`-`shift`-`C` to copy the sketch canvas.
* Sketch timestamps may show dates as "Today" or "Yesterday".
    * This can be toggled off, mainly because localization of those words can be an issue.
    * Hovering on sketch timestamps will show their full date and time.

#### noz.rip

* Gallery save buttons have hover tooltips indicating what does what.
* The booru form has a rating dropdown.
* The booru form can optionally send a noz.rip/sketch_bunker archive link as a source.

#### noz.rip/sketch_bunker

* Added the ability to load sketches later than a given `maxid`.
  There's also a status bar on top of the page that tells which sketch ID you're on.

---
