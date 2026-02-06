// ==UserScript==
// @name         Open in IINA
// @namespace    https://github.com/Noyoth/userscripts
// @version      1.2.0
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

    function getRealVideoUrl() {
        if (window.ap && window.ap.options && window.ap.options.video) {
            return window.ap.options.video.url;
        }
        if (window.aplayer && window.aplayer.options) {
            return window.aplayer.options.video.url;
        }

        const scripts = document.getElementsByTagName('script');
        for (let script of scripts) {
            const match = script.textContent.match(/https?%?[^"']+?\.m3u8[^"']*?/i);
            if (match) {
                return decodeURIComponent(match[0].replace(/\\/g, ''));
            }
        }

        const video = document.querySelector('video');
        if (video && video.currentSrc && !video.currentSrc.startsWith('blob:')) {
            return video.currentSrc;
        }

        return window.location.href;
    }

    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        if (e.altKey && e.code === 'KeyI') {
            const targetUrl = getRealVideoUrl();
            console.log('[IINA] Sniffed URL:', targetUrl);
            window.location.href = `iina://open?url=${encodeURIComponent(targetUrl)}`;
        }
    }, false);
})();
