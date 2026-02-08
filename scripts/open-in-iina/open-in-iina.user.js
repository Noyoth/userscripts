// ==UserScript==
// @name         Open in IINA
// @namespace    https://github.com/Noyoth/userscripts
// @version      2.0.1
// @description  Opens web videos in IINA via (Option + I), featuring specialized support for https://bgm.girigirilove.com to export complete series as .m3u playlists.
// @author       Noyoth
// @match        *://*/*
// @license      MIT
// @icon         https://raw.githubusercontent.com/iina/iina/master/iina/Assets.xcassets/AppIcon.appiconset/iina-icon-256.png
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const UtilsGiri = {
        formatUrl: function(url) {
            if (!url) return null;
            try {
                const decoded = decodeURIComponent(url);
                const match = decoded.match(/(https?:\/\/[\w-./?%&=]+\.(m3u8|mp4))/i);
                if (match) return match[0];
            } catch(e) {}
            let cleanUrl = url.replace(/&amp;/g, '&').replace(/\\/g, '');
            if (cleanUrl.startsWith('//')) cleanUrl = window.location.protocol + cleanUrl;
            else if (cleanUrl.startsWith('/')) cleanUrl = window.location.origin + cleanUrl;
            return cleanUrl;
        },

        extractVideoFuzzy: function(html) {
            if (!html) return null;
            const cleanHtml = html.replace(/\\/g, '');
            const jsonRegex = /(?:player_data|config|opts|video)\s*=\s*({.*?})/;
            const jsonMatch = html.match(jsonRegex);
            if (jsonMatch) {
                try {
                    const urlInJson = jsonMatch[1].match(/["']url["']\s*:\s*["']([^"']+)["']/);
                    if (urlInJson) return UtilsGiri.formatUrl(urlInJson[1]);
                } catch(e) {}
            }
            const rawMatches = cleanHtml.match(/https?:[^"'<>\s]+?\.m3u8/gi);
            if (rawMatches && rawMatches.length > 0) {
                const valid = rawMatches.filter(u => !u.includes('ad') && !u.includes('log'));
                if (valid.length > 0) return UtilsGiri.formatUrl(valid[0]);
            }
            const mp4Matches = cleanHtml.match(/https?:[^"'<>\s]+?\.mp4/gi);
            if (mp4Matches && mp4Matches.length > 0) return UtilsGiri.formatUrl(mp4Matches[0]);
            return null;
        },

        showToast: function(msg, duration = 0) {
            let toastNode = document.getElementById('iina-toast');
            if (!toastNode) {
                toastNode = document.createElement('div');
                toastNode.id = 'iina-toast';
                toastNode.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.85);color:white;padding:12px 20px;border-radius:8px;z-index:2147483647;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:opacity 0.3s;pointer-events:none;line-height:1.5;font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;';
                document.body.appendChild(toastNode);
            }
            toastNode.innerHTML = msg;
            toastNode.style.opacity = '1';
            if (duration > 0) setTimeout(() => { toastNode.style.opacity = '0'; }, duration);
        },

        downloadM3U: (content, filename) => {
            const blob = new Blob([content], { type: 'audio/x-mpegurl' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.m3u`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const StrategyGiri = {
        name: 'GiriGiri (v3.3.1 Strict)',
        match: () => location.hostname.includes('girigirilove') || location.hostname.includes('iyoudm'),

        runChild: () => {
            let foundAndSent = false;
            const reportFound = (rawUrl, source) => {
                if (foundAndSent || !rawUrl) return;
                const finalUrl = UtilsGiri.formatUrl(rawUrl);
                if (finalUrl && !finalUrl.startsWith('blob:')) {
                    window.top.postMessage({ type: 'IINA_VIDEO_FOUND', url: finalUrl, href: window.location.href }, '*');
                    foundAndSent = true;
                }
            };
            const checkNetwork = (url) => {
                if (typeof url === 'string' && (url.includes('.m3u8') || url.includes('.mp4'))) {
                    reportFound(url, 'Network');
                }
            };
            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
                checkNetwork(url);
                return originalOpen.apply(this, arguments);
            };
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
                let url = input instanceof Request ? input.url : input;
                checkNetwork(url);
                return originalFetch.apply(this, arguments);
            };
            window.addEventListener('DOMContentLoaded', () => {
                const configs = [window.player_data, window.config, window.opts, window.video_config];
                for (let conf of configs) {
                    if (conf && conf.url) reportFound(conf.url, 'GlobalVar');
                }
                const fuzzyUrl = UtilsGiri.extractVideoFuzzy(document.body.innerHTML);
                if (fuzzyUrl) reportFound(fuzzyUrl, 'HTMLScan');
                setTimeout(() => {
                    if (!foundAndSent) {
                        const playBtn = document.querySelector('.dplayer-mobile-play, .art-state-play, button[aria-label="Play"], video');
                        if (playBtn) playBtn.click();
                    }
                }, 100);
            });
            setInterval(() => {
                if (!foundAndSent) {
                    const v = document.querySelector('video');
                    if (v && v.src && v.src.startsWith('http')) reportFound(v.src, 'VideoTag');
                }
            }, 1000);
        },

        exportPlaylist: async () => {
            const findBestPlaylistLinks = () => {
                const allLinks = document.getElementsByTagName('a');
                const pathParts = location.pathname.split('/').filter(p => p && p.trim() !== '');
                const currentId = pathParts.length > 0 ? pathParts[pathParts.length - 1].replace(/\.[^/.]+$/, "") : null;
                if (currentId) {
                    const strictGroup = [];
                    for (let link of allLinks) {
                        const href = link.href;
                        if (!href || href.includes('javascript') || href === window.location.href) continue;
                        if (link.hostname !== location.hostname) continue;
                        if (href.includes(currentId) && (href.includes('play') || href.includes('vod-play') || href.includes('video'))) {
                            strictGroup.push(link);
                        }
                    }
                    if (strictGroup.length > 1) return [...new Set(strictGroup)];
                }
                const groups = new Map();
                for (let link of allLinks) {
                    const href = link.getAttribute('href');
                    if (!href || href.includes('javascript') || href === '#') continue;
                    const text = link.innerText.trim();
                    if (/^(\d+|第\d+集|OVA\d*|SP\d*|EP\d+)$/i.test(text) || /^\d+-\d+$/.test(text)) {
                        const gp = link.parentElement?.parentElement;
                        if (gp) {
                            if (!groups.has(gp)) groups.set(gp, []);
                            groups.get(gp).push(link);
                        }
                    }
                }
                let bestGroup = [];
                for (let links of groups.values()) { if (links.length > bestGroup.length) bestGroup = links; }
                return bestGroup.length > 1 ? bestGroup : null;
            };

            const episodeLinks = findBestPlaylistLinks();
            if (!episodeLinks || episodeLinks.length === 0) {
                UtilsGiri.showToast('⚠️ No episode list found.', 3000);
                return;
            }

            const uniqueLinks = new Map();
            episodeLinks.forEach(link => uniqueLinks.set(link.href, link));
            const finalLinks = Array.from(uniqueLinks.values());
            const results = [];
            let completed = 0;
            let successCount = 0;

            const container = document.createElement('div');
            container.style.cssText = 'position:fixed;right:0px;bottom:0px;width:10px;height:10px;overflow:hidden;opacity:0.01;z-index:9999;';
            document.body.appendChild(container);

            const messageHandler = (e) => {
                if (e.data && e.data.type === 'IINA_VIDEO_FOUND') {
                    const task = activeTask;
                    if (task && !task.done) {
                        task.done = true;
                        task.resolve(e.data.url);
                    }
                }
            };
            window.addEventListener('message', messageHandler);

            let activeTask = null;
            const runTask = (link, index) => {
                return new Promise(resolve => {
                    const title = link.getAttribute('title') || link.innerText.trim() || `Episode ${index + 1}`;
                    const targetUrl = link.href;
                    activeTask = { url: targetUrl, done: false, resolve: (vUrl) => {
                        if (vUrl) {
                            results.push({ title, url: vUrl, index });
                            successCount++;
                        }
                        cleanup();
                        resolve();
                    }};
                    const iframe = document.createElement('iframe');
                    iframe.src = targetUrl;
                    iframe.style.width = '400px';
                    iframe.style.height = '300px';
                    container.appendChild(iframe);
                    const timer = setTimeout(() => {
                        if (!activeTask.done) {
                            activeTask.resolve(null);
                        }
                    }, 5000);
                    const cleanup = () => {
                        clearTimeout(timer);
                        try { container.removeChild(iframe); } catch(e){}
                    };
                });
            };

            for (let i = 0; i < finalLinks.length; i++) {
                completed++;
                UtilsGiri.showToast(`📺 Parsing Progress: ${i + 1}/${finalLinks.length}<br>✅ Success: ${successCount}<br>⚡️ Now Parsing: ${finalLinks[i].innerText.trim()}`);
                await runTask(finalLinks[i], i);
                await new Promise(r => setTimeout(r, 50));
            }

            window.removeEventListener('message', messageHandler);
            document.body.removeChild(container);

            if (results.length === 0) {
                UtilsGiri.showToast('Parsing failed.', 4000);
                return;
            }

            results.sort((a, b) => a.index - b.index);
            let m3uContent = "#EXTM3U\n";
            results.forEach(item => {
                let t = item.title.replace(/[\r\n,]+/g, ' ').trim();
                m3uContent += `#EXTINF:-1,${t}\n${item.url}\n`;
            });

            const safeTitle = document.title.split(/[-_]/)[0].trim().replace(/[\\/:*?"<>|]/g, "") || "Playlist";
            UtilsGiri.showToast(`✅ Export ${results.length}/${finalLinks.length} episodes<br>`, 3000);

            UtilsGiri.downloadM3U(m3uContent, safeTitle);
        }
    };

    const StrategyDefault = {
        name: 'Default (Primitive)',
        match: () => true,

        runChild: () => {},

        execute: () => {
            const targetUrl = window.location.href;
            console.log('[IINA Primitive] Sending:', targetUrl);

            window.location.href = `iina://open?url=${encodeURIComponent(targetUrl)}`;
        }
    };

    const CurrentStrategy = StrategyGiri.match() ? StrategyGiri : StrategyDefault;
    console.log(`[IINA] Loaded Strategy: ${CurrentStrategy.name}`);

    if (window.self !== window.top && StrategyGiri.match()) {
        CurrentStrategy.runChild();
        return;
    }

    let lastSniffedUrl = '';
    const mainCheck = (u) => {
        if (typeof u === 'string' && (u.includes('.m3u8') || u.includes('.mp4') || u.includes('video'))) {
            lastSniffedUrl = u;
        }
    };

    if (StrategyGiri.match()) {
        const oriOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(m, u) { mainCheck(u); return oriOpen.apply(this, arguments); };
        const oriFetch = window.fetch;
        window.fetch = function(i, init) {
            let u = i instanceof Request ? i.url : i;
            mainCheck(u);
            return oriFetch.apply(this, arguments);
        };
    }

    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

        if (e.altKey && e.code === 'KeyI') {
            e.preventDefault();

            if (StrategyGiri.match()) {
                let singleUrl = UtilsGiri.formatUrl(lastSniffedUrl);
                if (!singleUrl) singleUrl = UtilsGiri.extractVideoFuzzy(document.body.innerHTML);
                const hasPlayer = window.player_data || window.config || document.querySelector('video');

                if (singleUrl && hasPlayer && !location.pathname.endsWith('/')) {
                    UtilsGiri.showToast('🚀 [Single] Opening in IINA...', 2000);
                    window.location.href = `iina://open?url=${encodeURIComponent(singleUrl)}`;
                } else {
                    StrategyGiri.exportPlaylist();
                }
            } else {
                StrategyDefault.execute();
            }
        }
    }, false);

})();
