(() => {
    'use strict';

    /* ==============================
       CONFIGURATION
    ============================== */

    const CONFIG = Object.freeze({
        pixelId: '2159496661619099',
        telegramUrl: 'https://t.me/+fg7u4ExAYPc5YzI1',

        // Visitor qualification
        pageViewDelayMs: 3000,
        passiveReaderDelayMs: 8000,

        // Telegram click qualification
        minimumClickTimeMs: 1000,

        // Redirect delays
        trackedRedirectDelayMs: 700,
        fastRedirectDelayMs: 50,

        // Prevent duplicate PageView in same session
        pageViewSessionKey: 'three_point_qualified_page_view'
    });


    /* ==============================
       STATE
    ============================== */

    const pageOpenedAt = Date.now();

    let pageViewTracked = false;
    let leadTracked = false;
    let navigationStarted = false;
    let humanInteractionDetected = false;


    /* ==============================
       LOAD META PIXEL
    ============================== */

    function loadMetaPixel() {

        const pixelGuardKey =
            `__threePointPixelInitialized_${CONFIG.pixelId}`;

        !function (f, b, e, v, n, t, s) {

            if (f.fbq) return;

            n = f.fbq = function () {

                n.callMethod
                    ? n.callMethod.apply(n, arguments)
                    : n.queue.push(arguments);

            };

            if (!f._fbq) {
                f._fbq = n;
            }

            n.push = n;
            n.loaded = true;
            n.version = '2.0';
            n.queue = [];

            t = b.createElement(e);
            t.async = true;
            t.src = v;

            s = b.getElementsByTagName(e)[0];

            s.parentNode.insertBefore(t, s);

        }(
            window,
            document,
            'script',
            'https://connect.facebook.net/en_US/fbevents.js'
        );


        /* Prevent duplicate Pixel initialization */

        if (window[pixelGuardKey]) {
            return;
        }

        let pixelAlreadyRegistered = false;

        try {

            if (
                typeof fbq !== 'undefined' &&
                typeof fbq.getState === 'function'
            ) {

                const pixelState = fbq.getState();

                pixelAlreadyRegistered =
                    pixelState.pixels.some((pixel) => {

                        return String(pixel.id) ===
                            String(CONFIG.pixelId);

                    });
            }

        } catch (error) {

            pixelAlreadyRegistered = false;

        }


        if (!pixelAlreadyRegistered) {

            fbq(
                'init',
                CONFIG.pixelId
            );

        }

        window[pixelGuardKey] = true;
    }


    /* ==============================
       SESSION PAGEVIEW CHECK
    ============================== */

    function sessionPageViewExists() {

        try {

            return sessionStorage.getItem(
                CONFIG.pageViewSessionKey
            ) === 'true';

        } catch (error) {

            return false;

        }
    }


    function saveSessionPageView() {

        try {

            sessionStorage.setItem(
                CONFIG.pageViewSessionKey,
                'true'
            );

        } catch (error) {

            // Ignore storage errors

        }
    }


    /* ==============================
       BASIC AUTOMATION CHECK
    ============================== */

    function automationDetected() {

        return navigator.webdriver === true;

    }


    /* ==============================
       QUALIFIED PAGE VIEW
    ============================== */

    function tryQualifiedPageView() {

        const timeOnPageMs =
            Date.now() - pageOpenedAt;


        // User interacted and stayed at least 3 seconds

        const interactionQualified =

            humanInteractionDetected &&
            timeOnPageMs >=
                CONFIG.pageViewDelayMs;


        // Or visitor stayed focused for 8 seconds

        const passiveReaderQualified =

            timeOnPageMs >=
            CONFIG.passiveReaderDelayMs;


        const canTrack =

            !pageViewTracked &&

            !sessionPageViewExists() &&

            !automationDetected() &&

            (
                interactionQualified ||
                passiveReaderQualified
            ) &&

            document.visibilityState === 'visible' &&

            document.hasFocus() &&

            typeof window.fbq === 'function';


        if (!canTrack) {
            return;
        }


        /* Send PageView */

        fbq(
            'track',
            'PageView',
            {

                qualified_view: true,

                human_interaction:
                    humanInteractionDetected,

                qualification:
                    interactionQualified
                        ? 'interaction_3_seconds'
                        : 'focused_8_seconds',

                time_on_page:
                    Math.round(
                        timeOnPageMs / 1000
                    )

            }
        );


        pageViewTracked = true;

        saveSessionPageView();
    }


    /* ==============================
       HUMAN INTERACTION
    ============================== */

    function recordHumanInteraction(event) {

        if (
            !event.isTrusted ||
            humanInteractionDetected
        ) {
            return;
        }


        humanInteractionDetected = true;

        tryQualifiedPageView();
    }


    function initializeVisitorQualification() {

        const interactionEvents = [

            'pointerdown',
            'touchstart',
            'keydown',
            'scroll',
            'mousemove'

        ];


        interactionEvents.forEach((eventName) => {

            window.addEventListener(
                eventName,
                recordHumanInteraction,
                {
                    passive: true,
                    once: true
                }
            );

        });


        /* Check after 3 seconds */

        window.setTimeout(
            tryQualifiedPageView,
            CONFIG.pageViewDelayMs
        );


        /* Check passive visitor after 8 seconds */

        window.setTimeout(
            tryQualifiedPageView,
            CONFIG.passiveReaderDelayMs
        );
    }


    /* ==============================
       TELEGRAM CLICK + LEAD EVENT
    ============================== */

    function handleTelegramClick(event) {

        event.preventDefault();


        // Prevent multiple clicks

        if (navigationStarted) {
            return;
        }


        navigationStarted = true;


        const timeOnPageMs =
            Date.now() - pageOpenedAt;


        const isQualifiedClick =

            event.isTrusted &&

            !automationDetected() &&

            timeOnPageMs >=
                CONFIG.minimumClickTimeMs;


        /* ==========================
           META LEAD EVENT
        ========================== */

        if (

            isQualifiedClick &&

            !leadTracked &&

            typeof window.fbq === 'function'

        ) {

            fbq(
                'track',
                'Lead',
                {

                    value: 0,

                    currency: 'INR',

                    destination: 'Telegram',

                    time_on_page:
                        Math.round(
                            timeOnPageMs / 1000
                        )

                }
            );


            leadTracked = true;
        }


        /* ==========================
           REDIRECT TO TELEGRAM
        ========================== */

        const redirectDelay =

            isQualifiedClick

                ? CONFIG.trackedRedirectDelayMs

                : CONFIG.fastRedirectDelayMs;


        window.setTimeout(() => {

            window.location.assign(
                CONFIG.telegramUrl
            );

        }, redirectDelay);
    }


    /* ==============================
       INITIALIZE TELEGRAM BUTTONS
    ============================== */

    function initializeTelegramButtons() {

        const buttons =
            document.querySelectorAll(
                '.join-link, .jnBtn'
            );


        buttons.forEach((button) => {

            /* Force correct Telegram URL */

            button.href =
                CONFIG.telegramUrl;


            /* Track click */

            button.addEventListener(
                'click',
                handleTelegramClick
            );

        });
    }


    /* ==============================
       START
    ============================== */

    loadMetaPixel();

    initializeVisitorQualification();


    if (
        document.readyState === 'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            initializeTelegramButtons,
            {
                once: true
            }
        );

    } else {

        initializeTelegramButtons();

    }

})();