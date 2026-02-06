// ==UserScript==
// @name         Bilibili in One Tab
// @namespace    https://github.com/Noyoth/userscripts
// @version      1.1.0
// @description  Forces all Bilibili links and search results to open in the current tab.
// @author       Noyoth
// @match        *://*.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @license      MIT
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    const originalOpen = window.open;
    window.open = function(url, target, features) {
        if (url && (target === '_blank' || !target)) {
            window.location.href = url;
            return null;
        }
        return originalOpen(url, target, features);
    };
    function forceSelfTarget(nodes) {
        nodes.forEach(node => {
            if (node.tagName === 'A') {
                node.setAttribute('target', '_self');
            } else if (node.querySelectorAll) {
                const anchors = node.querySelectorAll('a[target="_blank"]');
                anchors.forEach(a => a.setAttribute('target', '_self'));
            }
        });
    }
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                forceSelfTarget(mutation.addedNodes);
            }
        });
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
    document.addEventListener('click', function(e) {
        const anchor = e.target.closest('a');
        if (anchor && anchor.href) {
            anchor.target = '_self';
        }
    }, true);
})();
