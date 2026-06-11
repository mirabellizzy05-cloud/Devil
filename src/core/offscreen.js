/**
 * Toji Project - Offscreen Audio Bridge (MV3)
 * Plays sound assets triggered by background messages.
 */

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'PLAY_HIT_SND') {
        try {
            console.log('[Toji] 🎵 Playing HIT_SOUND...');
            const audio = new Audio(chrome.runtime.getURL('assets/hits.mp3'));
            audio.volume = 1.0;
            await audio.play();
        } catch (e) {
            console.error('[Toji] Failed to play audio:', e);
        }
    }
});
