
// ==UserScript==
// @name        garyc.me sketch tweaks
// @namespace   garyc.me by quackbarc
// @description QoL tweaks and personal mods for garyc.me/sketch
// @homepage    https://github.com/quackbarc/garyc-sketch-tweaks
// @author      quac
// @version     1.3.2
// @match       https://garyc.me/sketch*
// @icon        https://raw.githubusercontent.com/quackbarc/garyc-sketch-tweaks/master/crunge.png
// @downloadURL https://github.com/quackbarc/garyc-sketch-tweaks/raw/master/sketch.user.js
// @updateURL   https://github.com/quackbarc/garyc-sketch-tweaks/raw/master/sketch.user.js
// @run-at      document-body
// @grant       none
// @require     https://gist.githubusercontent.com/arantius/3123124/raw/grant-none-shim.js
// ==/UserScript==

/* TODO:
    - SVG saving..?
    - animation speed setting..?
    - option to save the canvas instead of the getIMG link?

    - sketch: update():
      - update the UI with updateUI(State.IDLE)
      - fix animation ending one line too early
      - fix animation using the moveTo/lineTo way of drawing

    - debug:
      - having the viewer open takes up a lot of CPU for some reason; i'm blaming pixi.
*/

var settings = {};

async function _sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

/* interval purging */

const lastInterval = setTimeout(() => void 0, 0) - 1;
for(let int = 0; int <= lastInterval; int++) {
    clearInterval(int);
}

/* / */

function _getSettings() {
    const defaultSettings = {
        changeHashOnNav: true,
        cacheSize: 100,
        theme: "auto",
        noAnimation: false,
        doReplay: false,
        thumbQuality: "default",
        sketchQuality: "default",
        relativeTimestamps: true,
    };
    let storedSettings = JSON.parse(localStorage.getItem("settings_sketch")) || {};
    return {...defaultSettings, ...storedSettings};
}

function _saveSettings() {
    localStorage.setItem("settings_sketch", JSON.stringify(settings));
}

function _updateTheme() {
    switch(settings.theme) {
        case "auto": {
            let prefersDark = (
                window.matchMedia
                && window.matchMedia("(prefers-color-scheme: dark)")
            );
            $("html").attr({"theme": prefersDark ? "dark" : "light"});
            break;
        }
        case "dark":
        case "light": {
            $("html").attr({"theme": settings.theme});
            break;
        }
        default: {
            $("html").attr({"theme": "light"});
        }
    }
}

function _updateSketchQuality(quality) {
    const ctx = $("canvas")[0].getContext("2d");

    switch(quality) {
        case "spiky": {
            ctx.lineJoin = "miter";
            break;
        }
        case "default":
        default: {
            ctx.lineJoin = "round";
            break;
        }
    }
}

function main() {
    settings = _getSettings();

    GM_addStyle(`
        /* dark theme */
        :root[theme="dark"] body {
            background-color: #111;
            color: #ccc;
        }
        :root[theme="dark"] #holder {
            background-color: #191919;
        }
        :root[theme="dark"] #holder img:not([src^=save]) {
            filter: invert(90%);
        }
        :root[theme="dark"] input[type="submit" i]:disabled button:disabled {
            background-color: #fff3;
            color: #fff8
        }
        :root[theme="dark"] h1 {
            color: #eee;
        }
    `);
    _updateTheme();
}

main();

if(window.location.pathname.startsWith("/sketch")) {
    let db = new URLSearchParams(window.location.search).get("db");
    window.db = db && parseInt(db);    // db can be `null`
}

/* /sketch/gallery.php */

const cache = {};
let lastAlertPromise = null;
let cachedCanvasBlob = null;
window.surpassPossible = false;
window.details = null;

function _getThumbSize(qualityName) {
    switch(qualityName) {
        case "oldDefault":
            return 20;
        case "raster":
            return 20.1;
        case "hq":
            return 40;
        case "default":
        default:
            return 100;
    };
}

function getTile(id) {
    let size = _getThumbSize(settings.thumbQuality);

    let dbParam = window.db != null ? `&db=${window.db}` : "";
    return $([
        `<a href="#${id}" onclick="show(${id});">`,
        `<img src="getIMG.php?format=png${dbParam}&id=${id}&size=${size}" style="`,
            `padding: 5px;`,
            `width: 160px;`,
            `height: 120px;`,
        `"></a>`,
    ].join(""));
}

function currentURL() {
    if(window.db != null) {
        return `https://garyc.me/sketch/gallery.php?db=${window.db}#${window.current}`;
    } else {
        return `https://garyc.me/sketch/gallery.php#${window.current}`;
    }
}

function updateDetails(msg=null) {
    const unavailable = window.dat == "wait";
    let elems = [];

    if(msg != null) {
        elems.push(msg);
    } else if(unavailable) {
        elems.push("(unavailable)");
    } else {
        let ink = Math.floor(window.dat.length / 65535 * 100);
        let inkText = `${ink}% ink used`;
        elems.push(inkText);
    }

    // This build custom HTML for the URL, unlike currentURL(), which only
    // returns it as a string.
    let current = `<span class="id">#${window.current}</span>`;
    let url = (
        window.db != null
        ? `https://garyc.me/sketch/gallery.php?db=${window.db}${current}`
        : `https://garyc.me/sketch/gallery.php${current}`
    );
    elems.push(url);

    if(!unavailable) {
        let origin = window.details.origin;
        let date = new Date(window.details.timestamp * 1000);
        let timestamp = date
            .toLocaleString("default", {
                weekday: "short",
                month: "long",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        let timestampTooltip = date
            .toLocaleString("default", {
                weekday: "short",
                month: "long",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZoneName: "short",
            });
        if(settings.relativeTimestamps) {
            const today = new Date();
            const yesterday = new Date(today - 86_400_000);
            const dateOptions = {
                weekday: "short",
                month: "long",
                day: "2-digit",
                year: "numeric",
            };
            timestamp = timestamp
                .replace(today.toLocaleString("default", dateOptions), "Today")
                .replace(yesterday.toLocaleString("default", dateOptions), "Yesterday");
        }
        let timestampHTML = `<span title="${timestampTooltip}">${timestamp}</span>`;
        let detailsText = `<span class="extra">from ${origin} • ${timestampHTML}</span>`;
        elems.push(detailsText);
    }

    $("#details").empty();
    $("#details").append(elems.join("<br>"));
}

async function detailsAlert(msg) {
    updateDetails(msg);
    let alertPromise = lastAlertPromise = _sleep(3000);
    await alertPromise;
    if(alertPromise === lastAlertPromise) {
        updateDetails();
    }
}

function updateStats(json) {
    const {sketches, artists, peekers} = json;
    let es_were = sketches == 1 ? " was" : "es were";
    let different_artists = artists == 1 ? " artist" : "different artists";
    let were = peekers == 1 ? "was" : "were";
    let people = peekers == 1 ? "person" : "people";

    $("#stats").html(
        "In the past 5 minutes, "
        + `<b>${sketches}</b> sketch${es_were} swapped by `
        + `<b>${artists}</b> ${different_artists}. There ${were} also `
        + `<b>${peekers}</b> ${people} who only peeked.`
    );
}

// overrides

function gallery_update() {
    if(autodrawpos >= 0) {
        for(var i = 0; i < 8; i++) {
            if(autodrawpos == lines.length) {
                autodrawpos = -1;
                break;
            }
            var line = lines[autodrawpos++];
            if(line.moveTo) {
                graphics.moveTo(line.x1, line.y1);
            }
            graphics.lineTo(line.x2, line.y2);
        }
    }
}

async function refresh() {
    $("#refresh").prop("disabled", true);
    $("#refresh").val("checking...");

    function enableRefresh() {
        $("#refresh").prop("disabled", false);
        $("#refresh").val("refresh");
    }

    $.ajax({
        url: `/sketch/getStats.php?details&db=${db || ""}`,
        dataType: "json",
        success: function(json) {
            updateStats(json);

            const newMax = json.maxID;
            if(window.max == newMax) {
                return enableRefresh();
            }

            for(let id = window.max + 1; id <= newMax; id++) {
                $("#tiles").prepend(
                    $(getTile(id))
                      .hide()
                      .show(1000)
                );
            }

            if(window.current == window.max) {
                let cur = window.current;
                let left = [
                    `<a href="#${cur+1}" onclick="show(${cur+1})" class="left">`,
                        `<img src="left.png">`,
                    `</a>`,
                ].join("")
                $(".left").replaceWith(left);
            }

            window.max = newMax;
            window.min = json.minID;
            enableRefresh();
        },
        error: function(req) {
            enableRefresh();
        },
    });
}

function gallery_drawData(data) {
    reset();

    var parts = data.split(" ");
    var ox = 0;
    var oy = 0;
    for(var i = 0; i < parts.length; i++) {
        var part = parts[i];
        for(var j = 0; j < part.length; j += 4) {
            var x = dec(part.substr(j, 2));
            var y = dec(part.substr(j+2, 2));
            if(j >= 4) {
                lines.push({
                    moveTo: (j == 4),
                    x1: ox,
                    y1: oy,
                    x2: x,
                    y2: y,
                });
            }
            ox = x;
            oy = y;
        }
    }

    // dunno what this extra space is for but that's what was
    // on the original client
    window.dat = data.trim() + " ";

    autodrawpos = 0;
}

function show(id) {
    // show() via page init passes the ID as a string (from URL hash).
    // can't change that since it's fired from an event listener.
    id = parseInt(id);
    if(Number.isNaN(id)) return;

    if(id == 0) return;
    // prevents showing the same sketch again.
    if(id == window.current) return;

    window.current = id;

    if(settings.changeHashOnNav) {
        window.location.hash = id;
    }

    // html building
    // TODO: don't rebuild this everytime this function's called

    var downloadFn = window.db == null ? `${id}` : `${window.db}#${id}`;
    var top = `<a href="#0" onclick="hide()" class="top"><img src="top.png"></a>`;
    var leftReg = `<a href="#${id+1}" onclick="show(${id+1})" class="left"><img src="left.png"></a>`;
    var leftMax = `<div class="left"></div>`;
    var left = id == max ? leftMax : leftReg;
    var right = `<a href="#${id-1}" onclick="show(${id-1})" class="right"><img src="right.png"></a>`;
    var save = [
        `<a`,
            ` href="getIMG.php?format=png&db=${window.db}&id=${id}"`,
            ` download="${downloadFn}.png"`,
            ` class="save"`,
        `>`,
        `<img src="save.png" style="width: 25px; height: 25px; position: relative;">`,
        `</a>`,
    ].join("");
    var bottom = `<div id="details">...</div>`;

    $("#holder").addClass("active");
    $("#holder").empty();
    $("#holder").append([top, left, sketch, right, bottom, save]);
    $("#tiles").css({opacity: "75%"});

    // clear alerts and other cached properties from the last shown sketch
    lastAlertPromise = null;
    // clearing the cached blob is better done on reset() but i don't wanna
    // monkeypatch that method right now just for this
    cachedCanvasBlob = null;

    sketch.show();
    sketch.on("click", () => {
        if(autodrawpos == -1 && settings.doReplay) {
            drawData(window.dat);
        } else {
            setData(window.dat);
        }
    });
    reset();
    get(id);
}

function hide() {
    $("#tiles").css({opacity: "100%"});
    $("#holder").removeClass("active");
    window.location.hash = 0;
    window.current = null;
    window.details = null;
    reset();
}

function addToCache(id, details) {
    details.data = details.data.trim();
    cache['#' + id] = details;
    let keys = Object.keys(cache);
    let tail = keys[0];
    if(keys.length > settings.cacheSize) {
        delete cache[tail];
    }
}

async function get(id) {
    function success(details) {
        let dat = details.data;
        window.dat = dat;
        window.details = details;
        updateDetails();

        if(dat == "wait") return;
        if(window.autodrawpos == -1) {
            if(settings.noAnimation) {
                setData(dat);
            } else {
                drawData(dat);
            }
        }
    }

    if(cache.hasOwnProperty("#" + id)) {
        return success(cache["#" + id]);
    }

    $.ajax({
        url: `/sketch/get.php?db=${db || ""}&id=${id}&details`,
        dataType: "text",
        success: function(resp) {
            // Despite being a JSON endpoint, "wait" still gets sent as plain
            // text without quotes.
            let details;
            if(resp == "wait") {
                details = {
                    id: id,
                    data: "wait",
                    timestamp: null,
                    origin: null,
                }
            } else {
                details = JSON.parse(resp);
            }

            if(window.dat.trim() == details.data.trim()) {
                // We already loaded this sketch; don't load it again.
                return;
            }

            addToCache(id, details);
            if(window.current == id) {
                success(details);
            }
        },
        error: function(req) {
            $("#details").html("network error.");
        },
    });
}

function addMore(n=100) {
    const hardLimit = 1;
    const lastPossible = Math.max(hardLimit, (Math.floor(window.max / 1000) - 5) * 1000 + 1);
    const limit = surpassPossible ? hardLimit : lastPossible;

    let last = window.max - ($("#tiles").children().length) + 1;
    let target = Math.max(last - n, limit);
    let newtiles = [];
    for(let id = last - 1; id >= target; id--) {
        newtiles.push(getTile(id));
    }

    if(target == limit && last != limit) {
        $("#tiles").after(`<div id="tilesEnd">reached the end of the gallery.</div>`);

        // note: we don't show the button if we're at the hard limit
        if(!window.surpassPossible && limit > hardLimit) {
            $("#tilesEnd").append([
                `<br>`,
                `<button id="surpassPossible">load more anyway</button>`,
            ].join(""));

            $("button#surpassPossible").click(() => {
                window.surpassPossible = true;
                $("#tilesEnd").remove();
            });
        }
    }

    $("#tiles").append(newtiles);
}

function createPreferencesUI() {
    const button = $("<button>preferences</button>");
    const preferences = $(`<fieldset id="preferences" style="display: none"></fieldset>`);
    preferences.html(`
        <legend>Preferences</legend>
        <div class="preference">
            <label for="theme">Theme:</label>
            <select id="theme" name="theme">
                <option value="auto" selected>System default</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
            </select>
        </div>
        <div class="preference">
            <label for="cachesize">Cache size:</label>
            <input type="number" id="cachesize" min="0">
        </div>
        <div class="preference">
            <label for="skipanimation">Auto-skip sketch animation:</label>
            <input type="checkbox" id="skipanimation">
        </div>
        <div class="preference">
            <label for="doreplay">Enable sketch animation replay:</label>
            <input type="checkbox" id="doreplay">
            <br>
            <i>(with LMB click or space keypress)</i>
        </div>
        <div class="preference">
            <label for="hashnav">Update URL from arrow key navigation:</label>
            <input type="checkbox" id="hashnav">
            <br>
            <i>(useful to turn off to reduce browser history clutter)</i>
        </div>
        <div class="preference">
            <label for="thumbquality">Thumbnail quality:</label>
            <select id="thumbquality" name="thumbquality">
                <option value="default" selected>Default</option>
                <option value="hq">Downscaled</option>
                <option value="raster">Rasterized</option>
                <option value="oldDefault">Old default</option>
            </select>
        </div>
        <div class="preference">
            <label for="sketchquality">Sketch quality:</label>
            <select id="sketchquality" name="sketchquality">
                <option value="default" selected>No spikes (default)</option>
                <option value="spiky">Spiky (old)</option>
            </select>
        </div>
        <div class="preference">
            <label for="relativetimestamps">Show timestamps as relative:</label>
            <input type="checkbox" id="relativetimestamps">
        </div>
    `);

    button.click(() => preferences.slideToggle(200));

    preferences.find("#theme").val(settings.theme);
    preferences.find("#cachesize").val(settings.cacheSize);
    preferences.find("#skipanimation").prop("checked", settings.noAnimation);
    preferences.find("#doreplay").prop("checked", settings.doReplay);
    preferences.find("#hashnav").prop("checked", settings.changeHashOnNav);
    preferences.find("#thumbquality").val(settings.thumbQuality);
    preferences.find("#sketchquality").val(settings.sketchQuality);
    preferences.find("#relativetimestamps").prop("checked", settings.relativeTimestamps);

    preferences.find("#cachesize").change(function(e) {
        settings.cacheSize = e.target.value;
        _saveSettings();
    });
    preferences.find("#hashnav").change(function(e) {
        settings.changeHashOnNav = e.target.checked;
        _saveSettings();
    });
    preferences.find("#skipanimation").change(function(e) {
        settings.noAnimation = e.target.checked;
        _saveSettings();
    });
    preferences.find("#doreplay").change(function(e) {
        settings.doReplay = e.target.checked;
        _saveSettings();
    });
    preferences.find("#theme").change(function(e) {
        settings.theme = e.target.value;
        _updateTheme();
        _saveSettings();
    });
    preferences.find("#thumbquality").change(function(e) {
        settings.thumbQuality = e.target.value;
        _saveSettings();

        let size = _getThumbSize(settings.thumbQuality);
        $("a > img").each(function(ind, img) {
            img.src = img.src.replace(
                /size=[\d.]+/,
                `size=${size}`
            );
        });
    });
    preferences.find("#sketchquality").change(function(e) {
        settings.sketchQuality = e.target.value;
        _updateSketchQuality(settings.sketchQuality);
        _saveSettings();
    });
    preferences.find("#relativetimestamps").change(function(e) {
        settings.relativeTimestamps = e.target.checked;
        _saveSettings();
    });

    return [button, preferences];
}

async function personalKeybinds(e) {
    if(window.current == null) {
        return;
    }

    switch(e.key.toLowerCase()) {
        case " ": {
            // space -- skip/replay animation
            if(!(e.ctrlKey || e.altKey || e.metaKey || e.shiftKey)) {
                e.preventDefault();
                if(autodrawpos == -1 && settings.doReplay) {
                    drawData(window.dat);
                } else {
                    setData(window.dat);
                }
            }
            break;
        }
        case "c": {
            // ctrl+C -- copying URL to clipboard
            if(e.ctrlKey && !(e.altKey || e.metaKey || e.shiftKey)) {
                e.preventDefault();
                await navigator.clipboard.writeText(currentURL());
                await detailsAlert("copied url");
            }

            // ctrl+shift+C -- copying canvas image to clipboard
            if(e.ctrlKey && e.shiftKey && !(e.altKey || e.metaKey)) {
                if(!window.ClipboardItem) {
                    await detailsAlert("no permission to copy canvas");
                    return false;
                }

                e.preventDefault();

                let blob = cachedCanvasBlob || await new Promise((resolve) => {
                    document.querySelector("#sketch").toBlob(blob => resolve(blob))
                });

                if(autodrawpos == -1) {
                    cachedCanvasBlob = blob;
                }

                try {
                    await navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})]);
                }
                catch (e) {
                    // .write will raise a DOMException if the document lost focus.
                    // that should be the only user-made error to expect during the copying anyway.
                    await detailsAlert("failed to copy canvas. try again?")
                    throw e;
                }

                await detailsAlert("copied canvas");
            }
            break;
        }
        case "s": {
            // ctrl+S -- downloads/saves a sketch
            if(e.ctrlKey && !(e.altKey || e.metaKey || e.shiftKey)) {
                e.preventDefault();
                $(".save").click();
            }
        }
    }
}


if(window.location.pathname == "/sketch/gallery.php") {
    GM_addStyle(`
        body {
            margin: 10px 10px;
        }

        input[type=submit], button {
            margin: 5px 4px;
        }

        #stats {
            margin: 0px 4px;
        }

        canvas {
            /* prevent canvas from showing up for a split second on page boot */
            display: none;
        }

        #details {
            box-sizing: border-box;
            padding: 10px 60px;
            width: 100%;
            height: 100%;

            text-align: left;
            font-size: 18px;
            font-family: monospace;
        }

        #details .id {
            font-weight: bold;
        }

        #details .extra {
            opacity: 80%;
            font-style: italic;
        }

        #holder {
            display: none;
            z-index: 1;
            background-color: white;
            box-shadow: 0px 0px 10px #00000077;
            position: fixed;

            /* fixes original centering management */
            position: fixed;
            top: calc((100vh - 800px) / 2) !important;
            /* sure have this computed too i guess */
            left: calc((100vw - 1008px) / 2);
        }

        #holder img {
            user-select: none;
        }

        #tilesEnd {
            padding: 10px;
            text-align: center;
        }

        /* preferences */
        #preferences {
            width: 350px;
            margin: 5px; /* match that of #tiles */
            font-family: monospace;
        }
        #preferences .preference {
            padding: 4px;
        }

        /* grid styles for holder */
        #holder.active {
            display: grid;
        }
        #holder {
            width: auto;
            justify-items: center;
            padding: 0px 2px;
            grid-template-columns: 100px 808px 100px;
            grid-template-rows: 100px 577px 25px 100px;
            grid-template-areas:
                "x x x"
                "l c r"
                "l c s"
                "d d d";
        }
        #holder > .top {grid-area: x;}
        #holder > .left {grid-area: l;}
        #holder > canvas {grid-area: c;}
        #holder > .right {grid-area: r;}
        #holder > #details {grid-area: d;}
        #holder > .save {
            box-sizing: border-box;
            width: 100%;
            padding-left: 5px;
            grid-area: s;
            justify-self: start;
        }

        /* just some stylistic choices */
        #tiles {
            transition: opacity 0.2s ease;
        }
        #holder a {
            cursor: pointer;
        }
        #holder img:hover {
            opacity: 80%;
        }
    `);

    window.update = update;
    window.refresh = refresh;
    setInterval(window.update, 1000/30);
    setInterval(window.refresh, 15000);

    window.drawData = drawData;
    window.show = show;
    window.hide = hide;
    window.addMore = addMore;

    document.addEventListener("keydown", personalKeybinds.bind(this));

    // Fix new scrolling behavior to use the old one instead;
    // i.e. adding thumbnails happens when scrolled to bottom of the page
    $(window).off("scroll");
    $(window).on("scroll", function(e) {
        let bottom = document.body.scrollHeight - (document.body.scrollTop + document.body.clientHeight) < 1;
        if(bottom) {
            addMore(100);
        }
    });

    $(document).off("keydown");
    $(document).on("keydown", function(e) {
        switch(e.key) {
            case "Escape": {
                if(window.current != null) {
                    hide();
                    // Prevent abortion of page load when the viewer is still open.
                    // The user only wants to exit the viewer in this case.
                    e.preventDefault();
                }
            }

            // ArrowLeft and ArrowRight no longer
            // update window.current.

            case "ArrowLeft": {
                if(window.current == null) return;
                if(window.current == window.max) return;
                show(window.current + 1);
                return false;
            }

            case "ArrowRight": {
                if(window.current == null) {
                    show(window.max);
                    return false;
                }
                show(window.current - 1);
                return false;
            }
        }
    });

    window.addEventListener("hashchange", function(e) {
        let id = parseInt(window.location.hash.slice(1));
        // prevent show() from firing again
        if(id == window.current) return;
        if(id == 0) {
            hide();
        } else {
            show(id);
        }
    });

    document.addEventListener("DOMContentLoaded", function() {
        window.current = null;

        const [button, preferences] = createPreferencesUI();
        $("input[type=submit]:last-of-type").after(button);
        $("#tiles").before(preferences);

        // clear the script tag and the extra newline that causes
        // misalignment of new sketches
        document.getElementById("tiles").innerHTML = "";
        // add a little init text for the stats
        document.getElementById("stats").innerHTML = "...";
        // remove text nodes that causes buttons to be spaced out.
        // the spacing will get re-added as css.
        let text_nodes = Array
            .from(document.body.childNodes)
            .filter(e => e.nodeType == Node.TEXT_NODE);
        $(text_nodes).remove();
    });

    $(document).ready(function() {
        $("#holder").css({
            // remove inline css for the style overrides
            left: "",
            margin: "",
            position: "",
            width: "",
        });
        $("#sketch").attr({
            tabindex: "0",
            // fix canvas not being 798x598
            width: "800px",
            height: "600px",
        });

        _updateSketchQuality(settings.sketchQuality);
    })
}

/* /sketch/ */

const SwapState = {
    IDLE: 0,
    SWAPPING: 1,
    PEEKING_FROM_SWAP: 2,
    PEEKING: 3,
    WAITING_PEEK: 4,
    DONE_FROM_SWAP: 5,
    DONE: 6,
}

function _setProgress(n) {
    n = Math.min(Math.max(n, 0), 3);
    let width = Math.round(n / 3 * 100);
    $("#progress").attr({"aria-valuenow": n});
    $("#progressBar").width(`${width}%`);
}

function updateUI(state) {
    switch(state) {
        case SwapState.IDLE: {
            let ink = Math.floor(window.dat.length / window.limit * 100);
            $("#ink").html(`Ink used: ${ink}%`);
            $("#reset").prop("disabled", false);
            $("#undo").prop("disabled", window.dat.length == 0);
            $("#swap").prop("disabled", ink < 1);
            $("#peek").prop("disabled", ink >= 1);
            $("#swap").val("swap");
            _setProgress(0);
            break;
        }
        case SwapState.SWAPPING: {
            let ink = Math.floor(window.dat.length / window.limit * 100);
            $("#ink").html(`Ink used: ${ink}%`);
            $("#reset").prop("disabled", true);
            $("#undo").prop("disabled", true);
            $("#swap").prop("disabled", true);
            $("#peek").prop("disabled", true);
            $("#swap").val("swapping...");
            _setProgress(1);
            break;
        }
        case SwapState.PEEKING_FROM_SWAP: {
            $("#swap").val("swapping...");
        }
        case SwapState.PEEKING_FROM_SWAP:
        case SwapState.PEEKING: {
            let ink = Math.floor(window.dat.length / window.limit * 100);
            $("#ink").html(`Ink used: ${ink}%`);
            $("#reset").prop("disabled", true);
            $("#undo").prop("disabled", true);
            $("#swap").prop("disabled", true);
            $("#peek").prop("disabled", true);
            _setProgress(2);
            break;
        }
        case SwapState.WAITING_PEEK: {
            let ink = Math.floor(window.dat.length / window.limit * 100);
            $("#ink").html(`Ink used: ${ink}%`);
            $("#reset").prop("disabled", true);
            $("#undo").prop("disabled", true);
            $("#swap").prop("disabled", true);
            $("#peek").prop("disabled", true);
            $("#swap").val("waiting for other sketch to be drawn...");
            _setProgress(2);
            break;
        }
        case SwapState.DONE_FROM_SWAP: {
            $("#swap").val("swapped!");
        }
        case SwapState.DONE_FROM_SWAP:
        case SwapState.DONE: {
            let ink = Math.floor(window.dat.length / window.limit * 100);
            $("#ink").html(`Ink used: ${ink}%`);
            $("#reset").prop("disabled", false);
            $("#undo").prop("disabled", true);
            $("#swap").prop("disabled", true);
            $("#peek").prop("disabled", true);
            _setProgress(3);
            break;
        }
    }
}

function resetUI() {
    updateUI(SwapState.IDLE);
    window.locked = false;
}

// overrides

function resetCanvas() {
    graphics.clear();
    graphics.beginFill(0xFFFFFF);
    graphics.drawRect(0,0,800,600);
    graphics.endFill();
    graphics.lineStyle(3, 0x000000);
}

function sketch_setData(data) {
    window.dat = `${data.trim()} `;

    // using normal reset() would've left the wrong buttons enabled
    // every time as if ink really was 0%.
    resetCanvas();
    resetUI();

    const parts = data.split(" ");
    for(var i = 0; i < parts.length; i++) {
        let part = parts[i];
        for(var j = 0; j < part.length; j += 4) {
            var x = dec(part.substr(j, 2));
            var y = dec(part.substr(j+2, 2));
            if(j == 0) {
                graphics.moveTo(x, y);
            } else {
                graphics.lineTo(x, y);
            }
        }
    }
}

function sketch_reset() {
    window.dat = "";
    window.lines = [];
    window.autodrawpos = -1;
    resetCanvas();
    resetUI();
}

function swap() {
    // lock the client *before* the swap request, gary
    updateUI(SwapState.SWAPPING);
    window.locked = true;

    $.ajax({
        url: `swap.php?db=${db || ""}&v=32`,
        method: "POST",
        data: window.dat,
        error: function() {
            alert("There was an error swapping.");
            resetUI();
        },
        success: function(n) {
            n = parseInt(n);
            if(n < 0) {
                alert(`On cooldown; please wait ${n} more seconds before swapping again.`);
                resetUI();
                return;
            }
            window.swapID = n;
            attemptSwap();
        },
    });
}

function attemptSwap() {
    updateUI(SwapState.PEEKING_FROM_SWAP);
    getStats();

    $.ajax({
        url: `get.php?id=${swapID}&db=${db || ""}`,
        method: "GET",
        error: function() {
            setTimeout(attemptSwap, 2000);
        },
        success: function(result) {
            if(result == "wait") {
                updateUI(SwapState.WAITING_PEEK);
                setTimeout(attemptSwap, 2000);
            } else {
                drawData(result);
                getStats();
                updateUI(SwapState.DONE_FROM_SWAP);
            }
        }
    });
}

function getLatest() {
    updateUI(SwapState.PEEKING);
    window.locked = true;

    $.ajax({
        url: `get.php?db=${db || ""}`,
        method: "GET",
        error: function() {
            alert("There was an error getting the latest sketch.");
            resetUI();
        },
        success: function(result) {
            drawData(result);
            getStats();
            updateUI(SwapState.DONE);
        }
    });
}

if(window.location.pathname == "/sketch/") {
    GM_addStyle(`
        /* save button */
        img[src="save.png"] {
            /* shift 5px to the right.
               i don't feel like making this button statically positioned
               because there's whitespace text preceding it, and leaving or
               relying on that might result in inconsistent positioning from,
               say, font size changes...
               doesn't seem easy to take out either in a userscript context,
               unless i maybe go with regex, which i'm not insane enough to
               tackle right now. */
            left: 815px;
        }

        /* flash UI mimicking */
        td input {
            width: 100%;
            height: 30px;
        }
        img[src="save.png"] {
            opacity: .8;
        }
        img[src="save.png"]:hover {
            opacity: 1;
        }

        /* progress bar */
        td.swapContainer {
            display: flex;
            align-items: center;
        }
        td.swapContainer #swap {
            flex: 2;
            min-width: min-content;
        }
        td.swapContainer #progress {
            flex: 3;
            background-color: #f9f9f9;
            border: 1px solid #767676;
            border-radius: 4px;
            height: 16px;
            margin-top: 4px;
            margin-left: 10px;
        }
        #progressBar {
            height: 100%;
            background-color: #a1ef55;
            border-radius: 3px;
            transition: width 0.15s ease;
        }

        /* personal tweaks */
        td {
            padding: 3px;
        }
    `);

    // base site's JS happens at the body,
    // inject when that finishes loading

    document.addEventListener("DOMContentLoaded", function() {
        setInterval(window.update, 1000/30);
        setInterval(window.getStats, 30000);

        window.reset = sketch_reset;
        window.setData = sketch_setData;
        window.swap = swap;
        window.attemptSwap = attemptSwap;
        window.getLatest = getLatest;

        // mark parent of swap button and add progress bar
        // don't wanna use native <progress> due to lack of its styling
        // support on firefox
        const container = $("#swap").parent();
        container.addClass("swapContainer");
        container.append(`
            <div id="progress"
                 role="progressbar"
                 aria-label="swap progress"
                 aria-valuenow="0"
                 aria-valuemin="0"
                 aria-valuemax="3">
                <div id="progressBar" style="width: 0%"></div>
            </div>
        `);

        _updateSketchQuality(settings.sketchQuality);
    })

    $(document).ready(function() {
        $("img[src='save.png']").css({
            left: "",
        });
    });
}
