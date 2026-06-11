/**
 * Toji Project - Anti-Throttle Utility
 * Developed by @RealYashvirGaming
 * 
 * Keeps the tab awake using the Web Audio API. 
 * Prevents browser from throttling timers in background tabs.
 */

class AntiThrottle {
    constructor() {
        this.ctx = null;
        this.osc = null;
    }

    start() {
        if (this.ctx) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            gain.gain.value = 0.00001; // Inaudible
            this.osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            this.osc.start();
            console.log('[Toji Project] Anti-Throttle active');
        } catch (e) {
            console.error('[Toji Project] Anti-Throttle failed:', e);
        }
    }

    stop() {
        try {
            if (this.osc) {
                this.osc.stop();
                this.osc.disconnect();
                this.osc = null;
            }
            if (this.ctx) {
                this.ctx.close();
                this.ctx = null;
            }
        } catch (e) {}
    }
}

export default new AntiThrottle();
