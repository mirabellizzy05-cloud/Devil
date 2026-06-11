/**
 * Toji Project - Card Generator (Ported from ghee khtm)
 * Luhn-validated card generation from BIN
 * Developed by @RealYashvirGaming
 */

export class CardGenerator {

    // ─── Luhn Algorithm (from ghee khtm) ─────────────────────────────────────

    static luhnCheck(cardNumber) {
        let checksum = 0;
        let shouldDouble = false;
        for (let i = cardNumber.length - 1; i >= 0; i--) {
            let digit = parseInt(cardNumber[i]);
            if (shouldDouble) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            checksum += digit;
            shouldDouble = !shouldDouble;
        }
        return checksum % 10 === 0;
    }

    static generateCheckDigit(partial) {
        let checksum = 0;
        let shouldDouble = true;
        for (let i = partial.length - 1; i >= 0; i--) {
            let digit = parseInt(partial[i], 10);
            if (shouldDouble) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            checksum += digit;
            shouldDouble = !shouldDouble;
        }
        return ((10 - (checksum % 10)) % 10).toString();
    }

    static randomDigits(len) {
        let s = '';
        for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
        return s;
    }

    // ─── Parse a single BIN or full card string ───────────────────────────────
    // Accepts:
    //   "424242"              → BIN only
    //   "424242|MM|YY|CVC"   → BIN + meta
    //   "4242424242424242|12|2026|123" → Full card

    static parseLine(line) {
        line = line.trim();
        if (!line) return null;

        if (line.includes('|')) {
            const parts = line.split('|').map(p => p.trim());
            const num = parts[0].replace(/\D/g, '');
            // Full card (16/15 digits)
            if (num.length >= 13) {
                return {
                    mode: 'full',
                    number: num,
                    month: parts[1] || '',
                    year: parts[2] || '',
                    cvc: parts[3] || ''
                };
            }
            // BIN with metadata
            if (num.length >= 6) {
                return {
                    mode: 'bin',
                    bin: num,
                    month: parts[1] || null,
                    year: parts[2] || null,
                    cvc: parts[3] || null
                };
            }
        }

        const num = line.replace(/\D/g, '');
        if (num.length >= 13) {
            // Raw full card, no metadata
            return { mode: 'full', number: num, month: '', year: '', cvc: '' };
        }
        if (num.length >= 6) {
            return { mode: 'bin', bin: num, month: null, year: null, cvc: null };
        }
        return null;
    }

    // ─── Generate a Luhn-valid card from a BIN entry ──────────────────────────

    static generateFromBin(entry) {
        const isAmex = entry.bin.startsWith('34') || entry.bin.startsWith('37');
        const targetLen = isAmex ? 15 : 16;
        let bin = entry.bin.substring(0, targetLen);

        const remaining = targetLen - bin.length - 1;
        const partial = bin + this.randomDigits(Math.max(0, remaining));
        let number = partial + this.generateCheckDigit(partial);

        // Fallback if Luhn fails
        if (!this.luhnCheck(number)) {
            const p2 = bin + this.randomDigits(Math.max(0, remaining));
            number = p2 + this.generateCheckDigit(p2);
            if (!this.luhnCheck(number)) return null;
        }

        const month = entry.month || String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        const curYear = new Date().getFullYear();
        let year = entry.year;
        if (!year) {
            year = String(curYear + Math.floor(Math.random() * 8) + 1);
        } else if (year.length === 2) {
            year = '20' + year;
        }
        const cvcLen = isAmex ? 4 : 3;
        const cvc = entry.cvc || this.randomDigits(cvcLen);

        return { number, month, year, cvc };
    }

    /**
     * Parse all lines and return an expanded card list.
     * @param {string} rawText - The raw input from the user.
     * @param {number} binPoolSize - How many unique cards to generate per BIN.
     */
    static parseAll(rawText, binPoolSize = 1) {
        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
        const cards = [];

        for (const line of lines) {
            const parsed = this.parseLine(line);
            if (!parsed) continue;

            if (parsed.mode === 'full') {
                cards.push({
                    number: parsed.number,
                    month: parsed.month,
                    year: parsed.year,
                    cvc: parsed.cvc,
                    expiry: parsed.month && parsed.year ? `${parsed.month}/${parsed.year.slice(-2)}` : ''
                });
            } else if (parsed.mode === 'bin') {
                // Generate a unique pool for this BIN
                const seen = new Set();
                let attempts = 0;
                while (seen.size < binPoolSize && attempts < binPoolSize * 5) {
                    const generated = this.generateFromBin(parsed);
                    if (generated && !seen.has(generated.number)) {
                        seen.add(generated.number);
                        cards.push({
                            ...generated,
                            expiry: `${generated.month}/${generated.year.slice(-2)}`
                        });
                    }
                    attempts++;
                }
            }
        }

        return cards;
    }
}
