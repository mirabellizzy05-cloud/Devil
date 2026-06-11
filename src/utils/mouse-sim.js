/**
 * Toji Project - Mouse Simulation Utility
 * Developed by @RealYashvirGaming
 */

export class MouseSim {
    static getCenter(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    static bezier(t, p0, p1, p2, p3) {
        const cx = 3 * (p1.x - p0.x);
        const bx = 3 * (p2.x - p1.x) - cx;
        const ax = p3.x - p0.x - cx - bx;
        const cy = 3 * (p1.y - p0.y);
        const by = 3 * (p2.y - p1.y) - cy;
        const ay = p3.y - p0.y - cy - by;
        const x = ax * Math.pow(t, 3) + bx * Math.pow(t, 2) + cx * t + p0.x;
        const y = ay * Math.pow(t, 3) + by * Math.pow(t, 2) + cy * t + p0.y;
        return { x, y };
    }

    static async move(fromEl, toEl) {
        const fromPos = fromEl ? this.getCenter(fromEl) : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const toPos = this.getCenter(toEl);
        const distance = Math.hypot(toPos.x - fromPos.x, toPos.y - fromPos.y);
        const jitter = Math.max(10, distance / 5);

        const cp1 = { x: fromPos.x + (Math.random() - 0.5) * jitter, y: fromPos.y + (Math.random() - 0.5) * jitter };
        const cp2 = { x: toPos.x + (Math.random() - 0.5) * jitter, y: toPos.y + (Math.random() - 0.5) * jitter };

        const steps = Math.max(5, Math.floor(distance / 20));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pos = this.bezier(t, fromPos, cp1, cp2, toPos);
            const event = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: pos.x,
                clientY: pos.y
            });
            document.dispatchEvent(event);
            await new Promise(r => setTimeout(r, 10 + Math.random() * 10));
        }
    }

    static async click(element) {
        await this.move(null, element);
        const events = ['mousedown', 'mouseup', 'click'];
        for (const type of events) {
            const event = new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: this.getCenter(element).x,
                clientY: this.getCenter(element).y
            });
            element.dispatchEvent(event);
            await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
        }
    }

    static async paste(element, text) {
        if (!element) return;
        this.unlockElement(element);
        element.focus();

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
        const setter = nativeInputValueSetter || nativeTextareaSetter;

        if (setter && setter.set) {
            setter.set.call(element, text);
        } else {
            element.value = text;
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        element.blur();
    }

    static async type(element, text) {
        if (!element) return;
        this.unlockElement(element);
        element.focus();

        const chars = String(text).split('');
        for (const char of chars) {
            // Use native setter for React/Vue controlled inputs per character
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
            const setter = nativeInputValueSetter || nativeTextareaSetter;

            const currentVal = element.value || '';
            const nextVal = currentVal + char;

            if (setter && setter.set) {
                setter.set.call(element, nextVal);
            } else {
                element.value = nextVal;
            }

            // Fire events per character to trigger site validations
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
            element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
            element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

            await new Promise(r => setTimeout(r, 30 + Math.random() * 40));
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100)); // Final pause
        element.blur();
    }

    static unlockElement(el) {
        el.removeAttribute('disabled');
        el.removeAttribute('readonly');
        el.disabled = false;
        el.readOnly = false;
        el.style.pointerEvents = 'auto';
        el.style.opacity = '1';

        // Remove blocking parent restrictions
        let parent = el.parentElement;
        while (parent && parent !== document.body) {
            parent.style.pointerEvents = 'auto';
            parent.style.opacity = '1';
            parent.classList.remove('disabled', 'locked', 'readonly');
            parent = parent.parentElement;
        }
    }

    static removeOverlays() {
        const overlays = document.querySelectorAll('[style*="pointer-events: none"], [class*="overlay"], [class*="modal"]');
        overlays.forEach(ov => {
            if (ov.offsetWidth > window.innerWidth * 0.8 && ov.offsetHeight > window.innerHeight * 0.8) {
                ov.style.pointerEvents = 'none';
                ov.style.display = 'none';
            }
        });
    }
}
