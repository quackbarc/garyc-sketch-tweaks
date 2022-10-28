
// ==UserScript==
// @name        garyc.me sketch tweaks
// @namespace   garyc.me by quackbarc
// @description QoL tweaks and personal mods for garyc.me/sketch
// @homepage    https://github.com/quackbarc/garyc-sketch-tweaks
// @author      quac
// @version     1.0.1
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
    - stop doing addMore past sketch threshold..?
    - correct gallery thumbnail resolutions?
    - refresh():
        - auto adding left arrow?
*/

var settings = {};

async function _sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

/* / */

function _getSettings() {
    const defaultSettings = {
        changeHashOnNav: true,
        cacheSize: 100,
        theme: "auto",
        noAnimation: false,
        doReplay: false,
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
    window.db = db != null ? parseInt(db) : 0;
}

/* /sketch/gallery.php */

const cache = {};
let lastCurrent = null;
let lastAlertPromise = null;

function currentURL() {
    if(window.db != 0) {
        return `https://garyc.me/sketch/gallery.php?db=${window.db}#${window.current}`;
    } else {
        return `https://garyc.me/sketch/gallery.php#${window.current}`;
    }
}

function updateDetails(msg=null) {
    let elems = [];

    if(msg != null) {
        elems.push(msg);
    } else if(window.dat != "wait") {
        let ink = Math.floor(window.dat.length / 65535 * 100);
        let inkText = `${ink}% ink used`;
        elems.push(inkText);
    } else {
        elems.push("(unavailable)");
    }

    let url = currentURL();
    elems.push(url);

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

// overrides

function show(id, force=false) {
    // show() via page init passes the ID as a string (from URL hash).
    // can't change that since it's fired from an event listener.
    id = parseInt(id);

    if(id == 0) return;
    // prevents showing the same sketch again.
    // would've used window.current if the arrow navigation listener
    // didn't do the changing themselves.
    if(id == lastCurrent) return;

    // eh, why not.
    if(!force && (id == -1 || id == 1)) {
        id = window.max;
    }

    // fixes arrow navigation.
    window.current = lastCurrent = id;
    if(settings.changeHashOnNav) {
        window.location.hash = id;
    }

    // html building
    // TODO: don't rebuild this everytime this function's called

    var downloadFn = window.db == 0 ? `${id}` : `${window.db}#${id}`;
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
    window.current = lastCurrent = null;
    reset();
}

function addToCache(id, dat) {
    cache['#' + id] = dat.trim();
    let keys = Object.keys(cache);
    let tail = keys[0];
    if(keys.length > settings.cacheSize) {
        delete cache[tail];
    }
}

async function get(id) {
    function success(dat) {
        window.dat = dat;
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

    await fetch(`/sketch/get.php?db=${db}&id=${id}`)
      .then(r => r.text())
      .then(function(dat) {
        addToCache(id, dat);
        if(window.current == id) {
            success(dat);
        }
      })
      .catch(e => $("#details").html("network error."));
}

function addMore(n=100) {
    let last = window.max - ($("#tiles").children().length);
    let target = last - n;
    let newtiles = [];
    for(let id = last; id > target; id--) {
        newtiles.push([
            `<a href="#${id}" onclick="show(${id});">`,
            `<img src="getIMG.php?format=png&db=${window.db}&id=${id}&size=20" style="`,
                `padding: 5px;`,
                `width: 160px;`,
                `height: 120px;`,
            `"></a>`,
        ].join(""));
    }
    $("#tiles").append(newtiles);
}

if(window.location.pathname == "/sketch/gallery.php") {
    GM_addStyle(`
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

    // add preferences menu in gallery
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
    `);
    button.click(() => preferences.toggle());
    $("#holder").before([button, preferences]);
    $("#theme").val(settings.theme);
    $("#cachesize").val(settings.cacheSize);
    $("#skipanimation").prop("checked", settings.noAnimation);
    $("#doreplay").prop("checked", settings.noAnimation);
    $("#hashnav").prop("checked", settings.changeHashOnNav);

    $("#cachesize").change(function(e) {
        settings.cacheSize = e.target.value;
        _saveSettings();
    });
    $("#hashnav").change(function(e) {
        settings.changeHashOnNav = e.target.checked;
        _saveSettings();
    });
    $("#skipanimation").change(function(e) {
        settings.noAnimation = e.target.checked;
        _saveSettings();
    });
    $("#doreplay").change(function(e) {
        settings.doReplay = e.target.checked;
        _saveSettings();
    });
    $("#theme").change(function(e) {
        settings.theme = e.target.value;
        _updateTheme();
        _saveSettings();
    });

    window.show = show;
    window.hide = hide;
    window.addMore = addMore;

    // these are keybinds i personally use to speed up sketch posting.
    // feel free to remove em or use em.
    document.addEventListener("keydown", async function(e) {
        // don't fire if the holder is open
        if(window.current == null) return;

        if(e.key == " " && !(e.ctrlKey || e.altKey || e.metaKey || e.shiftKey)) {
            e.preventDefault();
            if(autodrawpos == -1 && settings.doReplay) {
                drawData(window.dat);
            } else {
                setData(window.dat);
            }
        }
        if(e.ctrlKey && e.key.toLowerCase() == "c" && !(e.altKey || e.metaKey || e.shiftKey)) {
            e.preventDefault();
            await navigator.clipboard.writeText(currentURL());
            await detailsAlert("copied url");
        }
        if(e.ctrlKey && e.shiftKey && e.key.toLowerCase() == "c" && !(e.altKey || e.metaKey)) {
            if(!window.ClipboardItem) return false;
            e.preventDefault();
            $("#sketch")[0].toBlob(async (blob) => {
                await navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})]);
                await detailsAlert("copied canvas");
            });
        }
        if(e.ctrlKey && e.key.toLowerCase() == "s" && !(e.altKey || e.metaKey || e.shiftKey)) {
            e.preventDefault();
            $(".save").click();
        }
    });

    window.addEventListener("hashchange", function(e) {
        let id = parseInt(window.location.hash.slice(1));
        // prevent show() from firing again
        if(id == window.current) return;
        if(id == 0) {
            hide();
        } else {
            // force special cases like 1 and -1
            show(id, true);
        }
    });

    document.addEventListener("DOMContentLoaded", function() {
        window.current = null;
        // prematurely refresh cached max and thumbnails
        refresh();
        // clear the script tag and the extra newline that causes
        // misalignment of new sketches
        document.getElementById("tiles").innerHTML = "";
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
        // fix miter spikes on the canvas
        $("#sketch")[0].getContext("2d").lineJoin = "round";
    })
}

/* /sketch/ */

function _setProgress(n) {
    n = Math.min(Math.max(n, 0), 3);
    let width = Math.round(n / 3 * 100);
    $("#progress").attr({"aria-valuenow": n});
    $("#progressBar").width(`${width}%`);
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
    let ink = Math.floor(window.dat.length / window.limit * 100);
    $("#ink").html(`Ink used: ${ink}%`);
    $("#swap").prop("disabled", ink < 1);
    $("#peek").prop("disabled", ink >= 1);

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
    $("#swap").prop("disabled", true);
    $("#peek").prop("disabled", false);
    $("#swap").val("swap");
    $("#ink").html("Ink used: 0%");
    _setProgress(0);
    resetCanvas();
    window.dat = "";
    window.locked = false;
    window.lines = [];
    window.autodrawpos = -1;
}

function swap() {
    // lock the client *before* the swap request, gary
    $("#reset").prop("disabled", true);
    $("#undo").prop("disabled", true);
    $("#swap").prop("disabled", true);
    $("#swap").val("swapping...");
    _setProgress(1);
    window.locked = true;

    function rollback() {
        $("#reset").prop("disabled", false);
        $("#undo").prop("disabled", false);
        $("#swap").prop("disabled", false);
        $("#swap").val("swap");
        _setProgress(0);
        window.locked = false;
    }

    $.ajax({
        url: `swap.php?db=${db}&v=32`,
        method: "POST",
        data: window.dat,

        error: function() {
            alert("There was an error swapping.");
            rollback();
        },

        success: function(n) {
            n = parseInt(n);
            if(n < 0) {
                alert(`On cooldown; please wait ${n} more seconds before swapping again.`);
                rollback();
                return;
            }
            window.swapID = n;
            attemptSwap();
        },
    });
}

function attemptSwap() {
    _setProgress(2);

    $.ajax({
        url: `get.php?id=${swapID}&db=${db}`,
        method: "GET",

        error: function() {
            setTimeout(attemptSwap, 2000);
        },

        success: function(result) {
            if(result == "wait") {
                $("#swap").val("waiting for other sketch to be drawn...");
                setTimeout(attemptSwap, 2000);
            } else {
                drawData(result);
                $("#swap").val("done");
                $("#peek").prop("disabled", true); // thanks reset()
                $("#reset").prop("disabled", false);
                _setProgress(3);
                getStats();
            }
        }
    });
}

function getLatest() {
    let undoWasDisabled = $("#undo").prop("disabled");
    $("#peek").prop("disabled", true);
    $("#undo").prop("disabled", true);
    $("#reset").prop("disabled", true);
    _setProgress(2);
    window.locked = true;

    $.ajax({
        url: `get.php?db=${db}`,
        method: "GET",

        error: function() {
            alert("There was an error getting the latest sketch.");
            $("#peek").prop("disabled", false);
            $("#undo").prop("disabled", undoWasDisabled);
            window.locked = false;
        },

        success: function(result) {
            drawData(result);
            $("#peek").prop("disabled", true); // thanks reset()
            $("#reset").prop("disabled", false);
            _setProgress(3);
            getStats();
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

    window.reset = sketch_reset;
    window.setData = sketch_setData;
    window.swap = swap;
    window.attemptSwap = attemptSwap;
    window.getLatest = getLatest;

    // this script fires immediately after the body, and
    // the old getStats interval is the last interval in it,
    // so as long as those are true, this should be fine.
    let newInterval = setInterval(window.getStats, 30000);
    clearInterval(newInterval - 1);

    document.addEventListener("DOMContentLoaded", function() {
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

        // fix miter spikes on the canvas
        window.app.view.getContext("2d").lineJoin = "round";
    })

    $(document).ready(function() {
        $("img[src='save.png']").css({
            left: "",
        });
    });
}
