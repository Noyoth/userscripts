// ==UserScript==
// @name         Open in IINA
// @namespace    https://github.com/Noyoth/userscripts
// @version      1.0.0
// @description  Adds a keyboard shortcut (Option+I) to open the current page URL in IINA.
// @author       Noyoth
// @match        *://*/*
// @license      MIT
// @icon         https://raw.githubusercontent.com/iina/iina/master/iina/Assets.xcassets/AppIcon.appiconset/iina-icon-256.png
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable) {
            return;
        }

        if (e.altKey && e.code === 'KeyI') {
            const videoUrl = window.location.href;
            window.location.href = `iina://open?url=${encodeURIComponent(videoUrl)}`;
        }
    }, false);
})();
