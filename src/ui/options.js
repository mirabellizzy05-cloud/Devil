/**
 * Toji Project - Options Logic (Advanced Dashboard)
 * Developed by @RealYashvirGaming
 */

import Storage from '../core/storage.js';
import { CardGenerator } from '../utils/card-generator.js';

document.addEventListener('DOMContentLoaded', () => {
    // ── UI Element Selectors ──────────────────────────────────────────────────
    const cardInput    = document.getElementById('card-input');
    const countryInput = document.getElementById('country-input');
    const modeSelect   = document.getElementById('mode-select');
    const tgToken      = document.getElementById('tg-token');
    const tgChatId     = document.getElementById('tg-chatid');
    const stealthCheck = document.getElementById('stealth-check');
    const proxyCheck   = document.getElementById('proxy-check');
    const refreshCheck = document.getElementById('refresh-on-decline');
    const saveBtn      = document.getElementById('save-btn');
    const resetBtn     = document.getElementById('reset-btn');
    const statusMsg    = document.getElementById('status-msg');
    const cardCount    = document.getElementById('card-count');
    const currentMode  = document.getElementById('current-mode');
    const exportBtn    = document.getElementById('export-hits-btn');
    const dashboardTerminal = document.getElementById('dashboard-terminal');
    const navItems = document.querySelectorAll('.nav-item');
    const activeTabName = document.getElementById('active-tab-name');
    const logSearchInput = document.getElementById('log-search-input');
    const testTgBtn = document.getElementById('test-tg-btn');

    // Elite Stealth Selectors
    const cvcModifier     = document.getElementById('cvc-modifier');
    const customCvcGroup  = document.getElementById('custom-cvc-group');
    const customCvcInput  = document.getElementById('custom-cvc-input');
    const removeAgentCheck = document.getElementById('remove-agent-check');
    const removeZipCheck  = document.getElementById('remove-zip-check');
    const blockAnalyticsCheck = document.getElementById('block-analytics-check');
    const threeDCheck     = document.getElementById('three-d-check');

    // State
    let logsData = [];
    let activeLogFilter = 'all';
    let activeSearchQuery = '';
    let currentSettings = {};

    // ── UI Helper Functions ──────────────────────────────────────────────────
    const updateStatsDisplay = (stats) => {
        if (!stats) return;
        const hits = stats.hits || 0;
        const errors = stats.errors || 0;
        const total = stats.checkouts || (hits + errors);
        const rate = total > 0 ? ((hits / total) * 100).toFixed(2) : '0.00';
        
        if (document.getElementById('stat-total-hits')) document.getElementById('stat-total-hits').textContent = total;
        if (document.getElementById('stat-success-rate')) document.getElementById('stat-success-rate').textContent = rate;
        if (document.getElementById('log-stat-hits')) document.getElementById('log-stat-hits').textContent = hits;
        if (document.getElementById('log-stat-errors')) document.getElementById('log-stat-errors').textContent = errors;
    };

    const renderDashboardLogs = (logsList) => {
        if (!dashboardTerminal) return;
        let filteredLogs = logsList || [];
        if (activeLogFilter === 'hit') filteredLogs = filteredLogs.filter(l => l.type === 'success');
        if (activeLogFilter === 'error') filteredLogs = filteredLogs.filter(l => l.type === 'error');
        if (activeSearchQuery) {
            const query = activeSearchQuery.toLowerCase();
            filteredLogs = filteredLogs.filter(l => 
                (l.msg && l.msg.toLowerCase().includes(query)) ||
                (l.card && l.card.number && l.card.number.includes(query))
            );
        }

        if (filteredLogs.length === 0) {
            dashboardTerminal.innerHTML = '<div style="text-align: center; color: var(--ghost-border); margin-top: 200px; font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.1em;">NO_LOGS_AVAILABLE...</div>';
            return;
        }

        dashboardTerminal.innerHTML = '';
        filteredLogs.forEach(log => {
            const div = document.createElement('div');
            let color = '#a2a2a2'; 
            let marker = '[LOG]';
            if (log.type === 'success') { color = 'var(--primary)'; marker = '[HIT]'; }
            else if (log.type === 'error') { color = 'var(--tertiary)'; marker = '[DEC]'; }

            div.className = 'log-entry';
            div.style.padding = '8px 12px';
            div.style.borderBottom = '1px solid rgba(255, 255, 255, 0.03)';
            div.style.fontFamily = 'var(--font-mono)';
            div.style.fontSize = '12px';
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.gap = '4px';
            div.style.color = '#fff';
            
            const timeStr = log.time || '--:--:--';
            let cardSnippet = '';
            if (log.card && log.card.number) {
                const num = log.card.number;
                const formatted = num.replace(/(.{4})/g, '$1 ').trim();
                cardSnippet = `
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                        <span style="color: var(--primary); font-size: 10px; font-weight: bold; padding: 2px 5px; background: rgba(0,255,204,0.1); border: 1px solid var(--primary); border-radius: 2px;">[DEEP_STORE_VERIFIED]</span>
                        <span style="color: #888; font-size: 11px; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
                            ${formatted} | ${log.card.expiry || '??'} | ${log.card.cvc || '??'}
                        </span>
                    </div>`;
            }

            div.innerHTML = `
                <div style="display: flex; gap: 12px; align-items: center;">
                    <span style="color: var(--ghost-border); min-width: 65px; opacity: 0.7; font-size: 10px;">${timeStr}</span>
                    <span style="color: ${color}; min-width: 45px; font-weight: bold; font-size: 11px;">${marker}</span>
                    <span style="flex: 1; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;" title="${log.msg}">${log.msg}</span>
                </div>
                ${cardSnippet}
            `;
            dashboardTerminal.appendChild(div);
        });
        
        // Ensure scroll reaches the very bottom
        setTimeout(() => {
            dashboardTerminal.scrollTop = dashboardTerminal.scrollHeight;
        }, 30);
    };

    function updateCardCount() {
        const raw = cardInput.value.trim();
        const mode = currentMode.value || 'bin';
        let counts = { visa: 0, mc: 0, amex: 0, disc: 0 };
        if (!raw) { 
            cardCount.textContent = '0 CARDS_LOADED'; 
        } else {
            const cards = CardGenerator.parseAll(raw, mode === 'bin' ? 300 : 1);
            cardCount.textContent = `${cards.length} CARD${cards.length !== 1 ? 'S' : ''}_LOADED`;
            cards.forEach(c => {
                const pan = c.pan || c;
                if (pan.startsWith('4')) counts.visa++;
                else if (pan.startsWith('5')) counts.mc++;
                else if (pan.startsWith('34') || pan.startsWith('37')) counts.amex++;
                else if (pan.startsWith('6')) counts.disc++;
            });
        }
        document.getElementById('badge-visa').textContent = counts.visa;
        document.getElementById('badge-mc').textContent = counts.mc;
        document.getElementById('badge-amex').textContent = counts.amex;
        document.getElementById('badge-disc').textContent = counts.disc;
    }

    // ── Event Listeners (Attach IMMEDIATELY) ─────────────────────────────────
    
    // Tab Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            if (!tab) return;
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            if (activeTabName) activeTabName.textContent = tab.toUpperCase().replace('_', ' ');
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            const target = document.getElementById(`tab-${tab}`);
            if (target) {
                target.style.display = 'block';
                if (tab === 'logs') renderDashboardLogs(logsData);
            }
        });
    });

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            activeLogFilter = e.currentTarget.getAttribute('data-filter');
            renderDashboardLogs(logsData);
        });
    });

    // Search Bar
    if (logSearchInput) {
        logSearchInput.addEventListener('input', (e) => {
            activeSearchQuery = e.target.value.trim();
            renderDashboardLogs(logsData);
        });
    }

    // Action Buttons
    if (exportBtn) {
        exportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const hits = logsData.filter(l => l.type === 'success');
            if (hits.length === 0) { alert('NO HITS TO EXPORT.'); return; }
            let exportStr = `--- TOJI PROJECT // HITS EXPORT ---\nDATE: ${new Date().toISOString()}\nTOTAL: ${hits.length}\n-----------------------------------\n\n`;
            hits.forEach(h => { exportStr += `[${h.time}] ${h.msg}\n`; });
            const blob = new Blob([exportStr], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `toji_hits_${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url);
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('ARE_YOU_SURE? THIS_WILL_WIPE_ALL_STATS_AND_LOGS.')) {
                chrome.runtime.sendMessage({ type: 'RESET_STATS' }, () => {
                    statusMsg.textContent = '✓ STATS_AND_LOGS_PURGED';
                    // Also clear visit flag if they want a fresh start
                    chrome.storage.local.set({ dashboard_visited: false });
                    setTimeout(() => statusMsg.textContent = 'SYSTEM_READY', 3000);
                });
            }
        });
    }

    const welcomeModal = document.getElementById('welcome-modal');
    const closeWelcomeBtn = document.getElementById('close-welcome-btn');

    if (closeWelcomeBtn && welcomeModal) {
        closeWelcomeBtn.addEventListener('click', () => {
            welcomeModal.style.display = 'none';
            chrome.storage.local.set({ dashboard_visited: true });
            console.log('[Toji] Welcome modal dismissed. Visit flag set.');
        });
    }

    if (testTgBtn) {
        testTgBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const token = tgToken.value.trim();
            const chatId = tgChatId.value.trim();
            if (!token || !chatId) {
                statusMsg.textContent = '⚠ MISSING TG_TOKEN OR CHAT_ID';
                setTimeout(() => statusMsg.textContent = 'SYSTEM_READY', 3000);
                return;
            }
            statusMsg.textContent = 'PINGING_TELEGRAM...';
            chrome.runtime.sendMessage({ type: 'TEST_TG_PING', token, chatId }, (response) => {
                if (response && response.ok) {
                    statusMsg.textContent = '✓ TG_PING_SUCCESS';
                } else if (response && response.error) {
                    statusMsg.textContent = `⚠ TG_ERR: ${response.error}`;
                } else {
                    statusMsg.textContent = '⚠ NETWORK_ERR';
                }
                setTimeout(() => statusMsg.textContent = 'SYSTEM_READY', 4000);
            });
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const raw  = cardInput.value.trim();
            const mode = currentMode.value || 'bin';
            const cards = CardGenerator.parseAll(raw, mode === 'bin' ? 300 : 1);
            if (cards.length === 0) {
                statusMsg.textContent = '⚠ NO_VALID_CARDS_FOUND';
                setTimeout(() => statusMsg.textContent = 'SYSTEM_READY', 3000);
                return;
            }
            const settings = {
                ...currentSettings,
                cardRaw: raw, cardMode: mode, cards: cards, cardIndex: 0,
                country: countryInput.value.trim(), mode: modeSelect.value,
                tgToken: tgToken.value.trim(), tgChatId: tgChatId.value.trim(),
                stealthEnabled: stealthCheck.checked, proxyEnabled: proxyCheck.checked,
                refreshOnDecline: refreshCheck.checked,
                enabled: currentSettings.enabled !== false,
                
                // Elite Protocols
                cvcModifier: cvcModifier.value,
                customCvc: customCvcInput.value.trim(),
                removePaymentAgent: removeAgentCheck.checked,
                removeZipCode: removeZipCheck.checked,
                blockAnalytics: blockAnalyticsCheck.checked,
                threeDBypass: threeDCheck.checked
            };
            await Storage.saveSettings(settings);
            currentSettings = settings;
            statusMsg.textContent = `✓ ${cards.length} CARDS_LOADED`;
            updateCardCount();
            setTimeout(() => statusMsg.textContent = 'SYSTEM_READY', 3000);
        });
    }

    cardInput.addEventListener('input', updateCardCount);
    currentMode.addEventListener('change', updateCardCount);

    if (cvcModifier) {
        cvcModifier.addEventListener('change', () => {
            if (cvcModifier.value === 'custom') customCvcGroup.style.display = 'block';
            else customCvcGroup.style.display = 'none';
        });
    }

    // ── Live Updates ─────────────────────────────────────────────────────────
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'STATS_UPDATE') {
            console.log('[Toji] Stats Update Received:', message.stats);
            updateStatsDisplay(message.stats);
        }
        if (message.type === 'LOG_UPDATE') { 
            console.log('[Toji] LOG_UPDATE Received:', message.logs.length, 'entries');
            logsData = message.logs; 
            renderDashboardLogs(logsData); 
        }
    });

    // ── Async Data Loading (Runs LAST) ───────────────────────────────────────
    async function initData(isInitialSetup = false) {
        try {
            currentSettings = await Storage.getSettings();
            const statsData = await Storage.get(['hits', 'errors', 'checkouts']);
            const logObj = await Storage.get('logs');
            logsData = logObj.logs || [];

            if (isInitialSetup) {
                // Check if this is the first visit
                const visitData = await chrome.storage.local.get('dashboard_visited');
                if (!visitData.dashboard_visited) {
                    if (welcomeModal) welcomeModal.style.display = 'flex';
                }

                // Restore UI values
                if (currentSettings.cardRaw) cardInput.value = currentSettings.cardRaw;
                if (currentSettings.cardMode) currentMode.value = currentSettings.cardMode;
                countryInput.value = currentSettings.country || 'US';
                modeSelect.value   = currentSettings.mode || 'turbo';
                tgToken.value      = currentSettings.tgToken || '';
                tgChatId.value     = currentSettings.tgChatId || '';
                stealthCheck.checked = currentSettings.stealthEnabled !== false;
                proxyCheck.checked   = currentSettings.proxyEnabled !== false;
                refreshCheck.checked = currentSettings.refreshOnDecline === true;

                // Restore Elite Protocols
                if (currentSettings.cvcModifier && cvcModifier) cvcModifier.value = currentSettings.cvcModifier;
                if (customCvcInput) customCvcInput.value = currentSettings.customCvc || '';
                if (removeAgentCheck) removeAgentCheck.checked = currentSettings.removePaymentAgent !== false;
                if (removeZipCheck) removeZipCheck.checked = currentSettings.removeZipCode === true;
                if (blockAnalyticsCheck) blockAnalyticsCheck.checked = currentSettings.blockAnalytics !== false;
                if (threeDCheck) threeDCheck.checked = currentSettings.threeDBypass === true;

                // Handle CVC Group Visibility
                if (cvcModifier && cvcModifier.value === 'custom') {
                    if (customCvcGroup) customCvcGroup.style.display = 'block';
                } else {
                    if (customCvcGroup) customCvcGroup.style.display = 'none';
                }
            }

            updateCardCount();
            updateStatsDisplay(statsData);
            renderDashboardLogs(logsData);
        } catch (e) { console.error('Toji Init Error:', e); }
    }

    initData(true);

    // ── Polling Safety Net (Guarantee Updates) ───────────────────────────────
    // Sometimes chrome.runtime.onMessage fails to wake up the dashboard.
    // This heartbeat ensures stats and logs update even if messaging is laggy.
    setInterval(() => {
        initData(false);
    }, 2000);
});
