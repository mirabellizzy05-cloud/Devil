/**
 * Toji Project - HUD Popup Logic
 * Developed by @RealYashvirGaming
 */

import Storage from '../core/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const toggleBtn = document.getElementById('toggle-btn');
    const stopBtn = document.getElementById('stop-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const hitsEl = document.getElementById('stat-hits');
    const errorsEl = document.getElementById('stat-checkouts');
    const spamStatusText = document.getElementById('spam-status-text');
    const miniTerminal = document.getElementById('mini-terminal');
    const stealthModeBtn = document.getElementById('stealth-mode-btn');
    const threeDBtn = document.getElementById('three-d-btn');

    let settings = await Storage.getSettings();

    // ── Update Basic UI ──────────────────────────────────────────────────────
    const updateStats = async () => {
        const data = await Storage.get(['hits', 'errors', 'checkouts', 'logs']);
        if (hitsEl) hitsEl.innerText = String(data.hits || 0).padStart(3, '0');
        if (errorsEl) errorsEl.innerText = String(data.errors || 0).padStart(3, '0');
        
        if (data.logs) {
            renderLogs(data.logs);
        }
    };

    const renderLogs = (logs) => {
        if (!miniTerminal) return;
        miniTerminal.innerHTML = '';
        // Show last 15 logs for full terminal experience (newest at bottom)
        const displayLogs = logs.slice(-15);
        displayLogs.forEach(log => {
            const div = document.createElement('div');
            div.className = `log-entry ${log.type}`;
            div.style.marginBottom = '6px';
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.gap = '2px';
            
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
                <div style="display: flex; gap: 8px; align-items: baseline;">
                    <span class="log-time" style="min-width: 65px;">${log.time}</span> 
                    <span style="flex: 1; font-weight: 500;">${log.msg}</span>
                </div>
                ${cardSnippet}
            `;
            miniTerminal.appendChild(div);
        });
        // Scroll to bottom
        miniTerminal.scrollTop = miniTerminal.scrollHeight;
    };

    const refreshToggle = () => {
        const isEnabled = settings.enabled !== false;
        toggleBtn.checked = isEnabled;
        if (stealthModeBtn) {
            stealthModeBtn.checked = settings.payloadSubstitution === true;
        }
        if (threeDBtn) {
            threeDBtn.checked = settings.threeDBypass === true;
        }
        if (spamStatusText) {
            spamStatusText.innerText = isEnabled ? 'SPAM_ON' : 'SPAM_OFF';
            spamStatusText.style.color = isEnabled ? 'var(--primary)' : 'var(--on-surface-variant)';
        }
    };

    // ── Event Listeners ──────────────────────────────────────────────────────
    toggleBtn.addEventListener('change', async () => {
        settings.enabled = toggleBtn.checked;
        await Storage.saveSettings(settings);
        refreshToggle();
    });

    if (stealthModeBtn) {
        stealthModeBtn.addEventListener('change', async () => {
            settings.payloadSubstitution = stealthModeBtn.checked;
            await Storage.saveSettings(settings);
            console.log('[Toji] Payload Substitution:', settings.payloadSubstitution);
        });
    }

    if (threeDBtn) {
        threeDBtn.addEventListener('change', async () => {
            settings.threeDBypass = threeDBtn.checked;
            await Storage.saveSettings(settings);
            console.log('[Toji] 3DS Bypass:', settings.threeDBypass);
        });
    }

    stopBtn.addEventListener('click', async () => {
        chrome.runtime.sendMessage({ type: 'EMERGENCY_STOP' }, async () => {
            settings = await Storage.getSettings();
            refreshToggle();
            await updateStats();
        });
    });

    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // ── Live Updates ────────────────────────────────────────────────────────
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'STATS_UPDATE') {
            const stats = message.stats;
            if (hitsEl) hitsEl.innerText = String(stats.hits || 0).padStart(3, '0');
            if (errorsEl) errorsEl.innerText = String(stats.errors || 0).padStart(3, '0');
        }
        if (message.type === 'LOG_UPDATE') {
            renderLogs(message.logs);
        }
    });

    // Initial load
    refreshToggle();
    await updateStats();
});
