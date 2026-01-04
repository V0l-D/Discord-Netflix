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

// Picture in Picture
(function () {
    const ICON_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none" role="img"><path fill="currentColor" fill-rule="evenodd" d="M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6l-4 4v-4H4a2 2 0 0 1-2-2zm2 0v10h6v2.17L13.17 14H20V4z"/></svg>`;

    const getVideo = () => document.querySelector("video");

    const togglePiP = async () => {
        const video = getVideo();
        if (!video) return;
        document.pictureInPictureElement
            ? await document.exitPictureInPicture()
            : await video.requestPictureInPicture();
    };

    const createButton = () => {
        const btn = document.createElement("button");
        btn.className = "pip-button default-ltr-iqcdef-cache-1enhvti";
        btn.setAttribute("aria-label", "Picture in Picture");
        btn.innerHTML = `<div class="control-medium default-ltr-iqcdef-cache-iyulz3">${ICON_SVG}</div>`;
        btn.onclick = togglePiP;
        return btn;
    };

    const inject = () => {
        const controls = document.querySelector('[data-uia="control-fullscreen-enter"]')?.parentElement;
        if (!controls || controls.querySelector(".pip-button")) return;
        controls.insertBefore(createButton(), controls.firstChild);
    };

    // Wait until <head> exists for styles
    const injectStyle = () => {
        if (!document.head) return requestAnimationFrame(injectStyle);
        if (!document.getElementById("pip-css")) {
            const style = document.createElement("style");
            style.id = "pip-css";
            style.textContent = `
                .pip-button { cursor: pointer; }
                .pip-button:hover svg { opacity: 0.8; }
                .pip-button:active svg { transform: scale(0.95); }
            `;
            document.head.appendChild(style);
        }
    };
    injectStyle();

    // Wait until <body> exists before attaching MutationObserver
    const waitForBodyAndObserve = () => {
        if (!document.body) return requestAnimationFrame(waitForBodyAndObserve);

        // Safe to observe now
        new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
        inject(); // initial injection
    };
    waitForBodyAndObserve();
})();
