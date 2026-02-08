// ==UserScript==
// @name         Open in IINA
// @namespace    https://github.com/Noyoth/userscripts
// @version      2.1.0
// @description  Opens web videos in IINA via (Option + I), featuring specialized support for bgm.girigirilove.com to export complete series as .m3u playlists.
// @author       Noyoth
// @match        *://*/*
// @license      MIT
// @icon         https://raw.githubusercontent.com/iina/iina/master/iina/Assets.xcassets/AppIcon.appiconset/iina-icon-256.png
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================================
    // 🔰 CORE: Shared Utilities & UI
    // =========================================================================
    const Core = {
        state: {
            lastSniffedUrl: ''
        },

        formatUrl: (url) => {
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

        extractVideoFuzzy: (html) => {
            if (!html) return null;
            const cleanHtml = html.replace(/\\/g, '');
            const jsonRegex = /(?:player_data|config|opts|video)\s*=\s*({.*?})/;
            const jsonMatch = html.match(jsonRegex);
            if (jsonMatch) {
                try {
                    const urlInJson = jsonMatch[1].match(/["']url["']\s*:\s*["']([^"']+)["']/);
                    if (urlInJson) return Core.formatUrl(urlInJson[1]);
                } catch(e) {}
            }
            const rawMatches = cleanHtml.match(/https?:[^"'<>\s]+?\.m3u8/gi);
            if (rawMatches && rawMatches.length > 0) {
                const valid = rawMatches.filter(u => !u.includes('ad') && !u.includes('log'));
                if (valid.length > 0) return Core.formatUrl(valid[0]);
            }
            return null;
        },

        showToast: (msg, duration = 0) => {
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

    // =========================================================================
    // 🔌 ADAPTERS
    // =========================================================================

    // --- Adapter 1: GiriGiri (Unified Crawler Logic) ---
    const AdapterGiri = {
        name: 'GiriGiri (Crawler)',
        match: () => location.hostname.includes('girigirilove') || location.hostname.includes('iyoudm'),

        onReady: () => {
            if (window.self === window.top) return;

            let foundAndSent = false;
            const report = (rawUrl) => {
                if (foundAndSent || !rawUrl) return;
                const finalUrl = Core.formatUrl(rawUrl);
                if (finalUrl && !finalUrl.startsWith('blob:')) {
                    window.top.postMessage({ type: 'IINA_VIDEO_FOUND', url: finalUrl, href: window.location.href }, '*');
                    foundAndSent = true;
                }
            };

            const check = (u) => { if(typeof u==='string' && (u.includes('.m3u8')||u.includes('.mp4'))) report(u); };
            const oriOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(m, u) { check(u); return oriOpen.apply(this, arguments); };

            const configs = [window.player_data, window.config, window.opts];
            for (let c of configs) if (c && c.url) report(c.url);
            const f = Core.extractVideoFuzzy(document.body.innerHTML);
            if (f) report(f);

            setTimeout(() => {
                if (!foundAndSent) {
                    const btn = document.querySelector('.dplayer-mobile-play, .art-state-play, button[aria-label="Play"], video');
                    if (btn) btn.click();
                }
            }, 10);

            setInterval(() => {
                if (!foundAndSent) {
                    const v = document.querySelector('video');
                    if (v && v.src && v.src.startsWith('http')) report(v.src);
                }
            }, 1000);
        },

        execute: async () => {
            const isPlayPage = /\/play/i.test(location.pathname);
            if (isPlayPage) {
                Core.showToast('🕷️ Single Mode: Crawling current page...', 2000);

                // Create a container for the single-task crawler
                const container = document.createElement('div');
                container.style.cssText = 'position:fixed;right:0;bottom:0;width:10px;height:10px;opacity:0.01;z-index:9999;';
                document.body.appendChild(container);

                // Listen for result
                const singleMessageHandler = (e) => {
                    if (e.data?.type === 'IINA_VIDEO_FOUND' && e.data.url) {
                        // Success!
                        Core.showToast('🚀 [Single] URL Found! Opening IINA...', 2000);
                        window.location.href = `iina://open?url=${encodeURIComponent(e.data.url)}`;

                        // Cleanup
                        window.removeEventListener('message', singleMessageHandler);
                        document.body.removeChild(container);
                    }
                };
                window.addEventListener('message', singleMessageHandler);

                // Launch Iframe (reload current page in iframe to trigger child logic)
                const iframe = document.createElement('iframe');
                iframe.src = window.location.href;
                iframe.style.width = '400px'; iframe.style.height = '300px';
                container.appendChild(iframe);

                // Timeout fallback
                setTimeout(() => {
                    if (document.body.contains(container)) {
                        Core.showToast('❌ Single crawl timed out.', 3000);
                        window.removeEventListener('message', singleMessageHandler);
                        document.body.removeChild(container);
                    }
                }, 8000); // 8s timeout for single page

                return;
            }

            const findBestLinks = () => {
                const allLinks = document.getElementsByTagName('a');
                const pathParts = location.pathname.split('/').filter(p => p && p.trim() !== '');
                const currentId = pathParts.length > 0 ? pathParts[pathParts.length - 1].replace(/\.[^/.]+$/, "") : null;

                if (currentId) {
                    const strict = Array.from(allLinks).filter(l => l.hostname===location.hostname && l.href.includes(currentId) && (l.href.includes('play') || l.href.includes('vod-play') || l.href.includes('video')));
                    if (strict.length > 1) return [...new Set(strict)];
                }

                const groups = new Map();
                for (let link of allLinks) {
                    const text = link.innerText.trim();
                    if (/^(\d+(\.\d+)?|第\d+[集话]|OVA\d*|SP\d*|EP?\d+|Vol\.?\d+)$/i.test(text) || /^\d+-\d+$/.test(text)) {
                        const gp = link.parentElement?.parentElement;
                        if (gp) { if (!groups.has(gp)) groups.set(gp, []); groups.get(gp).push(link); }
                    }
                }
                let best = []; for (let links of groups.values()) if (links.length > best.length) best = links;
                return best.length > 1 ? best : null;
            };

            const links = findBestLinks();
            if (!links || links.length === 0) { Core.showToast('⚠️ No episode list found.', 3000); return; }
            const finalLinks = Array.from(new Map(links.map(l => [l.href, l])).values());
            const results = [];
            let successCount = 0;

            Core.showToast(`📺 Found ${finalLinks.length} episodes.<br>🕷️ Starting Crawler...`);
            const container = document.createElement('div');
            container.style.cssText = 'position:fixed;right:0;bottom:0;width:10px;height:10px;opacity:0.01;z-index:9999;';
            document.body.appendChild(container);

            let activeTask = null;
            const messageHandler = (e) => {
                if (e.data?.type === 'IINA_VIDEO_FOUND' && activeTask && !activeTask.done) {
                    activeTask.done = true;
                    activeTask.resolve(e.data.url);
                }
            };
            window.addEventListener('message', messageHandler);

            const runTask = (link, index) => new Promise(resolve => {
                activeTask = { url: link.href, done: false, resolve: (vUrl) => {
                    if (vUrl) { results.push({ title: link.title || link.innerText.trim() || `EP ${index+1}`, url: vUrl, index }); successCount++; }
                    cleanup(); resolve();
                }};
                const iframe = document.createElement('iframe');
                iframe.src = link.href; iframe.style.width = '400px'; iframe.style.height = '300px';
                container.appendChild(iframe);

                const timer = setTimeout(() => { if (!activeTask.done) activeTask.resolve(null); }, 5000);
                const cleanup = () => {
                    clearTimeout(timer);
                    try { container.removeChild(iframe); } catch(e){}
                };
            });

            for (let i = 0; i < finalLinks.length; i++) {
                Core.showToast(`📺 Progress: ${i + 1}/${finalLinks.length}<br>✅ Success: ${successCount}<br>⚡️ Processing: ${finalLinks[i].innerText.trim()}`);
                await runTask(finalLinks[i], i);
                await new Promise(r => setTimeout(r, 100));
            }

            window.removeEventListener('message', messageHandler);
            document.body.removeChild(container);

            if (results.length === 0) { Core.showToast('❌ Parsing failed.', 3000); return; }

            results.sort((a, b) => a.index - b.index);
            let m3u = "#EXTM3U\n" + results.map(item => `#EXTINF:-1,${item.title.replace(/[\r\n,]+/g, ' ').trim()}\n${item.url}`).join('\n');
            const safeTitle = document.title.split(/[-_]/)[0].trim() || "Playlist";

            Core.showToast(`✅ Exported ${results.length} episodes.<br>Opening IINA...`, 3000);
            Core.downloadM3U(m3u, safeTitle);
        }
    };

    // --- Adapter 2: Panopto (Turbo) ---
    const AdapterPanopto = {
        name: 'Panopto (Turbo)',
        match: () => location.hostname.includes('panopto.com') || location.pathname.includes('Panopto'),
        execute: async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const deliveryId = urlParams.get('id');
            if (!deliveryId) {
                window.location.href = `iina://open?url=${encodeURIComponent(window.location.href)}`;
                return;
            }
            Core.showToast('⚡️ Fetching stream info...', 3000);
            try {
                const response = await fetch('/Panopto/Pages/Viewer/DeliveryInfo.aspx', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `deliveryId=${deliveryId}&responseType=json`
                });
                const data = await response.json();
                let streamUrl = data?.Delivery?.Streams?.[0]?.StreamUrl;
                if (streamUrl) {
                    window.location.href = `iina://open?url=${encodeURIComponent(streamUrl)}`;
                } else { throw new Error(); }
            } catch (e) {
                window.location.href = `iina://open?url=${encodeURIComponent(window.location.href)}`;
            }
        }
    };

    // --- Adapter 3: Default (Primitive) ---
    const AdapterDefault = {
        name: 'Default (Primitive)',
        match: () => true,
        execute: () => {
            const targetUrl = window.location.href;
            console.log('[IINA Primitive] Sending:', targetUrl);
            Core.showToast('🚀 [Default] Opening in IINA...', 2000);
            window.location.href = `iina://open?url=${encodeURIComponent(targetUrl)}`;
        }
    };

    // =========================================================================
    // 🧠 MAIN: Initialization
    // =========================================================================

    const adapters = [AdapterGiri, AdapterPanopto, AdapterDefault];
    let currentAdapter = null;

    for (const adapter of adapters) {
        if (adapter.match()) {
            currentAdapter = adapter;
            break;
        }
    }
    console.log(`[IINA] Loaded Adapter: ${currentAdapter.name}`);

    // Child Window Initialization
    if (window.self !== window.top && currentAdapter.onReady) {
        currentAdapter.onReady();
        return;
    }

    document.addEventListener('keydown', function(e) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
        if (e.altKey && e.code === 'KeyI') {
            e.preventDefault();
            console.log(`[IINA] Executing: ${currentAdapter.name}`);
            currentAdapter.execute();
        }
    }, false);

})();
