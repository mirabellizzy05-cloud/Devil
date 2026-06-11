/**
 * Toji Project - Generic Autofill Engine
 * Developed by @RealYashvirGaming
 */

import { MouseSim } from '../utils/mouse-sim.js';
import { AddressGenerator } from '../utils/address-generator.js';

class AutofillEngine {
    constructor() {
        this.kw = {
            name: ['name', 'cardholder', 'owner', 'fullname'],
            email: ['email', 'mail', 'contact'],
            address: ['address', 'street', 'addr1'],
            city: ['city', 'town', 'location'],
            zip: ['zip', 'post', 'pin', 'code'],
            phone: ['phone', 'tel', 'mobile']
        };
    }

    // ── Aggressive Field Unlocking (Ashes Protocol) ─────────────────
    forceUnlock() {
        const fields = document.querySelectorAll('input, select, textarea');
        fields.forEach(f => {
            f.removeAttribute('disabled');
            f.removeAttribute('readonly');
            f.disabled = false;
            f.readOnly = false;
            f.style.pointerEvents = 'auto';
            f.style.opacity = '1';
        });
        
        // Remove overlay blockers
        document.querySelectorAll('[style*="pointer-events: none"]').forEach(el => {
            el.style.pointerEvents = 'auto';
        });
    }

    async run(settings) {
        console.log('[Toji Project] Generic Autofill Engine Running...');
        const identity = await AddressGenerator.generate(settings.country || 'US');
        
        const addressMap = [
            { key: 'email', val: settings.email || identity.email, selectors: [
                'input[type="email"]', 'input[name="email"]', 'input[autocomplete*="email"]', 
                'input[id*="email"]', 'input[placeholder*="email" i]', '[class*="email" i] input', 
                'input[aria-label*="email" i]', '#email'
            ]},
            { key: 'name', val: identity.name, selectors: [
                '#billingName', 'input[name="billingName"]', 'input[name="cardholder-name"]', 
                'input[name="cardholder"]', 'input[name="name"]', 'input[name*="name"]',
                'input[placeholder*="name" i]', 'input[autocomplete="cc-name"]', 
                'input[autocomplete*="name"]', 'input[aria-label*="name" i]', 
                'input[data-testid*="name"]', '[class*="billingName"] input', 'input[id*="name"]'
            ]},
            { key: 'address', val: identity.street, selectors: [
                '#billingAddressLine1', 'input[name="billingAddressLine1"]', 'input[name="addressLine1"]', 
                'input[name="address"]', 'input[name="address1"]', 'input[name*="address_line1"]', 
                'input[name*="address1"]', 'input[placeholder*="address" i]', 
                'input[autocomplete*="address-line1"]', 'input[aria-label*="address" i]', 
                'input[data-testid*="address"]', 'input[id*="address"]'
            ]},
            { key: 'address2', val: 'Apt 1', selectors: [
                'input[name*="address2"]', 'input[name*="address_line2"]', 'input[placeholder*="apartment" i]',
                'input[aria-label*="apartment" i]', 'input[data-testid*="apartment"]'
            ]},
            { key: 'city', val: identity.city, selectors: [
                '#billingLocality', 'input[name="billingLocality"]', 'input[name="city"]', 'input[name*="city"]',
                'input[placeholder*="city" i]', 'input[autocomplete*="address-level2"]', 
                'input[aria-label*="city" i]', 'input[data-testid*="city"]', 'input[id*="city"]'
            ]},
            { key: 'zip', val: identity.zip, selectors: [
                '#billingPostalCode', 'input[name="billingPostalCode"]', 'input[name="postalCode"]', 
                'input[name="zip"]', 'input[name*="postal"]', 'input[name*="zip"]',
                'input[placeholder*="zip" i]', 'input[placeholder*="postal" i]', 
                'input[autocomplete="postal-code"]', 'input[aria-label*="postal" i]', 
                'input[aria-label*="zip" i]', 'input[data-testid*="postal"]', 'input[data-testid*="zip"]',
                'input[id*="postal"]', 'input[id*="zip"]'
            ]},
            { key: 'state', val: identity.state, selectors: [
                'input[name="billingAdministrativeArea"]', 'input[name="state"]', 'input[name*="state"]',
                'input[placeholder*="state" i]', 'input[autocomplete*="address-level1"]',
                'input[aria-label*="state" i]', 'input[data-testid*="state"]', 'input[id*="state"]'
            ]},
            { key: 'country', val: identity.country, selectors: [
                'input[name*="country"]', 'input[placeholder*="country" i]', 'input[aria-label*="country" i]', 
                'input[data-testid*="country"]', 'input[id*="country"]'
            ]}
        ];

        // Process selects first
        const selectMap = [
            { key: 'country', val: identity.country, selectors: [
                'select[name="billingCountry"]', 'select[name="country"]', 'select[autocomplete*="country"]',
                '#billingCountry', 'select[id*="country"]'
            ]},
            { key: 'state', val: identity.state, selectors: [
                'select[name="billingAdministrativeArea"]', 'select[name="state"]', 
                'select[name*="state"]', 'select[autocomplete*="address-level1"]',
                'select[autocomplete*="state"]'
            ]}
        ];

        for (const mapping of selectMap) {
            for (const selector of mapping.selectors) {
                const el = document.querySelector(selector);
                if (el && el.tagName === 'SELECT') {
                    MouseSim.unlockElement(el);
                    const options = Array.from(el.options);
                    const match = options.find(o => 
                        o.value.toLowerCase() === mapping.val.toLowerCase() ||
                        o.text.toLowerCase().includes(mapping.val.toLowerCase())
                    );
                    if (match) {
                        el.value = match.value;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        break; // Move to next field type
                    }
                }
            }
        }

        // Process text inputs with mouse sim typing/pasting
        for (const mapping of addressMap) {
            for (const selector of mapping.selectors) {
                const el = document.querySelector(selector);
                if (el && !el.value) {
                    MouseSim.unlockElement(el);
                    await MouseSim.paste(el, mapping.val); // Generic engine defaults to fast pasting for address
                    break; // Specific field mapping handled
                }
            }
        }

        // CARD FIELDS
        const card = settings.card || {};
        const useDummy = settings.payloadSubstitution === true;
        const decoyBase = settings.decoyType || '4242';
        const dummy = decoyBase === '0000' ? '0000000000000000' : (decoyBase.repeat(4)); 
        const fillCard = useDummy ? {
            number: dummy,
            expiry: '12/34',
            cvc: '123'
        } : card;

        if (card.number) {
            console.log(`[Toji] 🛡️ Shielding Card: ${card.number.slice(0,6)}... Mode: ${useDummy ? 'STEALTH (' + decoyBase + ')' : 'STANDARD'}`);
            window.postMessage({ 
                type: 'SET_REAL_CARD', 
                card: card, 
                dummy: dummy,
                elite: {
                    cvcModifier: settings.cvcModifier || 'normal',
                    customCvc: settings.customCvc || '',
                    removePaymentAgent: settings.removePaymentAgent !== false,
                    removeZipCode: settings.removeZipCode === true,
                    blockAnalytics: settings.blockAnalytics !== false,
                    payloadSubstitution: useDummy
                }
            }, '*');
        }

        if (fillCard.number) {
            const numSelectors = [
                '#cardNumber', 'input[name="cardNumber"]', 'input[name*="card"]', 
                'input[autocomplete="cc-number"]', 'input[id="cardNumber"]',
                '[data-elements-stable-field-name*="cardNumber"]', 'input[aria-label*="card" i]', 
                'input[placeholder*="card" i]', '[data-fieldtype="number"]'
            ];
            for (const selector of numSelectors) {
                const el = document.querySelector(selector);
                if (el && !el.value) {
                    MouseSim.unlockElement(el);
                    await MouseSim.paste(el, fillCard.number);
                    break;
                }
            }
        }

        if (fillCard.expiry) {
            const expSelectors = [
                '#cardExpiry', 'input[name="cardExpiry"]', 'input[name*="expir"]', 
                'input[autocomplete="cc-exp"]', 'input[id="cardExpiry"]',
                '[data-elements-stable-field-name*="cardExpiry"]', 'input[aria-label*="expir" i]', 
                'input[placeholder*="MM" i]', '[data-fieldtype="expiry"]'
            ];
            for (const selector of expSelectors) {
                const el = document.querySelector(selector);
                if (el && !el.value) {
                    MouseSim.unlockElement(el);
                    await MouseSim.paste(el, fillCard.expiry);
                    break;
                }
            }
        }

        if (fillCard.cvc) {
            const cvcSelectors = [
                '#cardCvc', 'input[name="cardCvc"]', 'input[name*="cvc"]', 'input[name*="cvv"]', 
                'input[autocomplete="cc-csc"]', 'input[id="cardCvc"]',
                '[data-elements-stable-field-name*="cardCvc"]', 'input[aria-label*="CVC" i]', 
                'input[placeholder*="CVC" i]', '[data-fieldtype="cvc"]'
            ];
            for (const selector of cvcSelectors) {
                const el = document.querySelector(selector);
                if (el && !el.value) {
                    MouseSim.unlockElement(el);
                    await MouseSim.paste(el, fillCard.cvc);
                    break;
                }
            }
        }


        const clicked = await this.clickSubmit(settings);
        if (clicked) {
            await this.monitorForRetry(settings);
        }
    }

    async clickSubmit(settings) {
        if (settings.autoClick === false) return;

        console.log('[Toji] Attempting to click generic submit...');
        // Wait exactly 2 seconds before clicking Pay
        await new Promise(r => setTimeout(r, 2000));

        const selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            '.submit-btn',
            '#submit',
            'button.pay-button'
        ];

        for (const selector of selectors) {
            try {
                const btn = document.querySelector(selector);
                if (btn && !btn.disabled) {
                    console.log('[Toji] Clicking generic Submit Button:', selector);
                    btn.click();
                    return true;
                }
            } catch(e) {}
        }
        return false;
    }

    getLabel(input) {
        let label = '';
        if (input.id) {
            const labelEl = document.querySelector(`label[for="${input.id}"]`);
            if (labelEl) label = labelEl.innerText;
        }
        if (!label) {
            label = input.closest('label')?.innerText || '';
        }
        return label;
    }

    async monitorForRetry(settings) {
        if (!settings.cards || settings.cards.length <= 1) return;

        console.log('[Toji] Monitoring generic autofill for decline/error...');
        let attempts = 0;
        await new Promise(r => setTimeout(r, 3500));

        while (attempts < 60) {
            attempts++;
            await new Promise(r => setTimeout(r, 1000));

            const errNodes = document.querySelectorAll('.alert-danger, .error-message, [class*="error" i], [role="alert"]');
            let hasError = false;
            for (const node of errNodes) {
                if (node.innerText && node.getBoundingClientRect().height > 0) {
                    hasError = true;
                    break;
                }
            }

            const btn = document.querySelector('button[type="submit"], input[type="submit"]');
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

export default new AutofillEngine();
