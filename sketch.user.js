
// ==UserScript==
// @name        garyc.me sketch tweaks
// @namespace   garyc.me by quackbarc
// @description QoL tweaks and personal mods for garyc.me/sketch
// @homepage    https://github.com/quackbarc/garyc-sketch-tweaks
// @author      quac
// @version     1.6.5
// @match       https://garyc.me/sketch/*
// @match       http*://noz.rip/sketch/*
// @match       http*://noz.rip/sketch_bunker/*
// @icon        https://raw.githubusercontent.com/quackbarc/garyc-sketch-tweaks/master/crunge.png
// @downloadURL https://github.com/quackbarc/garyc-sketch-tweaks/raw/master/sketch.user.js
// @updateURL   https://github.com/quackbarc/garyc-sketch-tweaks/raw/master/sketch.user.js
// @license     MIT
// @run-at      document-body
// @grant       none
// ==/UserScript==

/* TODO:
    - animation speed setting..?
    - improve tag autocomplete caching..?
    - narrow down _purgeIntervals() to just the necessary intervals?
      cuz it might consequently affect other extensions.

    - sketch: update():
      - update the UI with updateUI(State.IDLE)
      - fix animation ending one line too early
      - fix animation using the moveTo/lineTo way of drawing

    - debug:
      - having the viewer open takes up a lot of CPU for some reason; i'm blaming pixi.
*/

/* / */

const GARYC_GALLERY_CLIENT      = "garyc.me/sketch/gallery.php";
const NOZ_GALLERY_CLIENT        = "noz.rip/sketch/gallery";
const NOZBUNKER_GALLERY_CLIENT  = "noz.rip/sketch_bunker/";
const NOZ_ALT_SKETCH_CLIENT     = "noz.rip/sketch/alt";

const client = window.location.hostname + window.location.pathname;
const source = _getGallerySource(client);

var settings = {};

if(window.location.pathname.startsWith("/sketch")) {
    window.db = _getDB();
}

// Using a custom implementation of GM_addStyle instead of giving a @grant GM_addstyle;
// the latter limits our access to `window` properties very greatly.
// Implementation gracefully snagged from https://gist.github.com/arantius/3123124/ (MIT).
/**
 * @param {string} aCss The CSS to append to the page, specifically <head\>.
 */
function GM_addStyle(aCss) {
  'use strict';
  let head = document.getElementsByTagName('head')[0];
  if (head) {
    let style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.textContent = aCss;
    head.appendChild(style);
    return style;
  }
  return null;
}

/** @param {function} initfunc */
async function _loadOnPageReady(initfunc) {
    if(document.readyState == "loading") {
        document.addEventListener("DOMContentLoaded", initfunc);
    }
    else {
        initfunc();
    }
}

async function _sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function _waitForPageRevisit() {
    return new Promise(res => {
        document.addEventListener("visibilitychange", () => {
            if(document.visibilityState == "visible") {
                res();
            }
        }, {once: true});
    });
}

function _purgeIntervals() {
    const lastInterval = setTimeout(() => void 0, 0) - 1;
    for(let int = 0; int <= lastInterval; int++) {
        clearInterval(int);
    }
}

function _getSettings() {
    let defaultSettings = {
        cacheSize: 100,
        theme: "auto",
        noAnimation: false,
        doReplay: true,
        thumbQuality: "default",
        sketchQuality: "default",
        relativeTimestamps: true,
        showDatecards: true,    // on the UI, these would be called "time cards"
        saveAsCanvas: true,
        sketchSaveResolution: 1,
        showStats: true,
        supportApril2023: true,
    };
    if(window.location.hostname == "noz.rip") {
        defaultSettings = {
            ...defaultSettings,
            showBooru: false,
            useArchiveAsBooruSource: true,
            samePageBooru: true,
            showTagSuggestions: true,
            currentHolderMenu: "main",
            // noz.rip has its own cache with a limited size; gotta be faithful with it.
            cacheSize: 10,
            // It also doesn't have a stats bar of its own by default.
            showStats: false,
        };
    }

    let settings = {};
    let storedSettings = JSON.parse(localStorage.getItem("settings_sketch")) || {};
    for(const [setting, defaultValue] of Object.entries(defaultSettings)) {
        settings[setting] = storedSettings[setting] ?? defaultValue;
    }

    return settings;
}

function _saveSettings() {
    localStorage.setItem("settings_sketch", JSON.stringify(settings));
}

function _updateTheme() {
    switch(settings.theme) {
        case "auto": {
            let prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
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

/* / (endpoints) */

function _getDB() {
    let db = new URLSearchParams(window.location.search).get("db");
    if(!db) {
        return null;
    }
    return parseInt(db);
}

/** @param {string} client */
function _getGallerySource(client) {
    if(client.startsWith("noz.rip/sketch/")) {
        return "noz.rip/sketch/";
    }
    if(client.startsWith("noz.rip/sketch_bunker/")) {
        return "noz.rip/sketch_bunker/";
    }
    return "garyc.me/sketch/";
}

/**
 * @param {string} source
 * @param {number} id
 * @param {boolean} fullres     This only affects to noz.rip.
 */
function _getThumbnailURL(source, id, fullres=false) {
    if(source == "noz.rip/sketch/" || source == "noz.rip/sketch_bunker/") {
        if(fullres) {
            return `image/${id}.png`;
        }
        return `image/${id}th.jpeg`;
    }

    const dbParam = window.db != null ? `&db=${window.db}` : "";
    return `getIMG.php?format=png${dbParam}&id=${id}`;
}

/** @param {string} source */
function _getStatsURL(source) {
    if(source == "noz.rip/sketch/" || source == "noz.rip/sketch_bunker/") {
        return "stats";
    }
    return `getStats.php?details&db=${window.db || ""}`;
}

/** @param {string} source */
function _getSwapURL(source) {
    if(source == "noz.rip/sketch/" || source == "noz.rip/sketch_bunker/") {
        return "swap";
    }
    return `swap.php?db=${window.db || ""}&v=32`;
}

/**
 * @param {string} source
 * @param {number?} id
 * @param {boolean} details
 */
function _getSketchURL(source, id=null, details=false) {
    if(source == "noz.rip/sketch/" || source == "noz.rip/sketch_bunker/") {
        return `data/${id}`;
    }

    const params = new URLSearchParams();

    if(details) {
        params.set("details", true);
    }
    if(id != null) {
        params.set("id", id);
    }
    if(window.db != null) {
        params.set("db", window.db.toString() || "");
    }

    if(params.size >= 1) {
        // Truncating "details=true" to "details" like how noz.rip does it
        // just to keep it one-to-one.
        const paramStr = params
            .toString()
            .replace("details=true", "details");
        return "get.php?" + paramStr;
    }
    else {
        return "get.php";
    }
}

/** @param {string} source */
function _getInkLimit(source) {
    if(source == "noz.rip/sketch/") {
        return 131_071;
    }
    return 65_535;
}

/* /: Main */

function main() {
    _purgeIntervals();
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
        :root[theme="dark"] #holder img:not([src*="save.png"]) {
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
        :root[theme="dark"] #holder svg {
            stroke: #e5e5e5;
        }

        /* userscript-created elements */
        :root {
            --z-index-dropdown: 10;
            --background-tag-suggestions: #fff;
            --background-tag-suggestions-selected: #eee;
        }
        :root[theme="dark"] {
            --background-tag-suggestions: #111;
            --background-tag-suggestions-selected: #222;
        }
    `);
    _updateTheme();
}

main();

/* /sketch/gallery.php */

const booruStates = {};
const cache = {};
let lastAlertPromise = null;
let lastAutocompletePromise = null;
let lastAutocompleteQuery = null;
let lastTagsValue = null;
let autocompleteSelected = null;
let cachedBooruToken = null;
let cachedCanvasBlob = null;
let animationMenuRAF = null;
let datecardDates = new Map();
window.details = null;

// enums

const BooruPostState = {
    POSTED: 1,
    ALREADY_POSTED: 2,
    PARSING_ERROR: 3,
};

const FooterState = {
    NORMAL: 0,
    END_OF_GALLERY: 1,
};

// miscellaneous methods

function _getAprilFoolsColor(id) {
    const index = [
        0x4B0082,  // purple
        0x0000FF,  // blue
        0x008000,  // dark green
        0xFFFF00,  // yellow
        0xFFA500,  // orange
        0xFF0000,  // red
    ];

    return index[id % 6];
}

function _getCurrentTag(tagsBar) {
    const cursorPos = tagsBar.selectionStart;
    // Match everything from the beginning of the tags value to the nth
    // character, and any word/part of word that comes immediately after it.
    // Using [^ \n] instead of just [^ ] just to match with what . captures.
    // Using {0,n} instead of {n} because I don't want match breakage
    //   (from an n that's bigger than the search string).
    const pattern = new RegExp(`^.{0,${cursorPos}}[^ \n]*`);

    const rawTags = tagsBar.value;
    const [rawTagsShort,] = rawTags.match(pattern);
    const tags = rawTagsShort.split(" ");
    const currentTag = tags.at(-1);

    return currentTag;
}

function normalizeDetails(details) {
    const normDetails = {...details};

    // Unlike garyc.me, noz.rip/sketch/ and noz.rip/sketch_bunker/ both
    // return strings on the numeric fields. On what would've been otherwise
    // a primitive `null` on garyc.me, they're empty strings here.

    const fields = ["id", "timestamp"];
    for(const field of fields) {
        if(typeof details[field] == "string") {
            if(details[field] == "") {
                normDetails[field] = null;
                continue;
            }
            normDetails[field] = parseInt(details[field]);
        }
    }

    // noz.rip/sketch_bunker/ saves the origin field as "null".
    if(details.origin == "null") {
        normDetails.origin = null;
    }

    return normDetails;
}

// UI and public API methods

async function _waitForPIXIFrame() {
    // Render everything first, and return on the next PIXI tick.
    //
    // This could also be re-written to use PIXI's update priority
    // feature, in case we ever wanna call update() just once.
    // https://pixijs.download/v4.5.1/docs/PIXI.ticker.Ticker.html#addOnce
    app.ticker.update();
    await new Promise((res) => app.ticker.addOnce(res));
}

function _tileAnchorOverride(event) {
    event.preventDefault();

    const a = event.currentTarget;
    const idMatch = a.href.match(/#(\d+)/)
    const [hashID, id] = idMatch;
    window.history.pushState(window.history.state, "", hashID);
    show(parseInt(id));
}

function _navAnchorOverride(event) {
    event.preventDefault();

    const a = event.currentTarget;
    const idMatch = a.href.match(/#(\d+)/)
    const id = parseInt(idMatch[1]);
    show(id);
}

function _getThumbSize(qualityName) {
    switch(qualityName) {
        case "awful":
            return 4;
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

function _getNozSVGAsset(type) {
    // These COULD be put on separate files for cacheability
    switch(type) {
        case "top": {
            return (`
                <svg
                    fill="none"
                    stroke="black"
                    stroke-width="30"
                    stroke-linejoin="round"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 300 300"
                    width="300" height="300">
                        <circle cx="150" cy="150" r="135"></circle>
                        <path d="${[
                            "M 95,75 L 205,225 z",
                            "M 205,75 L 95,225 z"
                        ].join(" ")}">
                        </path>
                </svg>
            `);
        }
        case "left": {
            return (`
                <svg
                    fill="none"
                    stroke="black"
                    stroke-width="20"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 300 300"
                    width="300" height="300">
                        <path d="${[
                            "M 180,30 L 16,150 L 180,270",
                            "V 200 H 290 V 100 H 180 V 30 z"
                        ].join(" ")}">
                        </path>
                </svg>
            `);
        }
        case "right": {
            return (`
                <svg
                    fill="none"
                    stroke="black"
                    stroke-width="20"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 300 300"
                    width="300" height="300">
                        <path d="${[
                            "M 120,30 L 284,150 L 120,270",
                            "V 200 H 10 V 100 H 120 V 30 z",
                        ].join(" ")}">
                        </path>
                </svg>
            `);
        }
        default: {
            throw Error(`unknown asset type "${type}"`);
        }
    }
}

async function getSketchBlob() {
    window.setData(window.dat);

    await _waitForPIXIFrame();
    const sketch = window.sketch[0];
    const blob = await new Promise((res) => sketch.toBlob((blob) => res(blob)));
    return blob;
}

function getTile(id) {
    const imgURL = _getThumbnailURL(source, id);
    const tile = $([
        `<a href="#${id}">`,
        `<img src="${imgURL}" loading="lazy" style="`,
            `padding: 5px;`,
            `width: 160px;`,
            `height: 120px;`,
        `"></a>`,
    ].join(""));
    tile.click(_tileAnchorOverride);

    return tile;
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
    const client = window.location.hostname + window.location.pathname;
    if(window.db != null) {
        return `https://${client}?db=${window.db}#${window.current}`;
    } else {
        return `https://${client}#${window.current}`;
    }
}

function currentArchiveURL() {
    if(window.db != null) {
        return null;
    } else {
        return `https://noz.rip/sketch_bunker/?maxid=${window.current}#${window.current}`;
    }
}

function updateDetails(options={}) {
    if(window.current == null) {
        return;
    }

    const defaultOptions = {
        message: null,
        showFullTimestamp: false,
    };
    const mergedOptions = {...defaultOptions, ...options};
    const {message, showFullTimestamp} = mergedOptions;

    const unavailable = (window.dat == "wait" || window.dat == "wait ");    // thanks drawData();
    let elems = [];

    if(message != null) {
        elems.push(message);
    } else if(unavailable) {
        elems.push("(unavailable)");
    } else {
        let inkLimit = _getInkLimit(source);
        let ink = Math.floor(window.dat.length / inkLimit * 100);
        let inkText = `${ink}% ink used`;
        elems.push(inkText);
    }

    // This builds custom HTML for the URL, unlike currentURL(), which only
    // returns it as a string.
    let client = window.location.hostname + window.location.pathname;
    let current = `<span class="id">#${window.current}</span>`;
    let url = (
        window.db != null
        ? `https://${client}?db=${window.db}${current}`
        : `https://${client}${current}`
    );
    elems.push(url);

    const hasSketchDetails = window.details.origin || (window.details.timestamp != null);  // for timestamp=0 ig
    if(hasSketchDetails) {
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

            const weekdayMin = new Date();
            weekdayMin.setDate(today.getDate() - 6);
            weekdayMin.setHours(0, 0, 0, 0);

            if(date >= weekdayMin) {
                timestamp = timestamp
                    .replace(
                        date.toLocaleString("default", dateOptions),
                        date.toLocaleString("default", {weekday: "long"})
                    );
            }
        }

        let timestampHTML = `<span title="${timestampTooltip}">${timestamp}</span>`;
        if(showFullTimestamp) {
            timestampHTML = `<span>${timestampTooltip}</span>`;
        }

        let detailsText = `from ${origin} • ${timestampHTML}`;
        if(origin == null) {
            detailsText = timestampHTML;
        }
        let detailsHTML = `<span class="extra">${detailsText}</span>`

        elems.push(detailsHTML);
    }

    switch(client) {
        case NOZBUNKER_GALLERY_CLIENT:
        case NOZ_GALLERY_CLIENT: {
            const left = $(`<div id="details-left"></div>`);
            const right = $(`<div id="details-right"></div>`);

            const toggleMenu = createMenuSwitcher();
            const menus = [];

            const [animationMenu, animationToggle] = createAnimationUI();
            const [booruForm, booruToggle] = createBooruFormUI(window.current);
            toggleMenu.append(animationToggle, booruToggle);
            menus.push(animationMenu, booruForm);

            if(settings.currentHolderMenu == "booru" && booruForm == null) {
                settings.currentHolderMenu = "main";
            }

            $("#details").empty();
            $("#details").append(left, right);
            left.append(elems.join("<br>"));
            right.append(...menus, toggleMenu);

            updateHolderMenu(settings.currentHolderMenu);
            break;
        }

        default: {
            $("#details").empty();
            $("#details").append(elems.join("<br>"));
        }
    }

    $(".extra span[title]").click(() => detailsFullTimestamp());
}

async function detailsAlert(msg) {
    if(document.visibilityState == "hidden") {
        await _waitForPageRevisit();
    }

    updateDetails({message: msg});
    let alertPromise = lastAlertPromise = _sleep(3000);
    await alertPromise;
    if(alertPromise === lastAlertPromise) {
        updateDetails();
    }
}

async function detailsFullTimestamp() {
    updateDetails({showFullTimestamp: true});
    let alertPromise = lastAlertPromise = _sleep(3000);
    await alertPromise;
    if(alertPromise === lastAlertPromise) {
        updateDetails();
    }
}

function updateHolderMenu(menutype="main") {
    const elemIDLookup = {
        "main": "toggle-menu",
        "booru": "booru-form",
        "animation": "animation-menu",
    };
    const targetID = elemIDLookup[menutype];
    if(!targetID) {
        console.warn(`unknown holder menu type: ${menutype}`);
        return;
    }

    const menus = $("#details-right").children();
    for(const menu of menus) {
        const show = menu.id == targetID;
        $(menu).toggle(show);
    }

    settings.currentHolderMenu = menutype;
    _saveSettings();
}

function createStats() {
    const stats = $(`<span id="stats">...</span>`);
    return stats;
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

function createGalleryButtons(id) {
    let topAsset, leftAsset, rightAsset;
    switch(window.location.hostname) {
        case "noz.rip": {
            topAsset = _getNozSVGAsset("top");
            leftAsset = _getNozSVGAsset("left");
            rightAsset = _getNozSVGAsset("right");
            break;
        }
        default: {
            topAsset = `<img src="https://garyc.me/sketch/top.png">`;
            leftAsset = `<img src="https://garyc.me/sketch/left.png">`;
            rightAsset = `<img src="https://garyc.me/sketch/right.png">`;
        }
    }

    let leftID = Math.max(window.min, id + 1);
    let rightID = Math.min(window.max, id - 1);

    var top = `<a onclick="hide()" class="top">${topAsset}</a>`;
    var leftReg = `<a href="#${leftID}" class="left">${leftAsset}</a>`;
    var leftMax = `<div class="left"></div>`;
    var rightReg = `<a href="#${rightID}" class="right">${rightAsset}</a>`;
    var rightMin = `<div class="right"></div>`;
    var left = id >= window.max ? leftMax : leftReg;
    var right = id <= window.min ? rightMin : rightReg;

    return {
        top: top,
        left: left,
        right: right,
    };
}

function updateGalleryButtons() {
    if(window.current == null) {
        return;
    }

    const {top, left, right} = createGalleryButtons(window.current);
    $(".top").replaceWith(top);
    $(".left").replaceWith(left);
    $(".right").replaceWith(right);
}

function saveBooruChanges(id, form) {
    if(!booruStates.hasOwnProperty(id)) {
        booruStates[id] = {
            booruPostID: null,
            booruPostStatus: null,
            uploading: false,
            tags: null,
            rating: null,
        };
    }

    const tagsBar = form.find("input[name='tags']");
    const ratingSelect = form.find("select#rating");

    const state = booruStates[id];
    state.tags = tagsBar.val();
    state.rating = ratingSelect.val();
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

        // Parsing HTML with regex instead of making a document fragment,
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

    // Render the entire sketch first before saving
    window.setData(window.dat);

    const scale = settings.sketchSaveResolution;
    await scaleCanvas(scale);

    let filename = `${window.current}`;
    if(window.db != null) {
        filename = `${window.db}#${window.current}`;
    }
    if(scale != 1) {
        filename = `${filename}_${scale}x`;
    }

    const sketch = window.sketch[0];
    const blob = await new Promise((res, rej) => sketch.toBlob(blob => res(blob)));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.click();

    await scaleCanvas(1);
    URL.revokeObjectURL(url);
}

async function scaleCanvas(size) {
    const width = Math.round(800 * size);
    const height = Math.round(600 * size);

    $("#sketch").attr({
        width: `${width}px`,
        height: `${height}px`
    });

    // Once the canvas has its width/height properties tampered with,
    // everything about it would be reset.
    // Restore canvas state right after.
    graphics.setTransform(0, 0, size, size);
    _updateSketchQuality(settings.sketchQuality);

    // Give PIXI some time to re-render the whole sketch before we return
    await _waitForPIXIFrame();
}

// Booru and tag autocomplete methods (for noz.rip/booru)

async function getBooruAuthToken() {
    if(cachedBooruToken) {
        return cachedBooruToken;
    }

    const resp = await fetch("https://noz.rip/booru/upload");
    if(!resp.ok) {
        // Cloudflare's challenge firewall, most likely.
        return null;
    }

    const respHTML = await resp.text();
    const respParsed = new DOMParser().parseFromString(respHTML, "text/html");
    const authField = respParsed.querySelector('input[name="auth_token"]');
    if(!authField) {
        return null;
    }

    const token = authField.value;
    cachedBooruToken = token;

    return token;
}

async function selfUploadToBooru(id, form) {
    // Form can only be serialized before it gets disabled.
    const formElem = form[0];
    const formData = new FormData(formElem);

    saveBooruChanges(id, form);
    const booruState = booruStates[id];
    booruState.uploading = true;
    updateDetails();

    const [blob, authToken] = await Promise.all([getSketchBlob(), getBooruAuthToken()]);
    if(authToken) {
        formData.append("auth_token", authToken);
    }
    formData.append("data[]", blob);

    let resp = await fetch(
        "/booru/upload",
        {
            method: "POST",
            body: formData,
        }
    );

    const uploadSuccessful = resp.redirected;  // not the best way of detecting this. try a URL regex?
    const loggedOut = resp.status == 403;
    const booruServerError = resp.status >= 500 && resp.status <= 599;

    if(loggedOut) {
        const text = await resp.text();
        const isCFError = text.includes("https://challenges.cloudflare.com");
        if(isCFError) {
            booruState.uploading = false;
            updateDetails({message: "cloudflare error! try visiting the booru first"});
            return;
        }
        else {
            // Booru token is now stale. Replace it on the next fetch
            cachedBooruToken = null;

            booruState.uploading = false;
            updateDetails({message: "can't upload; logged out of booru"});
            return;
        }
    }

    if(booruServerError) {
        booruState.uploading = false;
        updateDetails({message: "booru's having hiccups. try again later?"});
        return;
    }

    if(uploadSuccessful) {
        const match = resp.url.match(/\/view\/(\d+)/);
        const postID = parseInt(match[1]);
        booruState.booruPostID = postID;
        booruState.booruPostStatus = BooruPostState.POSTED;
    }
    else {
        // Until I find a way to properly check for errors and hash duplicates through the wire,
        // this will have to do.

        const idPattern = /\/booru\/post\/view\/(\d+)(?:.+ already has hash .+)/;
        const text = await resp.text();
        const match = text.match(idPattern);
        if(!match) {
            const doc = new DOMParser().parseFromString(text, "text/html");

            const xEmptyErrorElem = $(doc).find("section[id^=Error_with] .blockbody");
            const generalErrorElem = $(doc).find("section[id^=Error] .blockbody");

            const isXEmptyError = xEmptyErrorElem.length > 0;
            const isGeneralError = generalErrorElem.length > 0;
            if(isXEmptyError) {
                booruState.uploading = false;
                updateDetails({message: "can't upload; unavailable sketch"});
                return;
            }
            else if(isGeneralError) {
                const errorMessage = generalErrorElem.text();

                booruState.uploading = false;
                updateDetails({message: `booru error: ${errorMessage}`});
                return;
            }
            else if(isShimmieDoc) {
                // Treat this as an isGeneralError but with the message
                // coming from the header. I'm too uneducated with Shimmie
                // to know what types of errors can fall under these two
                booruState.uploading = false;
                updateDetails({message: `booru error: ${headerText}`});
                return;
            }
            else {
                console.error("Unexpected response from Shimmie:", doc);
                booruState.booruPostStatus = BooruPostState.PARSING_ERROR;
            }
        }
        else {
            const postID = parseInt(match[1]);
            booruState.booruPostID = postID;
            booruState.booruPostStatus = BooruPostState.ALREADY_POSTED;
        }
    }

    booruState.uploading = false;
    if(window.current == id) {
        updateDetails();
    }
}

async function hideTagSuggestions() {
    $("#tag-suggestions").hide();
    lastAutocompletePromise = null;
    lastAutocompleteQuery = null;
    autocompleteSelected = null;
}

async function updateTagSuggestions() {
    if(!settings.showTagSuggestions) {
        hideTagSuggestions();
        return;
    }

    const tagsBar = $("input[name='tags']");
    const tagsBarElement = tagsBar[0];

    const currentTag = _getCurrentTag(tagsBarElement);
    if(!currentTag || currentTag.startsWith("rating:")) {
        hideTagSuggestions();
        return;
    }

    $("#tag-suggestions").hide();

    let autocompletePromise = lastAutocompletePromise = _sleep(200);
    await autocompletePromise;
    if(autocompletePromise !== lastAutocompletePromise) {
        return;
    }

    const baseURL = "https://noz.rip/booru/api/internal/autocomplete";
    const url = baseURL + "?s=" + currentTag;
    // Endpoint doesn't send caching instructions;
    // we're on our own here
    const cacheType = "reload";

    let p = fetch(url, {cache: cacheType}).catch(err => err);
    let fetchPromise = lastAutocompletePromise = p;
    const resp = await fetchPromise;
    if(fetchPromise !== lastAutocompletePromise) {
        return;
    }
    lastAutocompletePromise = null;

    // Network issue; ignore
    if(resp instanceof TypeError) {
        return;
    }

    if(!resp.ok) {
        await autocompleteError(resp);
        return;
    }

    const json = await resp.json();
    await autocompleteDropdown(json, currentTag);
}

async function autocompleteError(response) {
    let errorText = `(something went wrong: ${response.status})`;

    if(response.statusText) {
        errorText = `(something went wrong: ${response.status} ${response.statusText})`;
    }

    if(response.status == 403) {
        const text = await response.text();
        const isCFError = text.includes("https://challenges.cloudflare.com");
        if(isCFError) {
            errorText = "(cloudflare error! try visiting the booru first)";
        }
    }

    $("#tag-suggestions").show();
    $("#tag-suggestions").html(`
        <tr role="option" class="tag-info">
            <td colspan="2">${errorText}</td>
        </tr>
    `);
}

async function autocompleteDropdown(json, query) {
    const tagElements = [];
    let tags = Object.entries(json);
    if(json instanceof Array) {
        // For queries with zero results. Damn this API is terrible
        tags = json;
    }

    if(tags.length == 0) {
        const element = $(`
            <tr role="option" class="tag-info">
                <td colspan="2">
                    (new tag: ${query})
                </td>
            </tr>
        `);
        tagElements.push(element);
        $("#tag-suggestions").show();
        $("#tag-suggestions").html(tagElements);
    }

    const lastSelectedIndex = tags.findIndex(([name, count]) => name == autocompleteSelected);
    const selectedIsKept = lastSelectedIndex >= 0;

    if(tags.length >= 1 && selectedIsKept) {
        autocompleteSelected = autocompleteSelected;
    }
    else if(tags.length >= 1 && !selectedIsKept) {
        autocompleteSelected = tags[0][0];
    }
    else if(tags.length == 0) {
        autocompleteSelected = null;
    }

    const maxTagCount = 20;
    for(let i = 0; i < Math.min(tags.length, maxTagCount); i++) {
        const [name, result] = tags[i];
        const {count} = result;
        const element = $(`
            <tr role="option" name="${name}">
                <td class="tag-name">${name}</td>
                <td class="tag-count">${count}</td>
            </tr>
        `);

        // Don't lose focus off the tags bar.
        element.on("pointerdown", function(event) {
            const focusingTagsBar = $("input[name='tags']").has(":focus");
            return !focusingTagsBar;
        });
        element.on("pointerup", () => addTag(name, query));

        element.on("pointerover", () => autocompleteSelect(name));
        element.attr("aria-selected", (name == autocompleteSelected).toString());
        tagElements.push(element);
    }

    if(tags.length > maxTagCount) {
        const remainingTags = tags.slice(maxTagCount);
        const element = $(`
            <tr role="option" class="tag-info">
                <td colspan="2">
                    (${remainingTags.length} more...)
                </td>
            </tr>
        `);
        tagElements.push(element);
    }

    $("#tag-suggestions").show();
    $("#tag-suggestions").html(tagElements);
}

function autocompleteSelect(name) {
    const option = $(`#tag-suggestions [name="${name}"]`);
    const optionExists = option.length >= 1;
    if(!optionExists) {
        console.debug(`"${name}" doesn't exist in visible tags, ignoring that`);
        return;
    }

    const optionLast = $(`#tag-suggestions [aria-selected]`);
    optionLast.attr("aria-selected", "false");
    option.attr("aria-selected", "true");

    autocompleteSelected = name;
}

function addTag(name, query) {
    const tagsBar = $("#booru-form input[name=tags]");
    const rawTags = tagsBar.val();
    const index = tagsBar.prop("selectionStart");

    const [section,] = rawTags.match(new RegExp(`.{0,${index}}[^ ]*`));
    let sectionTags = section.split(" ");
    sectionTags[sectionTags.length - 1] = name;
    sectionTags = sectionTags.join(" ");

    const newIndex = sectionTags.length + 1;
    const newTags = sectionTags + " " + rawTags.slice(section.length).trimLeft(" ");
    tagsBar.prop("value", newTags);
    tagsBar.prop("selectionStart", newIndex);
    tagsBar.prop("selectionEnd", newIndex);

    tagsBar.focus();
    hideTagSuggestions();
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
        url: _getStatsURL(source),
        dataType: "json",
        success: function(json) {
            updateStats(json);

            let newMax = null;
            let newMin = null;
            if(client == NOZ_GALLERY_CLIENT) {
                newMax = json.max_id;
                newMin = 1;
            }
            else {
                newMax = json.maxID;
                newMin = json.minID;
            }

            if(window.customMax != null) {
                window.sourceMax = newMax;
                window.min = newMin;

                $("#loadmoretop").prop("disabled", window.max >= newMax);
                return enableRefresh();
            }

            // noz.rip: `window.max` can be fetched from a $.ajax() on init,
            // but it's saved as a string. Firing this request a bit after
            // the $.ajax() call SHOULD fix that on time.
            const init = window.max == null || typeof window.max == "string";
            if(init) {
                window.max = newMax;
                window.min = newMin;
                updateGalleryButtons();
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

            if(client == GARYC_GALLERY_CLIENT && settings.showDatecards) {
                // Max values are -1'd so that IDs ending with 00 are NOT
                // equal to IDs ending with 01; the latter's where
                // `addMore.php`'s thumbnails start.
                const lastMax100 = Math.floor((window.max - 1) / 100);
                const newMax100 = Math.floor((newMax - 1) / 100);
                if(newMax100 > lastMax100) {
                    // Size is +1'd so the previous sketch gets a datecard
                    // when the current day changes.
                    addDateCards(newMax, newMax - window.max + 1);
                }
            }

            const viewingLatestSketch = window.current == window.max;
            window.max = newMax;
            window.min = newMin;

            if(viewingLatestSketch) {
                updateGalleryButtons();
            }

            enableRefresh();
        },
        error: function(req) {
            enableRefresh();
        },
    });
}

function seekTo(position) {
    const lines = window.dat.split(" ");
    let curpos = [0, 0];
    let acc = 0;

    gallery_resetCanvas();

    for(let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for(let j = 0; j < line.length; j += 4) {
            if(acc > position) {
                break;
            }

            const x = dec(line.slice(j, j + 2));
            const y = dec(line.slice(j + 2, j + 4));
            if(j == 0) {
                graphics.moveTo(x, y);
            }
            else {
                graphics.lineTo(x, y);
            }

            curpos = [i, j];
            acc += 4;
        }
    }

    window.curpos = curpos;
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

function gallery_resetCanvas() {
    let fillColor = 0xFFFFFF;

    // April Fools' 2023 color support
    if(settings.supportApril2023 && window.details) {
        const {id, timestamp} = window.details;
        const aprilFools2023 = (timestamp >= 1680332400) && (timestamp < 1680418800);
        if(aprilFools2023) {
            fillColor = _getAprilFoolsColor(id);
        }
    }

    graphics.clear();

    graphics.beginFill(fillColor);
    graphics.drawRect(0, 0, 800, 600);
    graphics.endFill();

    graphics.lineStyle(3, 0x000000);
    graphics.moveTo(0,0);
}

function gallery_reset() {
    gallery_resetCanvas();

    dat = "";
    lines = [];
    cachedCanvasBlob = null;

    if([NOZ_GALLERY_CLIENT, NOZBUNKER_GALLERY_CLIENT].includes(client)) {
        window.autodraw = false;
    }
    else {
        window.autodrawpos = -1;
    }
}

function show(id) {
    // show() via page init passes the ID as a string (from URL hash).
    // can't change that since it's fired from an event listener.
    id = parseInt(id);

    if(Number.isNaN(id)) {
        return;
    }
    if(id == 0) {
        return;
    }
    if(id == window.current) {
        // prevents showing the same sketch again.
        return;
    }

    if(client == NOZ_GALLERY_CLIENT) {
        hideTagSuggestions();
    }

    const hashID = `#${id}`
    const historyState = window.history.state;
    const showingFromHash = window.location.hash == hashID;
    if(window.current == null && !showingFromHash) {
        window.history.pushState(historyState, "", hashID);
    }
    else {
        window.history.replaceState(historyState, "", hashID);
    }

    window.current = id;

    // html building
    // TODO: don't rebuild this everytime this function's called

    const {top, left, right} = createGalleryButtons(id);
    const saveParts = [];

    let saveAnchorStart;
    if(settings.saveAsCanvas) {
        saveAnchorStart = '<a class="save" title="Save (PNG)">'
    } else {
        const imageURL = _getThumbnailURL(source, id, true);
        const downloadFn = window.db == null ? `${id}` : `${window.db}#${id}`;
        saveAnchorStart = [
            `<a`,
                ` href="${imageURL}"`,
                ` download="${downloadFn}.png"`,
                ` class="save"`,
                ` title="Save (PNG)"`,
            `>`
        ].join("");
    }

    let saveImgURL = "save.png";
    if([NOZBUNKER_GALLERY_CLIENT, NOZ_GALLERY_CLIENT].includes(client)) {
        saveImgURL = "/static/save.png";
    }

    saveParts.push(
        saveAnchorStart,
        `<img src="${saveImgURL}" style="width: 25px; height: 25px; position: relative;">`,
        `</a>`,
    );

    const saves = [`<div class="saves">`, ...saveParts, `</div>`].join("");
    const bottom = `<div id="details">...</div>`;

    $("#holder").addClass("active");
    $("#holder").empty();
    $("#holder").append([top, left, sketch, right, bottom, saves]);
    $("#tiles").css({opacity: "75%"});

    $("a.left").click(_navAnchorOverride);
    $("a.right").click(_navAnchorOverride);
    if(settings.saveAsCanvas) {
        $(".save").click(() => saveCanvas());
    }

    // clear alerts and other cached properties from the last shown sketch
    lastAlertPromise = null;

    sketch.show();
    sketch.on("click", () => {
        switch(client) {
            case NOZBUNKER_GALLERY_CLIENT:
            case NOZ_GALLERY_CLIENT: {
                const animating = window.autodraw;
                const finished = $("#progressbar").val() == "1000";

                if(animating) {
                    setData(window.dat);
                }
                else if(!animating && !finished) {
                    window.autodraw = true;
                }
                else if(!animating && settings.doReplay) {
                    drawData(window.dat);
                }
                break;
            }

            default: {
                const animating = window.autodrawpos >= 0;
                if(!animating && settings.doReplay) {
                    drawData(window.dat);
                } else {
                    setData(window.dat);
                }
            }
        }

    });
    reset();
    get(id);
}

function hide() {
    $("#tiles").css({opacity: "100%"});
    $("#holder").removeClass("active");
    window.current = null;
    window.details = null;
    reset();

    const hiddenViaURL = (!window.location.hash || window.location.hash == "#0");
    if(!hiddenViaURL) {
        // Change the URL only if we've fired hide() via the close button,
        // not via URL. This new URL would have the hash fragment, plus the
        // # symbol, taken out.
        const hashlessURL = new URL(window.location);
        hashlessURL.hash = "";
        window.history.pushState(window.history.state, "", hashlessURL);
    }

    if(client == NOZ_GALLERY_CLIENT) {
        if(animationMenuRAF) {
            window.cancelAnimationFrame(animationMenuRAF);
            animationMenuRAF = null;
        }

        window.curpos = [0, 0];
        hideTagSuggestions();
    }
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
        if(settings.noAnimation) {
            setData(dat);
        } else {
            drawData(dat);
        }
    }

    if(cache.hasOwnProperty("#" + id)) {
        return success(cache["#" + id]);
    }

    $.ajax({
        url: _getSketchURL(source, id, true),
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
                };
            } else {
                try {
                    details = JSON.parse(resp);
                }
                catch(err) {
                    // If we're here, then this is just plain data.
                    details = {
                        id: id,
                        data: resp,
                        timestamp: null,
                        origin: null,
                    };
                }

                // Correct any incorrect primitives sent by noz.rip
                details = normalizeDetails(details);
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
    if(client != GARYC_GALLERY_CLIENT) {
        return;
    }
    if(!settings.showDatecards) {
        return;
    }

    for(const [timestamp, datecard, id] of await getDateCards(last, size)) {
        let date = timestamp.toDateString();

        if(datecardDates.has(date)) {
            const datecardID = datecardDates.get(date);
            const datecardNeedsUpdate = id > datecardID;
            if(!datecardNeedsUpdate) {
                continue;
            }

            const a = $(`#tiles a[href='#${datecardID}']`);
            const oldDatecard = a.prev();
            oldDatecard.remove();
        }

        const a = $(`#tiles a[href='#${id}']`);
        if(a.length > 0) {
            a.before(datecard);
            datecardDates.set(date, id);
        }
    }
}

async function addMore(n=100) {
    let limit;
    if(client == NOZBUNKER_GALLERY_CLIENT) {
        limit = 1;
    } else {
        const hardLimit = 1;
        const lastPossible = Math.max(hardLimit, window.min);
        limit = lastPossible;
    }

    let newtiles = [];
    let last = window.max - ($("#tiles").children("a").length) + 1;
    let target = Math.max(last - n, limit);

    for(let id = last - 1; id >= target; id--) {
        newtiles.push(getTile(id));
    }

    const footerState = target == limit
        ? FooterState.END_OF_GALLERY
        : FooterState.NORMAL;
    if(footerState == FooterState.END_OF_GALLERY && !(last == target)) {
        const tilesEnd = createGalleryFooter(footerState);
        $("#tiles-end").replaceWith(tilesEnd);
    }

    $("#tiles").append(newtiles);

    if(client == GARYC_GALLERY_CLIENT) {
        addDateCards(last - 1, n);
    }
}

function addMoreTop(n=100) {
    if(![NOZBUNKER_GALLERY_CLIENT, NOZ_GALLERY_CLIENT].includes(client)) {
        return;
    }

    let newtiles = [];
    let last = window.max;
    let target = Math.min(last + n, window.sourceMax);

    for(let id = target; id > window.max; id--) {
        newtiles.push(getTile(id));
    }

    window.max = target;
    $("#tiles").prepend(newtiles);
    $("#status").html(`Showing sketches up to #${target}`);
    if(target == window.sourceMax) {
        $("#loadmoretop").prop("disabled", true);
    }

    const viewingLatestSketch = window.current == last;
    if(viewingLatestSketch) {
        updateGalleryButtons();
    }

    const newURL = new URL(window.location);
    newURL.searchParams.set("maxid", target);
    window.history.replaceState("", null, newURL);
}

function createMenuSwitcher() {
    const toggleMenu = $(`<div id="toggle-menu"></div>`);
    return toggleMenu;
}

function createAnimationUI() {
    const showButton = $(`<button>show animation menu</button>`);
    const menu = $(`<div id="animation-menu">
        <button id="playpause">▶</button>
        <input type="range" name="progressbar" id="progressbar" value="0" min="0" max="1000">
        <button id="hide-animation">hide</button>
    </div>`);

    // Property assignment

    const playpause = menu.find("#playpause");
    const playpauseText = window.autodraw ? "❚❚" : "▶";
    playpause.text(playpauseText);

    const progress = menu.find("#progressbar");
    const lastProgress = $("#progressbar");
    if(lastProgress.length >= 1) {
        // We can't use the `curpos` for calculating the progress bar width;
        // since conversion from progress -> `curpos` is clamped, converting
        // from `curpos` -> progress would lose some of its original precision.
        // It's like rounding 1.67 to 2; you can't un-round the 1.67 back.
        const progPosition = lastProgress.val();
        progress.val(progPosition);
    }

    // Background property assignment

    const cachedCurrent = window.current;

    function animationMenuOverride() {
        if(window.current !== cachedCurrent) {
            return;
        }

        const playpauseIsPaused = playpause.text() == "▶";
        if(window.autodraw && playpauseIsPaused) {
            playpause.text("❚❚");
        }
        else if(!window.autodraw && !playpauseIsPaused) {
            playpause.text("▶");
        }

        window.requestAnimationFrame(animationMenuOverride);
    }

    // Event listeners

    const hideButton = menu.find("#hide-animation");
    showButton.click(() => updateHolderMenu("animation"));
    hideButton.click(() => updateHolderMenu("main"));

    playpause.click(() => {
        const finished = $("#progressbar").val() == "1000";
        if(finished) {
            drawData(window.dat);
        }
        else {
            window.autodraw = !window.autodraw;
        }
    })

    progress.on("input", () => {
        if(window.autodraw) {
            window.autodraw = false;
        }

        const val = parseInt(progress.val());
        const total = window.dat.replaceAll(" ", "").length;
        const target = Math.floor(val * total / 1000);

        seekTo(target);
    });

    // Epilogue

    if(animationMenuRAF) {
        window.cancelAnimationFrame(animationMenuRAF);
    }

    animationMenuRAF = window.requestAnimationFrame(animationMenuOverride);
    return [menu, showButton];
}

function createBooruFormUI(id) {
    if(!settings.showBooru) {
        return [null, null];
    }

    const sketch = cache["#" + id];
    const unavailable = (sketch.data == "wait" || sketch.data == "wait ");  // thanks drawData();
    if(unavailable) {
        return [null, null];
    }

    if(window.db) {
        const warning = $(
            `<button disabled>
                booru doesn't support custom DBs
            </button>
        `);
        return [null, warning];
    }

    let sourceURL = currentArchiveURL();
    if(source == "noz.rip/sketch/") {
        sourceURL = `https://noz.rip/sketch/gallery?maxid=${id}#${id}`;
    }

    const showButton = $("<button>show booru menu</button>");
    const form = $(`
        <form
            id="booru-form"
            target="_blank"
            action="/booru/upload"
            method="POST"
            enctype="multipart/form-data"
            style="display: none;">
            <input type="hidden" name="source" value="${sourceURL}">
            <span id="post-status"></span>
            <div id="tag-container">
                <table id="tag-suggestions" role="listbox"></table>
                <input
                    type="text"
                    name="tags"
                    required
                    placeholder="tagme"
                    autocomplete="off"
                    class="autocomplete_tags">
            </div>
            <div id="booru-buttons">
                <!-- Select isn't natively part of the form; post-processing is done to make
                     ratings actually get sent. -->
                <select id="rating">
                    <option value="?" selected>Unrated</option>
                    <option value="s">Safe</option>
                    <option value="q">Questionable</option>
                    <option value="e">Explicit</option>
                </select>
                <button type="submit">post to booru</button>
                <button type="button" id="hide-booru">hide</button>
            </div>
        </form>
    `);

    // UI and property assignment

    const tagsBar = form.find("input[name='tags']");
    const ratingSelect = form.find("select#rating");
    const postStatus = form.find("#post-status");
    const sourceField = form.find("input[name='source']");

    postStatus.hide();
    sourceField.prop("disabled", !settings.useArchiveAsBooruSource);

    const booruState = booruStates[id];
    if(booruState) {
        tagsBar.val(booruState.tags);
        ratingSelect.val(booruState.rating);
    }

    const booruUploading = settings.samePageBooru && booruState && booruState.uploading;
    if(booruUploading) {
        const formInputs = form.find(`input, button, select`);
        formInputs.prop("disabled", true);
    }

    const booruPostStatus = settings.samePageBooru && booruState && booruState.booruPostStatus;
    if(booruPostStatus) {
        const otherFormElements = form.children(`*:not(#booru-buttons, #post-status)`);
        const otherButtons = form.find(`#booru-buttons *:not(#hide-booru)`);
        otherFormElements.hide();
        otherButtons.hide();

        const postURL = `https://noz.rip/booru/post/view/${booruState.booruPostID}`;
        const postIDHTML = [
            `<a href=${postURL} target="_blank">`,
                `/${booruState.booruPostID}`,
            `</a>`
        ].join("");

        switch(booruState.booruPostStatus) {
            case BooruPostState.POSTED: {
                postStatus.html(`sketch uploaded: ${postIDHTML}`);
                break;
            }
            case BooruPostState.ALREADY_POSTED: {
                postStatus.html(`sketch was already uploaded! ${postIDHTML}`);
                break;
            }

            default: {
                console.error("Unexpected booru post state:", booruState.booruPostStatus);
            }
            case BooruPostState.PARSING_ERROR: {
                postStatus.html(`something went wrong! check console for details.`);

                const submit = form.find("button[type=submit]");
                submit.html("try again");
                submit.show();
                break;
            }
        }

        postStatus.show();
    }

    // Autocomplete-related

    const tagSuggestions = form.find("#tag-suggestions");
    tagSuggestions.hide();
    tagsBar.on("input", function() {
        updateTagSuggestions();
    });
    tagsBar.on("keydown", function(event) {
        switch(event.key) {
            case "Tab":
            case "Enter": {
                const dropdownClosed = tagSuggestions.is(":hidden");
                const hasModifiers = (
                    event.ctrlKey
                    || event.altKey
                    || event.metaKey
                    || event.shiftKey
                );
                if(dropdownClosed || hasModifiers) {
                    return;
                }

                // Prevent form submission or loss of tags bar focus
                event.preventDefault();

                tagSuggestions.hide();

                const currentTag = _getCurrentTag(this);
                const newTag = autocompleteSelected || currentTag;
                addTag(newTag, currentTag);

                break;
            }

            case "ArrowUp":
            case "ArrowDown": {
                const dropdownClosed = tagSuggestions.is(":hidden");
                if(dropdownClosed) {
                    return;
                }

                // Prevent text caret from moving to the beginning/end of the tags bar
                event.preventDefault();

                const visibleTagElems = tagSuggestions.children(":not(.tag-info)");
                const visibleTags = Array.from(visibleTagElems).map(
                    (element) => element.querySelector(".tag-name").innerHTML
                );
                if(visibleTags.length == 0 || visibleTags.length == 1) {
                    return;
                }

                let selectedIndex = visibleTags.findIndex((tag) => tag == autocompleteSelected);
                if(selectedIndex == -1) {
                    selectedIndex = 0;
                }

                const dir = event.key == "ArrowUp" ? -1 : 1;
                const ind = selectedIndex;
                const length = visibleTagElems.length;
                const selectedIndexNew = (((ind + dir) % length) + length) % length;
                const selectedNew = visibleTags[selectedIndexNew];
                autocompleteSelect(selectedNew);

                break;
            }

            case "Escape": {
                const dropdownClosed = tagSuggestions.is(":hidden");
                if(dropdownClosed) {
                    return;
                }

                // Don't know what this should be preventing specifically, but
                // just in case
                event.preventDefault();

                hideTagSuggestions();
            }
        }
    });
    tagsBar.on("blur", function(event) {
        hideTagSuggestions();
    });
    $(document).on("selectionchange", function() {
        if(!tagsBar.is(":focus")) {
            return;
        }

        const tagsBarElement = tagsBar[0];

        // Don't catch text caret movements from text input.
        const tagsValue = tagsBar.val();
        const tagsValueChanged = lastTagsValue != tagsValue;
        if(tagsValueChanged) {
            const currentTag = _getCurrentTag(tagsBarElement);
            lastTagsValue = tagsValue;
            lastAutocompleteQuery = currentTag;
            return;
        }

        // Text selections should hide #tag-suggestions (we're only catching text caret movement).
        const selectionStart = $("#booru-form input[name=tags]").prop("selectionStart");
        const selectionEnd = $("#booru-form input[name=tags]").prop("selectionEnd");
        const selectingText = selectionStart != selectionEnd;
        if(selectingText) {
            hideTagSuggestions();
            return;
        }

        const currentTag = _getCurrentTag(tagsBarElement);
        const currentTagChanged = lastAutocompleteQuery != currentTag;
        if(currentTagChanged) {
            lastAutocompleteQuery = currentTag;
            updateTagSuggestions();
        }
    });

    // Event listeners

    const hideButton = form.find("#hide-booru");
    showButton.click(() => updateHolderMenu("booru"));
    hideButton.click(() => updateHolderMenu("main"));

    tagsBar.on("change", () => saveBooruChanges(id, form));
    ratingSelect.on("change", () => saveBooruChanges(id, form));

    form.submit(async function(event) {
        const form = $(this);
        const ratingSelect = form.find("select");
        const rating = ratingSelect.val();

        const tagsBar = form.find("input[name='tags']");
        let tags = tagsBar.val();
        let newtags = tags
            .replace(/\s+$/gi, "")
            + (
                tags.match(/\s?rating:./gi)
                ? ""
                : ` rating:${rating}`
            );
        tagsBar.val(newtags.trim());

        if(settings.samePageBooru) {
            event.preventDefault();

            // In the case of retries, clear the existing post status.
            if(booruState && booruState.booruPostStatus) {
                booruState.booruPostStatus = null;
            }

            selfUploadToBooru(id, form);
        }
    });

    return [form, showButton];
}

function createPreferencesUI() {
    const button = $('<button id="pref-button">userscript preferences</button>');
    const preferences = $(`<fieldset id="preferences" style="display: none"></fieldset>`);
    preferences.html(`
        <legend>Preferences</legend>
        <fieldset id="preferences-gallery">
            <legend>Gallery</legend>
            <div class="preference">
                <label for="theme">Theme:</label>
                <select id="theme" name="theme">
                    <option value="auto" selected>System default</option>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                </select>
            </div>
            <div class="preference">
                <label for="thumbquality">Thumbnail quality:</label>
                <select id="thumbquality" name="thumbquality">
                    <option value="default" selected>Default</option>
                    <option value="hq">Downscaled</option>
                    <option value="raster">Rasterized</option>
                    <option value="oldDefault">Old default</option>
                    <option value="awful">What</option>
                </select>
            </div>
            <div class="preference">
                <label for="showstats">Show the "past 5 minutes" stats bar:</label>
                <input type="checkbox" id="showstats">
            </div>
            <div class="preference">
                <label for="showdatecards">Show time cards:</label>
                <input type="checkbox" id="showdatecards">
                <br>
                <i>(cards might not show up for newer sketches due to an API limitation)</i>
            </div>
        </fieldset>
        <fieldset id="preferences-sketches">
            <legend>Sketches</legend>
            <div class="preference">
                <label for="skipanimation">Auto-skip sketch animation:</label>
                <input type="checkbox" id="skipanimation">
            </div>
            <div class="preference">
                <label for="doreplay">Enable sketch animation replay:</label>
                <input type="checkbox" id="doreplay">
                <br>
                <i>(by clicking on the sketch player or pressing Space)</i>
            </div>
            <div class="preference">
                <label for="sketchquality">Sketch quality:</label>
                <select id="sketchquality" name="sketchquality">
                    <option value="default" selected>No spikes (default)</option>
                    <option value="spiky">Spiky (old)</option>
                </select>
            </div>
            <div class="preference">
                <label for="sketchsaveresolution">Sketch save resolution:</label>
                <select id="sketchsaveresolution" name="sketchsaveresolution">
                    <!-- There's an artist in GaryC that usually goes by "2x". -->
                    <option value="1" title="it's almost like the artist"selected>1x</option>
                    <option value="2" title="haha, kinda like the artist">2x</option>
                    <option value="4" title="it's like that artist but if there were two of them">4x</option>
                </select>
                <br>
                <i>(only works for sketch player quality saves)</i>
            </div>
            <div class="preference">
                <label for="saveascanvas">Save sketches in sketch player quality:</label>
                <input type="checkbox" id="saveascanvas">
                <br>
                <i>(useful if you don't like how screentones look in saves)</i>
            </div>
        </fieldset>
        <fieldset id="preferences-advanced">
            <legend>Advanced</legend>
            <div class="preference">
                <label for="cachesize">Sketch cache size:</label>
                <input type="number" id="cachesize" min="0">
            </div>
            <div class="preference">
                <label for="relativetimestamps">Show sketch timestamps as relative:</label>
                <input type="checkbox" id="relativetimestamps">
            </div>
            <div class="preference">
                <label for="supportapril2023">Add color to sketches from April Fools' 2023:</label>
                <input type="checkbox" id="supportapril2023">
            </div>
        </fieldset>
    `);

    button.click(() => preferences.slideToggle(200));

    preferences.find("#theme").val(settings.theme);
    preferences.find("#cachesize").val(settings.cacheSize);
    preferences.find("#skipanimation").prop("checked", settings.noAnimation);
    preferences.find("#doreplay").prop("checked", settings.doReplay);
    preferences.find("#thumbquality").val(settings.thumbQuality);
    preferences.find("#sketchquality").val(settings.sketchQuality);
    preferences.find("#relativetimestamps").prop("checked", settings.relativeTimestamps);
    preferences.find("#showdatecards").prop("checked", settings.showDatecards);
    preferences.find("#saveascanvas").prop("checked", settings.saveAsCanvas);
    preferences.find("#sketchsaveresolution").val(settings.sketchSaveResolution);
    preferences.find("#showstats").prop("checked", settings.showStats);
    preferences.find("#supportapril2023").prop("checked", settings.supportApril2023);

    preferences.find("#sketchsaveresolution").prop("disabled", !settings.saveAsCanvas);

    preferences.find("#cachesize").change(function(e) {
        settings.cacheSize = e.target.value;
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

        preferences.find("#sketchsaveresolution").prop("disabled", !e.target.checked);
    });
    preferences.find("#sketchsaveresolution").change(function(e) {
        settings.sketchSaveResolution = parseInt(e.target.value);
        _saveSettings();
    });
    preferences.find("#showstats").change(function(e) {
        settings.showStats = e.target.checked;
        _saveSettings();

        $("#stats").toggle(settings.showStats);
    });
    preferences.find("#supportapril2023").change(function(e) {
        settings.supportApril2023 = e.target.checked;
        _saveSettings();
    });

    switch(client) {
        case NOZ_GALLERY_CLIENT: {
            applyNozPreferences(preferences);
            break;
        }
        case NOZBUNKER_GALLERY_CLIENT: {
            applyBunkerPreferences(preferences);
            break;
        }
    }

    return [button, preferences];
}

function addBooruPreferences(preferences) {
    const preferencesSketches = preferences.find("#preferences-sketches");
    const preferencesBooru = $(`
        <fieldset id="preferences-booru">
            <legend>Booru</legend>
            <div class="preference">
                <label for="showbooru">Enable booru menu:</label>
                <input type="checkbox" id="showbooru">
            </div>
            <div class="preference">
                <label for="showtagsuggestions">Show tag suggestions:</label>
                <input type="checkbox" id="showtagsuggestions">
            </div>
            <div class="preference">
                <label for="samepagebooru">Post to booru without opening a new tab:</label>
                <input type="checkbox" id="samepagebooru">
            </div>
            <div class="preference">
                <label for="archiveassource">Add archive link as booru source:</label>
                <input type="checkbox" id="archiveassource">
            </div>
        </fieldset>
    `);
    preferencesSketches.after(preferencesBooru);

    preferences.find("#showbooru").prop("checked", settings.showBooru);
    preferences.find("#showtagsuggestions").prop("checked", settings.showTagSuggestions);
    preferences.find("#samepagebooru").prop("checked", settings.samePageBooru);
    preferences.find("#archiveassource").prop("checked", settings.useArchiveAsBooruSource);

    preferences.find("#showtagsuggestions").prop("disabled", !settings.showBooru);
    preferences.find("#samepagebooru").prop("disabled", !settings.showBooru);
    preferences.find("#archiveassource").prop("disabled", !settings.showBooru);

    preferences.find("#showbooru").change(function(e) {
        const enabled = e.target.checked;
        settings.showBooru = enabled;
        _saveSettings();

        preferences.find("#showtagsuggestions").prop("disabled", !enabled);
        preferences.find("#samepagebooru").prop("disabled", !enabled);
        preferences.find("#archiveassource").prop("disabled", !enabled);

        if(window.current != null) {
            updateDetails();
        }
    })

    preferences.find("#showtagsuggestions").change(function(e) {
        settings.showTagSuggestions = e.target.checked;
        _saveSettings();

        updateTagSuggestions();
    });
    preferences.find("#samepagebooru").change(function(e) {
        settings.samePageBooru = e.target.checked;
        _saveSettings();

        // Updates the booru menu
        if(window.current != null) {
            updateDetails();
        }
    });
    preferences.find("#archiveassource").change(function(e) {
        settings.useArchiveAsBooruSource = e.target.checked;
        _saveSettings();
    });
}

function applyNozPreferences(preferences) {
    addBooruPreferences(preferences);

    const toremove = [
        preferences.find("#thumbquality"),
        preferences.find("#showdatecards"),
        preferences.find("#supportapril2023"),
        preferences.find("#archiveassource"),
    ];
    for(const pref of toremove) {
        pref.parent().remove();
    }
}

function applyBunkerPreferences(preferences) {
    addBooruPreferences(preferences);

    const toremove = [
        preferences.find("#thumbquality"),
        preferences.find("#showdatecards"),
        preferences.find("#showstats"),
        preferences.find("#archiveassource"),
    ];
    for(const pref of toremove) {
        pref.parent().remove();
    }
}

function createGalleryFooter(footerState=FooterState.NORMAL) {
    const tilesEnd = $(`<footer id="tiles-end"></footer>`);

    switch(footerState) {
        case FooterState.END_OF_GALLERY: {
            tilesEnd.html(`
                and then there were none.
                <button>back to top</button>
            `);
            tilesEnd.find("button").on("click", () => document.documentElement.scrollIntoView());
            break;
        }

        case FooterState.NORMAL:
        default: {
            tilesEnd.html(`
                <button>load more</button>
            `);
            tilesEnd.find("button").on("click", () => addMore(100));
            break;
        }
    }

    return tilesEnd;
}

function createLoadMoreTopButton() {
    const button = $(`<button id="loadmoretop">load more</button>`);

    button.click(() => addMoreTop(100));
    return button;
}

function createBunkerStatus() {
    const status = $(`<span id="status"></span>`);
    return status;
}

async function personalKeybinds(e) {
    if(window.current == null) {
        return;
    }
    if(document.activeElement.nodeName == "INPUT") {
        return;
    }

    switch(e.key.toLowerCase()) {
        case " ": {
            // space -- skip/replay animation
            if(!(e.ctrlKey || e.altKey || e.metaKey || e.shiftKey)) {
                e.preventDefault();
                sketch.click();
            }
            break;
        }
        case "c": {
            const selection = document.getSelection();
            const selecting = selection.type == "Range";
            if(selecting) {
                break;
            }

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

                const animating = [NOZ_GALLERY_CLIENT, NOZBUNKER_GALLERY_CLIENT].includes(client)
                    ? window.autodraw
                    : window.autodrawpos >= 0;
                if(!animating) {
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


function _gallery_commonStyles() {
    GM_addStyle(`
        body {
            margin: 10px 10px;
        }

        input[type=text] {
            margin: 0px 4px;
        }

        input[type=submit], input[type=number], button {
            margin: 5px 4px;
        }

        #stats,
        #status {
            display: inline-block;
            font-family: "Helvetica", "Arial", sans-serif;
            margin: 0px 4px;
        }

        #status {
            font-style: italic;
        }

        canvas {
            /* prevent canvas from showing up for a split second on page boot */
            display: none;
            /* re-add garyc.me border on noz.rip */
            border: 1px black solid;
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

        #tiles-end {
            padding: 10px;
            text-align: center;
            font-family: monospace;
        }

        /* preferences */
        #preferences {
            display: flex;
            flex-wrap: wrap;
            width: fit-content;
            margin: 5px; /* match that of #tiles */
            font-family: monospace;
        }
        #preferences fieldset {
            min-width: 250px;
            flex: 1;
            border-left: none;
            border-right: none;
            border-bottom: none;
        }
        #preferences .preference {
            padding: 4px;
        }
        #preferences .preference:has([disabled]) {
            opacity: 60%;
            pointer-events: none;
            user-select: none;
        }
        #preferences .preference i {
            opacity: 50%;
        }
        #preferences .preference input[type=number] {
            margin: unset;
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
        #holder > .right {
            grid-area: r;
            /* prevent overflowing to .saves */
            overflow: hidden;
            height: 100%;
        }
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

function _gallery_commonNozStyles() {
    GM_addStyle(`
        /* #holder svg styles */

        #holder svg {
            width: 100%;
            height: 100%;
            padding: 10px;
            box-sizing: border-box;
        }
        #holder .top,
        #holder .left,
        #holder .right {
            height: 100%;
            width: 100%;
        }

        /* alignment of close button */
        #holder .top {
            display: flex;
            flex-direction: column-reverse;
            align-items: flex-end;

            padding-right: 50px;
            box-sizing: border-box;
        }
        #holder .top svg {
            height: 60px;
            width: 60px;
        }

        /* other #holder stylistic choices */

        #holder .top:hover,
        #holder .left:hover,
        #holder .right:hover {
            opacity: 80%;
        }

        /* #details styles */

        #details {
            display: flex;
            gap: 30px;

            height: min-content;
            max-height: 100%;
        }

        #details input,
        #details button {
            /* none of the default input spacings should apply here in #details */
            margin: 0;
        }

        #details #details-left {
            flex: 0 1 auto;
            overflow: auto;
        }

        #details #details-right {
            flex: 1 0 auto;

            display: flex;
            align-items: flex-end;
            justify-content: flex-end;
        }

        #details #toggle-menu {
            display: flex;
            flex-direction: column;
            align-items: flex-end;

            gap: 8px;
        }

        #details #animation-menu {
            display: flex;
            justify-content: flex-end;
            width: 100%;

            gap: 12px;
        }

        #details #progressbar {
            max-width: 200px;
            width: 100%;
        }

        #details form {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            text-align: right;

            gap: 8px;
        }

        #details #booru-buttons {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        #details form input[type="text"] {
            min-width: min-content;
            width: 100%;
            max-width: 400px;
            height: 2em;
            padding: 0px 5px;
            box-sizing: border-box;
        }

        /* tag autocomplete styles */

        #details {
            overflow: visible;
        }

        #tag-container {
            width: 100%;
            max-width: 400px;

            /* Position #tag-suggestions' parent so #tag-suggestions can be
            absolutely positioned to it */
            position: relative;
        }

        #tag-suggestions {
            position: absolute;
            right: calc(100% + 10px);
            bottom: 0px;

            display: block;
            user-select: none;
            z-index: var(--z-index-dropdown);
            background-color: var(--background-tag-suggestions);
            box-shadow: 0px 0px 10px #00000077;
            margin: 0;
            padding: 10px;
            width: max-content;

            /* Ditch default border spacing */
            border-spacing: 0;
        }

        #tag-suggestions td {
            /* Alternative to border-spacing in #tag-uggestions where the <tr>
            background would actually fill in the spacing gaps */
            padding: 0 5px;
        }

        #tag-suggestions tr[aria-selected="true"] {
            background-color: var(--background-tag-suggestions-selected);
            text-decoration: underline;
        }

        #tag-suggestions tr.tag-info {
            text-align: center;
            font-style: italic;
        }
        #tag-suggestions tr.tag-info:not(:only-child) td {
            padding: 5px;
        }
        #tag-suggestions .tag-name {
            text-align: right;
        }
        #tag-suggestions .tag-count {
            text-align: left;
            font-style: italic;
            opacity: 50%;
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
        let bottom = pageHeight - pageScroll <= 1;  // == 1 is for garyc.me
        if(bottom) {
            addMore(100);
        }
    });

    $(document).off("keydown");
    $(document).on("keydown", function(e) {
        if(document.activeElement.nodeName == "INPUT") {
            return;
        }

        switch(e.key) {
            case "Escape": {
                if(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
                if(window.current != null) {
                    hide();
                    // Prevent abortion of page load when the viewer is still open.
                    // The user only wants to exit the viewer in this case.
                    e.preventDefault();
                }
                return false;
            }

            // ArrowLeft and ArrowRight no longer
            // update window.current.

            case "ArrowLeft": {
                if(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
                if(window.current == null) return;
                if(window.current >= window.max) return;
                if(window.current < window.min) {
                    show(window.min);
                    return false;
                }
                show(window.current + 1);
                return false;
            }

            case "ArrowRight": {
                if(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
                if(window.current == null || window.current > window.max) {
                    show(window.max);
                    return false;
                }
                if(window.current <= window.min) return;
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
    // Remove text nodes that cause buttons to be unevenly spaced out.
    // Spacing would get re-added as CSS.
    const firstButton = $('input[type="submit"]');
    const firstButtonParent = firstButton.parent();
    if(firstButtonParent.length >= 1) {
        const textNodes = Array
            .from(firstButtonParent[0].childNodes)
            .filter(e => e.nodeType == Node.TEXT_NODE);
        $(textNodes).remove();
    }

    const [button, preferences] = createPreferencesUI();
    $("input[type=submit]:last-of-type").after(button);
    $("#tiles").before(preferences);

    const tilesEnd = createGalleryFooter();
    $("#tiles").after(tilesEnd);
}

function _gallery_commonNozOverrides() {
    // Use .customMax instead of noz.rip's .custom_max for the sake of naming consistency.
    window.customMax = null;
    const customMax = new URLSearchParams(window.location.search).get("maxid");
    const cm = parseInt(customMax);
    if(!Number.isNaN(cm)) {
        window.customMax = cm;
    }
}

function _gallery_commonNozDOMOverrides() {
    if(window.customMax != null) {
        const loadmoreTop = createLoadMoreTopButton();
        const status = createBunkerStatus();

        const preferencesButton = $("#pref-button");
        preferencesButton.after(status);
        $("#refresh").after(loadmoreTop);
        $("#refresh").hide();

        if(window.sourceMax == null) {
            loadmoreTop.prop("disabled", true);
        }

        status.html(`Showing sketches up to #${window.max}`);
    }
}


if(window.location.pathname == "/sketch/gallery.php" && window.location.hostname == "garyc.me") {
    _gallery_commonStyles();

    window.update = gallery_update;
    window.refresh = refresh;
    setInterval(window.update, 1000/30);
    setInterval(window.refresh, 15000);

    window.reset = gallery_reset;
    window.drawData = gallery_drawData;
    window.show = show;
    window.hide = hide;
    window.get = get;
    window.addMore = addMore;

    _gallery_commonOverrides();

    // Note: garyc.me doesn't have a <body> tag.
    // DOM manipulation can only happen after DOMContentLoaded.

    // TODO: Further MV3 support. I know I wrote a draft for these garyc.me
    // overrides like last year.

    function DOMInit() {
        window.current = null;

        _gallery_commonDOMOverrides();

        // clear the script tag and the extra newline that causes
        // misalignment of new sketches
        document.getElementById("tiles").innerHTML = "";
        // add a little init text for the stats
        document.getElementById("stats").innerHTML = "...";

        // remove inline css for the style overrides
        $("#holder").css({
            top: "",
            left: "",
            margin: "",
            position: "",
            width: "",
        });
        $("#sketch").css({
            border: "",
        });
    }

    // these are assigned on another `.ready` event;
    // overwrite them on another one
    $(document).ready(function() {
        $("#sketch").attr({
            tabindex: "0",
            // fix canvas not being 798x598
            width: "800px",
            height: "600px",
        });
        $("#sketch").css({
            // constrain actual size to 800x600 in case the canvas gets scaled up
            width: "800px",
            height: "600px",
        });

        _updateSketchQuality(settings.sketchQuality);
    });

    _loadOnPageReady(DOMInit);
}

if(window.location.pathname == "/sketch/gallery" && window.location.hostname == "noz.rip") {
    _gallery_commonStyles();
    _gallery_commonNozStyles();

    // Firing these overrides after the DOM is fully rendered.
    // noz.rip's <script> code happens AFTER the <body> tag,
    // so these can only fired after the whole page has loaded,
    // i.e. after `DOMContentLoaded`.
    // Why.

    function DOMInit() {
        _purgeIntervals();

        // noz.rip doesn't have a stats bar but this works surprisingly fine.
        window.refresh = refresh;
        setInterval(window.refresh, 15000);

        window.reset = gallery_reset;
        window.show = show;
        window.hide = hide;
        window.get = get;
        window.addMore = addMore;

        _gallery_commonOverrides();
        _gallery_commonNozOverrides();

        window.min = 1;
        window.current = null;

        if(window.customMax != null) {
            window.max = window.customMax;
            window.sourceMax = null;
            // Poll the refresh endpoint to get window.sourceMax and
            // enable the #loadmoretop button.
            window.refresh();
        }

        // use the new show();
        // setupOverlay override cancels the old show() from being used
        window.setupOverlay = (() => void 0);
        let hash = window.location.hash.slice(1);
        if(hash) {
            window.show(hash);
        }

        _gallery_commonDOMOverrides();
        _gallery_commonNozDOMOverrides();

        const stats = $("#stats");
        const statsExists = stats.length >= 1;
        if(!statsExists) {
            const preferencesButton = $("#pref-button");
            const stats = createStats();
            stats.toggle(settings.showStats);
            preferencesButton.after(stats);

            if(settings.showStats) {
                window.refresh();
            }
        }

        // remove inline css for the style overrides
        $("#holder").css({
            position: "",
            width: "",
            height: "",
            backgroundColor: "",
            display: "",
        });
        $("#sketch").css({
            // remove white background of the canvas
            background: "",
            // remove absolute positioning of the canvas
            position: "",
            top: "",
            left: "",
            transform: "",
            // replace box-shadow with border; caused dark mode to show
            // white edges around the canvas
            boxShadow: "",
            // constrain actual size to 800x600 in case the canvas gets scaled up
            width: "800px",
            height: "600px",
        });

        $("#sketch").attr({
            tabindex: "0",
            width: "800px",
            height: "600px",
        });

        _updateSketchQuality(settings.sketchQuality);
    }

    _loadOnPageReady(DOMInit);
}

if(window.location.pathname == "/sketch_bunker/" && window.location.hostname == "noz.rip") {
    _gallery_commonStyles();
    _gallery_commonNozStyles();
    GM_addStyle(`
        #jump_value {
            margin-left: 0px;
        }

        div:has(h4) {
            align-items: center;
        }
    `);

    // Hide <tiles> for this site's addMore() monkeypatch
    const style = document.createElement("style");
    style.innerHTML = (`
        #tiles {
            display: none;
        }
    `);
    document.head.appendChild(style);

    // Like noz.rip/sketch/gallery, the <script> code also happens
    // AFTER the <body> tag. We're also firing this one after
    // DOMContentLoaded. I'm going to throw hands.

    function DOMInit() {
        _purgeIntervals();

        window.reset = gallery_reset;
        window.show = show;
        window.hide = hide;
        window.get = get;
        window.addMore = addMore;

        _gallery_commonOverrides();
        _gallery_commonNozOverrides();

        window.min = 1;
        window.max = window.customMax || window.max;
        window.sourceMax = null;
        window.current = null;

        for(const script of $("#tiles ~ script")) {
            const maxMatch = $(script).html().match(/max=(?<max>\d+)/);
            if(maxMatch) {
                window.sourceMax = parseInt(maxMatch.groups.max);
                break;
            }
        }

        // use the new show();
        // setupOverlay override cancels the old show() from being used
        window.setupOverlay = (() => void 0);
        let hash = window.location.hash.slice(1);
        if(hash) {
            window.show(hash);
        }

        // DOM manipulation

        _gallery_commonDOMOverrides();
        _gallery_commonNozDOMOverrides();

        // addMore() can't be monkeypatched in time before it gets first fired.
        // Guess we have to do some dirty work "behind-the-scenes".
        $("#tiles").empty();
        style.remove();
        addMore();

        const [button, preferences] = createPreferencesUI();
        $("#jump_value").after(button);
        $("#tiles").before(preferences);

        // remove inline css for the style overrides
        $("#holder").css({
            position: "",
            width: "",
            height: "",
            backgroundColor: "",
            display: "",
        });

        $("#sketch").css({
            // remove absolute positioning of the canvas
            position: "",
            top: "",
            left: "",
            transform: "",
            // replace box-shadow with border; caused dark mode to show
            // white edges around the canvas
            boxShadow: "",
            // constrain actual size to 800x600 in case the canvas gets scaled up
            width: "800px",
            height: "600px",
        });

        $("#sketch").attr({
            tabindex: "0",
            width: "800px",
            height: "600px",
        });

        $("#refresh").prop("disabled", !!window.customMax);

        _updateSketchQuality(settings.sketchQuality);

        // DOM-related event listeners

        $("#jump_value").on("change", window.jump_to);
    }

    _loadOnPageReady(DOMInit);
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
};

function _setProgress(n) {
    n = Math.min(Math.max(n, 0), 3);
    let width = Math.round(n / 3 * 100);
    $("#progress").attr({"aria-valuenow": n});
    $("#progress-bar").width(`${width}%`);
}

function updateUI(state) {
    let dat;
    if(client == NOZ_ALT_SKETCH_CLIENT) {
        dat = window.arrdat.join(" ");
    } else {
        dat = window.dat;
    }

    const inkLimit = _getInkLimit(source);
    const ink = Math.floor(dat.length / inkLimit * 100);

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

function noz_alt_sketch_setData(arrdata) {
    window.arrdat = arrdata = arrdata.filter((part) => part != "");

    // using normal reset() would've left the wrong buttons enabled
    // every time as if ink really was 0%.
    resetCanvas();
    resetUI();

    for(var h = 0; h < arrdata.length; h++) {
        const arrpart = arrdata[h];
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

function noz_sketch_reset(manual=false) {
    if(manual) {
        saveIncomplete(false);
    }
    sketch_reset();
}

function noz_alt_sketch_reset(manual=false) {
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
        url: _getSwapURL(source),
        method: "POST",
        data: window.dat,
        error: function() {
            alert("There was an error swapping.");
            resetUI();
        },
        success: function(n) {
            n = parseInt(n);
            if(n < 0) {
                alert(`On cooldown; please wait ${-n} more seconds before swapping again.`);
                resetUI();
                return;
            }
            window.swapID = n;

            updateUI(SwapState.PEEKING_FROM_SWAP);
            window.attemptSwap();
        },
    });
}

function noz_swap() {
    updateUI(SwapState.SWAPPING);
    window.locked = true;

    getStats();

    if(client == NOZ_ALT_SKETCH_CLIENT) {
        window.dat = window.arrdat.join(" ") + " ";
        window.lastsketch = arrdat;
        localStorage.setItem('lastsketch', arrdat);
    }

    const captchaPhrase = $("#phrase").val();
    const postData = {
        data: window.dat,
        phrase: captchaPhrase,
    };

    $.ajax({
        url: _getSwapURL(source),
        method: "POST",
        data: postData,
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        error: function(e) {
            switch(e.status) {
                case 400: {
                    alert("That sketch already exists.");
                    break;
                }
                case 401: {
                    alert("Your captcha answer was incorrect.");
                    break;
                }
                case 403: {
                    alert(
                        "Your sketch data contains non-alphanumeric characters. "
                        + "(this should never happen)"
                    );
                    break;
                }
                case 429: {
                    alert("You're swapping too fast.");
                    break;
                }
                default: {
                    alert("There was an error swapping.");
                    break;
                }
            }

            const timestamp = new Date().getTime();
            $("#captcha").attr("src", `captcha?${timestamp}`);
            $("#phrase").val("");
            resetUI();
        },
        success: function(result) {
            const timestamp = new Date().getTime();
            $("#captcha").attr("src", `captcha?${timestamp}`);
            $("#phrase").val("");

            n = parseInt(result);
            if(Number.isNaN(n)) {
                alert("There was an error swapping.");
                resetUI();
                return;
            }
            if(n < 0) {
                alert(`On cooldown; please wait ${n} more seconds before swapping again.`);
                resetUI();
                return;
            }

            if(client == NOZ_ALT_SKETCH_CLIENT) {
                window.backupdat = {};
                window.screentoningPoints = {};
            }

            window.swapID = n;
            saveIncomplete(false);
            window.attemptSwap();
        },
    });
}

function attemptSwap() {
    getStats();

    $.ajax({
        url: _getSketchURL(source, swapID),
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

            drawData(result);
            getStats();
            updateUI(SwapState.DONE_FROM_SWAP);
        }
    });
}

function noz_attemptSwap() {
    $.ajax({
        url: _getSketchURL(source, swapID, true),
        method: "GET",
        error: function(e) {
            if(e.status == 404) {
                updateUI(SwapState.WAITING_PEEK);
                setTimeout(attemptSwap, 2000);
            }
            else {
                setTimeout(attemptSwap, 2000);
            }
        },
        success: function(result) {
            const data = result.data;
            if(client == NOZ_ALT_SKETCH_CLIENT) {
                drawData([data]);
            }
            else {
                drawData(data);
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
        url: _getSketchURL(source, null),
        method: "GET",
        error: function() {
            alert("There was an error getting the latest sketch.");
            resetUI();
        },
        success: function(result) {
            if(client == NOZ_ALT_SKETCH_CLIENT) {
                drawData([result]);
            }
            else {
                drawData(result);
            }

            getStats();
            updateUI(SwapState.DONE);
        }
    });
}


function _sketch_commonOverrides() {
    GM_addStyle(`
        /* save button */
        img[src*="save.png"] {
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
        img[src*="save.png"] {
            opacity: .8;
        }
        img[src*="save.png"]:hover {
            opacity: 1;
        }

        /* progress bar */
        #progress {
            background-color: #f9f9f9;
            border: 1px solid #767676;
            border-radius: 4px;
            min-width: 70px;
            height: 16px;
        }
        #progress-bar {
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

    function DOMInit() {
        setInterval(window.getStats, 30000);

        window.reset = sketch_reset;
        window.setData = sketch_setData;
        window.swap = swap;
        window.attemptSwap = attemptSwap;
        window.getLatest = getLatest;

        // Add progress bar.
        // We're not using a native <progress> here due to its lack of
        // styling support on Firefox; it's gotta look like the old Flash UI
        const peekTD = $("#peek").parent();
        const swapTD = $("#swap").parent();
        const progressTD = $(`<td>
            <div id="progress"
                role="progressbar"
                aria-label="swap progress"
                aria-valuenow="0"
                aria-valuemin="0"
                aria-valuemax="3">
                <div id="progress-bar" style="width: 0%"></div>
            </div>
        </td>`);
        progressTD.insertAfter(swapTD);
        peekTD.attr("colspan", 2);

        $("img[src*='save.png']").css({
            left: "",
        });

        _updateSketchQuality(settings.sketchQuality);
    }

    _loadOnPageReady(DOMInit)
}

if(window.location.pathname == "/sketch/" && window.location.hostname == "garyc.me") {
    _sketch_commonOverrides();

    function DOMInit() {
        setInterval(window.update, 1000/30);

        // Fix ink limit from 50KiB to 64KiB, the largest amount of data that
        // garyc.me can take in without truncating it.
        window.limit = _getInkLimit(source);
    }

    _loadOnPageReady(DOMInit);
}

if(window.location.pathname == "/sketch/" && window.location.hostname == "noz.rip") {
    _sketch_commonOverrides();

    function DOMInit() {
        setInterval(window.update, 1000/30);
        setInterval(() => saveIncomplete(true), 10000);

        window.reset = noz_sketch_reset;
        window.swap = noz_swap;
        window.attemptSwap = noz_attemptSwap;
    }

    _loadOnPageReady(DOMInit);
}

if(window.location.pathname == "/sketch/alt" && window.location.hostname == "noz.rip") {
    _sketch_commonOverrides();

    function DOMInit() {
        // not sure how i'd monkeypatch update() here;
        // it uses requestAnimationFrame instead of setInterval
        setInterval(() => saveIncomplete(true), 10000);

        window.reset = noz_alt_sketch_reset;
        window.setData = noz_alt_sketch_setData;
        window.swap = noz_swap;
        window.attemptSwap = noz_attemptSwap;
    }

    _loadOnPageReady(DOMInit);
}