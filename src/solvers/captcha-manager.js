/**
 * Toji Project - Captcha Manager
 * Developed by @RealYashvirGaming
 */

class CaptchaManager {
    constructor() {
        this.solvers = {
            hcaptcha: this.handleHCaptcha.bind(this),
            recaptcha: this.handleReCaptcha.bind(this)
        };
        this.init();
    }

    init() {
        console.log('[Toji Project] Captcha Manager initialized');
        this.startDetection();
    }

    startDetection() {
        setInterval(() => {
            this.detectHCaptcha();
            this.detectReCaptcha();
        }, 1000);
    }

    detectHCaptcha() {
        if (window.location.href.includes('hcaptcha.com') && (window.location.href.includes('checkbox') || window.location.href.includes('hcaptcha-challenge'))) {
            this.handleHCaptcha();
        }
    }

    detectReCaptcha() {
        if (window.location.href.includes('google.com/recaptcha') || window.location.href.includes('recaptcha.net')) {
            this.handleReCaptcha();
        }
    }

    handleHCaptcha() {
        const checkbox = document.querySelector('#checkbox');
        if (!checkbox) return;

        const isChecked = checkbox.getAttribute('aria-checked') === 'true';
        if (isChecked) {
            this.notify('hcaptcha:solved');
        } else {
            // Auto click if not checked and visible
            if (checkbox.offsetParent !== null) {
                checkbox.click();
                this.notify('hcaptcha:clicked');
            }
        }
    }

    handleReCaptcha() {
        const checkbox = document.querySelector('.recaptcha-checkbox-border');
        if (!checkbox) return;

        const isChecked = document.querySelector('#recaptcha-accessible-status')?.textContent?.includes('You are verified');
        if (isChecked) {
            this.notify('recaptcha:solved');
        } else {
            if (checkbox.offsetParent !== null) {
                checkbox.click();
                this.notify('recaptcha:clicked');
            }
        }
    }

    notify(action) {
        try {
            chrome.runtime.sendMessage({
                __toji_helper: true,
                type: 'CAPTCHA_STATUS',
                action: action,
                url: window.location.href
            });
        } catch (e) {}
    }
}

// Initialize on load
if (typeof window !== 'undefined') {
    new CaptchaManager();
}

export default CaptchaManager;
