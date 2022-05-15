
// ==UserScript==
// @name        garyc.me sketch tweaks
// @namespace   garyc.me by quackbarc
// @description QoL tweaks and personal mods for garyc.me/sketch
// @author      quac
// @version     1.0.0
// @match       https://garyc.me/sketch*
// @icon        https://cdn.discordapp.com/attachments/416900237618315274/932976241282252800/crung.png
// @run-at      document-body
// @grant       none
// @require     https://gist.githubusercontent.com/arantius/3123124/raw/grant-none-shim.js
// ==/UserScript==

/* TODO:
    - db support
    - SVG saving..?
    - stop doing addMore past sketch threshold..?
    - refresh():
        - auto adding left arrow?
    - add preferences menu
*/

var settings = {
    changeHashOnNav: true,
    cacheSize: 100,
    theme: "auto",
}

async function _sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

/* /sketch/gallery.php */

const cache = {};
let lastCurrent = null;
let lastAlertPromise = null;

function currentURL() {
    return `https://garyc.me/sketch/gallery.php#${window.current}`
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

function show(id) {
    // show() via page init passes the ID as a string (from URL hash).
    // can't change that since it's fired from an event listener.
    id = parseInt(id);

    if(id == 0) return;
    // prevents showing the same sketch again.
    // would've used window.current if the arrow navigation listener
    // didn't do the changing themselves.
    if(id == lastCurrent) return;

    // eh, why not.
    if(id == -1 || id == 1) {
        id = window.max;
    }

    // fixes arrow navigation.
    window.current = lastCurrent = id;
    if(settings.changeHashOnNav) {
        window.location.hash = id;
    }

    // html building
    // TODO: don't rebuild this everytime this function's called

    var top = `<a href="#0" onclick="hide()" class="top"><img src="top.png"></a>`;
    var leftReg = `<a href="#${id+1}" onclick="show(${id+1})" class="left"><img src="left.png"></a>`;
    var leftMax = `<div class="left"></div>`;
    var left = id == max ? leftMax : leftReg;
    var right = `<a href="#${id-1}" onclick="show(${id-1})" class="right"><img src="right.png"></a>`;
    var save = [
        `<a`,
            ` href="getIMG.php?format=png&db=&id=${id}"`,
            ` download="${id}.png"`,
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
    sketch.on("click", () => setData(dat));
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
            drawData(dat);
        }
    }

    if(cache.hasOwnProperty("#" + id)) {
        return success(cache["#" + id]);
    }

    let resp;
    try {
        resp = await fetch(`/sketch/get.php?db=&id=${id}`);
    } catch(e) {
        // network error
        if(e instanceof TypeError) {
            $("#details").html("network error.");
            return;
        } else throw e;
    }

    dat = await resp.text();
    addToCache(id, dat);
    if(window.current == id) {
        success(dat);
    }
}

function addMore(n=100) {
    let last = window.max - ($("#tiles").children().length);
    let target = last - n;
    let newtiles = [];
    for(let id = last; id > target; id--) {
        newtiles.push([
            `<a href="#${id}" onclick="show(${id});">`,
            `<img src="getIMG.php?format=png&db=&id=${id}&size=20" style="`,
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
            position: fixed;

            /* fixes original centering management */
            position: fixed;
            top: calc((100vh - 800px) / 2) !important;
            /* sure have this computed too i guess */
            left: calc((100vw - 1008px) / 2);
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

    window.current = null;
    window.show = show;
    window.hide = hide;
    window.addMore = addMore;

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

    // these are keybinds i personally use to speed up sketch posting.
    // feel free to remove em or use em.
    document.addEventListener("keydown", async function(e) {
        // don't fire if the holder is open
        if(window.current == null) return;

        if(e.key == " " && !(e.ctrlKey || e.altKey || e.metaKey || e.shiftKey)) {
            e.preventDefault();
            setData(window.dat);
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
    });

    window.addEventListener("hashchange", function(e) {
        let id = parseInt(window.location.hash.slice(1));
        show(id);
    });

    document.addEventListener("DOMContentLoaded", function() {
        // clear the script tag and the extra newline that causes
        // misalignment of new sketches
        $("#tiles").html("");
    })

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