/**
 * Toji Project - Protected Cyber HUD (Shadow DOM)
 * Developed by @RealYashvirGaming
 */

class HUDOverlay {
    constructor() {
        this.host = null;
        this.shadow = null;
        this.container = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        
        // 1. Create Host Element (Top Level)
        this.host = document.createElement('div');
        this.host.id = 'toji-hud-host';
        this.host.style.all = 'initial'; // Reset everything
        this.host.style.position = 'fixed';
        this.host.style.zIndex = '2147483647';
        this.host.style.top = '0';
        this.host.style.left = '0';
        this.host.style.width = '100%';
        this.host.style.height = '100%';
        this.host.style.pointerEvents = 'none';

        // 2. Create Shadow Root (The Shield)
        this.shadow = this.host.attachShadow({ mode: 'closed' });

        // 3. Inject Styles into Shadow
        const style = document.createElement('style');
        style.textContent = `
            :host { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

            #toji-notif-stack {
                position: fixed;
                top: 24px;
                right: 24px;
                width: 320px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
            }

            .toji-popup {
                pointer-events: auto;
                background: rgba(12, 12, 12, 0.95);
                backdrop-filter: blur(25px);
                border: 1px solid rgba(200, 254, 0, 0.3);
                border-left: 4px solid #c8fe00;
                color: #fff;
                padding: 16px;
                box-shadow: 0 15px 40px rgba(0,0,0,0.8);
                transform: translateX(130%);
                transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            .toji-popup.active { transform: translateX(0); }
            
            .toji-popup.success { border-left-color: #00ff88; }
            .toji-popup.error { border-left-color: #ff0055; }

            .toji-popup-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 8px;
                padding-bottom: 6px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .toji-popup-avatar {
                width: 30px;
                height: 30px;
                border: 1px solid #c8fe00;
                background-size: cover;
                background-position: center;
            }
            .toji-popup-title {
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 2px;
                color: #c8fe00;
            }
            .toji-popup.success .toji-popup-title { color: #00ff88; }
            .toji-popup.error .toji-popup-title { color: #ff0055; }

            .toji-popup-msg {
                font-size: 13px;
                line-height: 1.4;
                opacity: 0.9;
            }

            /* Watermark (Elite Branding) */
            #toji-watermark {
                position: fixed;
                top: 30px;
                left: 30px;
                width: 90px;
                opacity: 0.4;
                border: 1px solid rgba(200, 254, 0, 0.5);
                pointer-events: none;
            }
            #toji-watermark img { width: 100%; display: block; }

            #toji-sticky-status {
                position: fixed;
                bottom: 30px;
                left: 30px;
                background: #c8fe00;
                color: #000;
                padding: 6px 14px;
                font-size: 10px;
                font-weight: 900;
                text-transform: uppercase;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .toji-pulse {
                width: 6px;
                height: 6px;
                background: #000;
                border-radius: 50%;
                animation: toji-pulse-anim 0.8s infinite steps(2);
            }
            @keyframes toji-pulse-anim { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        `;
        this.shadow.appendChild(style);

        // 4. Create Notification Stack
        this.container = document.createElement('div');
        this.container.id = 'toji-notif-stack';
        this.shadow.appendChild(this.container);

        // 5. Add Watermark
        const wm = document.createElement('div');
        wm.id = 'toji-watermark';
        const imgUrl = chrome.runtime.getURL('assets/toji.jpg');
        wm.innerHTML = `<img src="${imgUrl}">`;
        this.shadow.appendChild(wm);

        // 6. Mount to Document
        (document.documentElement || document.body).appendChild(this.host);
        this.isInitialized = true;
    }

    setStickyStatus(msg) {
        this.init();
        let el = this.shadow.getElementById('toji-sticky-status');
        if (!el) {
            el = document.createElement('div');
            el.id = 'toji-sticky-status';
            this.shadow.appendChild(el);
        }
        el.innerHTML = `<div class="toji-pulse"></div> ${msg}`;
    }

    show(msg, type = 'info', duration = 4000) {
        this.init();
        
        const popup = document.createElement('div');
        popup.className = `toji-popup ${type}`;
        
        const avatarUrl = chrome.runtime.getURL('assets/toji.jpg');
        const title = type === 'success' ? 'HIT_SUCCESS' : (type === 'error' ? 'SYSTEM_DECLINE' : 'STATUS_UPDATE');
        
        popup.innerHTML = `
            <div class="toji-popup-header">
                <div class="toji-popup-avatar" style="background-image: url('${avatarUrl}')"></div>
                <div class="toji-popup-title">${title}</div>
            </div>
            <div class="toji-popup-msg">${msg}</div>
        `;

        this.container.appendChild(popup);
        
        // Use requestAnimationFrame for smooth reliable animation
        requestAnimationFrame(() => {
            setTimeout(() => popup.classList.add('active'), 10);
        });

        setTimeout(() => {
            popup.classList.remove('active');
            setTimeout(() => popup.remove(), 500);
        }, duration);
    }
}

export default new HUDOverlay();
