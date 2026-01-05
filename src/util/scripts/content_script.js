// Max Bitrate & 1080p + EAC3 Audio
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
    const WATCH_REGEXP = /netflix.com\/watch\/.*/;
    let oldLocation;

    setInterval(() => {
        const newLocation = window.location.toString();
        if (newLocation !== oldLocation) {
            oldLocation = newLocation;
            WATCH_REGEXP.test(newLocation) && run();
        }
    }, 500);

    console.log("MAXBITRATE ENABLED | DISCORD-NETFLIX");
})();

// Picture in Picture for Netflix
(function () {
    const ICON_SVG = `
        <svg viewBox="0 0 24 24" width="24" height="24"
             xmlns="http://www.w3.org/2000/svg" fill="none" role="img">
            <path fill="currentColor" fill-rule="evenodd"
                  d="M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6l-4 4v-4H4a2 2 0 0 1-2-2zm2 0v10h6v2.17L13.17 14H20V4z">
            </path>
        </svg>
    `;

    const getVideo = () => document.querySelector("video");

    const togglePiP = async () => {
        const video = getVideo();
        if (!video) return;

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch (e) {
            // silently ignore errors
        }
    };

    const createButton = () => {
        const btn = document.createElement("button");
        btn.className = "pip-button default-ltr-iqcdef-cache-1enhvti";
        btn.setAttribute("aria-label", "Picture in Picture");

        btn.innerHTML = `
            <div class="control-medium default-ltr-iqcdef-cache-iyulz3" role="presentation">
                ${ICON_SVG}
            </div>
        `;

        btn.addEventListener("click", togglePiP);
        return btn;
    };

    const inject = () => {
        // Find the fullscreen button
        const fullscreenBtn = document.querySelector('button[data-uia="control-fullscreen-enter"]');
        if (!fullscreenBtn) return;

        // The container we actually want is the direct parent of the fullscreen button:
        // <div class="medium default-ltr-iqcdef-cache-1dcjcj4">[buttons here]</div>
        const container = fullscreenBtn.parentElement;
        if (!container) return;

        // Avoid duplicating the PiP button
        if (container.querySelector(".pip-button")) return;

        const pipBtn = createButton();

        // Insert PiP directly BEFORE fullscreen inside the same container
        container.insertBefore(pipBtn, fullscreenBtn);
    };

    const injectStyle = () => {
        if (!document.head) return requestAnimationFrame(injectStyle);
        if (document.getElementById("pip-css")) return;

        const style = document.createElement("style");
        style.id = "pip-css";
        style.textContent = `
            .pip-button {
                cursor: pointer;
            }
            .pip-button:hover svg {
                opacity: 0.8;
            }
            .pip-button:active svg {
                transform: scale(0.95);
            }
        `;
        document.head.appendChild(style);
    };

    injectStyle();

    const waitForBodyAndObserve = () => {
        if (!document.body) {
            requestAnimationFrame(waitForBodyAndObserve);
            return;
        }

        // Observe changes so we re-inject when Netflix rebuilds the controls
        const observer = new MutationObserver(() => inject());
        observer.observe(document.body, { childList: true, subtree: true });

        // Initial attempt
        inject();
    };

    waitForBodyAndObserve();
})();


// SmoothScroll (Netflix / Electron – FIXED)
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

        if (queue.length) {
            requestAnimationFrame(animate);
        } else {
            running = false;
        }
    };

    const onWheel = e => {
        if (e.defaultPrevented) return;

        const delta = e.deltaY;
        if (!delta) return;

        const dir = Math.sign(delta);
        if (dir !== lastDir) queue.length = 0;
        lastDir = dir;

        const elem = findScrollable(e.target);

        queue.push({
            elem,
            y: delta * STEP / 120,
            ly: 0,
            start: performance.now()
        });

        if (!running) {
            running = true;
            requestAnimationFrame(animate);
        }

        e.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    console.log("SMOOTH SCROLL ENABLED | DISCORD-NETFLIX");
})();
