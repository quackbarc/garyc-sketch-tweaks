
// ==UserScript==
// @name        garyc.me sketch tweaks
// @namespace   garyc.me by quackbarc
// @description QoL tweaks and personal mods for garyc.me/sketch
// @homepage    https://github.com/quackbarc/garyc-sketch-tweaks
// @author      quac
// @version     1.4.0
// @match       https://garyc.me/sketch*
// @match       http*://noz.rip/sketch*
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
    - narrow down purgeIntervals() to just the necessary intervals?
      cuz it might consequently affect other extensions.

    - sketch: update():
      - update the UI with updateUI(State.IDLE)
      - fix animation ending one line too early
      - fix animation using the moveTo/lineTo way of drawing

    - noz.rip, gallery:
      - make toSVG() download the blob instead of opening it on the same page?

    - debug:
      - having the viewer open takes up a lot of CPU for some reason; i'm blaming pixi.
*/

var settings = {};

async function _sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

/* interval purging */

function purgeIntervals() {
    const lastInterval = setTimeout(() => void 0, 0) - 1;
    for(let int = 0; int <= lastInterval; int++) {
        clearInterval(int);
    }
}

purgeIntervals();

/* / */

function _getSettings() {
    const defaultSettings = {
        changeHashOnNav: true,
        cacheSize: 100,
        theme: "auto",
        noAnimation: false,
        doReplay: true,
        thumbQuality: "default",
        sketchQuality: "default",
        relativeTimestamps: true,
        showDatecards: true,    // on the UI, these would be called "time cards"
        saveAsCanvas: false,
    };
    if(window.location.hostname == "noz.rip") {
        // noz.rip has its own cache with a limited size; gotta be faithful with it.
        defaultSettings["cacheSize"] = 10;
    }

    let storedSettings = JSON.parse(localStorage.getItem("settings_sketch")) || {};
    return {...defaultSettings, ...storedSettings};
}

function _saveSettings() {
    localStorage.setItem("settings_sketch", JSON.stringify(settings));
}

function _updateTheme() {
    switch(settings.theme) {
        case "auto": {
            let prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
            document.documentElement.setAttribute("theme", prefersDark ? "dark" : "light");
            break;
        }
        case "dark":
        case "light": {
            document.documentElement.setAttribute("theme", settings.theme);
            break;
        }
        default: {
            document.documentElement.setAttribute("theme", "light");
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
        :root[theme="dark"] a {
            color: #5c99ff;
        }
        :root[theme="dark"] a:hover {
            color: #5c99ffcc;
        }
        :root[theme="dark"] a:visited {
            color: #8c1ae9;
        }
        :root[theme="dark"] a:visited:hover {
            color: #8c1ae9cc;
        }

        /* noz.rip */
        :root[theme="dark"] .panel {
            border-color: #888;
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
let datecardDates = new Map();
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
        `<img src="https://garyc.me/sketch/getIMG.php?format=png${dbParam}&id=${id}&size=${size}" style="`,
            `padding: 5px;`,
            `width: 160px;`,
            `height: 120px;`,
        `"></a>`,
    ].join(""));
}

function createDateCard(dt) {
    let weekday = dt.toLocaleString("default", {weekday: "long"});
    let date = dt.toLocaleString("default", {month: "long", day: "numeric", year: "numeric"});
    return $(`
        <div class="datecard">
            <div>
                ${weekday}<br>${date}
            </div>
        </div>
    `);
}

function currentURL() {
    if(window.db != null) {
        return `https://${window.location.hostname}/sketch/gallery.php?db=${window.db}#${window.current}`;
    } else {
        return `https://${window.location.hostname}/sketch/gallery.php#${window.current}`;
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
    let domain = window.location.hostname;
    let current = `<span class="id">#${window.current}</span>`;
    let url = (
        window.db != null
        ? `https://${domain}/sketch/gallery.php?db=${window.db}${current}`
        : `https://${domain}/sketch/gallery.php${current}`
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

        let detailsText = `from ${origin} • ${timestampHTML}`;
        if(origin == null) {
            detailsText = timestampHTML;
        }
        let detailsHTML = `<span class="extra">${detailsText}</span>`

        elems.push(detailsHTML);
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

async function getDateCards(endID, size) {
    if(size <= 0) {
        return [];
    }

    let fromID = endID - size + 1;
    let toID = endID;
    let lastTimestamp = new Date();

    var ret = [];

    const fetchIDFrom = Math.ceil(fromID / 100) * 100;
    const fetchIDTo = Math.ceil(toID / 100) * 100;
    for(let fetchID = fetchIDTo; fetchID >= fetchIDFrom; fetchID -= 100) {
        let html = await fetch(`https://garyc.me/sketch/getMore.php?start=${fetchID}&db=${db || ""}`)
            .then(r => r.text());

        // Parsing HTML with regex instead of making a document dragment,
        // since one, it's cleaner to write than the alternative, and two,
        // we won't get 404s from thumbnails of sketches that don't exist.

        const htmlRegex = /class='timestamp'.+?>(?<timestamp>\d*)<\/div><a href=['"](?<href>#\d+)/g;
        for(const match of html.matchAll(htmlRegex)) {
            if(!match.groups.timestamp) {
                continue;
            }

            let timestamp = new Date(match.groups.timestamp * 1000);
            let href = match.groups.href;
            let id = parseInt(href.replace("#", ""));

            if(lastTimestamp.toDateString() != timestamp.toDateString()) {
                ret.push([timestamp, createDateCard(timestamp), id]);
            }

            lastTimestamp = timestamp;
        }
    }

    return ret;
}

async function getDateCardMapping(last, size) {
    let datecards = {};
    for(const [timestamp, datecard, id] of await getDateCards(last, size)) {
        let date = timestamp.toDateString();
        datecards[id] = [datecard, date];
    }
    return datecards;
}

async function saveCanvas() {
    if(window.current == null) {
        return;
    }

    window.setData(window.dat);

    const sketch = window.sketch[0];
    let blob = await new Promise((res, rej) => sketch.toBlob(blob => res(blob)));
    let url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    let downloadFn = window.db == null ? `${window.current}` : `${window.db}#${window.current}`;
    a.href = url;
    a.download = downloadFn;
    a.click();

    URL.revokeObjectURL(url);
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

    function addLeftButton() {
        let leftAsset;
        switch(window.location.hostname) {
            case "noz.rip": {
                // I don't have noz.rip's left SVGs in hand.
            }
            default: {
                leftAsset = `<img src="https://garyc.me/sketch/left.png">`;
            }
        }

        let cur = window.current;
        let left = [
            `<a href="#${cur+1}" onclick="show(${cur+1})" class="left">`,
                leftAsset,
            `</a>`,
        ].join("");
        $(".left").replaceWith(left);
    }

    $.ajax({
        url: `https://garyc.me/sketch/getStats.php?details&db=${db || ""}`,
        dataType: "json",
        success: function(json) {
            updateStats(json);

            const newMax = json.maxID;

            // noz.rip: `window.max` can be fetched from a $.ajax() on init,
            // but it's saved as a string. Firing this request a bit after
            // the $.ajax() call SHOULD fix that on time.

            const init = window.max == null || typeof window.max == "string";
            if(init) {
                if(window.current < newMax) {
                    addLeftButton();
                }
                window.max = newMax;
                window.min = json.minID;
                return enableRefresh();
            }

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

            if(settings.showDatecards) {
                // Max values are -1'd so that IDs ending with 00 are NOT
                // equal to IDs ending with 01; the latter's where
                // `addMore.php`'s thumbnails start.
                let lastMax100 = Math.floor((window.max - 1) / 100);
                let newMax100 = Math.floor((newMax - 1) / 100);
                if(newMax100 > lastMax100) {
                    // Size is +1'd so the previous sketch gets a datecard
                    // when the current day changes.
                    addDateCards(newMax, newMax - window.max + 1);
                }
            }

            if(window.current == window.max) {
                addLeftButton();
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

    let topAsset, leftAsset, rightAsset;
    switch(window.location.hostname) {
        case "noz.rip": {
            // placeholder for noz.rip's SVG URIs;
            // someday i'll have the guts to dump those beasts on this script
        }
        default: {
            topAsset = `<img src="https://garyc.me/sketch/top.png">`;
            leftAsset = `<img src="https://garyc.me/sketch/left.png">`;
            rightAsset = `<img src="https://garyc.me/sketch/right.png">`;
        }
    }

    var top = `<a href="#0" onclick="hide()" class="top">${topAsset}</a>`;
    var leftReg = `<a href="#${id+1}" onclick="show(${id+1})" class="left">${leftAsset}</a>`;
    var leftMax = `<div class="left"></div>`;
    var rightReg = `<a href="#${id-1}" onclick="show(${id-1})" class="right">${rightAsset}</a>`;
    var rightMin = `<div class="right"></div>`;
    var left = id >= window.max ? leftMax : leftReg;
    var right = id <= window.min ? rightMin : rightReg;

    let saveParts = [];
    let saveSVGParts = [];

    let saveAnchorStart;
    if(settings.saveAsCanvas) {
        saveAnchorStart = '<a class="save">'
    } else {
        let dbParam = window.db != null ? `&db=${window.db}` : "";
        let downloadFn = window.db == null ? `${id}` : `${window.db}#${id}`;
        saveAnchorStart = [
            `<a`,
                ` href="https://garyc.me/sketch/getIMG.php?format=png${dbParam}&id=${id}"`,
                ` download="${downloadFn}.png"`,
                ` class="save"`,
            `>`
        ].join("");
    }

    saveParts.push(
        saveAnchorStart,
        `<img src="save.png" style="width: 25px; height: 25px; position: relative;">`,
        `</a>`,
    );

    if(window.location.hostname == "noz.rip") {
        saveSVGParts.push(
            '<a class="saveSVG">',
            `<img src="svg.png" style="width: 25px; height: 25px; position: relative;">`,
            '</a>',
        );
    }

    var saves = [`<div class="saves">`, ...saveParts, ...saveSVGParts, `</div>`].join("");
    var bottom = `<div id="details">...</div>`;

    $("#holder").addClass("active");
    $("#holder").empty();
    $("#holder").append([top, left, sketch, right, bottom, saves]);
    $("#tiles").css({opacity: "75%"});

    if(settings.saveAsCanvas) {
        $(".save").click(() => saveCanvas());
    }
    if(window.location.hostname == "noz.rip") {
        $(".saveSVG").click(() => toSVG());
    }

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
        url: `https://garyc.me/sketch/get.php?db=${db || ""}&id=${id}&details`,
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

async function addDateCards(last, size) {
    for(const [timestamp, datecard, id] of await getDateCards(last, size)) {
        let date = timestamp.toDateString();
        if((datecardDates.get(date) ?? -Infinity) >= id) {
            continue;
        }

        const a = $(`a[href='#${id}']`);
        if(a.length > 0) {
            a.before(datecard);
            datecardDates.set(date, id);
        }
    }
}

async function addMore(n=100) {
    const hardLimit = 1;
    const lastPossible = Math.max(hardLimit, (Math.floor(window.max / 1000) - 5) * 1000 + 1);
    const limit = lastPossible;

    let newtiles = [];
    let last = window.max - ($("#tiles").children("a").length) + 1;
    let target = Math.max(last - n, limit);

    for(let id = last - 1; id >= target; id--) {
        newtiles.push(getTile(id));
    }

    if(target == limit && last != limit) {
        const tilesEnd = $(`
            <div id="tilesEnd">
                and then there were none.
                <button>back to top</button>
            </div>
        `);
        $("#tiles").after(tilesEnd);
        $("#tilesEnd button").on("click", () => document.documentElement.scrollIntoView());
    }

    $("#tiles").append(newtiles);

    addDateCards(last - 1, n);
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
        <div class="preference">
            <label for="showdatecards">Show time cards on gallery:</label>
            <input type="checkbox" id="showdatecards">
            <br>
            <i>(cards might not show up for newer sketches due to an API limitation)</i>
        </div>
        <div class="preference">
            <label for="saveascanvas">Save sketches in canvas quality:</label>
            <input type="checkbox" id="saveascanvas">
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
    preferences.find("#showdatecards").prop("checked", settings.showDatecards);
    preferences.find("#saveascanvas").prop("checked", settings.saveAsCanvas);

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
    preferences.find("#showdatecards").change(function(e) {
        settings.showDatecards = e.target.checked;
        _saveSettings();

        if(e.target.checked) {
            addDateCards(window.max, $("#tiles").children().length - 1);
        } else {
            $(".datecard").remove();
            datecardDates.clear();
        }
    });
    preferences.find("#saveascanvas").change(function(e) {
        settings.saveAsCanvas = e.target.checked;
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

                if(!navigator.clipboard) {
                    await detailsAlert("no clipboard permissions!");
                    return false;
                }

                await navigator.clipboard.writeText(currentURL());
                await detailsAlert("copied url");
            }

            // ctrl+shift+C -- copying canvas image to clipboard
            if(e.ctrlKey && e.shiftKey && !(e.altKey || e.metaKey)) {
                e.preventDefault();

                if(!window.ClipboardItem) {
                    await detailsAlert("no permission to copy canvas");
                    return false;
                }
                if(!navigator.clipboard) {
                    await detailsAlert("no clipboard permissions!");
                    return false;
                }

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

        #tiles {
            font-family: monospace;
        }

        #details {
            box-sizing: border-box;
            padding: 10px 60px;
            width: 100%;
            height: 100%;
            overflow: auto;

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

        #details .extra span[title]:hover {
            text-decoration: underline dotted;
        }

        #holder {
            display: none;
            z-index: 1;
            background-color: white;
            box-shadow: 0px 0px 10px #00000077;
            position: fixed;

            /* fixes garyc.me's centering management */
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }

        #holder img {
            user-select: none;
        }

        #tilesEnd {
            padding: 10px;
            text-align: center;
            font-family: monospace;
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
        #holder > .saves {
            box-sizing: border-box;
            width: 100%;
            padding-left: 5px;
            grid-area: s;
            justify-self: start;
        }

        /* datecards */
        .datecard {
            display: inline-block;
            vertical-align: middle;
            width: 160px;
            height: 120px;

            box-sizing: border-box;
            border: 2px solid #ccd;
            margin: 5px;
        }
        .datecard div {
            display: flex;
            width: 100%;
            height: 100%;
            padding: 10px;

            align-items: center;
            justify-content: center;
            box-sizing: border-box;
        }
        a img {
            /* aligns sketch thumbnails with the cards */
            vertical-align: middle;
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
}

function _gallery_commonOverrides() {
    document.addEventListener("keydown", personalKeybinds.bind(this));

    // On garyc.me, this uses the scrolling behavior the site used to have;
    // i.e. thumbnails will only get added at the *bottom* of the page.
    $(window).off("scroll");
    $(window).on("scroll", function(e) {
        let pageHeight = document.documentElement.scrollHeight;
        let pageScroll = window.scrollY + window.innerHeight;
        let bottom = pageHeight - pageScroll < 1;
        if(bottom) {
            addMore(100);
        }
    });

    $(document).off("keydown");
    $(document).on("keydown", function(e) {
        switch(e.key) {
            case "Escape": {
                if(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
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
                if(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
                if(window.current == null) return;
                if(window.current == window.max) return;
                show(window.current + 1);
                return false;
            }

            case "ArrowRight": {
                if(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
                if(window.current == null) {
                    show(window.max);
                    return false;
                }
                if(window.current == window.min) return;
                show(window.current - 1);
                return false;
            }
        }
    });

    window.addEventListener("hashchange", function(e) {
        if(!window.location.hash) {
            hide();
        }

        let id = parseInt(window.location.hash.slice(1));
        // prevent show() from firing again
        if(id == window.current) return;
        if(id == 0) {
            hide();
        } else {
            show(id);
        }
    });
}

function _gallery_commonDOMOverrides() {
    // remove text nodes that causes buttons to be spaced out.
    // the spacing will get re-added as css.
    let text_nodes = Array
        .from(document.body.childNodes)
        .filter(e => e.nodeType == Node.TEXT_NODE);
    $(text_nodes).remove();

    const [button, preferences] = createPreferencesUI();
    $("input[type=submit]:last-of-type").after(button);
    $("#tiles").before(preferences);
}


if(window.location.pathname == "/sketch/gallery.php" && window.location.hostname == "garyc.me") {
    window.update = gallery_update;
    window.refresh = refresh;
    setInterval(window.update, 1000/30);
    setInterval(window.refresh, 15000);

    window.drawData = gallery_drawData;
    window.show = show;
    window.hide = hide;
    window.get = get;
    window.addMore = addMore;

    _gallery_commonOverrides();

    // garyc.me doesn't even HAVE a <body> tag;
    // DOM manipulation can only happen after DOMContentLoaded.

    document.addEventListener("DOMContentLoaded", function() {
        window.current = null;

        _gallery_commonDOMOverrides();

        // clear the script tag and the extra newline that causes
        // misalignment of new sketches
        document.getElementById("tiles").innerHTML = "";
        // add a little init text for the stats
        document.getElementById("stats").innerHTML = "...";

        $("#holder").css({
            // remove inline css for the style overrides
            top: "",
            left: "",
            margin: "",
            position: "",
            width: "",
        });
    });

    // these are assigned on another `.ready` event;
    // overwrite them on another one
    $(document).ready(function() {
        $("#sketch").attr({
            tabindex: "0",
            // fix canvas not being 798x598
            width: "800px",
            height: "600px",
        });

        _updateSketchQuality(settings.sketchQuality);
    });
}

if(window.location.pathname == "/sketch/gallery.php" && window.location.hostname == "noz.rip") {
    // noz.rip has the JS code AFTER the <body> tag.
    // Same case with the jQuery import, so DOM manipulation
    // can only be executed after DOMContentLoaded.
    // One of these days, I'm just gonna snap.

    document.addEventListener("DOMContentLoaded", function() {
        purgeIntervals();

        // noz.rip doesn't have a stats bar but this works surprisingly fine.
        window.refresh = refresh;
        setInterval(window.refresh, 15000);

        window.show = show;
        window.hide = hide;
        window.get = get;
        window.addMore = addMore;

        _gallery_commonOverrides();

        window.max = null;
        window.min = null;
        window.current = null;
        // turn window.max into a Number;
        // the window.max fetched via $.ajax() is saved as a string.
        window.refresh();

        // use the new show();
        // setupOverlay override cancels the old show() from being used
        window.setupOverlay = (() => void 0);
        let hash = window.location.hash.slice(1);
        if(hash) {
            window.show(hash);
        }

        _gallery_commonDOMOverrides();

        // remove inline css for the style overrides
        $("#holder").css({
            position: "",
            width: "",
            height: "",
            backgroundColor: "",
            display: "",
        });

        $("#sketch").attr({
            tabindex: "0",
        });

        _updateSketchQuality(settings.sketchQuality);
    });
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
    let dat;
    if(window.location.hostname == "noz.rip") {
        dat = window.arrdat.join(" ");
    } else {
        dat = window.dat;
    }

    const ink = Math.floor(dat.length / window.limit * 100);

    switch(state) {
        case SwapState.IDLE: {
            $("#ink").html(`Ink used: ${ink}%`);
            $("#reset").prop("disabled", false);
            $("#undo").prop("disabled", dat.length == 0);
            $("#swap").prop("disabled", ink < 1);
            $("#peek").prop("disabled", ink >= 1);
            $("#swap").val("swap");
            _setProgress(0);
            break;
        }
        case SwapState.SWAPPING: {
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
            $("#ink").html(`Ink used: ${ink}%`);
            $("#reset").prop("disabled", true);
            $("#undo").prop("disabled", true);
            $("#swap").prop("disabled", true);
            $("#peek").prop("disabled", true);
            _setProgress(2);
            break;
        }
        case SwapState.WAITING_PEEK: {
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

function noz_sketch_setData(arrdata) {
    window.arrdat = arrdata.filter((part) => part != "");

    // using normal reset() would've left the wrong buttons enabled
    // every time as if ink really was 0%.
    resetCanvas();
    resetUI();

    for(var h = 0; h < arrdata.length; h++) {
        const arrpart = arrdat[h];
        const parts = arrpart.split(" ");
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
}

function sketch_reset() {
    window.dat = "";
    window.lines = [];
    window.autodrawpos = -1;
    resetCanvas();
    resetUI();
}

function noz_sketch_reset(manual) {
    if(manual) {
        window.backupdat = {
            arrdat: window.arrdat,
            screentoningPoints: window.screentoningPoints,
        };
        window.screentoningPoints = {};
        saveIncomplete(false);
    }

    if(window.locked) {
        window.backupdat = {};
    }

    window.dat = "";
    window.arrdat = [];
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

            updateUI(SwapState.PEEKING_FROM_SWAP);
            attemptSwap();
        },
    });
}

function noz_swap() {
    updateUI(SwapState.SWAPPING);
    window.locked = true;

    let dat = window.arrdat.join(" ") + " ";

    $.ajax({
        url: `https://garyc.me/sketch/swap.php?db=${db || ""}&v=32`,
        method: "POST",
        data: dat,
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
            window.backupdat = {};
            window.screentoningPoints = {};
            saveIncomplete(false);
            attemptSwap();
        },
    });
}

function attemptSwap() {
    getStats();

    $.ajax({
        url: `https://garyc.me/sketch/get.php?id=${swapID}&db=${db || ""}`,
        method: "GET",
        error: function() {
            setTimeout(attemptSwap, 2000);
        },
        success: function(result) {
            if(result == "wait") {
                updateUI(SwapState.WAITING_PEEK);
                setTimeout(attemptSwap, 2000);
                return;
            }

            switch(window.location.hostname) {
                case "noz.rip":
                    drawData([result]);
                    break;
                default:
                    drawData(result);
                    break;
            }
            getStats();
            updateUI(SwapState.DONE_FROM_SWAP);
        }
    });
}

function getLatest() {
    updateUI(SwapState.PEEKING);
    window.locked = true;

    $.ajax({
        url: `https://garyc.me/sketch/get.php?db=${db || ""}`,
        method: "GET",
        error: function() {
            alert("There was an error getting the latest sketch.");
            resetUI();
        },
        success: function(result) {
            switch(window.location.hostname) {
                case "noz.rip":
                    drawData([result]);
                    break;
                default:
                    drawData(result);
                    break;
            }
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

    // both noz.rip and garyc.me's JS happen at the document body,
    // inject when that finishes loading

    document.addEventListener("DOMContentLoaded", function() {
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

        $("img[src='save.png']").css({
            left: "",
        });

        _updateSketchQuality(settings.sketchQuality);
    });
}

if(window.location.pathname == "/sketch/" && window.location.hostname == "garyc.me") {
    document.addEventListener("DOMContentLoaded", function() {
        setInterval(window.update, 1000/30);
    });
}

if(window.location.pathname == "/sketch/" && window.location.hostname == "noz.rip") {
    document.addEventListener("DOMContentLoaded", function() {
        // not sure how i'd monkeypatch update() here;
        // it uses requestAnimationFrame instead of setInterval
        setInterval(() => saveIncomplete(true), 10000);

        window.reset = noz_sketch_reset;
        window.setData = noz_sketch_setData;
        window.swap = noz_swap;
    });
}