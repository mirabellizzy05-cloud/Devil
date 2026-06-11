/**
 * Toji Project - Event Bus
 * Developed by @RealYashvirGaming
 */

class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data, localOnly = false) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }

        if (localOnly) return;

        // Bridge to Chrome runtime for cross-context events
        try {
            chrome.runtime.sendMessage({
                type: 'EVENT_BUS_SIGNAL',
                event,
                data
            });
        } catch (e) {
            // Context might be invalidated
        }
    }
}

export default new EventBus();
