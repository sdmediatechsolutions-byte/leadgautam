
(() => {
    'use strict';

    /* =========================================================
       CONFIGURATION
    ========================================================= */

    const CONFIG = Object.freeze({

        // Meta Pixel / Dataset ID
        pixelId: '2159496661619099',

        // Telegram destination
        telegramUrl: 'https://t.me/+fg7u4ExAYPc5YzI1',

        // Qualified PageView
        pageViewDelayMs: 3000,
        passiveReaderDelayMs: 8000,

        // Minimum time before a Telegram click qualifies as Lead
        minimumClickTimeMs: 1000,

        // IMPORTANT:
        // Give Meta Pixel time to send the Lead event
        // before navigating to Telegram.
        trackedRedirectDelayMs: 3000,

        // Very fast redirect for clicks that don't qualify
        fastRedirectDelayMs: 100,

        // Prevent duplicate PageView during this browser session
        pageViewSessionKey: 'three_point_qualified_page_view',

        // Button selectors
        telegramButtonSelector: '.join-link, .jnBtn'
    });


    /* =========================================================
       STATE
    ========================================================= */

    const pageOpenedAt = Date.now();

    let pageViewTracked = false;
    let leadTracked = false;
    let navigationStarted = false;
    let humanInteractionDetected = false;


    /* =========================================================
       DEBUG
    ========================================================= */

    function debug(...args) {
        console.log('[Meta Pixel]', ...args);
    }


    /* =========================================================
       LOAD META PIXEL
    ========================================================= */

    function loadMetaPixel() {

        debug('Loading Meta Pixel:', CONFIG.pixelId);

        if (window.fbq) {

            debug('fbq already exists');

            try {
                fbq('init', CONFIG.pixelId);
            } catch (error) {
                debug('Pixel init error:', error);
            }

            return;
        }


        /*
         * Standard Meta Pixel loader
         */

        !function(f, b, e, v, n, t, s) {

            if (f.fbq) return;

            n = f.fbq = function() {

                if (n.callMethod) {
                    n.callMethod.apply(n, arguments);
                } else {
                    n.queue.push(arguments);
                }

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


        /*
         * Initialize Pixel
         */

        fbq(
            'init',
            CONFIG.pixelId
        );


        debug('Pixel initialized');
    }


    /* =========================================================
       SESSION PAGEVIEW CHECK
    ========================================================= */

    function sessionPageViewExists() {

        try {

            return (
                sessionStorage.getItem(
                    CONFIG.pageViewSessionKey
                ) === 'true'
            );

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

            debug('sessionStorage unavailable');

        }
    }


    /* =========================================================
       BASIC AUTOMATION CHECK
    ========================================================= */

    function automationDetected() {

        return navigator.webdriver === true;

    }


    /* =========================================================
       QUALIFIED PAGEVIEW
    ========================================================= */

    function tryQualifiedPageView() {

        const timeOnPageMs =
            Date.now() - pageOpenedAt;


        /*
         * User interacted and stayed at least 3 seconds
         */

        const interactionQualified =
            humanInteractionDetected &&
            timeOnPageMs >=
                CONFIG.pageViewDelayMs;


        /*
         * Or visitor stayed focused for 8 seconds
         */

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


        /*
         * Send PageView
         */

        debug(
            'Sending qualified PageView',
            {
                timeOnPage:
                    Math.round(timeOnPageMs / 1000),

                humanInteraction:
                    humanInteractionDetected,

                qualification:
                    interactionQualified
                        ? 'interaction_3_seconds'
                        : 'focused_8_seconds'
            }
        );


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


    /* =========================================================
       HUMAN INTERACTION
    ========================================================= */

    function recordHumanInteraction(event) {

        if (!event.isTrusted) {
            return;
        }


        if (humanInteractionDetected) {
            return;
        }


        humanInteractionDetected = true;


        debug(
            'Human interaction detected:',
            event.type
        );


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


        interactionEvents.forEach(
            (eventName) => {

                window.addEventListener(
                    eventName,
                    recordHumanInteraction,
                    {
                        passive: true,
                        once: true
                    }
                );

            }
        );


        /*
         * Check after 3 seconds
         */

        window.setTimeout(
            tryQualifiedPageView,
            CONFIG.pageViewDelayMs
        );


        /*
         * Check passive visitor after 8 seconds
         */

        window.setTimeout(
            tryQualifiedPageView,
            CONFIG.passiveReaderDelayMs
        );
    }


    /* =========================================================
       TELEGRAM LEAD EVENT
    ========================================================= */

    function handleTelegramClick(event) {

        /*
         * Only handle actual user clicks
         */

        if (!event.isTrusted) {

            debug(
                'Ignored untrusted click'
            );

            return;
        }


        /*
         * Find the actual Telegram button
         */

        const button =
            event.target.closest(
                CONFIG.telegramButtonSelector
            );


        /*
         * If click didn't come from one
         * of our Telegram buttons, ignore it.
         */

        if (!button) {
            return;
        }


        /*
         * Stop normal anchor navigation
         * so Meta gets time to receive Lead.
         */

        event.preventDefault();


        /*
         * Prevent double clicks
         */

        if (navigationStarted) {

            debug(
                'Navigation already started'
            );

            return;
        }


        navigationStarted = true;


        const timeOnPageMs =
            Date.now() - pageOpenedAt;


        const isQualifiedClick =
            !automationDetected() &&

            timeOnPageMs >=
                CONFIG.minimumClickTimeMs;


        debug(
            'Telegram button clicked',
            {
                timeOnPageMs,
                isQualifiedClick,
                fbqAvailable:
                    typeof window.fbq === 'function'
            }
        );


        /* =====================================================
           SEND LEAD
        ===================================================== */

        if (
            isQualifiedClick &&
            !leadTracked &&
            typeof window.fbq === 'function'
        ) {

            try {

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


                debug(
                    'Lead event SENT'
                );


            } catch (error) {

                debug(
                    'Lead event ERROR:',
                    error
                );

            }

        } else {

            debug(
                'Lead NOT sent',
                {
                    qualified:
                        isQualifiedClick,

                    alreadyTracked:
                        leadTracked,

                    fbq:
                        typeof window.fbq
                }
            );

        }


        /* =====================================================
           REDIRECT
        ===================================================== */

        const redirectDelay =
            isQualifiedClick
                ? CONFIG.trackedRedirectDelayMs
                : CONFIG.fastRedirectDelayMs;


        debug(
            'Redirecting to Telegram in',
            redirectDelay,
            'ms'
        );


        window.setTimeout(
            () => {

                debug(
                    'Opening Telegram'
                );


                window.location.assign(
                    CONFIG.telegramUrl
                );

            },
            redirectDelay
        );
    }


    /* =========================================================
       INITIALIZE TELEGRAM BUTTONS
       ========================================================= */

    function initializeTelegramButtons() {

        /*
         * We don't attach directly to each button.
         *
         * Instead, the document-level click listener
         * below catches:
         *
         * - existing buttons
         * - dynamically created buttons
         * - buttons added by page builders
         */

        document.addEventListener(
            'click',
            handleTelegramClick,
            true
        );


        /*
         * Force Telegram URL on existing buttons
         */

        const buttons =
            document.querySelectorAll(
                CONFIG.telegramButtonSelector
            );


        debug(
            'Telegram buttons found:',
            buttons.length
        );


        buttons.forEach(
            (button) => {

                button.href =
                    CONFIG.telegramUrl;

                /*
                 * Don't let page builders replace
                 * the Telegram destination.
                 */

                button.setAttribute(
                    'target',
                    '_self'
                );

            }
        );
    }


    /* =========================================================
       UPDATE DYNAMIC TELEGRAM BUTTONS
    ========================================================= */

    function updateTelegramButtonUrls() {

        const buttons =
            document.querySelectorAll(
                CONFIG.telegramButtonSelector
            );


        buttons.forEach(
            (button) => {

                if (
                    button.href !==
                    CONFIG.telegramUrl
                ) {

                    button.href =
                        CONFIG.telegramUrl;

                }

            }
        );
    }


    /* =========================================================
       WATCH FOR DYNAMIC CONTENT
    ========================================================= */

    function initializeMutationObserver() {

        if (
            typeof MutationObserver ===
            'undefined'
        ) {
            return;
        }


        const observer =
            new MutationObserver(
                () => {

                    updateTelegramButtonUrls();

                }
            );


        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );
    }


    /* =========================================================
       OPTIONAL TEST FUNCTION
    ========================================================= */

    /*
     * You can manually test Lead from the browser console:
     *
     * testMetaLead()
     */

    window.testMetaLead = function() {

        if (
            typeof window.fbq !==
            'function'
        ) {

            console.error(
                '[Meta Pixel] fbq is not available'
            );

            return;
        }


        console.log(
            '[Meta Pixel] Sending TEST Lead'
        );


        fbq(
            'track',
            'Lead',
            {
                test_lead: true,
                value: 0,
                currency: 'INR',
                destination: 'Telegram'
            }
        );


        console.log(
            '[Meta Pixel] TEST Lead sent'
        );
    };


    /* =========================================================
       START
    ========================================================= */

    loadMetaPixel();

    initializeVisitorQualification();


    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            () => {

                initializeTelegramButtons();

                initializeMutationObserver();

            },
            {
                once: true
            }
        );

    } else {

        initializeTelegramButtons();

        initializeMutationObserver();

    }


    debug(
        'Meta Pixel script loaded successfully'
    );

})()
