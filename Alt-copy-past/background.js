// WMS Circuit Studio — Background Service Worker (background.js)
// Handles switching between existing open browser tabs (like Ctrl+1..9, Ctrl+Tab, Ctrl+Shift+Tab, or by Title/URL)
// without opening new tabs or changing URLs, and relays running circuits to the newly activated tab.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'WMS_SWITCH_BROWSER_TAB') return false;

  const senderTab = sender && sender.tab ? sender.tab : null;
  const queryOpts = senderTab && typeof senderTab.windowId === 'number'
    ? { windowId: senderTab.windowId }
    : { currentWindow: true };

  chrome.tabs.query(queryOpts, (tabs) => {
    if (chrome.runtime.lastError || !Array.isArray(tabs) || tabs.length === 0) {
      sendResponse({ ok: false, reason: 'no-browser-tabs-found' });
      return;
    }

    // Sort by browser tab bar order (0-indexed: 0 = Ctrl+1, 1 = Ctrl+2, ...)
    const sorted = tabs.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const currentIndex = senderTab
      ? sorted.findIndex((t) => t.id === senderTab.id)
      : sorted.findIndex((t) => t.active);

    const mode = message.mode || 'index';
    let targetTab = null;

    if (mode === 'index') {
      const requestedNum = parseInt(message.tabIndex, 10) || 1;
      // Like Chrome's Ctrl+1..9: 1..8 pick tab 1..8; 9 (or >= count) picks the last tab if requestedNum === 9 and tabs.length >= 9, otherwise exact 1-based index
      if (requestedNum === 9 && sorted.length >= 9) {
        targetTab = sorted[sorted.length - 1];
      } else if (requestedNum >= 1 && requestedNum <= sorted.length) {
        targetTab = sorted[requestedNum - 1];
      } else {
        sendResponse({
          ok: false,
          reason: `tab-#${requestedNum}-not-open (only ${sorted.length} tab${sorted.length === 1 ? '' : 's'} open)`
        });
        return;
      }
    } else if (mode === 'next') {
      const base = currentIndex >= 0 ? currentIndex : 0;
      targetTab = sorted[(base + 1) % sorted.length];
    } else if (mode === 'prev') {
      const base = currentIndex >= 0 ? currentIndex : 0;
      targetTab = sorted[(base - 1 + sorted.length) % sorted.length];
    } else if (mode === 'title') {
      const q = String(message.query || '').trim();
      const matchMode = message.matchMode || 'contains';
      const matches = (str) => {
        const s = String(str || '');
        if (!s) return false;
        if (matchMode === 'equals') return s.trim().toLowerCase() === q.toLowerCase();
        if (matchMode === 'regex') {
          try { return new RegExp(q, 'i').test(s); } catch (_) { return false; }
        }
        return s.toLowerCase().includes(q.toLowerCase());
      };
      targetTab = sorted.find((t) => matches(t.title) || matches(t.url));
      if (!targetTab) {
        sendResponse({ ok: false, reason: `no-open-tab-matching-"${q.slice(0, 25)}"` });
        return;
      }
    }

    if (!targetTab || typeof targetTab.id !== 'number') {
      sendResponse({ ok: false, reason: 'target-tab-not-found' });
      return;
    }

    const targetNumber = sorted.findIndex((t) => t.id === targetTab.id) + 1;
    const isSameTab = Boolean(senderTab && senderTab.id === targetTab.id);

    chrome.tabs.update(targetTab.id, { active: true }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, reason: chrome.runtime.lastError.message || 'tab-activate-failed' });
        return;
      }

      if (typeof targetTab.windowId === 'number') {
        try { chrome.windows.update(targetTab.windowId, { focused: true }); } catch (_) {}
      }

      // If there is a circuit handoff for the target tab, notify that tab directly as well
      if (!isSameTab && message.handoff) {
        setTimeout(() => {
          try {
            chrome.tabs.sendMessage(targetTab.id, {
              type: 'WMS_RESUME_FROM_TAB_SWITCH',
              handoff: message.handoff
            }, () => {
              void chrome.runtime.lastError;
            });
          } catch (_) {}
        }, 120);
      }

      sendResponse({
        ok: true,
        sameTab: isSameTab,
        tabId: targetTab.id,
        tabNumber: targetNumber,
        tabTitle: targetTab.title || ''
      });
    });
  });

  return true; // Keep message channel open for async sendResponse
});
