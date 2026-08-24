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

======= SHORTHAND CODE ======

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

========================
