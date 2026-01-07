/* =========================================================
   MAX BITRATE & 1080p + EAC3 AUDIO
   ========================================================= */
(function () {
    const getElementByXPath = xpath =>
        document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
            .singleNodeValue;

    const setMaxBitrate = () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
            keyCode: 83, ctrlKey: true, altKey: true, shiftKey: true
        }));

        const VIDEO_SELECT = getElementByXPath("//div[text()='Video Bitrate']");
        const AUDIO_SELECT = getElementByXPath("//div[text()='Audio Bitrate']");
        const BUTTON = getElementByXPath("//button[text()='Override']");

        if (!(VIDEO_SELECT && AUDIO_SELECT && BUTTON)) return false;

        [VIDEO_SELECT, AUDIO_SELECT].forEach(el => {
            const parent = el.parentElement;
            const options = parent.querySelectorAll('select > option');
            for (let i = 0; i < options.length - 1; i++) options[i].removeAttribute('selected');
            options[options.length - 1].setAttribute('selected', 'selected');
        });

        BUTTON.click();
        return true;
    };

    const run = () => setMaxBitrate() || setTimeout(run, 100);
    const WATCH_REGEXP = /netflix\.com\/watch\/.*/;
    let oldLocation;

    setInterval(() => {
        const loc = location.toString();
        if (loc !== oldLocation) {
            oldLocation = loc;
            WATCH_REGEXP.test(loc) && run();
        }
    }, 500);

    console.log("MAX BITRATE ENABLED | DISCORD-NETFLIX");
})();

/* =========================================================
   PICTURE IN PICTURE (NETFLIX-EXACT)
   ========================================================= */
(function () {
    const ICON_SVG = `
 <svg viewBox="0 0 24 24" width="24" height="24"
     xmlns="http://www.w3.org/2000/svg" fill="none" role="img">
    <path fill="currentColor" fill-rule="evenodd"
          d="M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm2 0v12h16V4zm9 7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/>
</svg>
    `;

    const getVideo = () => document.querySelector("video");

    const togglePiP = async () => {
        const video = getVideo();
        if (!video) return;
        try {
            document.pictureInPictureElement
                ? await document.exitPictureInPicture()
                : await video.requestPictureInPicture();
        } catch {}
    };

    const createPiPUnit = (fullscreenWrapper) => {
        // --- button wrapper (medium)
        const wrapper = fullscreenWrapper.cloneNode(false);
        wrapper.innerHTML = "";

        const btn = document.createElement("button");
        btn.className = "pip-button default-ltr-iqcdef-cache-1enhvti";
        btn.setAttribute("aria-label", "Picture in Picture");

        btn.innerHTML = `
            <div class="control-medium default-ltr-iqcdef-cache-iyulz3" role="presentation">
                ${ICON_SVG}
            </div>
        `;

        // Netflix-like hover/focus behavior
        const activate = () => btn.classList.add("active");
        const deactivate = () => btn.classList.remove("active");

        btn.addEventListener("mouseenter", activate);
        btn.addEventListener("mouseleave", deactivate);
        btn.addEventListener("focus", activate);
        btn.addEventListener("blur", deactivate);

        btn.addEventListener("click", togglePiP);
        wrapper.appendChild(btn);

        // --- spacing div (THIS FIXES ALIGNMENT)
        const spacer = document.createElement("div");
        spacer.className = "default-ltr-iqcdef-cache-1npqywr";
        spacer.style.minWidth = "3rem";
        spacer.style.width = "3rem";

        return { wrapper, spacer };
    };

    const inject = () => {
        const fullscreenBtn = document.querySelector(
            'button[data-uia="control-fullscreen-enter"]'
        );
        if (!fullscreenBtn) return;

        const fullscreenWrapper = fullscreenBtn.closest(".medium");
        if (!fullscreenWrapper) return;

        const container = fullscreenWrapper.parentElement;
        if (!container || container.querySelector(".pip-button")) return;

        const { wrapper, spacer } = createPiPUnit(fullscreenWrapper);

        container.insertBefore(spacer, fullscreenWrapper);
        container.insertBefore(wrapper, spacer);
    };

    const injectStyle = () => {
        if (document.getElementById("pip-css")) return;

        const style = document.createElement("style");
        style.id = "pip-css";
        style.textContent = `
            .pip-button {
                cursor: pointer;
                transition: transform 0.2s ease;
            }
        `;

        const target = document.head || document.body;
        if (!target) return requestAnimationFrame(injectStyle);
        target.appendChild(style);
    };

    const waitForBody = () => {
        if (!document.body) return requestAnimationFrame(waitForBody);

        injectStyle();
        const observer = new MutationObserver(inject);
        observer.observe(document.body, { childList: true, subtree: true });

        inject();
    };

    waitForBody();
})();

/* =========================================================
   SMOOTH SCROLL (NETFLIX / ELECTRON)
   ========================================================= */
(function () {
    const STEP = 120;
    const DURATION = 400;
    const PULSE = 8;

    let queue = [];
    let running = false;
    let lastDir = 0;

    const pulse = x => {
        x *= PULSE;
        return x < 1
            ? x - (1 - Math.exp(-x))
            : (1 - Math.exp(-(x - 1))) * (1 - Math.exp(-1)) + Math.exp(-1);
    };

    const findScrollable = el => {
        while (el && el !== document.body) {
            const s = getComputedStyle(el);
            if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight)
                return el;
            el = el.parentElement;
        }
        return document.scrollingElement || document.documentElement;
    };

    const animate = () => {
        const now = performance.now();
        queue = queue.filter(item => {
            const t = Math.min(1, (now - item.start) / DURATION);
            const p = pulse(t);
            const dy = (item.y * p - item.ly) | 0;
            item.ly += dy;
            item.elem.scrollTop += dy;
            return t < 1;
        });
        running ? requestAnimationFrame(animate) : (running = false);
    };

    const onWheel = e => {
        if (e.defaultPrevented) return;

        const delta = e.deltaY;
        if (!delta) return;

        const dir = Math.sign(delta);
        if (dir !== lastDir) queue.length = 0;
        lastDir = dir;

        const elem = findScrollable(e.target);
        queue.push({ elem, y: delta * STEP / 120, ly: 0, start: performance.now() });

        if (!running) {
            running = true;
            requestAnimationFrame(animate);
        }
        e.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    console.log("SMOOTH SCROLL ENABLED | DISCORD-NETFLIX");
})();

/* =========================================================
   BYPASS HOUSEHOLD RESTRICTIONS (NETFLIX / ELECTRON)
   ========================================================= */
(function () {
    'use strict';

    let hasForced = false;
    let observer = null;

    function tryForcePlay() {
        if (hasForced) return;

        try {
            const video = document.querySelector('video');
            if (!video) return;

            const netflixPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI?.().videoPlayer;
            const sessionId = netflixPlayer?.getAllPlayerSessionIds?.()[0];
            const player = netflixPlayer?.getVideoPlayerBySessionId?.(sessionId);

            if (player && video.paused) {
                player.play();
                hasForced = true;

                // once successful, disconnect everything
                observer?.disconnect();
                observer = null;

                console.log('[TM] Household block bypassed.');
            }
        } catch (_) {
            // intentionally silent (stealth)
        }
    }

    function cleanUI() {
        const blockers = document.querySelectorAll(
            '.nf-modal, .screen-overlay, [data-uia*="interstitial"], .active-overlay, .error-page-container'
        );
        blockers.forEach(el => el.remove());

        if (document.body) {
            document.body.style.pointerEvents = 'auto';
            document.body.style.overflow = 'auto';
        }
    }

    function setupObserver() {
        if (!document.body) {
            requestAnimationFrame(setupObserver);
            return;
        }

        observer = new MutationObserver(() => {
            const modal = document.querySelector(
                '.nf-modal, [data-uia*="interstitial"]'
            );

            if (modal && !hasForced) {
                cleanUI();

                // delay slightly so Netflix finishes its own handling
                setTimeout(tryForcePlay, 500);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    setupObserver();

    /* INPUT CONTROLS — UNCHANGED */
    window.addEventListener('keydown', function (e) {
        const video = document.querySelector('video');
        if (!video) return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                video.paused ? video.play() : video.pause();
                break;
            case 'KeyM':
                video.muted = !video.muted;
                break;
            case 'ArrowRight':
                video.currentTime += 10;
                break;
            case 'ArrowLeft':
                video.currentTime -= 10;
                break;
        }
    });

    window.addEventListener('click', function (e) {
        const video = document.querySelector('video');
        if (!video) return;
        if (e.target.tagName.toLowerCase() === 'video') {
            video.paused ? video.play() : video.pause();
        }
    });
    console.log("BYPASS HOUSEHOLD RESTRICTIONS ENABLED | DISCORD-NETFLIX");
})();
