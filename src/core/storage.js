/**
 * Toji Project - Unified Storage Utility
 * Developed by @RealYashvirGaming
 */

class TojiStorage {
    static async get(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (result) => {
                resolve(result);
            });
        });
    }

    static async set(data) {
        return new Promise((resolve) => {
            chrome.storage.local.set(data, () => {
                resolve();
            });
        });
    }

    static async clear() {
        return new Promise((resolve) => {
            chrome.storage.local.clear(() => {
                resolve();
            });
        });
    }

    static async getSettings() {
        const defaults = {
            enabled: true,
            autoClick: true,
            retryCount: 3,
            telegramBotToken: '',
            telegramChatId: '',
            activeEngine: 'auto', // auto, stripe, xsolla, general
            stealthMode: true,
            payloadSubstitution: true,
            cvcModifier: 'normal',
            customCvc: '',
            removePaymentAgent: true,
            removeZipCode: false,
            blockAnalytics: true,
            threeDBypass: false,
            playSounds: true
        };
        const settings = await this.get('settings');
        return { ...defaults, ...(settings.settings || {}) };
    }

    static async saveSettings(settings) {
        await this.set({ settings });
    }
}

export default TojiStorage;
