# tampermonkey-last


// ==UserScript==
// @name         Shopee QC Hotkey
// @match        https://wms.ssc.shopee.ph/v2/returninbound/qc*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    document.addEventListener('keydown', function (event) {
        if (event.key === 'F8') {
            event.preventDefault();

            const button = document.getElementById('critical-hit');

            if (button) {
                button.click();
                console.log('Button clicked');
            } else {
                console.log('Button not found');
            }
        }
    });
})();

    .(======= SHORTHAND CODE ======

function qc() {
    document.querySelector('.qc-button')?.click();
}

function confirm() {
    document.querySelector('.confirm-button')?.click();
}

function cancel() {
    document.querySelector('.cancel-button')?.click();
}

if (e.altKey && e.key === 'z') qc();
if (e.altKey && e.key === 'x') confirm();
if (e.altKey && e.key === 'c') cancel();

    =======================

    
// ==UserScript==
// @name         WMS Button Hotkey
// @namespace    local
// @version      1.0
// @description  Click a specific WMS button with Alt+Z
// @match        https://YOUR-WMS-DOMAIN/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    document.addEventListener('keydown', function (event) {
        if (event.altKey && event.key.toLowerCase() === 'z') {
            event.preventDefault();

            const button = document.querySelector(
                '.w3-btn.w3-margin-bottom'
            );

            if (button) {
                button.click();
                console.log('WMS button clicked');
            } else {
                console.log('WMS button not found');
            }
        }
    });
})();
