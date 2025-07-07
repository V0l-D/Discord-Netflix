//Smoothscroll is kool
(function () {
  
    // Scroll Variables (tweakable)
    var defaultOptions = {
    
        // Scrolling Core
        frameRate        : 200, // [Hz]
        animationTime    : 400, // [ms]
        stepSize         : 100, // [px]
    
        // Pulse (less tweakable)
        // ratio of "tail" to "acceleration"
        pulseAlgorithm   : true,
        pulseScale       : 4,
        pulseNormalize   : 1,
    
        // Acceleration
        accelerationDelta : 50,  // 50
        accelerationMax   : 3,   // 3
    
        // Keyboard Settings
        keyboardSupport   : true,  // option
        arrowScroll       : 50,    // [px]
    
        // Other
        fixedBackground   : true, 
        excluded          : ''    
    };
    
    var options = defaultOptions;
    
    
    // Other Variables
    var isExcluded = false;
    var isFrame = false;
    var direction = { x: 0, y: 0 };
    var initDone  = false;
    var root = document.documentElement;
    var activeElement;
    var observer;
    var refreshSize;
    var deltaBuffer = [];
    var deltaBufferTimer;
    var isMac = /^Mac/.test(navigator.platform);
    
    var key = { left: 37, up: 38, right: 39, down: 40, spacebar: 32, 
                pageup: 33, pagedown: 34, end: 35, home: 36 };
    var arrowKeys = { 37: 1, 38: 1, 39: 1, 40: 1 };
    
    /***********************************************
     * INITIALIZE
     ***********************************************/
    
    /**
     * Tests if smooth scrolling is allowed. Shuts down everything if not.
     */
    function initTest() {
        if (options.keyboardSupport) {
            addEvent('keydown', keydown);
        }
    }
    
    /**
     * Sets up scrolls array, determines if frames are involved.
     */
    function init() {
      
        if (initDone || !document.body) return;
    
        initDone = true;
    
        var body = document.body;
        var html = document.documentElement;
        var windowHeight = window.innerHeight; 
        var scrollHeight = body.scrollHeight;
        
        // check compat mode for root element
        root = (document.compatMode.indexOf('CSS') >= 0) ? html : body;
        activeElement = body;
        
        initTest();
    
        // Checks if this script is running in a frame
        if (top != self) {
            isFrame = true;
        }
    
        /**
         * Safari 10 fixed it, Chrome fixed it in v45:
         * This fixes a bug where the areas left and right to 
         * the content does not trigger the onmousewheel event
         * on some pages. e.g.: html, body { height: 100% }
         */
        else if (isOldSafari &&
                 scrollHeight > windowHeight &&
                (body.offsetHeight <= windowHeight || 
                 html.offsetHeight <= windowHeight)) {
    
            var fullPageElem = document.createElement('div');
            fullPageElem.style.cssText = 'position:absolute; z-index:-10000; ' +
                                         'top:0; left:0; right:0; height:' + 
                                          root.scrollHeight + 'px';
            document.body.appendChild(fullPageElem);
            
            // DOM changed (throttled) to fix height
            var pendingRefresh;
            refreshSize = function () {
                if (pendingRefresh) return; // could also be: clearTimeout(pendingRefresh);
                pendingRefresh = setTimeout(function () {
                    if (isExcluded) return; // could be running after cleanup
                    fullPageElem.style.height = '0';
                    fullPageElem.style.height = root.scrollHeight + 'px';
                    pendingRefresh = null;
                }, 500); // act rarely to stay fast
            };
      
            setTimeout(refreshSize, 10);
    
            addEvent('resize', refreshSize);
    
            // TODO: attributeFilter?
            var config = {
                attributes: true, 
                childList: true, 
                characterData: false 
                // subtree: true
            };
    
            observer = new MutationObserver(refreshSize);
            observer.observe(body, config);
    
            if (root.offsetHeight <= windowHeight) {
                var clearfix = document.createElement('div');   
                clearfix.style.clear = 'both';
                body.appendChild(clearfix);
            }
        }
    
        // disable fixed background
        if (!options.fixedBackground && !isExcluded) {
            body.style.backgroundAttachment = 'scroll';
            html.style.backgroundAttachment = 'scroll';
        }
    }
    
    /**
     * Removes event listeners and other traces left on the page.
     */
    function cleanup() {
        observer && observer.disconnect();
        removeEvent(wheelEvent, wheel);
        removeEvent('mousedown', mousedown);
        removeEvent('keydown', keydown);
        removeEvent('resize', refreshSize);
        removeEvent('load', init);
    }
    
    
    /************************************************
     * SCROLLING 
     ************************************************/
     
    var que = [];
    var pending = false;
    var lastScroll = Date.now();
    
    /**
     * Pushes scroll actions to the scrolling queue.
     */
    function scrollArray(elem, left, top) {
        
        directionCheck(left, top);
    
        if (options.accelerationMax != 1) {
            var now = Date.now();
            var elapsed = now - lastScroll;
            if (elapsed < options.accelerationDelta) {
                var factor = (1 + (50 / elapsed)) / 2;
                if (factor > 1) {
                    factor = Math.min(factor, options.accelerationMax);
                    left *= factor;
                    top  *= factor;
                }
            }
            lastScroll = Date.now();
        }          
        
        // push a scroll command
        que.push({
            x: left, 
            y: top, 
            lastX: (left < 0) ? 0.99 : -0.99,
            lastY: (top  < 0) ? 0.99 : -0.99, 
            start: Date.now()
        });
            
        // don't act if there's a pending queue
        if (pending) {
            return;
        }  
    
        var scrollRoot = getScrollRoot();
        var isWindowScroll = (elem === scrollRoot || elem === document.body);
        
        // if we haven't already fixed the behavior, 
        // and it needs fixing for this sesh
        if (elem.$scrollBehavior == null && isScrollBehaviorSmooth(elem)) {
            elem.$scrollBehavior = elem.style.scrollBehavior;
            elem.style.scrollBehavior = 'auto';
        }
    
        var step = function (time) {
            
            var now = Date.now();
            var scrollX = 0;
            var scrollY = 0; 
        
            for (var i = 0; i < que.length; i++) {
                
                var item = que[i];
                var elapsed  = now - item.start;
                var finished = (elapsed >= options.animationTime);
                
                // scroll position: [0, 1]
                var position = (finished) ? 1 : elapsed / options.animationTime;
                
                // easing [optional]
                if (options.pulseAlgorithm) {
                    position = pulse(position);
                }
                
                // only need the difference
                var x = (item.x * position - item.lastX) >> 0;
                var y = (item.y * position - item.lastY) >> 0;
                
                // add this to the total scrolling
                scrollX += x;
                scrollY += y;            
                
                // update last values
                item.lastX += x;
                item.lastY += y;
            
                // delete and step back if it's over
                if (finished) {
                    que.splice(i, 1); i--;
                }           
            }
    
            // scroll left and top
            if (isWindowScroll) {
                window.scrollBy(scrollX, scrollY);
            } 
            else {
                if (scrollX) elem.scrollLeft += scrollX;
                if (scrollY) elem.scrollTop  += scrollY;                    
            }
            
            // clean up if there's nothing left to do
            if (!left && !top) {
                que = [];
            }
            
            if (que.length) { 
                requestFrame(step, elem, (1000 / options.frameRate + 1)); 
            } else { 
                pending = false;
                // restore default behavior at the end of scrolling sesh
                if (elem.$scrollBehavior != null) {
                    elem.style.scrollBehavior = elem.$scrollBehavior;
                    elem.$scrollBehavior = null;
                }
            }
        };
        
        // start a new queue of actions
        requestFrame(step, elem, 0);
        pending = true;
    }
    
    
    /***********************************************
     * EVENTS
     ***********************************************/
    
    /**
     * Mouse wheel handler.
     * @param {Object} event
     */
    function wheel(event) {
    
        if (!initDone) {
            init();
        }
        
        var target = event.target;
    
        // leave early if default action is prevented   
        // or it's a zooming event with CTRL 
        if (event.defaultPrevented || event.ctrlKey) {
            return true;
        }
        
        // leave embedded content alone (flash & pdf)
        if (isNodeName(activeElement, 'embed') || 
           (isNodeName(target, 'embed') && /\.pdf/i.test(target.src)) ||
            isNodeName(activeElement, 'object') ||
            target.shadowRoot) {
            return true;
        }
    
        var deltaX = -event.wheelDeltaX || event.deltaX || 0;
        var deltaY = -event.wheelDeltaY || event.deltaY || 0;
        
        if (isMac) {
            if (event.wheelDeltaX && isDivisible(event.wheelDeltaX, 120)) {
                deltaX = -120 * (event.wheelDeltaX / Math.abs(event.wheelDeltaX));
            }
            if (event.wheelDeltaY && isDivisible(event.wheelDeltaY, 120)) {
                deltaY = -120 * (event.wheelDeltaY / Math.abs(event.wheelDeltaY));
            }
        }
        
        // use wheelDelta if deltaX/Y is not available
        if (!deltaX && !deltaY) {
            deltaY = -event.wheelDelta || 0;
        }
    
        // line based scrolling (Firefox mostly)
        if (event.deltaMode === 1) {
            deltaX *= 40;
            deltaY *= 40;
        }
    
        var overflowing = overflowingAncestor(target);
    
        // nothing to do if there's no element that's scrollable
        if (!overflowing) {
            // except Chrome iframes seem to eat wheel events, which we need to 
            // propagate up, if the iframe has nothing overflowing to scroll
            if (isFrame && isChrome)  {
                // change target to iframe element itself for the parent frame
                Object.defineProperty(event, "target", {value: window.frameElement});
                return parent.wheel(event);
            }
            return true;
        }
        
        // check if it's a touchpad scroll that should be ignored
        if (isTouchpad(deltaY)) {
            return true;
        }
    
        // scale by step size
        // delta is 120 most of the time
        // synaptics seems to send 1 sometimes
        if (Math.abs(deltaX) > 1.2) {
            deltaX *= options.stepSize / 120;
        }
        if (Math.abs(deltaY) > 1.2) {
            deltaY *= options.stepSize / 120;
        }
        
        scrollArray(overflowing, deltaX, deltaY);
        event.preventDefault();
        scheduleClearCache();
    }
    
    /**
     * Keydown event handler.
     * @param {Object} event
     */
    function keydown(event) {
    
        var target   = event.target;
        var modifier = event.ctrlKey || event.altKey || event.metaKey || 
                      (event.shiftKey && event.keyCode !== key.spacebar);
        
        // our own tracked active element could've been removed from the DOM
        if (!document.body.contains(activeElement)) {
            activeElement = document.activeElement;
        }
    
        // do nothing if user is editing text
        // or using a modifier key (except shift)
        // or in a dropdown
        // or inside interactive elements
        var inputNodeNames = /^(textarea|select|embed|object)$/i;
        var buttonTypes = /^(button|submit|radio|checkbox|file|color|image)$/i;
        if ( event.defaultPrevented ||
             inputNodeNames.test(target.nodeName) ||
             isNodeName(target, 'input') && !buttonTypes.test(target.type) ||
             isNodeName(activeElement, 'video') ||
             isInsideNetflixVideo(event) ||
             target.isContentEditable || 
             modifier ) {
          return true;
        }
    
        // [spacebar] should trigger button press, leave it alone
        if ((isNodeName(target, 'button') ||
             isNodeName(target, 'input') && buttonTypes.test(target.type)) &&
            event.keyCode === key.spacebar) {
          return true;
        }
    
        // [arrwow keys] on radio buttons should be left alone
        if (isNodeName(target, 'input') && target.type == 'radio' &&
            arrowKeys[event.keyCode])  {
          return true;
        }
        
        var shift, x = 0, y = 0;
        var overflowing = overflowingAncestor(activeElement);
    
        if (!overflowing) {
            // Chrome iframes seem to eat key events, which we need to 
            // propagate up, if the iframe has nothing overflowing to scroll
            return (isFrame && isChrome) ? parent.keydown(event) : true;
        }
    
        var clientHeight = overflowing.clientHeight; 
    
        if (overflowing == document.body) {
            clientHeight = window.innerHeight;
        }
    
        switch (event.keyCode) {
            case key.up:
                y = -options.arrowScroll;
                break;
            case key.down:
                y = options.arrowScroll;
                break;         
            case key.spacebar: // (+ shift)
                shift = event.shiftKey ? 1 : -1;
                y = -shift * clientHeight * 0.9;
                break;
            case key.pageup:
                y = -clientHeight * 0.9;
                break;
            case key.pagedown:
                y = clientHeight * 0.9;
                break;
            case key.home:
                if (overflowing == document.body && document.scrollingElement)
                    overflowing = document.scrollingElement;
                y = -overflowing.scrollTop;
                break;
            case key.end:
                var scroll = overflowing.scrollHeight - overflowing.scrollTop;
                var scrollRemaining = scroll - clientHeight;
                y = (scrollRemaining > 0) ? scrollRemaining + 10 : 0;
                break;
            case key.left:
                x = -options.arrowScroll;
                break;
            case key.right:
                x = options.arrowScroll;
                break;            
            default:
                return true; // a key we don't care about
        }
    
        scrollArray(overflowing, x, y);
        event.preventDefault();
        scheduleClearCache();
    }
    
    /**
     * Mousedown event only for updating activeElement
     */
    function mousedown(event) {
        activeElement = event.target;
    }
    
    
    /***********************************************
     * OVERFLOW
     ***********************************************/
    
    var uniqueID = (function () {
        var i = 0;
        return function (el) {
            return el.uniqueID || (el.uniqueID = i++);
        };
    })();
    
    var cacheX = {}; // cleared out after a scrolling session
    var cacheY = {}; // cleared out after a scrolling session
    var clearCacheTimer;
    var smoothBehaviorForElement = {};
    
    //setInterval(function () { cache = {}; }, 10 * 1000);
    
    function scheduleClearCache() {
        clearTimeout(clearCacheTimer);
        clearCacheTimer = setInterval(function () { 
            cacheX = cacheY = smoothBehaviorForElement = {}; 
        }, 1*1000);
    }
    
    function setCache(elems, overflowing, x) {
        var cache = x ? cacheX : cacheY;
        for (var i = elems.length; i--;)
            cache[uniqueID(elems[i])] = overflowing;
        return overflowing;
    }
    
    function getCache(el, x) {
        return (x ? cacheX : cacheY)[uniqueID(el)];
    }
    
    //  (body)                (root)
    //         | hidden | visible | scroll |  auto  |
    // hidden  |   no   |    no   |   YES  |   YES  |
    // visible |   no   |   YES   |   YES  |   YES  |
    // scroll  |   no   |   YES   |   YES  |   YES  |
    // auto    |   no   |   YES   |   YES  |   YES  |
    
    function overflowingAncestor(el) {
        var elems = [];
        var body = document.body;
        var rootScrollHeight = root.scrollHeight;
        do {
            var cached = getCache(el, false);
            if (cached) {
                return setCache(elems, cached);
            }
            elems.push(el);
            if (rootScrollHeight === el.scrollHeight) {
                var topOverflowsNotHidden = overflowNotHidden(root) && overflowNotHidden(body);
                var isOverflowCSS = topOverflowsNotHidden || overflowAutoOrScroll(root);
                if (isFrame && isContentOverflowing(root) || 
                   !isFrame && isOverflowCSS) {
                    return setCache(elems, getScrollRoot()); 
                }
            } else if (isContentOverflowing(el) && overflowAutoOrScroll(el)) {
                return setCache(elems, el);
            }
        } while ((el = el.parentElement));
    }
    
    function isContentOverflowing(el) {
        return (el.clientHeight + 10 < el.scrollHeight);
    }
    
    // typically for <body> and <html>
    function overflowNotHidden(el) {
        var overflow = getComputedStyle(el, '').getPropertyValue('overflow-y');
        return (overflow !== 'hidden');
    }
    
    // for all other elements
    function overflowAutoOrScroll(el) {
        var overflow = getComputedStyle(el, '').getPropertyValue('overflow-y');
        return (overflow === 'scroll' || overflow === 'auto');
    }
    
    // for all other elements
    function isScrollBehaviorSmooth(el) {
        var id = uniqueID(el);
        if (smoothBehaviorForElement[id] == null) {
            var scrollBehavior = getComputedStyle(el, '')['scroll-behavior'];
            smoothBehaviorForElement[id] = ('smooth' == scrollBehavior);
        }
        return smoothBehaviorForElement[id];
    }
    
    
    /***********************************************
     * HELPERS
     ***********************************************/
    
    function addEvent(type, fn, arg) {
        window.addEventListener(type, fn, arg || false);
    }
    
    function removeEvent(type, fn, arg) {
        window.removeEventListener(type, fn, arg || false);  
    }
    
    function isNodeName(el, tag) {
        return el && (el.nodeName||'').toLowerCase() === tag.toLowerCase();
    }
    
    function directionCheck(x, y) {
        x = (x > 0) ? 1 : -1;
        y = (y > 0) ? 1 : -1;
        if (direction.x !== x || direction.y !== y) {
            direction.x = x;
            direction.y = y;
            que = [];
            lastScroll = 0;
        }
    }
    
    if (window.localStorage && localStorage.SS_deltaBuffer) {
        try { // #46 Safari throws in private browsing for localStorage 
            deltaBuffer = localStorage.SS_deltaBuffer.split(',');
        } catch (e) { } 
    }
    
    function isTouchpad(deltaY) {
        if (!deltaY) return;
        if (!deltaBuffer.length) {
            deltaBuffer = [deltaY, deltaY, deltaY];
        }
        deltaY = Math.abs(deltaY);
        deltaBuffer.push(deltaY);
        deltaBuffer.shift();
        clearTimeout(deltaBufferTimer);
        deltaBufferTimer = setTimeout(function () {
            try { // #46 Safari throws in private browsing for localStorage
                localStorage.SS_deltaBuffer = deltaBuffer.join(',');
            } catch (e) { }  
        }, 1000);
        var dpiScaledWheelDelta = deltaY > 120 && allDeltasDivisableBy(deltaY); // win64 
        var tp = !allDeltasDivisableBy(120) && !allDeltasDivisableBy(100) && !dpiScaledWheelDelta;
        if (deltaY < 50) return true;
        return tp;
    } 
    
    function isDivisible(n, divisor) {
        return (Math.floor(n / divisor) == n / divisor);
    }
    
    function allDeltasDivisableBy(divisor) {
        return (isDivisible(deltaBuffer[0], divisor) &&
                isDivisible(deltaBuffer[1], divisor) &&
                isDivisible(deltaBuffer[2], divisor));
    }
    
    function isInsideNetflixVideo(event) {
        var elem = event.target;
        var isControl = false;
        if (document.URL.indexOf ('www.netflix.com/watch') != -1) {
            do {
                isControl = (elem.classList && 
                             elem.classList.contains('html5-video-controls'));
                if (isControl) break;
            } while ((elem = elem.parentNode));
        }
        return isControl;
    }
    
    var requestFrame = (function () {
          return (window.requestAnimationFrame       || 
                  window.webkitRequestAnimationFrame || 
                  window.mozRequestAnimationFrame    ||
                  function (callback, element, delay) {
                     window.setTimeout(callback, delay || (1000/60));
                 });
    })();
    
    var MutationObserver = (window.MutationObserver || 
                            window.WebKitMutationObserver ||
                            window.MozMutationObserver);  
    
    var getScrollRoot = (function() {
      var SCROLL_ROOT = document.scrollingElement;
      return function() {
        if (!SCROLL_ROOT) {
          var dummy = document.createElement('div');
          dummy.style.cssText = 'height:10000px;width:1px;';
          document.body.appendChild(dummy);
          var bodyScrollTop  = document.body.scrollTop;
          var docElScrollTop = document.documentElement.scrollTop;
          window.scrollBy(0, 3);
          if (document.body.scrollTop != bodyScrollTop)
            (SCROLL_ROOT = document.body);
          else 
            (SCROLL_ROOT = document.documentElement);
          window.scrollBy(0, -3);
          document.body.removeChild(dummy);
        }
        return SCROLL_ROOT;
      };
    })();
    
    
    /***********************************************
     * PULSE (by Michael Herf)
     ***********************************************/
     
    /**
     * Viscous fluid with a pulse for part and decay for the rest.
     * - Applies a fixed force over an interval (a damped acceleration), and
     * - Lets the exponential bleed away the velocity over a longer interval
     * - Michael Herf, http://stereopsis.com/stopping/
     */
    function pulse_(x) {
        var val, start, expx;
        // test
        x = x * options.pulseScale;
        if (x < 1) { // acceleartion
            val = x - (1 - Math.exp(-x));
        } else {     // tail
            // the previous animation ended here:
            start = Math.exp(-1);
            // simple viscous drag
            x -= 1;
            expx = 1 - Math.exp(-x);
            val = start + (expx * (1 - start));
        }
        return val * options.pulseNormalize;
    }
    
    function pulse(x) {
        if (x >= 1) return 1;
        if (x <= 0) return 0;
    
        if (options.pulseNormalize == 1) {
            options.pulseNormalize /= pulse_(1);
        }
        return pulse_(x);
    }
    
    
    /***********************************************
     * FIRST RUN
     ***********************************************/
    
    var userAgent = window.navigator.userAgent;
    var isEdge    = /Edge/.test(userAgent); // thank you MS
    var isChrome  = /chrome/i.test(userAgent) && !isEdge; 
    var isSafari  = /safari/i.test(userAgent) && !isEdge; 
    var isMobile  = /mobile/i.test(userAgent);
    var isIEWin7  = /Windows NT 6.1/i.test(userAgent) && /rv:11/i.test(userAgent);
    var isOldSafari = isSafari && (/Version\/8/i.test(userAgent) || /Version\/9/i.test(userAgent));
    var isEnabledForBrowser = (isChrome || isSafari || isIEWin7) && !isMobile;
    
    var supportsPassive = false;
    try {
      window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
        get: function () {
                supportsPassive = true;
            } 
        }));
    } catch(e) {}
    
    var wheelOpt = supportsPassive ? { passive: false } : false;
    var wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel'; 
    
    if (wheelEvent && isEnabledForBrowser) {
        addEvent(wheelEvent, wheel, wheelOpt);
        addEvent('mousedown', mousedown);
        addEvent('load', init);
    }
    
    
    /***********************************************
     * PUBLIC INTERFACE
     ***********************************************/
    
    function SmoothScroll(optionsToSet) {
        for (var key in optionsToSet)
            if (defaultOptions.hasOwnProperty(key)) 
                options[key] = optionsToSet[key];
    }
    SmoothScroll.destroy = cleanup;
    
    if (window.SmoothScrollOptions) // async API
        SmoothScroll(window.SmoothScrollOptions);
    
    if (typeof define === 'function' && define.amd)
        define(function() {
            return SmoothScroll;
        });
    else if ('object' == typeof exports)
        module.exports = SmoothScroll;
    else
        window.SmoothScroll = SmoothScroll;
    
    })();

document.addEventListener('DOMContentLoaded', function (event) { 
    if (!window.netflixPartyLoaded) {
        window.netflixPartyLoaded = true
        const setImmediate = require('setimmediate') // eslint-disable-line
        window.$ = window.jQuery = require('jquery')
        const { ipcRenderer, clipboard } = require('electron')
        const io = require('socket.io-client')

        var withChatInterval = null;

        (function ($) {
            $.isBlank = function (obj) {
                return (!obj || $.trim(obj) === '')
            }
        })(jQuery)
    
        /// ///////////////////////////////////////////////////////////////////////
        // Vendor libraries                                                     //
        /// ///////////////////////////////////////////////////////////////////////  
    
        /* PNGLib.js v1.0 */
        // eslint-disable-next-line
        !(function () { function i (i, t) { for (var s = 2; s < arguments.length; s++) for (var h = 0; h < arguments[s].length; h++)i[t++] = arguments[s].charAt(h) } function t (i) { return String.fromCharCode(i >> 8 & 255, 255 & i) } function s (i) { return String.fromCharCode(i >> 24 & 255, i >> 16 & 255, i >> 8 & 255, 255 & i) } function h (i) { return String.fromCharCode(255 & i, i >> 8 & 255) }window.PNGlib = function (f, e, r) { this.width = f, this.height = e, this.depth = r, this.pix_size = e * (f + 1), this.data_size = 2 + this.pix_size + 5 * Math.floor((65534 + this.pix_size) / 65535) + 4, this.ihdr_offs = 0, this.ihdr_size = 25, this.plte_offs = this.ihdr_offs + this.ihdr_size, this.plte_size = 8 + 3 * r + 4, this.trns_offs = this.plte_offs + this.plte_size, this.trns_size = 8 + r + 4, this.idat_offs = this.trns_offs + this.trns_size, this.idat_size = 8 + this.data_size + 4, this.iend_offs = this.idat_offs + this.idat_size, this.iend_size = 12, this.buffer_size = this.iend_offs + this.iend_size, this.buffer = new Array(), this.palette = new Object(), this.pindex = 0; for (var n = new Array(), o = 0; o < this.buffer_size; o++) this.buffer[o] = '\x00'; i(this.buffer, this.ihdr_offs, s(this.ihdr_size - 12), 'IHDR', s(f), s(e), '\b'), i(this.buffer, this.plte_offs, s(this.plte_size - 12), 'PLTE'), i(this.buffer, this.trns_offs, s(this.trns_size - 12), 'tRNS'), i(this.buffer, this.idat_offs, s(this.idat_size - 12), 'IDAT'), i(this.buffer, this.iend_offs, s(this.iend_size - 12), 'IEND'); var a = 30912; a += 31 - a % 31, i(this.buffer, this.idat_offs + 8, t(a)); for (var o = 0; (o << 16) - 1 < this.pix_size; o++) { var d, _; o + 65535 < this.pix_size ? (d = 65535, _ = '\x00') : (d = this.pix_size - (o << 16) - o, _ = ''), i(this.buffer, this.idat_offs + 8 + 2 + (o << 16) + (o << 2), _, h(d), h(~d)) } for (var o = 0; o < 256; o++) { for (var u = o, z = 0; z < 8; z++)u = 1 & u ? -306674912 ^ u >> 1 & 2147483647 : u >> 1 & 2147483647; n[o] = u } this.index = function (i, t) { var s = t * (this.width + 1) + i + 1; var h = this.idat_offs + 8 + 2 + 5 * Math.floor(s / 65535 + 1) + s; return h }, this.color = function (i, t, s, h) { h = h >= 0 ? h : 255; var f = ((h << 8 | i) << 8 | t) << 8 | s; if (typeof this.palette[f] === 'undefined') { if (this.pindex == this.depth) return '\x00'; var e = this.plte_offs + 8 + 3 * this.pindex; this.buffer[e + 0] = String.fromCharCode(i), this.buffer[e + 1] = String.fromCharCode(t), this.buffer[e + 2] = String.fromCharCode(s), this.buffer[this.trns_offs + 8 + this.pindex] = String.fromCharCode(h), this.palette[f] = String.fromCharCode(this.pindex++) } return this.palette[f] }, this.getBase64 = function () { var i; var t; var s; var h; var f; var e; var r; var n = this.getDump(); var o = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='; var a = n.length; var d = 0; var _ = ''; do i = n.charCodeAt(d), h = i >> 2, t = n.charCodeAt(d + 1), f = (3 & i) << 4 | t >> 4, s = n.charCodeAt(d + 2), e = d + 2 > a ? 64 : (15 & t) << 2 | s >> 6, r = d + 3 > a ? 64 : 63 & s, _ += o.charAt(h) + o.charAt(f) + o.charAt(e) + o.charAt(r); while ((d += 3) < a);return _ }, this.getDump = function () { function t (t, h, f) { for (var e = -1, r = 4; f - 4 > r; r += 1)e = n[255 & (e ^ t[h + r].charCodeAt(0))] ^ e >> 8 & 16777215; i(t, h + f - 4, s(-1 ^ e)) } for (var h = 65521, f = 5552, e = 1, r = 0, o = f, a = 0; a < this.height; a++) for (var d = -1; d < this.width; d++)e += this.buffer[this.index(d, a)].charCodeAt(0), r += e, (o -= 1) == 0 && (e %= h, r %= h, o = f); return e %= h, r %= h, i(this.buffer, this.idat_offs + this.idat_size - 8, s(r << 16 | e)), t(this.buffer, this.ihdr_offs, this.ihdr_size), t(this.buffer, this.plte_offs, this.plte_size), t(this.buffer, this.trns_offs, this.trns_size), t(this.buffer, this.idat_offs, this.idat_size), t(this.buffer, this.iend_offs, this.iend_size), 'PNG\r\n\n' + this.buffer.join('') } } }())

        /* Identicon.js v1.0 */
        // eslint-disable-next-line
        !(function () { Identicon = function (n, t, r) { this.hash = n, this.size = t || 64, this.margin = r || 0 }, Identicon.prototype = { hash:null, size:null, margin:null, render:function () { var n; var t; var r = this.hash; var e = this.size; var i = Math.floor(e * this.margin); var s = Math.floor((e - 2 * i) / 5); var o = new PNGlib(e, e, 256); var h = o.color(0, 0, 0, 0); var a = this.hsl2rgb(parseInt(r.substr(-7), 16) / 268435455, 0.5, 0.7); var c = o.color(255 * a[0], 255 * a[1], 255 * a[2]); for (n = 0; n < 15; n++)t = parseInt(r.charAt(n), 16) % 2 ? h : c, n < 5 ? this.rectangle(2 * s + i, n * s + i, s, s, t, o) : n < 10 ? (this.rectangle(1 * s + i, (n - 5) * s + i, s, s, t, o), this.rectangle(3 * s + i, (n - 5) * s + i, s, s, t, o)) : n < 15 && (this.rectangle(0 * s + i, (n - 10) * s + i, s, s, t, o), this.rectangle(4 * s + i, (n - 10) * s + i, s, s, t, o)); return o }, rectangle:function (n, t, r, e, i, s) { var o, h; for (o = n; n + r > o; o++) for (h = t; t + e > h; h++)s.buffer[s.index(o, h)] = i }, hsl2rgb:function (n, t, r) { return n *= 6, t = [r += t *= r < 0.5 ? r : 1 - r, r - n % 1 * t * 2, r -= t *= 2, r, r + n % 1 * t, r + t], [t[~~n % 6], t[(16 | n) % 6], t[(8 | n) % 6]] }, toString:function () { return this.render().getBase64() } }, window.Identicon = Identicon }())

        /* SHA256 (Chris Veness) */
        // eslint-disable-next-line
        var Sha256 = {}; Sha256.hash = function (t) { t = t.utf8Encode(); var r = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]; var e = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]; t += String.fromCharCode(128); for (var n = t.length / 4 + 2, o = Math.ceil(n / 16), a = new Array(o), h = 0; o > h; h++) { a[h] = new Array(16); for (var S = 0; S < 16; S++)a[h][S] = t.charCodeAt(64 * h + 4 * S) << 24 | t.charCodeAt(64 * h + 4 * S + 1) << 16 | t.charCodeAt(64 * h + 4 * S + 2) << 8 | t.charCodeAt(64 * h + 4 * S + 3) }a[o - 1][14] = 8 * (t.length - 1) / Math.pow(2, 32), a[o - 1][14] = Math.floor(a[o - 1][14]), a[o - 1][15] = 8 * (t.length - 1) & 4294967295; for (var u, f, c, i, d, R, p, y, x = new Array(64), h = 0; o > h; h++) { for (var O = 0; O < 16; O++)x[O] = a[h][O]; for (var O = 16; O < 64; O++)x[O] = Sha256.σ1(x[O - 2]) + x[O - 7] + Sha256.σ0(x[O - 15]) + x[O - 16] & 4294967295; u = e[0], f = e[1], c = e[2], i = e[3], d = e[4], R = e[5], p = e[6], y = e[7]; for (var O = 0; O < 64; O++) { var T = y + Sha256.Σ1(d) + Sha256.Ch(d, R, p) + r[O] + x[O]; var s = Sha256.Σ0(u) + Sha256.Maj(u, f, c); y = p, p = R, R = d, d = i + T & 4294967295, i = c, c = f, f = u, u = T + s & 4294967295 }e[0] = e[0] + u & 4294967295, e[1] = e[1] + f & 4294967295, e[2] = e[2] + c & 4294967295, e[3] = e[3] + i & 4294967295, e[4] = e[4] + d & 4294967295, e[5] = e[5] + R & 4294967295, e[6] = e[6] + p & 4294967295, e[7] = e[7] + y & 4294967295 } return Sha256.toHexStr(e[0]) + Sha256.toHexStr(e[1]) + Sha256.toHexStr(e[2]) + Sha256.toHexStr(e[3]) + Sha256.toHexStr(e[4]) + Sha256.toHexStr(e[5]) + Sha256.toHexStr(e[6]) + Sha256.toHexStr(e[7]) }, Sha256.ROTR = function (t, r) { return r >>> t | r << 32 - t }, Sha256.Σ0 = function (t) { return Sha256.ROTR(2, t) ^ Sha256.ROTR(13, t) ^ Sha256.ROTR(22, t) }, Sha256.Σ1 = function (t) { return Sha256.ROTR(6, t) ^ Sha256.ROTR(11, t) ^ Sha256.ROTR(25, t) }, Sha256.σ0 = function (t) { return Sha256.ROTR(7, t) ^ Sha256.ROTR(18, t) ^ t >>> 3 }, Sha256.σ1 = function (t) { return Sha256.ROTR(17, t) ^ Sha256.ROTR(19, t) ^ t >>> 10 }, Sha256.Ch = function (t, r, e) { return t & r ^ ~t & e }, Sha256.Maj = function (t, r, e) { return t & r ^ t & e ^ r & e }, Sha256.toHexStr = function (t) { for (var r, e = '', n = 7; n >= 0; n--)r = t >>> 4 * n & 15, e += r.toString(16); return e }, typeof String.prototype.utf8Encode === 'undefined' && (String.prototype.utf8Encode = function () { return unescape(encodeURIComponent(this)) }), typeof String.prototype.utf8Decode === 'undefined' && (String.prototype.utf8Decode = function () { try { return decodeURIComponent(escape(this)) } catch (t) { return this } }), typeof module !== 'undefined' && module.exports && (module.exports = Sha256), typeof define === 'function' && define.amd && define([], function () { return Sha256 })

        /// ///////////////////////////////////////////////////////////////////////
        // Version                                                              //
        /// ///////////////////////////////////////////////////////////////////////

        var version = null

        /// ///////////////////////////////////////////////////////////////////////
        // Helpers                                                              //
        /// ///////////////////////////////////////////////////////////////////////

        // returns an action which delays for some time
        var delay = function (milliseconds) {
            return function (result) {
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        resolve(result)
                    }, milliseconds)
                })
            }
        }

        // returns an action which waits until the condition thunk returns true,
        // rejecting if maxDelay time is exceeded
        var delayUntil = function (condition, maxDelay) {
            return function (result) {
                var delayStep = 250
                var startTime = (new Date()).getTime()
                var checkForCondition = function () {
                    if (condition()) {
                        return Promise.resolve(result)
                    }
                    if (maxDelay !== null && (new Date()).getTime() - startTime > maxDelay) {
                        return Promise.reject(Error('delayUntil timed out'))
                    }
                    return delay(delayStep)().then(checkForCondition)
                }
                return checkForCondition()
            }
        }

        // add value to the end of array, and remove items from the beginning
        // such that the length does not exceed limit
        var shove = function (array, value, limit) {
            array.push(value)
            if (array.length > limit) {
                array.splice(0, array.length - limit)
            }
        }

        // compute the mean of an array of numbers
        var mean = function (array) {
            return array.reduce(function (a, b) { return a + b }) / array.length
        }

        // compute the median of an array of numbers
        var median = function (array) {
            return array.concat().sort()[Math.floor(array.length / 2)]
        }

        // swallow any errors from an action
        // and log them to the console
        var swallow = function (action) {
            return function (result) {
                return action(result).catch(function (e) {
                    //console.error(e) Only out purs annoying errors
                })
            }
        }

        // promise.ensure(fn) method
        // note that this method will not swallow errors
        // eslint-disable-next-line
        Promise.prototype.ensure = function (fn) {
            return this.then(fn, function (e) {
                fn()
                throw e
            })
        }

        console.log("SMOOTHSCROLL ENABLED | DISCORD-NETFLIX");

//MAX BITRATE//
let getElementByXPath = function (xpath) {
    return document.evaluate(
      xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
  };
  
  let fn = function () {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      keyCode: 83,
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    }));
  
    const VIDEO_SELECT = getElementByXPath("//div[text()='Video Bitrate']");
    const AUDIO_SELECT = getElementByXPath("//div[text()='Audio Bitrate']");
    const BUTTON = getElementByXPath("//button[text()='Override']");
  
    if (!(VIDEO_SELECT && AUDIO_SELECT && BUTTON)){
      return false;
    }
  
    [VIDEO_SELECT, AUDIO_SELECT].forEach(function (el) {
      let parent = el.parentElement;
  
      let options = parent.querySelectorAll('select > option');
  
      for (var i = 0; i < options.length - 1; i++) {
        options[i].removeAttribute('selected');
      }
  
      options[options.length - 1].setAttribute('selected', 'selected');
    });
  
    BUTTON.click();
  
    return true;
  };
  
  let run = function () {
    fn() || setTimeout(run, 100);
  };
  
  const WATCH_REGEXP = /netflix.com\/watch\/.*/;
  
  let oldLocation;
  
    console.log("MAXBITRATE ENABLED | DISCORD-NETFLIX");
    setInterval(function () {
      let newLocation = window.location.toString();
  
      if (newLocation !== oldLocation) {
        oldLocation = newLocation;
        WATCH_REGEXP.test(newLocation) && run();
      }
    }, 500);

    //Fixed PIP
    (function(){
    console.log("connected")
    //Creates button parent element
    const btnParent = document.createElement("div");
    //Styling button
    btnParent.style.position = "relative";
    btnParent.style.zIndex = "1";
    btnParent.style.textAlign = "center";
    btnParent.style.opacity = "0";
    btnParent.addEventListener("mouseover", () => {
        btnParent.style.opacity = "1";
        setTimeout(() => {
            btnParent.style.opacity = "0";
        },2000);
    });

    //Button element
    btnParent.innerHTML =
    `
        <button id='pipBtn' 
            style='width:30px;
                    background-color:rgba(0, 0, 0, 0);
                    margin-top:15px;     
        '><svg width="25" height="25" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="Hawkins-Icon Hawkins-Icon-Standard"><path fill-rule="evenodd" clip-rule="evenodd" d="m19.55311,11.22226l-8.86379,0l0,6.42295l8.82237,0l0,-6.42295l0.04142,0zm4.39048,8.5907l0,-15.01365c0,-1.16416 -0.99407,-2.1276 -2.19524,-2.1276l-19.88141,0c-1.20117,0 -2.19524,0.9233 -2.19524,2.1276l0,15.01365c0,1.16416 0.99407,2.1276 2.19524,2.1276l19.88141,0c1.20117,0 2.19524,-0.96344 2.19524,-2.1276zm-2.19524,0l-19.88141,0l0,-15.01365l19.88141,0l0,15.01365z" fill="currentColor"></path></svg>
        </button>
    `
    //Waits loading video element
    const observer = new MutationObserver((mutations, obs) => {
        const targetNode = document.querySelector('body');
        
        //Parses url and gets id
        const url = window.location.href.toString().split('/');
        if(url[4]){//Video Id
            const filmId = url[4].split('?')[0];
            const videoNode = document.getElementById(filmId);

            if (videoNode) {
                targetNode.prepend(btnParent);//Adds miniflix button
                obs.disconnect();
                return;
            }
        }        
    });
    
    //Which changes must listen in elements
    observer.observe(document, {
        childList: true,
        subtree: true
    });

    //Waits loading miniflix button
    const observer2 = new MutationObserver((mutations, obs) => {
        const pipBtn = document.getElementById('pipBtn');

        //Parses url and gets id
        const url = window.location.href.toString().split('/');
        if(url[4]){//Video Id
            const filmId = url[4].split('?')[0];
            if (pipBtn) {
                const videoNode = document.getElementById(filmId);
                const video = videoNode.firstElementChild;
                //console.log(video);
                pipBtn.style.border = "none";
                if("pictureInPictureEnabled" in document){//If miniflix mode enabled adds event listener for disabling
                    pipBtn.addEventListener("click",() => {
                        if(document.pictureInPictureElement){
                            document.exitPictureInPicture().catch(err=>{
                                console.log(err);
                            });
                            return;
                        }
                        video.requestPictureInPicture().catch(err=>{
                            console.log(err);
                        })
                    })
                }
                obs.disconnect();
                return;
            }
        }
        
    });

    //Which changes must listen in elements
    observer2.observe(document, {
        childList: true,
        subtree: true
    });

//Update notifier
const fs = require('fs');

let userChoice = null;

function getVersionNumberFromPackageJson() {
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        return packageJson.version;
    } catch (error) {

    }
}

function checkNumberOnWebsite(url, numberToCheck) {
    const versionNumber = getVersionNumberFromPackageJson();
    if (!versionNumber) {
        alert("Error: Couldn't retrieve version number from package.json");
        return;
    }

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(html => {
            if (html.includes(numberToCheck)) {
                console.log("Latest version: " + versionNumber)
            } else {
                setTimeout(() => {
                    userChoice = confirm("There's an update available. Would you like to update to version: " + versionNumber);
                }, 0);
                setTimeout(() => {
                    if (userChoice === null) {
                        console.log("User did not make a choice.");
                    } else if (userChoice === true) {
                        console.log("User chose to update.");
                        shell.openExternal(updateURL);
                    } else {
                        console.log("User chose not to update.");
                        // Do nothing
                    }
                }, 100);
            }
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
            alert("There was an error checking the website.");
        });
}
const { shell } = require('electron');
const updateURL = "https://github.com/V0l-D/Discord-Netflix/releases";
const websiteURL = "https://V0l-D.github.io";
const numberToCheck = getVersionNumberFromPackageJson();
if (numberToCheck) {
    checkNumberOnWebsite(websiteURL, numberToCheck);
}
    })
}
});


