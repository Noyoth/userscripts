// ==UserScript==
// @name         Open in IINA
// @namespace    https://github.com/Noyoth/userscripts
// @version      1.3.0
// @description  Opens web videos in IINA using a keyboard shortcut (Option + I).
// @author       Noyoth
// @match        *://*/*
// @license      MIT
// @icon         https://raw.githubusercontent.com/iina/iina/master/iina/Assets.xcassets/AppIcon.appiconset/iina-icon-256.png
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let lastSniffedUrl = '';

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && (url.includes('.m3u8') || url.includes('.mp4') || url.includes('video'))) {
            lastSniffedUrl = url;
        }
        return originalOpen.apply(this, arguments);
    };

    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        let url = input;
        if (input instanceof Request) url = input.url;
        if (typeof url === 'string' && (url.includes('.m3u8') || url.includes('.mp4') || url.includes('video'))) {
            lastSniffedUrl = url;
        }
        return originalFetch.apply(this, arguments);
    };

    function unpackUrl(url) {
        if (!url) return null;

        let cleanUrl = url.replace(/&amp;/g, '&');

        try {
            const urlObj = new URL(cleanUrl);
            const params = new URLSearchParams(urlObj.search);

            for (const [key, value] of params.entries()) {
                if (value.startsWith('http') && (value.includes('.m3u8') || value.includes('.mp4'))) {
                    console.log(`[IINA Unpacker] Found nested URL in parameter '${key}':`, value);
                    return value; 
                }
            }
        } catch (e) {
        }

        cleanUrl = cleanUrl.replace(/\\/g, '');
        if (cleanUrl.startsWith('//')) {
            cleanUrl = window.location.protocol + cleanUrl;
        } else if (cleanUrl.startsWith('/')) {
            cleanUrl = window.location.origin + cleanUrl;
        }

        return cleanUrl;
    }

    function getRealVideoUrl() {
        if (lastSniffedUrl) {
            const unpacked = unpackUrl(lastSniffedUrl);
            if (unpacked && !unpacked.startsWith('blob:')) return unpacked;
        }

        const globalConfigs = [window.player_data, window.config, window.opts];
        for (let conf of globalConfigs) {
            if (conf && conf.url) return unpackUrl(conf.url);
        }

        const pageHtml = document.documentElement.innerHTML;
        const m3u8Regex = /https?[:\\\/]+[^"']+?\.m3u8[^"']*?/i;
        const match = pageHtml.match(m3u8Regex);
        if (match) return unpackUrl(match[0]);

        return window.location.href;
    }

    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

        if (e.altKey && e.code === 'KeyI') {
            const targetUrl = getRealVideoUrl();
            console.log('[IINA Final] Sending:', targetUrl);
            if (targetUrl) {
                window.location.href = `iina://open?url=${encodeURIComponent(targetUrl)}`;
            }
        }
    }, false);
})();
