/**
 * Toji Project - Elite Auto-3DS & Challenge Watcher
 * Developed by @RealYashvirGaming - Combined Ashes & Warden 3DS Protocols
 */

(function() {
    'use strict';
    
    if (window._TOJI_3DS_WATCHER_ACTIVE) return;
    window._TOJI_3DS_WATCHER_ACTIVE = true;

    console.log('[Toji] 🛡️ ELITE 3DS WATCHER: ACTIVE');

    const CHALLENGE_SELECTORS = [
        '.LightboxModalClose', 
        '.LightboxModalHeader .LightboxModalClose', 
        'button[title="Cancel"]', 
        'button[aria-label="Cancel"]',
        '.ThreeDS2-container iframe',
        'iframe[name*="stripe-challenge-frame"]',
        '#challenge-iframe',
        '.challenge-container',
        '[data-testid="challenge-modal"]'
    ];

    const AUTO_CANCEL_3DS = true; // Set by settings in future

    function checkAndHandle3DS() {
        try {
            const modal = document.querySelector('.LightboxModal, .LightboxModalContainer, .ThreeDS2-container, iframe[name*="stripe-challenge-frame"]');
            
            if (modal && modal.offsetParent !== null) {
                console.log('[Toji] 🔔 3DS CHALLENGE DETECTED');
                
                if (AUTO_CANCEL_3DS) {
                    const cancelBtn = document.querySelector('.LightboxModalClose, button[title="Cancel"], button[aria-label="Cancel"]');
                    if (cancelBtn) {
                        console.log('[Toji] 🛡️ AUTO-CANCELING 3DS CHALLENGE...');
                        cancelBtn.click();
                        // Fallback click
                        const ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                        cancelBtn.dispatchEvent(ev);
                        
                        window.postMessage({ type: 'TOJI_CAPTURE', success: false, message: '3DS_CANCELLED' }, '*');
                    }
                }
            }
        } catch (e) {}
    }

    // High-frequency polling (Ashes Protocol)
    setInterval(checkAndHandle3DS, 800);

    // Mutation observer for instant detection (Warden Protocol)
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.addedNodes && m.addedNodes.length > 0) {
                checkAndHandle3DS();
            }
        }
    });

    try {
        observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}

})();
