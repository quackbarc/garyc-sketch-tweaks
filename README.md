
<div align="center">
    <img alt="image" src="https://github.com/user-attachments/assets/96cf1810-1713-4414-ad26-73bf33cea7db"/>
    <br>
    <i>Featured sketch drawn by Reshig.</i>
    <br>
    <i>Past featured sketches:
        <a href="https://github.com/quackbarc/garyc-sketch-tweaks/assets/49148994/c5f410cf-c71b-4b1a-8348-6ccee2899ed6">
            v1.6.0 by <a href="https://bsky.app/profile/cheepthepeanut.bsky.social">@cheepthepeanut</a>
        </a>
        •
        <a href="https://user-images.githubusercontent.com/49148994/225370421-ab5a70c1-729a-4c90-a1af-fe721c639189.png">
            v1.5.0 by archemachine
        </a>
    </i>
</div>

# ![the unofficial sketch mascot, crunge](/crunge.png)&nbsp;garyc.me sketch tweaks

A personal userscript for [garyc.me/sketch](https://web.archive.org/web/2/https://garyc.me/sketch/)
and [noz.rip/sketch](https://noz.rip/sketch).
Adds a bunch of visual tweaks, a plethora of bug fixes, and a handful
of extra features that might be useful.

## Main features

* Dark theme, automatically detected or manually set.
* Drawing client redesigned to imitate garyc.me's old Flash UI.
* Optional spiky line style for sketches.
* Support for [noz.rip/sketch_bunker](https://noz.rip/sketch_bunker/).
* Support for uploading sketches directly to [noz.rip/booru](https://noz.rip/booru), with extra QoL features like tag autocompletion.

## Installation

1. Install Violentmonkey, Tampermonkey, or any other userscript extension onto your browser.
2. Open up the [latest version of sketch.user.js](https://github.com/quackbarc/garyc-sketch-tweaks/raw/v1.7.0/sketch.user.js) on the browser.
3. The extension should automatically prompt to install the userscript.

Updates on the userscript are automatically installed by the userscript extension whenever there's a version bump.

---

## Tweaks and bug fixes
A complete list of changes by the script is listed below, most of which were originally for garyc.me.

### Drawing client

* Fixed swap button getting locked on undo.
* Fixed swap button alternating its text during swaps.
* Fixed button locking from swaps/peeks.
* Bumped the ink limit from 50KB to 64KB.
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
* Pressing the left/right buttons would only update the page URL but not affect back/forward history.

#### noz.rip

* Added garyc.me's stats bar at the top of the gallery (optional).
* Added noz.rip's old ability to upload sketches straight to noz.rip/booru (optional).
* Fixed canvas' box shadow causing a white border around it.
* The booru form's tags and ratings for a sketch would be kept, even if you switch out of the sketch.
* The booru form won't be shown on unavailable sketches.

### Very technical tweaks

* Sketches in the gallery are cached to a configurable limit.
* Sketches in the gallery are lazily loaded.
* Sketch animations are now drawn as entire lines than as small segments.
* Viewer uses CSS grid for better alignment.
* Viewer gets hidden by `display: none` instead of having its HTML purged.
* Viewer canvas is tab-focusable.
* Viewer buttons aren't user-selectable.
* The close button in the viewer leads to a hashless URL instead of \#0.
* `show()` casts passed-in IDs into a `Number` first since the fire from page load passes them as strings.
* `show()` ignores non-numerical IDs.
* The gallery stats bar is displayed as `inline-block` instead of `inline`.

#### noz.rip
* Viewer canvas is centered with `place-self` instead of `position: absolute`.
* Viewer button SVGs are recreated due to how large their codes are.

### Personal tweaks

* There's a nice little interface for userscript preferences (found in the gallery).
* There's a "load more" button at the end of the gallery. Good for mobile browsers where for some reason sketches can't be added by scrolling to the bottom.
* Pressing `right` in the gallery when no sketch is open shows the latest sketch.
* Pressing `left`/`right` on an unavailable sketch would navigate to the next available sketch instead of just whatever's immediately before or after (which is likely also unavailable).
* The save button in the gallery viewer can save sketches in either `getIMG.php` quality or gallery-player quality.
* When saving with gallery-player quality, sketches may be saved in 1x, 2x, or 4x resolutions.
  * This used to be possible with `getIMG.php` saves, but Gary imposed an upper limit to it at one point.
* Gallery thumbnails can be shown in different qualities: default, downscaled, rasterized, "awful", and the old default.
* Gallery dims out when viewing sketches. Gary commented this out in his code and I thought it looked nice.
* Gallery viewer has a box shadow so it visually stands out.
* Gallery viewer buttons also dim out when hovered. The close and save buttons show a pointer too.
* Some personal keybinds for the gallery viewer:
    * `space` to skip (or replay) sketch animation;
    * `ctrl`-`S` to save a sketch;
    * `ctrl`-`C` to copy the sketch URL; and
    * `ctrl`-`shift`-`C` to copy the sketch canvas.
* Sketch timestamps may show relative dates such as "Today", "Yesterday", or "Monday".
    * This can be toggled off, mainly because localization of those words can be an issue.
* Hovering or clicking/tapping on sketch timestamps will show their full date and time.

#### noz.rip

* Gallery save buttons have hover tooltips indicating what does what.
* The booru form has a rating dropdown.
* The booru form has autocompletion support for tags, with basic keyboard controls like:
    * `Up`/`Down` for navigating the tag list;
    * `Tab`/`Enter` for selecting/creating a tag; and
    * `Escape` to close the tag list.
* The booru form can optionally be submitted without having to open a new tab.
    * This feature is still a bit experimental, so do report any bugs or errors you encounter with it!

#### noz.rip/sketch_bunker

* Sketches made during the April Fools' 2023 event (e.g. 7270084) have partial support;
  backgrounds would only visible when they're clicked on and viewed at the moment.
* Added a button that would load sketches posted later after a `maxid`, if one was given in the URL.
  There's also a status bar on top of the page that tells which sketch ID you're on.

---
