/**
 * Toji Project - Xsolla Engine
 * Developed by @RealYashvirGaming
 */

import { MouseSim } from '../utils/mouse-sim.js';
import { CardGenerator } from '../utils/card-generator.js';

class XsollaEngine {
    constructor() {
        this.active = false;
        this.retryInterval = null;
        this.clickInterval = null;
        this.errorDetectionInterval = null;
        this.config = {
            selectors: {
                cardNumber: [
                    'input[name="card_number"]', '#card_number', 'input[data-xsolla-field="card_number"]',
                    '#cardNumber', 'input[name="cardNumber"]', 'input[name*="card"]', 
                    'input[autocomplete="cc-number"]', 'input[id="cardNumber"]',
                    '[data-elements-stable-field-name*="cardNumber"]', 'input[aria-label*="card" i]', 
                    'input[placeholder*="card" i]', '[data-fieldtype="number"]'
                ],
                cardExpiry: [
                    'input[name="expiry_date"]', '#expiry_date', 'input[placeholder="MM / YY"]',
                    '#cardExpiry', 'input[name="cardExpiry"]', 'input[name*="expir"]', 
                    'input[autocomplete="cc-exp"]', 'input[id="cardExpiry"]',
                    '[data-elements-stable-field-name*="cardExpiry"]', 'input[aria-label*="expir" i]', 
                    'input[placeholder*="MM" i]', '[data-fieldtype="expiry"]'
                ],
                cardCvc: [
                    'input[name="cvv"]', '#cvv', 'input[placeholder="CVV"]',
                    '#cardCvc', 'input[name="cardCvc"]', 'input[name*="cvc"]', 'input[name*="cvv"]', 
                    'input[autocomplete="cc-csc"]', 'input[id="cardCvc"]',
                    '[data-elements-stable-field-name*="cardCvc"]', 'input[aria-label*="CVC" i]', 
                    'input[placeholder*="CVC" i]', '[data-fieldtype="cvc"]'
                ],
                email: [
                    'input[name="email"]', '#email', 'input[type="email"]',
                    'input[autocomplete*="email"]', 'input[id*="email"]', 'input[placeholder*="email" i]', 
                    '[class*="email" i] input', 'input[aria-label*="email" i]'
                ],
                zip: [
                    'input[name="zip_code"]', '#zip_code', 'input[name="zip"]',
                    '#billingPostalCode', 'input[name="billingPostalCode"]', 'input[name="postalCode"]', 
                    'input[name*="postal"]', 'input[placeholder*="zip" i]', 'input[placeholder*="postal" i]', 
                    'input[autocomplete="postal-code"]', 'input[aria-label*="postal" i]', 
                    'input[aria-label*="zip" i]', 'input[data-testid*="postal"]', 'input[data-testid*="zip"]',
                    'input[id*="postal"]', 'input[id*="zip"]'
                ],
                submit: [
                    'button.x-button-blue', 'button[type="submit"]', '.x-payment-button',
                    '.SubmitButton', '[class*="SubmitButton"]', 'input[type="submit"]',
                    '[data-testid*="submit"]', '[data-testid*="pay"]',
                    '[class*="Button--primary"]', '#submitButton', '.p-Button'
                ]
            }
        };
    }

    async run(settings) {
        if (this.active) return;
        this.active = true;

        console.log('[Toji Project] Xsolla Engine Running (SPAM MODE)...');
        
        const isFrame = window.self !== window.top;
        if (isFrame) {
            await this.handleIframe();
            setInterval(() => this.handleIframe(), 2000);
        } else {
            this.startSpamLoop(settings);
            this.startErrorDetection(settings);
        }
    }

    async startSpamLoop(settings) {
        while (this.active && !window.TOJI_STOPPED) {
            const updatedSettings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            
            if (updatedSettings.enabled === false) {
                this.active = false;
                break;
            }

            const card = await this._pickCard(updatedSettings);

            // Notify background of active card for logging
            chrome.runtime.sendMessage({ type: 'SET_ACTIVE_CARD', card: card });
            
            // 2.5 Notify Injected Script if Payload Substitution is active
            if (updatedSettings.payloadSubstitution) {
                const dummy = '4242424242424242'; // Generic dummy
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
                console.log('[Toji] 🛡️ Stealth Mode: Real Card data + Elite Settings sent to Interceptor (Xsolla)');
            }
            
            await this.handleMainPage(updatedSettings);
            await this.handleIframe({ ...updatedSettings, card });

            console.log('[Toji] Waiting 3 seconds before clicking Pay...');
            await new Promise(r => setTimeout(r, 3000));
            
            await this.clickSubmit(updatedSettings);

            console.log('[Toji] Waiting 3 seconds before rotating to next CC...');
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    async _pickCard(settings) {
        let entry = settings.card || {};
        
        if (settings.cards && settings.cards.length > 0) {
            const idx = (settings.cardIndex || 0) % settings.cards.length;
            entry = settings.cards[idx];
        }

        const cleanVal = (entry.number || entry.bin || '').replace(/\D/g, '');
        const isBin = cleanVal.length >= 6 && cleanVal.length <= 12;

        if (isBin) {
            console.log('[Toji] 💎 BIN Mode Detected (Xsolla). Generating UNIQUE Card...');
            let attempts = 0;
            while (attempts < 100) {
                const gen = CardGenerator.generateFromBin({
                    bin: cleanVal,
                    month: entry.month || null,
                    year: entry.year || null,
                    cvc: entry.cvc || null
                });

                if (gen) {
                    const status = await chrome.runtime.sendMessage({ 
                        type: 'CHECK_AND_MARK_USED', 
                        number: gen.number 
                    });

                    if (status && status.used === false) {
                        return {
                            ...gen,
                            expiry: `${gen.month}/${gen.year.slice(-2)}`
                        };
                    }
                }
                attempts++;
            }
            return null;
        }

        if (entry.number) {
            const raw = entry.number.replace(/\D/g, '');
            if (raw.length >= 15) {
                await chrome.runtime.sendMessage({ type: 'CHECK_AND_MARK_USED', number: raw });
            }
        }

        return entry;
    }

    startErrorDetection(settings) {
        this.errorDetectionInterval = setInterval(async () => {
            const errNodes = document.querySelectorAll('.x-error, .error-message, [class*="error" i], .form-error, .x-payment-error');
            let hasError = false;
            for (const node of errNodes) {
                if (node.innerText && node.innerText.length > 3 && node.getBoundingClientRect().height > 0) {
                    hasError = true;
                    console.log('[Toji] Xsolla error detected:', node.innerText);
                    break;
                }
            }

            if (hasError) {
                await this.advanceAndRetry(settings);
            }
        }, 1000);
    }

    async advanceAndRetry(settings) {
        console.log('[Toji] Xsolla advancing index...');
        try {
            await chrome.runtime.sendMessage({ type: 'ADVANCE_CARD_INDEX' });
        } catch (e) {}
        
        await new Promise(r => setTimeout(r, 1000));
        
        if (settings.refreshOnDecline) {
            console.log('[Toji] Reloading Xsolla checkout...');
            window.location.reload();
        } else {
            console.log('[Toji] Fast-clearing Xsolla fields...');
            this.clearFields();
        }
    }

    clearFields() {
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    async handleMainPage(settings) {
        // Fill non-sensitive fields in main page if they exist
        const fields = ['email', 'zip'];
        for (const field of fields) {
            for (const selector of this.config.selectors[field]) {
                const el = document.querySelector(selector);
                if (el && !el.value) {
                    const value = field === 'email' ? (settings.email || 'test@example.com') : (settings.zip || '10001');
                    // Paste non-sensitive info instantly
                    await MouseSim.paste(el, value);
                    break;
                }
            }
        }
    }

    async handleIframe() {
        const liveSettings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        const card = await this._pickCard(liveSettings) || {};
        if (!card.number) return;

        const cardFields = ['cardNumber', 'cardExpiry', 'cardCvc'];
        for (const field of cardFields) {
            for (const selector of this.config.selectors[field]) {
                const el = document.querySelector(selector);
                if (el) {
                    const useDummy = liveSettings.payloadSubstitution === true;
                    const fillCard = useDummy ? {
                        number: '4242424242424242',
                        expiry: '12/34',
                        cvc: '123'
                    } : card;

                    if (useDummy && field === 'cardNumber' && !el._dummyLogged) {
                        console.log('[Toji] 🛡️ Stealth Mode: Filling with DUMMY card on Xsolla iframe');
                        el._dummyLogged = true;
                    }

                    let value = '';
                    if (field === 'cardNumber') value = fillCard.number;
                    if (field === 'cardExpiry') value = fillCard.expiry;
                    if (field === 'cardCvc') value = fillCard.cvc;

                    if (value) {
                        const formatVal = el.value.replace(/\s+/g, '');
                        const rawVal = value.replace(/\s+/g, '');
                        if (!el.value || (formatVal !== rawVal && formatVal.length < rawVal.length)) {
                            MouseSim.unlockElement(el);
                            await MouseSim.paste(el, value);
                        }
                    }
                    break;
                }
            }
        }
    }

    async clickSubmit(settings) {
        if (settings.autoClick === false) return;

        console.log('[Toji] Attempting to click Xsolla final submit...');

        for (const selector of this.config.selectors.submit) {
            try {
                const btn = document.querySelector(selector);
                if (btn && !btn.disabled) {
                    console.log('[Toji] Clicking Xsolla Submit Button:', selector);
                    btn.click();
                    return true;
                }
            } catch(e) {}
        }
        return false;
    }

    async monitorForRetry(settings) {
        if (!settings.cards || settings.cards.length <= 1) return;

        console.log('[Toji] Monitoring Xsolla for decline/error...');
        let attempts = 0;
        await new Promise(r => setTimeout(r, 3500));

        while (attempts < 60) {
            attempts++;
            await new Promise(r => setTimeout(r, 1000));

            const errNodes = document.querySelectorAll('.x-error, .error-message, [class*="error" i], .form-error');
            let hasError = false;
            for (const node of errNodes) {
                if (node.innerText && node.getBoundingClientRect().height > 0) {
                    hasError = true;
                    break;
                }
            }

            const btn = document.querySelector('button.x-button-blue, button[type="submit"], .x-payment-button');
            const isActive = btn && !btn.disabled;

            if (hasError || isActive) {
                console.log('[Toji] Form ready for next attempt. Reloading...');
                await new Promise(r => setTimeout(r, 1500));
                window.location.reload();
                return;
            }
        }
    }
}

export default new XsollaEngine();
