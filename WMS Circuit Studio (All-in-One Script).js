(function () {
  'use strict';

  // ============================================================================
  // 0. SINGLE-FILE BACKGROUND SERVICE WORKER MODE (OPTIONAL AUTO-DETECTION)
  // If you also set "service_worker": "content.js" in manifest.json, this same
  // single file automatically handles native Chrome tab switching in the background.
  // ============================================================================
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    let lastActiveTabId = null;
    let currentActiveTabId = null;

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.onActivated.addListener((activeInfo) => {
        if (currentActiveTabId && currentActiveTabId !== activeInfo.tabId) {
          lastActiveTabId = currentActiveTabId;
        }
        currentActiveTabId = activeInfo.tabId;
      });

      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (!msg || !msg.type) return false;

        if (msg.type === 'WMS_GET_TABS') {
          chrome.tabs.query({ currentWindow: true }, (tabs) => {
            const simplified = (tabs || []).map((t, index) => ({
              id: t.id,
              index: index + 1,
              title: t.title || '',
              url: t.url || '',
              active: Boolean(t.active)
            }));
            sendResponse({ ok: true, tabs: simplified });
          });
          return true;
        }

        if (msg.type === 'WMS_SWITCH_TAB') {
          const rawQuery = String(msg.query || '').trim();
          const needle = rawQuery.toLowerCase();

          chrome.tabs.query({}, (allTabs) => {
            if (!allTabs || allTabs.length === 0) {
              sendResponse({ ok: false });
              return;
            }

            const senderTab = sender && sender.tab ? sender.tab : allTabs.find(t => t.active);
            const winTabs = senderTab
              ? allTabs.filter(t => t.windowId === senderTab.windowId).sort((a, b) => a.index - b.index)
              : allTabs;

            let targetTab = null;

            if (rawQuery === '[[NEXT_TAB]]' || needle === 'next') {
              if (senderTab && winTabs.length > 1) {
                const idx = winTabs.findIndex(t => t.id === senderTab.id);
                targetTab = winTabs[(idx + 1) % winTabs.length];
              }
            } else if (rawQuery === '[[PREV_TAB]]' || needle === 'prev' || needle === 'previous') {
              if (senderTab && winTabs.length > 1) {
                const idx = winTabs.findIndex(t => t.id === senderTab.id);
                targetTab = winTabs[(idx - 1 + winTabs.length) % winTabs.length];
              }
            } else if (rawQuery === '[[LAST_TAB]]' || needle === 'last') {
              if (lastActiveTabId) {
                targetTab = allTabs.find(t => t.id === lastActiveTabId);
              }
            } else if (/^(?:tab\s*)?(\d+)$/i.test(rawQuery)) {
              const num = parseInt(rawQuery.replace(/[^0-9]/g, ''), 10);
              if (num >= 1 && num <= winTabs.length) {
                targetTab = winTabs[num - 1];
              }
            }

            if (!targetTab) {
              targetTab = allTabs.find(t =>
                (!senderTab || t.id !== senderTab.id) &&
                ((t.title || '').toLowerCase().includes(needle) || (t.url || '').toLowerCase().includes(needle))
              ) || allTabs.find(t =>
                (t.title || '').toLowerCase().includes(needle) || (t.url || '').toLowerCase().includes(needle)
              );
            }

            if (!targetTab) {
              sendResponse({ ok: false });
              return;
            }

            chrome.tabs.update(targetTab.id, { active: true }, () => {
              chrome.windows.update(targetTab.windowId, { focused: true }, () => {
                sendResponse({ ok: true, tabId: targetTab.id, title: targetTab.title });
              });
            });
          });
          return true;
        }
        return false;
      });
    }
    return;
  }

  // Clean up any previous instance if re-injected on the page
  if (typeof window.__wmsCircuitCleanup === 'function') {
    try { window.__wmsCircuitCleanup(); } catch (_) {}
  }

  // ============================================================================
  // 1. STATE & BACKWARD-COMPATIBLE STORAGE (PRESERVES ALL SAVED FLOWS)
  // ============================================================================
  let circuit = {
    panX: 0,
    panY: 0,
    nodes: [
      {
        id: 'n_start',
        type: 'trigger',
        x: 50,
        y: 120,
        data: { triggerType: 'hotkey', value: 'Alt+Q', zone: null }
      }
    ],
    wires: []
  };

  let canvases = [];
  let activeCanvasId = 'canvas_main';

  let isRunning = false;
  let cancelExecution = false;
  let isLocalStorageWrite = false;
  let lastMatchedUrl = '';
  let lastHandledHandoffTs = 0;
  const cooldownMap = new Map();

  // Assign a deterministic window name so tabs can focus each other directly
  if (!window.name || !window.name.startsWith('wms_tab_')) {
    window.name = 'wms_tab_' + Math.random().toString(36).slice(2, 9);
  }
  const THIS_TAB_ID = window.name;
  window.__wmsLinkedWindows = window.__wmsLinkedWindows || {};

  let floatingPos = {
    x: Math.max(16, window.innerWidth - 290),
    y: 20,
    minimized: false
  };

  function createBlankCanvas(name, id) {
    return {
      id: id || ('canvas_' + Date.now() + '_' + Math.floor(Math.random() * 1000)),
      name: name || ('Canvas ' + (canvases.length + 1)),
      enabled: true,
      panX: 0,
      panY: 0,
      nodes: [
        {
          id: 'n_start_' + Date.now(),
          type: 'trigger',
          x: 50,
          y: 120,
          data: { triggerType: 'hotkey', value: 'Alt+Q', zone: null }
        }
      ],
      wires: []
    };
  }

  function normalizeNode(n, idx) {
    const d = Object.assign({}, n.data || {});

    [
      'triggerType', 'value', 'hotkey', 'url', 'selector', 'zone',
      'eventType', 'targetVal', 'condition', 'source', 'customText',
      'pressEnter', 'waitType', 'ms', 'textVal', 'targetBox', 'box',
      'tabMode', 'targetValue', 'targetCanvasId', 'runAfterSwitch',
      'preset', 'code', 'expectedTag', 'expectedText'
    ].forEach(k => {
      if (n[k] !== undefined && d[k] === undefined) {
        d[k] = n[k];
      }
    });

    if (n.type === 'trigger') {
      if (!d.triggerType) d.triggerType = 'hotkey';
      if (d.triggerType === 'passive') d.triggerType = 'element';
      if (d.value === undefined) d.value = d.hotkey || d.url || d.selector || 'Alt+Q';
      if (d.zone === undefined) d.zone = null;
    }

    if (n.type === 'listener') {
      if (!d.eventType) d.eventType = 'contains';
      const map = {
        contains_text: 'contains',
        equals_text: 'equals',
        num_gt: 'gt',
        num_lt: 'lt',
        input_len: 'length',
        zone_change: 'change'
      };
      if (map[d.eventType]) d.eventType = map[d.eventType];
      if (d.targetVal === undefined) d.targetVal = d.value || '';
      if (d.selector === undefined) d.selector = '';
      if (d.zone === undefined) d.zone = null;
    }

    if (n.type === 'ifelse') {
      if (!d.condition) d.condition = 'exists';
      if (d.value === undefined) d.value = '';
      if (d.selector === undefined) d.selector = '';
      if (d.zone === undefined) d.zone = null;
    }

    if (n.type === 'click') {
      if (d.selector === undefined) d.selector = '';
      if (d.zone === undefined) d.zone = null;
    }

    if (n.type === 'type') {
      if (!d.source) d.source = 'box1';
      if (d.customText === undefined) d.customText = d.value || '';
      if (d.pressEnter === undefined) d.pressEnter = true;
      if (d.selector === undefined) d.selector = '';
      if (d.zone === undefined) d.zone = null;
    }

    if (n.type === 'wait') {
      if (!d.waitType) d.waitType = 'element';
      if (d.ms === undefined) d.ms = '500';
      if (d.selector === undefined) d.selector = '';
      if (d.textVal === undefined) d.textVal = '';
      if (d.zone === undefined) d.zone = null;
    }

    if (n.type === 'extract') {
      if (!d.targetBox) d.targetBox = d.box || d.source || 'box1';
      if (d.selector === undefined) d.selector = '';
      if (d.zone === undefined) d.zone = null;
    }

    if (n.type === 'tabswitch') {
      if (!d.tabMode) d.tabMode = 'wms_tab';
      if (d.targetValue === undefined) d.targetValue = '';
      if (d.selector === undefined) d.selector = '';
      if (d.zone === undefined) d.zone = null;
      if (d.targetCanvasId === undefined) d.targetCanvasId = '';
      if (d.runAfterSwitch === undefined) d.runAfterSwitch = true;
    }

    if (n.type === 'script') {
      if (!d.preset) d.preset = 'run_canvas';
      if (d.targetCanvasId === undefined) d.targetCanvasId = '';
      if (d.code === undefined) {
        d.code = '// Available: box1, box2, setBox1(v), setBox2(v), clickText("OK"), switchTab("Putaway")\nreturn true;';
      }
    }

    return {
      id: n.id || ('n_' + idx + '_' + Date.now()),
      type: n.type || 'click',
      x: typeof n.x === 'number' ? n.x : (60 + idx * 280),
      y: typeof n.y === 'number' ? n.y : 120,
      data: d
    };
  }

  function normalizeCanvasObj(raw, fallbackName, fallbackId) {
    const rawNodes = Array.isArray(raw && raw.nodes) ? raw.nodes : [];
    const rawWires = Array.isArray(raw && raw.wires) ? raw.wires : [];
    return {
      id: (raw && raw.id) || fallbackId || ('canvas_' + Date.now() + '_' + Math.floor(Math.random() * 1000)),
      name: (raw && raw.name) || fallbackName || 'Main Circuit',
      enabled: raw ? raw.enabled !== false : true,
      panX: Number(raw && raw.panX) || 0,
      panY: Number(raw && raw.panY) || 0,
      nodes: rawNodes.map((n, i) => normalizeNode(n, i)),
      wires: rawWires.map((w, i) => ({
        id: w.id || ('w_' + i + '_' + Date.now()),
        from: w.from || w.fromNode || w.source || '',
        fromPort: w.fromPort || w.port || w.sourcePort || 'out',
        to: w.to || w.toNode || w.target || ''
      })).filter(w => w.from && w.to)
    };
  }

  function isDefaultSingleNodeCanvas(c) {
    if (!c || !Array.isArray(c.nodes)) return true;
    if (c.nodes.length === 0) return true;
    if (c.nodes.length === 1 && (!c.wires || c.wires.length === 0)) {
      const n = c.nodes[0];
      if (n.type === 'trigger' && (!n.data || n.data.value === 'Alt+Q')) return true;
    }
    return false;
  }

  function syncActiveCanvasRef() {
    let found = canvases.find(c => c.id === activeCanvasId);
    if (!found) {
      if (canvases.length === 0) {
        canvases.push(normalizeCanvasObj(circuit, 'Main Circuit', 'canvas_main'));
      }
      activeCanvasId = canvases[0].id;
      found = canvases[0];
    }
    circuit = found;
    return found;
  }

  const storage = {
    getAll(cb) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(null, (res) => cb(res || {}));
          return;
        }
      } catch (_) {}
      const out = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith('wms_cs_')) {
            out[k.replace(/^wms_cs_/, '')] = JSON.parse(localStorage.getItem(k));
          } else {
            try { out[k] = JSON.parse(localStorage.getItem(k)); } catch (_) {}
          }
        }
      } catch (_) {}
      cb(out);
    },
    set(obj) {
      isLocalStorageWrite = true;
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set(obj, () => {
            setTimeout(() => { isLocalStorageWrite = false; }, 120);
          });
        }
      } catch (_) {}
      Object.keys(obj).forEach(k => {
        try { localStorage.setItem('wms_cs_' + k, JSON.stringify(obj[k])); } catch (_) {}
      });
      setTimeout(() => { isLocalStorageWrite = false; }, 120);
    }
  };

  function saveCircuit() {
    syncActiveCanvasRef();
    const mainCanvas = canvases[0] || circuit;
    const payload = {
      savedCircuit: {
        panX: mainCanvas.panX || 0,
        panY: mainCanvas.panY || 0,
        nodes: mainCanvas.nodes,
        wires: mainCanvas.wires
      },
      savedCanvases: canvases,
      activeCanvasId: activeCanvasId
    };
    if (!isDefaultSingleNodeCanvas(mainCanvas)) {
      payload.savedCircuitBackup = JSON.parse(JSON.stringify(payload.savedCircuit));
    }
    storage.set(payload);
  }

  // ============================================================================
  // 2. STYLESHEET INJECTION
  // ============================================================================
  const oldStyle = document.getElementById('wms-circuit-styles');
  if (oldStyle) oldStyle.remove();

  const styleEl = document.createElement('style');
  styleEl.id = 'wms-circuit-styles';
  styleEl.textContent = `
    #wms-floating-widget {
      position: fixed;
      top: 20px;
      left: calc(100vw - 290px);
      width: 266px;
      background: #0f172a;
      border: 2px solid #334155;
      border-radius: 12px;
      padding: 10px;
      z-index: 2147483640;
      box-shadow: 0 14px 34px rgba(0,0,0,0.65);
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #f8fafc;
      user-select: none;
      box-sizing: border-box;
    }
    #wms-floating-widget * { box-sizing: border-box; }
    .wms-drag-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e293b;
      padding: 6px 8px;
      border-radius: 7px;
      margin-bottom: 8px;
      cursor: grab;
      font-size: 11px;
      font-weight: 700;
      color: #38bdf8;
      border: 1px solid #334155;
    }
    .wms-drag-bar:active { cursor: grabbing; }
    .wms-drag-actions {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .wms-mini-icon-btn {
      background: #0f172a;
      color: #94a3b8;
      border: 1px solid #334155;
      border-radius: 4px;
      padding: 1px 6px;
      font-size: 11px;
      cursor: pointer;
      line-height: 1.3;
    }
    .wms-mini-icon-btn:hover { color: #f8fafc; border-color: #38bdf8; }
    .wms-clip-label {
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      margin-bottom: 3px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .wms-clip-input {
      width: 100%;
      height: 34px;
      background: #1e293b;
      color: #38bdf8;
      border: 1px solid #475569;
      border-radius: 6px;
      padding: 5px 7px;
      font-size: 12px;
      font-family: monospace;
      resize: none;
      margin-bottom: 8px;
      outline: none;
    }
    .wms-clip-input:focus { border-color: #38bdf8; }
    .wms-btn-row { display: flex; gap: 6px; }
    .wms-btn {
      flex: 1;
      padding: 7px 8px;
      border: none;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
      color: #fff;
      transition: filter 0.15s;
    }
    .wms-btn:hover { filter: brightness(1.12); }
    .wms-btn-studio { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
    .wms-btn-run { background: linear-gradient(135deg, #10b981, #059669); flex: 0 0 68px; }
    #wms-status-line {
      margin-top: 7px;
      font-size: 10px;
      color: #cbd5e1;
      background: #1e293b;
      padding: 5px 7px;
      border-radius: 5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-left: 3px solid #38bdf8;
    }

    /* FULLSCREEN CIRCUIT STUDIO */
    #wms-circuit-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #070b14;
      z-index: 2147483645;
      display: none;
      flex-direction: column;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #f8fafc;
      user-select: none;
    }
    #wms-circuit-overlay * { box-sizing: border-box; }

    /* CANVAS TABS BAR */
    #wms-canvas-tabs-bar {
      height: 38px;
      background: #0b1120;
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
      padding: 0 14px;
      gap: 6px;
      overflow-x: auto;
      z-index: 4;
    }
    .wms-canvas-tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
      border-radius: 6px 6px 0 0;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .wms-canvas-tab.active {
      background: #1e1b4b;
      color: #38bdf8;
      border-color: #6366f1;
    }
    .wms-canvas-tab-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      cursor: pointer;
    }
    .wms-canvas-tab-dot.disabled { background: #64748b; }
    .wms-tab-del {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 11px;
      padding: 0 2px;
    }
    .wms-tab-del:hover { color: #ef4444; }

    /* TOOLBAR */
    #wms-circuit-toolbar {
      min-height: 52px;
      background: #0f172a;
      border-bottom: 2px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 14px;
      gap: 8px;
      flex-wrap: wrap;
      z-index: 3;
    }
    .wms-palette {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .wms-add-node-btn {
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.15);
      font-weight: 700;
      font-size: 11px;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: transform 0.1s;
    }
    .wms-add-node-btn:hover { transform: translateY(-1px); filter: brightness(1.12); }

    #wms-circuit-viewport {
      position: relative;
      flex: 1;
      width: 100%;
      height: calc(100vh - 90px);
      overflow: hidden;
      background-color: #070b14;
      background-image:
        linear-gradient(to right, rgba(56, 189, 248, 0.05) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(56, 189, 248, 0.05) 1px, transparent 1px);
      background-size: 28px 28px;
      cursor: grab;
    }
    #wms-circuit-viewport:active { cursor: grabbing; }

    #wms-circuit-stage {
      position: absolute;
      top: 0;
      left: 0;
      width: 5000px;
      height: 5000px;
      transform-origin: 0 0;
    }

    #wms-wires-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 5000px;
      height: 5000px;
      pointer-events: none;
      z-index: 1;
      overflow: visible;
    }

    .wms-wire-group { pointer-events: stroke; cursor: pointer; }
    .wms-wire-hitbox { fill: none; stroke: transparent; stroke-width: 16px; }
    .wms-wire-line {
      fill: none;
      stroke: #38bdf8;
      stroke-width: 3.5px;
      stroke-linecap: round;
      filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.55));
      transition: stroke 0.15s, stroke-width 0.15s;
    }
    .wms-wire-line.wire-true {
      stroke: #10b981;
      filter: drop-shadow(0 0 5px rgba(16, 185, 129, 0.55));
    }
    .wms-wire-line.wire-false {
      stroke: #f43f5e;
      filter: drop-shadow(0 0 5px rgba(244, 63, 94, 0.55));
    }
    .wms-wire-group:hover .wms-wire-line {
      stroke: #ef4444 !important;
      stroke-width: 5px;
    }

    /* CIRCUIT NODE BLOCK */
    .wms-node {
      position: absolute;
      width: 256px;
      background: #1e293b;
      border: 2px solid #475569;
      border-radius: 10px;
      box-shadow: 0 10px 24px rgba(0,0,0,0.65);
      z-index: 2;
      color: #f8fafc;
      font-size: 12px;
      transition: box-shadow 0.15s, border-color 0.15s;
    }
    .wms-node.node-running {
      border-color: #38bdf8 !important;
      box-shadow: 0 0 24px rgba(56, 189, 248, 0.95) !important;
    }
    .wms-node-header {
      padding: 7px 10px;
      border-radius: 8px 8px 0 0;
      font-weight: 800;
      font-size: 11px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: grab;
      letter-spacing: 0.3px;
    }
    .wms-node-header:active { cursor: grabbing; }
    .wms-node-del {
      background: rgba(0,0,0,0.28);
      border: none;
      color: #fff;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      padding: 1px 6px;
    }
    .wms-node-del:hover { background: #ef4444; }
    .wms-node-body {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .wms-field-label {
      font-size: 10px;
      color: #94a3b8;
      font-weight: 700;
      text-transform: uppercase;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .wms-input, .wms-select, .wms-textarea {
      width: 100%;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 5px 7px;
      font-size: 11px;
      outline: none;
    }
    .wms-textarea {
      font-family: 'Consolas', monospace;
      min-height: 56px;
      resize: vertical;
      color: #a5f3fc;
    }
    .wms-input:focus, .wms-select:focus, .wms-textarea:focus { border-color: #38bdf8; }
    .wms-pick-row {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .wms-pick-btn {
      background: #334155;
      color: #f8fafc;
      border: 1px solid #475569;
      border-radius: 6px;
      padding: 5px 7px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .wms-pick-btn:hover { background: #475569; }
    .wms-pick-btn.zone-active {
      background: #065f46;
      border-color: #10b981;
      color: #d1fae5;
    }
    .wms-zone-pill {
      font-size: 9px;
      background: rgba(16, 185, 129, 0.16);
      border: 1px solid #10b981;
      color: #6ee7b7;
      padding: 2px 6px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* WIRING PINS */
    .wms-pin {
      position: absolute;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #0f172a;
      border: 3px solid #38bdf8;
      cursor: crosshair;
      z-index: 5;
      transition: transform 0.12s, background 0.12s;
    }
    .wms-pin:hover, .wms-pin.pin-selected {
      transform: scale(1.35);
      background: #38bdf8;
      box-shadow: 0 0 10px #38bdf8;
    }
    .wms-pin-in { left: -10px; top: 46px; }
    .wms-pin-out { right: -10px; top: 46px; }
    .wms-pin-true { right: -10px; top: 38px; border-color: #10b981; }
    .wms-pin-true:hover, .wms-pin-true.pin-selected { background: #10b981; box-shadow: 0 0 10px #10b981; }
    .wms-pin-false { right: -10px; top: 76px; border-color: #f43f5e; }
    .wms-pin-false:hover, .wms-pin-false.pin-selected { background: #f43f5e; box-shadow: 0 0 10px #f43f5e; }

    .wms-pin-tag {
      position: absolute;
      right: 12px;
      font-size: 9px;
      font-weight: 800;
      pointer-events: none;
    }
    .wms-pin-tag-true { top: 38px; color: #10b981; }
    .wms-pin-tag-false { top: 76px; color: #f43f5e; }

    /* PICKER & ZONE HIGHLIGHT */
    .wms-picker-highlight {
      outline: 3px solid #f43f5e !important;
      background-color: rgba(244, 63, 94, 0.18) !important;
    }
    #wms-zone-drawer-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      cursor: crosshair;
      background: rgba(15, 23, 42, 0.25);
    }
    #wms-zone-drawer-banner {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #6ee7b7;
      border: 2px solid #10b981;
      border-radius: 999px;
      padding: 8px 18px;
      font-family: 'Segoe UI', sans-serif;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 10px 25px rgba(0,0,0,0.6);
      pointer-events: none;
    }
    .wms-zone-rect-preview {
      position: fixed;
      border: 2px dashed #10b981;
      background: rgba(16, 185, 129, 0.18);
      border-radius: 6px;
      pointer-events: none;
      z-index: 2147483647;
      box-shadow: 0 0 16px rgba(16, 185, 129, 0.45);
    }
  `;
  document.head.appendChild(styleEl);

  // ============================================================================
  // 3. FLOATING WIDGET & CIRCUIT STUDIO OVERLAY
  // ============================================================================
  const oldWidget = document.getElementById('wms-floating-widget');
  if (oldWidget) oldWidget.remove();
  const oldOverlay = document.getElementById('wms-circuit-overlay');
  if (oldOverlay) oldOverlay.remove();

  const widget = document.createElement('div');
  widget.id = 'wms-floating-widget';
  widget.setAttribute('data-rr-ignore', 'true');
  widget.setAttribute('fs-exclude', 'true');
  widget.innerHTML = `
    <div class="wms-drag-bar" id="wms-widget-drag">
      <span>⚡ WMS CIRCUIT</span>
      <div class="wms-drag-actions">
        <span style="font-size:9px; color:#94a3b8; margin-right:2px;">ESC=Stop</span>
        <button class="wms-mini-icon-btn" id="wms-reset-pos-btn" title="Reset Position">⟲</button>
        <button class="wms-mini-icon-btn" id="wms-min-btn" title="Minimize / Expand">—</button>
      </div>
    </div>
    <div id="wms-widget-body">
      <div id="wms-canvas-switcher-row" style="display:none; margin-bottom:6px;">
        <div class="wms-clip-label">
          <span>CANVAS TAB</span>
          <span style="display:flex; gap:3px;">
            <button class="wms-mini-icon-btn" id="wms-prev-canvas-btn" title="Previous Canvas">◀</button>
            <button class="wms-mini-icon-btn" id="wms-next-canvas-btn" title="Next Canvas">▶</button>
          </span>
        </div>
        <select id="wms-widget-canvas-select" class="wms-select" style="font-weight:700; color:#38bdf8;"></select>
      </div>
      <div class="wms-clip-label"><span>BOX 1</span><span>Alt + 1</span></div>
      <textarea id="wms-box1" class="wms-clip-input" placeholder="Highlight + Alt+1 to copy..."></textarea>
      <div class="wms-clip-label"><span>BOX 2</span><span>Alt + 2</span></div>
      <textarea id="wms-box2" class="wms-clip-input" placeholder="Highlight + Alt+2 to copy..."></textarea>
      <div class="wms-btn-row">
        <button id="wms-open-studio-btn" class="wms-btn wms-btn-studio">🧩 Circuit Studio</button>
        <button id="wms-quick-run-btn" class="wms-btn wms-btn-run">▶ Run</button>
      </div>
      <div id="wms-status-line">Ready</div>
    </div>
  `;
  document.body.appendChild(widget);

  const overlay = document.createElement('div');
  overlay.id = 'wms-circuit-overlay';
  overlay.setAttribute('data-rr-ignore', 'true');
  overlay.innerHTML = `
    <div id="wms-canvas-tabs-bar"></div>
    <div id="wms-circuit-toolbar">
      <div class="wms-palette">
        <span style="font-weight:900; font-size:13px; color:#38bdf8; margin-right:4px;">⚡ BLOCKS:</span>
        <button class="wms-add-node-btn" data-add="trigger" style="background:#d97706;">+ ⚡ Trigger</button>
        <button class="wms-add-node-btn" data-add="listener" style="background:#7c3aed;">+ 👂 Listener</button>
        <button class="wms-add-node-btn" data-add="ifelse" style="background:#e11d48;">+ 🔀 If / Else</button>
        <button class="wms-add-node-btn" data-add="click" style="background:#2563eb;">+ 👆 Click</button>
        <button class="wms-add-node-btn" data-add="type" style="background:#059669;">+ ⌨️ Type</button>
        <button class="wms-add-node-btn" data-add="wait" style="background:#475569;">+ ⏳ Wait</button>
        <button class="wms-add-node-btn" data-add="extract" style="background:#0891b2;">+ 📋 Extract</button>
        <button class="wms-add-node-btn" data-add="tabswitch" style="background:#ca8a04;">+ 🗂️ Tab Select</button>
        <button class="wms-add-node-btn" data-add="script" style="background:#0e7490;">+ 💻 Script / Split</button>
      </div>
      <div style="display:flex; gap:6px; align-items:center;">
        <button id="wms-split-messy-btn" class="wms-add-node-btn" style="background:#0e7490;" title="Separate messy or disconnected block chains into their own fresh Canvas tab">✂️ Split Mess to Fresh Canvas</button>
        <button id="wms-test-circuit-btn" class="wms-add-node-btn" style="background:#10b981;">▶ Test Run</button>
        <button id="wms-clear-circuit-btn" class="wms-add-node-btn" style="background:#991b1b;">🗑️ Clear</button>
        <button id="wms-close-studio-btn" class="wms-add-node-btn" style="background:#334155;">✖ Close</button>
      </div>
    </div>
    <div id="wms-circuit-viewport">
      <div id="wms-circuit-stage">
        <svg id="wms-wires-svg"></svg>
        <div id="wms-nodes-layer"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const box1El = document.getElementById('wms-box1');
  const box2El = document.getElementById('wms-box2');
  const statusLine = document.getElementById('wms-status-line');
  const widgetBody = document.getElementById('wms-widget-body');
  const minBtn = document.getElementById('wms-min-btn');
  const resetPosBtn = document.getElementById('wms-reset-pos-btn');
  const canvasSwitcherRow = document.getElementById('wms-canvas-switcher-row');
  const widgetCanvasSelect = document.getElementById('wms-widget-canvas-select');
  const tabsBar = document.getElementById('wms-canvas-tabs-bar');
  const viewport = document.getElementById('wms-circuit-viewport');
  const stage = document.getElementById('wms-circuit-stage');
  const wiresSvg = document.getElementById('wms-wires-svg');
  const nodesLayer = document.getElementById('wms-nodes-layer');

  function setStatus(msg, color = '#38bdf8') {
    if (!statusLine) return;
    statusLine.textContent = msg;
    statusLine.style.borderLeftColor = color;
  }

  function applyFloatingPosition() {
    const maxX = Math.max(10, window.innerWidth - (widget.offsetWidth || 266) - 10);
    const maxY = Math.max(10, window.innerHeight - (widget.offsetHeight || 60) - 10);
    floatingPos.x = Math.min(Math.max(10, floatingPos.x), maxX);
    floatingPos.y = Math.min(Math.max(10, floatingPos.y), maxY);
    widget.style.left = floatingPos.x + 'px';
    widget.style.top = floatingPos.y + 'px';
    widget.style.right = 'auto';
    if (widgetBody) widgetBody.style.display = floatingPos.minimized ? 'none' : 'block';
    if (minBtn) minBtn.textContent = floatingPos.minimized ? '▢' : '—';
  }

  function saveFloatingPosition() {
    storage.set({ wmsFloatingPos: floatingPos });
  }

  // ============================================================================
  // 4. LOAD SAVED CONFIGURATION & CROSS-TAB REGISTRY
  // ============================================================================
  let sharedTabRegistry = {};

  storage.getAll((res) => {
    if (res.box1Data !== undefined) box1El.value = res.box1Data;
    if (res.box2Data !== undefined) box2El.value = res.box2Data;
    if (res.wmsFloatingPos && typeof res.wmsFloatingPos.x === 'number') {
      floatingPos = Object.assign(floatingPos, res.wmsFloatingPos);
    }
    if (res.wmsTabRegistry && typeof res.wmsTabRegistry === 'object') {
      sharedTabRegistry = res.wmsTabRegistry;
    }
    applyFloatingPosition();

    const loadedCanvases = [];

    const primarySaved = (!isDefaultSingleNodeCanvas(res.savedCircuit) && res.savedCircuit)
      || (!isDefaultSingleNodeCanvas(res.savedCircuitBackup) && res.savedCircuitBackup)
      || null;

    if (Array.isArray(res.savedCanvases) && res.savedCanvases.length > 0) {
      res.savedCanvases.forEach((c, i) => {
        loadedCanvases.push(normalizeCanvasObj(c, `Workflow ${i + 1}`, c.id));
      });
    }

    if (primarySaved && Array.isArray(primarySaved.nodes) && primarySaved.nodes.length > 0) {
      const mainNorm = normalizeCanvasObj(primarySaved, 'Main Circuit', 'canvas_main');
      if (loadedCanvases.length === 0) {
        loadedCanvases.push(mainNorm);
      } else if (isDefaultSingleNodeCanvas(loadedCanvases[0])) {
        loadedCanvases[0] = mainNorm;
      } else {
        const existingNodeIds = new Set();
        loadedCanvases.forEach(c => c.nodes.forEach(n => existingNodeIds.add(n.id)));
        const hasUniqueSavedNodes = mainNorm.nodes.some(n => !existingNodeIds.has(n.id));
        if (hasUniqueSavedNodes) {
          mainNorm.id = 'canvas_recovered_main';
          mainNorm.name = 'Saved Flow';
          loadedCanvases.unshift(mainNorm);
        }
      }
    }

    if (loadedCanvases.length === 0) {
      if (res.savedCircuit && Array.isArray(res.savedCircuit.nodes)) {
        loadedCanvases.push(normalizeCanvasObj(res.savedCircuit, 'Main Circuit', 'canvas_main'));
      } else {
        loadedCanvases.push(createBlankCanvas('Main Circuit', 'canvas_main'));
      }
    }

    canvases = loadedCanvases;
    activeCanvasId = (res.activeCanvasId && canvases.some(c => c.id === res.activeCanvasId))
      ? res.activeCanvasId
      : canvases[0].id;
    syncActiveCanvasRef();

    updateTabRegistry();
    renderCanvas();
    setTimeout(checkUrlTriggers, 500);
  });

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.wmsTabRegistry && changes.wmsTabRegistry.newValue) {
          sharedTabRegistry = changes.wmsTabRegistry.newValue;
        }
        if (changes.wmsTabHandoff && changes.wmsTabHandoff.newValue) {
          handleIncomingTabHandoff(changes.wmsTabHandoff.newValue);
        }
        if (isLocalStorageWrite) return;
        if (changes.box1Data) box1El.value = changes.box1Data.newValue || '';
        if (changes.box2Data) box2El.value = changes.box2Data.newValue || '';
        if (changes.savedCanvases && Array.isArray(changes.savedCanvases.newValue)) {
          canvases = changes.savedCanvases.newValue.map((c, i) => normalizeCanvasObj(c, `Workflow ${i + 1}`, c.id));
          syncActiveCanvasRef();
          renderCanvas();
        } else if (changes.savedCircuit && changes.savedCircuit.newValue) {
          canvases[0] = normalizeCanvasObj(changes.savedCircuit.newValue, 'Main Circuit', 'canvas_main');
          syncActiveCanvasRef();
          renderCanvas();
        }
      });
    }
  } catch (_) {}

  box1El.addEventListener('input', () => storage.set({ box1Data: box1El.value }));
  box2El.addEventListener('input', () => storage.set({ box2Data: box2El.value }));

  // ============================================================================
  // 5. DRAGGABLE FLOATING BOX & STUDIO BUTTONS
  // ============================================================================
  let widgetDrag = null;

  widget.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const tag = (e.target.tagName || '').toUpperCase();
    if (['TEXTAREA', 'INPUT', 'BUTTON', 'SELECT', 'OPTION'].includes(tag)) return;
    e.preventDefault();
    const rect = widget.getBoundingClientRect();
    widgetDrag = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
  });

  minBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    floatingPos.minimized = !floatingPos.minimized;
    applyFloatingPosition();
    saveFloatingPosition();
  });

  resetPosBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    floatingPos.x = Math.max(16, window.innerWidth - 290);
    floatingPos.y = 20;
    floatingPos.minimized = false;
    applyFloatingPosition();
    saveFloatingPosition();
    setStatus('Position reset', '#38bdf8');
  });

  window.addEventListener('resize', applyFloatingPosition);

  widgetCanvasSelect.addEventListener('change', (e) => {
    activeCanvasId = e.target.value;
    syncActiveCanvasRef();
    saveCircuit();
    renderCanvas();
    setStatus(`Canvas: ${circuit.name}`, '#38bdf8');
  });

  document.getElementById('wms-prev-canvas-btn').addEventListener('click', () => {
    if (canvases.length <= 1) return;
    const idx = canvases.findIndex(c => c.id === activeCanvasId);
    activeCanvasId = canvases[(idx - 1 + canvases.length) % canvases.length].id;
    syncActiveCanvasRef();
    saveCircuit();
    renderCanvas();
    setStatus(`Canvas: ${circuit.name}`, '#38bdf8');
  });

  document.getElementById('wms-next-canvas-btn').addEventListener('click', () => {
    if (canvases.length <= 1) return;
    const idx = canvases.findIndex(c => c.id === activeCanvasId);
    activeCanvasId = canvases[(idx + 1) % canvases.length].id;
    syncActiveCanvasRef();
    saveCircuit();
    renderCanvas();
    setStatus(`Canvas: ${circuit.name}`, '#38bdf8');
  });

  document.getElementById('wms-open-studio-btn').addEventListener('click', () => {
    updateTabRegistry();
    overlay.style.display = 'flex';
    renderCanvas();
  });

  document.getElementById('wms-close-studio-btn').addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  document.getElementById('wms-quick-run-btn').addEventListener('click', () => {
    runCircuitManually(circuit);
  });

  document.getElementById('wms-test-circuit-btn').addEventListener('click', () => {
    overlay.style.display = 'none';
    runCircuitManually(circuit);
  });

  let clearConfirmTimeout = null;
  const clearBtn = document.getElementById('wms-clear-circuit-btn');
  clearBtn.addEventListener('click', () => {
    if (clearBtn.dataset.confirming !== 'true') {
      clearBtn.dataset.confirming = 'true';
      clearBtn.textContent = '⚠️ Click to Confirm';
      clearConfirmTimeout = setTimeout(() => {
        clearBtn.dataset.confirming = 'false';
        clearBtn.textContent = '🗑️ Clear';
      }, 2500);
      return;
    }
    clearTimeout(clearConfirmTimeout);
    clearBtn.dataset.confirming = 'false';
    clearBtn.textContent = '🗑️ Clear';
    circuit.nodes = [];
    circuit.wires = [];
    circuit.panX = 0;
    circuit.panY = 0;
    saveCircuit();
    renderCanvas();
    setStatus('Canvas cleared', '#f59e0b');
  });

  // ============================================================================
  // 6. SCRIPT / MESSY CIRCUIT SPLITTER TO FRESH CANVAS
  // ============================================================================
  document.getElementById('wms-split-messy-btn').addEventListener('click', () => {
    const count = splitMessyCircuitToFreshCanvas(circuit);
    if (count > 0) {
      saveCircuit();
      renderCanvas();
      setStatus(`Separated ${count} chain(s) into fresh Canvas tab(s)!`, '#10b981');
    } else {
      autoOrganizeNodes(circuit);
      saveCircuit();
      renderCanvas();
      setStatus('Layout tidied! (Use 💻 Script block ✂️ to split at a specific step)', '#38bdf8');
    }
  });

  function splitDownstreamFromScriptBlock(sourceCanvas, scriptNode) {
    const downstreamIds = new Set();
    const queue = [];
    sourceCanvas.wires.forEach(w => {
      if (w.from === scriptNode.id) queue.push(w.to);
    });

    while (queue.length > 0) {
      const curr = queue.shift();
      if (!curr || curr === scriptNode.id || downstreamIds.has(curr)) continue;
      downstreamIds.add(curr);
      sourceCanvas.wires.forEach(w => {
        if (w.from === curr && !downstreamIds.has(w.to)) queue.push(w.to);
      });
    }

    if (downstreamIds.size === 0) {
      setStatus('Wire blocks to the right of this Script block first!', '#f59e0b');
      return;
    }

    const freshName = `Fresh Canvas ${canvases.length + 1}`;
    const fresh = createBlankCanvas(freshName);
    fresh.nodes = sourceCanvas.nodes.filter(n => downstreamIds.has(n.id));
    fresh.wires = sourceCanvas.wires.filter(w => downstreamIds.has(w.from) && downstreamIds.has(w.to));

    sourceCanvas.nodes = sourceCanvas.nodes.filter(n => !downstreamIds.has(n.id));
    sourceCanvas.wires = sourceCanvas.wires.filter(w => !downstreamIds.has(w.from) && !downstreamIds.has(w.to));

    autoOrganizeNodes(fresh);
    canvases.push(fresh);

    scriptNode.data.preset = 'run_canvas';
    scriptNode.data.targetCanvasId = fresh.id;

    saveCircuit();
    renderCanvas();
    setStatus(`Moved ${downstreamIds.size} block(s) to "${freshName}"!`, '#10b981');
  }

  function splitMessyCircuitToFreshCanvas(targetCanvas) {
    if (!targetCanvas || targetCanvas.nodes.length <= 1) return 0;

    const adj = {};
    targetCanvas.nodes.forEach(n => { adj[n.id] = new Set(); });
    targetCanvas.wires.forEach(w => {
      if (adj[w.from] && adj[w.to]) {
        adj[w.from].add(w.to);
        adj[w.to].add(w.from);
      }
    });

    const visited = new Set();
    const groups = [];
    targetCanvas.nodes.forEach(n => {
      if (visited.has(n.id)) return;
      const comp = new Set();
      const q = [n.id];
      while (q.length > 0) {
        const curr = q.shift();
        if (visited.has(curr)) continue;
        visited.add(curr);
        comp.add(curr);
        (adj[curr] || []).forEach(nb => {
          if (!visited.has(nb)) q.push(nb);
        });
      }
      groups.push(comp);
    });

    if (groups.length > 1) {
      let splitCount = 0;
      for (let i = 1; i < groups.length; i++) {
        const ids = groups[i];
        const fresh = createBlankCanvas(`Fresh Canvas ${canvases.length + 1}`);
        fresh.nodes = targetCanvas.nodes.filter(n => ids.has(n.id));
        fresh.wires = targetCanvas.wires.filter(w => ids.has(w.from) && ids.has(w.to));
        autoOrganizeNodes(fresh);
        canvases.push(fresh);

        targetCanvas.nodes = targetCanvas.nodes.filter(n => !ids.has(n.id));
        targetCanvas.wires = targetCanvas.wires.filter(w => !ids.has(w.from) && !ids.has(w.to));
        splitCount++;
      }
      autoOrganizeNodes(targetCanvas);
      return splitCount;
    }

    if (targetCanvas.nodes.length >= 6) {
      autoOrganizeNodes(targetCanvas);
      const sorted = [...targetCanvas.nodes].sort((a, b) => a.x - b.x);
      const midNode = sorted[Math.floor(sorted.length / 2) - 1];
      if (midNode) {
        const scriptId = 'n_' + Date.now() + '_split';
        const scriptNode = {
          id: scriptId,
          type: 'script',
          x: midNode.x + 280,
          y: midNode.y,
          data: { preset: 'run_canvas', targetCanvasId: '', code: 'return true;' }
        };
        targetCanvas.nodes.push(scriptNode);
        targetCanvas.wires.forEach(w => {
          if (w.from === midNode.id) w.from = scriptId;
        });
        targetCanvas.wires.push({
          id: 'w_' + Date.now() + '_link',
          from: midNode.id,
          fromPort: (midNode.type === 'ifelse' || midNode.type === 'script') ? 'true' : 'out',
          to: scriptId
        });
        splitDownstreamFromScriptBlock(targetCanvas, scriptNode);
        return 1;
      }
    }

    return 0;
  }

  function autoOrganizeNodes(targetCanvas) {
    if (!targetCanvas || !targetCanvas.nodes.length) return;
    const depth = {};
    targetCanvas.nodes.forEach(n => {
      depth[n.id] = (n.type === 'trigger' || n.type === 'listener') ? 0 : 1;
    });
    for (let i = 0; i < targetCanvas.nodes.length; i++) {
      targetCanvas.wires.forEach(w => {
        if (depth[w.from] !== undefined) {
          depth[w.to] = Math.max(depth[w.to] || 0, depth[w.from] + 1);
        }
      });
    }
    const cols = {};
    targetCanvas.nodes.forEach(n => {
      const c = depth[n.id] || 0;
      if (!cols[c]) cols[c] = [];
      cols[c].push(n);
    });
    Object.keys(cols).forEach(cKey => {
      const cIdx = Number(cKey);
      cols[cKey].forEach((node, rIdx) => {
        node.x = 50 + cIdx * 300;
        node.y = 80 + rIdx * 220;
      });
    });
    targetCanvas.panX = 0;
    targetCanvas.panY = 0;
  }

  // ============================================================================
  // 7. BLOCK DEFINITIONS & RENDERING (ALL 9 BLOCKS)
  // ============================================================================
  const NODE_META = {
    trigger:   { title: '⚡ TRIGGER',             color: '#d97706', hasIn: false, outType: 'single' },
    listener:  { title: '👂 EVENT LISTENER',      color: '#7c3aed', hasIn: false, outType: 'single' },
    ifelse:    { title: '🔀 IF / ELSE',           color: '#e11d48', hasIn: true,  outType: 'branch' },
    click:     { title: '👆 CLICK TARGET',        color: '#2563eb', hasIn: true,  outType: 'single' },
    type:      { title: '⌨️ TYPE TEXT',           color: '#059669', hasIn: true,  outType: 'single' },
    wait:      { title: '⏳ WAIT',                color: '#475569', hasIn: true,  outType: 'single' },
    extract:   { title: '📋 EXTRACT DATA',        color: '#0891b2', hasIn: true,  outType: 'single' },
    tabswitch: { title: '🗂️ TAB SELECT',          color: '#ca8a04', hasIn: true,  outType: 'single' },
    script:    { title: '💻 SCRIPT / SPLIT',      color: '#0e7490', hasIn: true,  outType: 'branch' }
  };

  document.querySelectorAll('.wms-add-node-btn[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      syncActiveCanvasRef();
      const type = btn.getAttribute('data-add');
      const id = 'n_' + Date.now() + '_' + Math.floor(Math.random() * 999);
      const offset = (circuit.nodes.length % 6) * 28;

      const defaults = {
        trigger:   { triggerType: 'hotkey', value: 'Alt+W', zone: null },
        listener:  { selector: '', zone: null, eventType: 'contains', targetVal: '' },
        ifelse:    { selector: '', zone: null, condition: 'exists', value: '' },
        click:     { selector: '', zone: null },
        type:      { selector: '', zone: null, source: 'box1', customText: '', pressEnter: true },
        wait:      { waitType: 'element', selector: '', zone: null, ms: '500', textVal: '' },
        extract:   { selector: '', zone: null, targetBox: 'box1' },
        tabswitch: { tabMode: 'wms_tab', selector: '', targetValue: '', zone: null, targetCanvasId: '', runAfterSwitch: true },
        script:    { preset: 'run_canvas', targetCanvasId: '', code: '// Available: box1, box2, setBox1(v), setBox2(v), clickText("OK"), switchTab("Putaway")\nreturn true;' }
      };

      circuit.nodes.push({
        id,
        type,
        x: Math.max(40, 140 - (circuit.panX || 0) + offset),
        y: Math.max(40, 90 - (circuit.panY || 0) + offset),
        data: JSON.parse(JSON.stringify(defaults[type]))
      });

      saveCircuit();
      renderCanvas();
    });
  });

  function renderTabsBar() {
    tabsBar.innerHTML = '';
    canvases.forEach((c) => {
      const tab = document.createElement('div');
      tab.className = 'wms-canvas-tab' + (c.id === activeCanvasId ? ' active' : '');
      tab.innerHTML = `
        <span class="wms-canvas-tab-dot ${c.enabled ? '' : 'disabled'}" title="${c.enabled ? 'Enabled (Click to pause)' : 'Paused (Click to enable)'}"></span>
        <span class="wms-tab-name">${escapeHtml(c.name)}</span>
        <span style="font-size:10px; color:#64748b;">(${c.nodes.length})</span>
        ${canvases.length > 1 ? `<button class="wms-tab-del" title="Delete Canvas Tab">✖</button>` : ''}
      `;

      tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('wms-canvas-tab-dot') || e.target.classList.contains('wms-tab-del')) return;
        activeCanvasId = c.id;
        syncActiveCanvasRef();
        saveCircuit();
        renderCanvas();
      });

      tab.querySelector('.wms-tab-name').addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = c.name;
        inp.className = 'wms-input';
        inp.style.width = '105px';
        inp.style.padding = '2px 5px';
        e.target.replaceWith(inp);
        inp.focus();
        inp.select();
        const saveName = () => {
          c.name = inp.value.trim() || c.name;
          saveCircuit();
          renderCanvas();
        };
        inp.addEventListener('blur', saveName);
        inp.addEventListener('keydown', (ke) => { if (ke.key === 'Enter') saveName(); });
      });

      tab.querySelector('.wms-canvas-tab-dot').addEventListener('click', (e) => {
        e.stopPropagation();
        c.enabled = !c.enabled;
        saveCircuit();
        renderCanvas();
      });

      const delBtn = tab.querySelector('.wms-tab-del');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (canvases.length <= 1) return;
          canvases = canvases.filter(item => item.id !== c.id);
          if (activeCanvasId === c.id) activeCanvasId = canvases[0].id;
          syncActiveCanvasRef();
          saveCircuit();
          renderCanvas();
        });
      }

      tabsBar.appendChild(tab);
    });

    const addTabBtn = document.createElement('button');
    addTabBtn.className = 'wms-add-node-btn';
    addTabBtn.style.background = '#1e293b';
    addTabBtn.style.borderColor = '#38bdf8';
    addTabBtn.style.color = '#38bdf8';
    addTabBtn.textContent = '+ Fresh Canvas';
    addTabBtn.addEventListener('click', () => {
      const fresh = createBlankCanvas(`Canvas ${canvases.length + 1}`);
      canvases.push(fresh);
      activeCanvasId = fresh.id;
      syncActiveCanvasRef();
      saveCircuit();
      renderCanvas();
      setStatus(`Created "${fresh.name}"`, '#10b981');
    });
    tabsBar.appendChild(addTabBtn);

    if (canvasSwitcherRow && widgetCanvasSelect) {
      canvasSwitcherRow.style.display = canvases.length > 1 ? 'block' : 'none';
      widgetCanvasSelect.innerHTML = canvases.map(c =>
        `<option value="${c.id}" ${c.id === activeCanvasId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
      ).join('');
    }
  }

  function renderCanvas() {
    syncActiveCanvasRef();
    renderTabsBar();

    stage.style.transform = `translate(${circuit.panX || 0}px, ${circuit.panY || 0}px)`;
    nodesLayer.innerHTML = '';

    circuit.nodes.forEach(node => {
      const meta = NODE_META[node.type] || NODE_META.click;
      const el = document.createElement('div');
      el.className = 'wms-node';
      el.id = node.id;
      el.style.left = node.x + 'px';
      el.style.top = node.y + 'px';

      let pinsHtml = '';
      if (meta.hasIn) {
        pinsHtml += `<div class="wms-pin wms-pin-in" data-node="${node.id}" data-port="in" title="Input Port"></div>`;
      }
      if (meta.outType === 'single') {
        pinsHtml += `<div class="wms-pin wms-pin-out" data-node="${node.id}" data-port="out" title="Output Port"></div>`;
      } else if (meta.outType === 'branch') {
        pinsHtml += `
          <span class="wms-pin-tag wms-pin-tag-true">TRUE</span>
          <div class="wms-pin wms-pin-true" data-node="${node.id}" data-port="true" title="True Output"></div>
          <span class="wms-pin-tag wms-pin-tag-false">FALSE</span>
          <div class="wms-pin wms-pin-false" data-node="${node.id}" data-port="false" title="False Output"></div>
        `;
      }

      el.innerHTML = `
        <div class="wms-node-header" style="background:${meta.color};">
          <span>${meta.title}</span>
          <button class="wms-node-del" title="Delete Block">✖</button>
        </div>
        ${pinsHtml}
        <div class="wms-node-body">${buildNodeFields(node)}</div>
      `;

      el.querySelector('.wms-node-del').addEventListener('click', (e) => {
        e.stopPropagation();
        circuit.nodes = circuit.nodes.filter(n => n.id !== node.id);
        circuit.wires = circuit.wires.filter(w => w.from !== node.id && w.to !== node.id);
        saveCircuit();
        renderCanvas();
      });

      bindNodeEvents(el, node);
      nodesLayer.appendChild(el);
    });

    renderWires();
  }

  function renderZonePillHtml(zone) {
    if (!zone) return '';
    return `
      <div class="wms-zone-pill">
        <span>🛡️ Zone Lock (${Math.round(zone.xPct)}%, ${Math.round(zone.yPct)}%)</span>
        <span style="display:flex; gap:3px;">
          <button class="wms-mini-icon-btn" data-preview-zone="true" title="Highlight Zone on Screen">👁️</button>
          <button class="wms-mini-icon-btn" data-clear-zone="true" title="Clear Zone">✖</button>
        </span>
      </div>
    `;
  }

  function buildBrowserTabPresetOptionsHtml(currentVal) {
    const openTabs = getKnownOpenTabs();
    return `
      <option value="">-- Select Open Tab or Shortcut --</option>
      <option value="[[NEXT_TAB]]" ${currentVal === '[[NEXT_TAB]]' ? 'selected' : ''}>➡️ Next Browser Tab</option>
      <option value="[[PREV_TAB]]" ${currentVal === '[[PREV_TAB]]' ? 'selected' : ''}>⬅️ Previous Browser Tab</option>
      <option value="[[LAST_TAB]]" ${currentVal === '[[LAST_TAB]]' ? 'selected' : ''}>🔙 Last Active Browser Tab</option>
      ${openTabs.map(t => `<option value="${escapeAttr(t.matchValue)}" ${currentVal === t.matchValue ? 'selected' : ''}>🟢 ${escapeHtml(t.label)}</option>`).join('')}
    `;
  }

  function buildNodeFields(node) {
    const d = node.data;

    if (node.type === 'trigger') {
      return `
        <div class="wms-field-label">When to Start</div>
        <select class="wms-select" data-key="triggerType">
          <option value="hotkey" ${d.triggerType === 'hotkey' ? 'selected' : ''}>⌨️ Keyboard Shortcut</option>
          <option value="element" ${d.triggerType === 'element' ? 'selected' : ''}>⚡ Passive Element Appears</option>
          <option value="url" ${d.triggerType === 'url' ? 'selected' : ''}>🌐 Auto URL Match</option>
        </select>
        <div class="wms-pick-row">
          <input type="text" class="wms-input" data-key="value" value="${escapeAttr(d.value || '')}" placeholder="${d.triggerType === 'hotkey' ? 'Press keys...' : d.triggerType === 'url' ? '/wms/pack' : 'Pick element...'}" ${d.triggerType === 'hotkey' ? 'readonly' : ''}>
          ${d.triggerType === 'element' ? `
            <button class="wms-pick-btn" data-pick="value" title="Pick Element">🎯</button>
            <button class="wms-pick-btn ${d.zone ? 'zone-active' : ''}" data-draw-zone="true" title="Draw Zone Fallback">🔲</button>
          ` : ''}
        </div>
        ${d.triggerType === 'element' ? renderZonePillHtml(d.zone) : ''}
        <button class="wms-pick-btn" data-run-trigger="true" style="background:#10b981; border-color:#059669; color:#fff; margin-top:2px;">▶ Run This Trigger</button>
      `;
    }

    if (node.type === 'listener') {
      return `
        <div class="wms-field-label">Target Element / Zone</div>
        <div class="wms-pick-row">
          <input type="text" class="wms-input" data-key="selector" value="${escapeAttr(d.selector || '')}" placeholder="Pick element or draw zone...">
          <button class="wms-pick-btn" data-pick="selector" title="Pick Element (also saves Zone backup)">🎯 Pick</button>
          <button class="wms-pick-btn ${d.zone ? 'zone-active' : ''}" data-draw-zone="true" title="Draw Screen Zone so DOM changes don't break it">🔲</button>
        </div>
        ${renderZonePillHtml(d.zone)}
        <div class="wms-field-label">Listen For</div>
        <select class="wms-select" data-key="eventType">
          <option value="contains" ${d.eventType === 'contains' ? 'selected' : ''}>🔤 Text Contains</option>
          <option value="equals" ${d.eventType === 'equals' ? 'selected' : ''}>🟰 Text Equals</option>
          <option value="gt" ${d.eventType === 'gt' ? 'selected' : ''}>🔢 Number &gt; Value</option>
          <option value="lt" ${d.eventType === 'lt' ? 'selected' : ''}>🔉 Number &lt; Value</option>
          <option value="length" ${d.eventType === 'length' ? 'selected' : ''}>🏷️ Barcode / Input Length &gt;=</option>
          <option value="change" ${d.eventType === 'change' ? 'selected' : ''}>🔄 Any Target / Zone Change</option>
        </select>
        ${d.eventType !== 'change' ? `
          <input type="text" class="wms-input" data-key="targetVal" value="${escapeAttr(d.targetVal || '')}" placeholder="Value to match...">
        ` : ''}
      `;
    }

    if (node.type === 'ifelse') {
      return `
        <div class="wms-field-label">Check Element / Zone</div>
        <div class="wms-pick-row">
          <input type="text" class="wms-input" data-key="selector" value="${escapeAttr(d.selector || '')}" placeholder="Pick element or draw zone...">
          <button class="wms-pick-btn" data-pick="selector" title="Pick Element (auto-saves Zone backup)">🎯 Pick</button>
          <button class="wms-pick-btn ${d.zone ? 'zone-active' : ''}" data-draw-zone="true" title="Draw Zone (Works even if WMS element changes)">🔲 Zone</button>
        </div>
        ${renderZonePillHtml(d.zone)}
        <div class="wms-field-label">If Condition</div>
        <select class="wms-select" data-key="condition">
          <option value="exists" ${d.condition === 'exists' ? 'selected' : ''}>✔️ Exists &amp; Visible (Element or Zone)</option>
          <option value="not_exists" ${d.condition === 'not_exists' ? 'selected' : ''}>❌ Not Exists / Hidden</option>
          <option value="contains" ${d.condition === 'contains' ? 'selected' : ''}>🔤 Text Contains</option>
          <option value="equals" ${d.condition === 'equals' ? 'selected' : ''}>🟰 Text Equals</option>
          <option value="gt" ${d.condition === 'gt' ? 'selected' : ''}>📈 Number Greater Than (&gt;)</option>
          <option value="lt" ${d.condition === 'lt' ? 'selected' : ''}>📉 Number Less Than (&lt;)</option>
          <option value="changed" ${d.condition === 'changed' ? 'selected' : ''}>🔄 Content Changed (No Reassign)</option>
        </select>
        ${(d.condition !== 'exists' && d.condition !== 'not_exists' && d.condition !== 'changed') ? `
          <input type="text" class="wms-input" data-key="value" value="${escapeAttr(d.value || '')}" placeholder="Expected value...">
        ` : ''}
      `;
    }

    if (node.type === 'click') {
      return `
        <div class="wms-field-label">Target to Click</div>
        <div class="wms-pick-row">
          <input type="text" class="wms-input" data-key="selector" value="${escapeAttr(d.selector || '')}" placeholder="Button selector...">
          <button class="wms-pick-btn" data-pick="selector" title="Pick Button">🎯 Pick</button>
          <button class="wms-pick-btn ${d.zone ? 'zone-active' : ''}" data-draw-zone="true" title="Draw Zone Fallback">🔲</button>
        </div>
        ${renderZonePillHtml(d.zone)}
      `;
    }

    if (node.type === 'type') {
      return `
        <div class="wms-field-label">Target Input Field</div>
        <div class="wms-pick-row">
          <input type="text" class="wms-input" data-key="selector" value="${escapeAttr(d.selector || '')}" placeholder="Input selector...">
          <button class="wms-pick-btn" data-pick="selector">🎯 Pick</button>
          <button class="wms-pick-btn ${d.zone ? 'zone-active' : ''}" data-draw-zone="true" title="Draw Zone Fallback">🔲</button>
        </div>
        ${renderZonePillHtml(d.zone)}
        <div class="wms-field-label">Text Source</div>
        <select class="wms-select" data-key="source">
          <option value="box1" ${d.source === 'box1' ? 'selected' : ''}>📋 Box 1 Data</option>
          <option value="box2" ${d.source === 'box2' ? 'selected' : ''}>📋 Box 2 Data</option>
          <option value="custom" ${d.source === 'custom' ? 'selected' : ''}>✏️ Custom Text</option>
        </select>
        ${d.source === 'custom' ? `<input type="text" class="wms-input" data-key="customText" value="${escapeAttr(d.customText || '')}" placeholder="Custom text to type...">` : ''}
        <label style="font-size:10px; color:#cbd5e1; display:flex; align-items:center; gap:5px; cursor:pointer;">
          <input type="checkbox" data-key="pressEnter" ${d.pressEnter !== false ? 'checked' : ''}> Press Enter After Typing
        </label>
      `;
    }

    if (node.type === 'wait') {
      return `
        <div class="wms-field-label">Wait Type</div>
        <select class="wms-select" data-key="waitType">
          <option value="element" ${d.waitType === 'element' ? 'selected' : ''}>🎯 Wait for Element / Zone</option>
          <option value="time" ${d.waitType === 'time' ? 'selected' : ''}>⏱️ Wait Fixed Time (ms)</option>
          <option value="zone_change" ${d.waitType === 'zone_change' ? 'selected' : ''}>🔲 Wait for Zone Content to Change</option>
          <option value="zone_appear" ${d.waitType === 'zone_appear' ? 'selected' : ''}>🔲 Wait for Any Element in Zone</option>
          <option value="zone_text" ${d.waitType === 'zone_text' ? 'selected' : ''}>🔲 Wait for Specific Text in Zone</option>
        </select>
        ${d.waitType === 'time' ? `
          <input type="number" class="wms-input" data-key="ms" value="${escapeAttr(d.ms || '500')}" placeholder="Milliseconds (e.g. 500)">
        ` : `
          <div class="wms-pick-row">
            <input type="text" class="wms-input" data-key="selector" value="${escapeAttr(d.selector || '')}" placeholder="Pick element or draw zone...">
            <button class="wms-pick-btn" data-pick="selector" title="Pick Element (also saves Zone backup)">🎯 Pick</button>
            <button class="wms-pick-btn ${d.zone ? 'zone-active' : ''}" data-draw-zone="true" title="Draw Screen Zone (Works without reassigning if element changes)">🔲 Zone</button>
          </div>
          ${renderZonePillHtml(d.zone)}
          ${d.waitType === 'zone_text' ? `<input type="text" class="wms-input" data-key="textVal" value="${escapeAttr(d.textVal || '')}" placeholder="Text to wait for in zone...">` : ''}
        `}
      `;
    }

    if (node.type === 'extract') {
      return `
        <div class="wms-field-label">Element to Copy From</div>
        <div class="wms-pick-row">
          <input type="text" class="wms-input" data-key="selector" value="${escapeAttr(d.selector || '')}" placeholder="Target selector...">
          <button class="wms-pick-btn" data-pick="selector">🎯 Pick</button>
          <button class="wms-pick-btn ${d.zone ? 'zone-active' : ''}" data-draw-zone="true" title="Draw Zone Fallback">🔲</button>
        </div>
        ${renderZonePillHtml(d.zone)}
        <div class="wms-field-label">Save Into</div>
        <select class="wms-select" data-key="targetBox">
          <option value="box1" ${d.targetBox === 'box1' ? 'selected' : ''}>📋 Box 1</option>
          <option value="box2" ${d.targetBox === 'box2' ? 'selected' : ''}>📋 Box 2</option>
        </select>
      `;
    }

    if (node.type === 'tabswitch') {
      const tabMode = d.tabMode || 'wms_tab';
      const otherCanvases = canvases.filter(c => c.id !== activeCanvasId);
      return `
        <div class="wms-field-label">Move To Tab</div>
        <select class="wms-select" data-key="tabMode">
          <option value="wms_tab" ${tabMode === 'wms_tab' ? 'selected' : ''}>📑 In-Page WMS Tab</option>
          <option value="browser_tab" ${tabMode === 'browser_tab' ? 'selected' : ''}>🌐 Browser Tab (URL / Title)</option>
          <option value="canvas_tab" ${tabMode === 'canvas_tab' ? 'selected' : ''}>🧩 Circuit Canvas Tab</option>
        </select>
        ${tabMode === 'wms_tab' ? `
          <div class="wms-pick-row">
            <input type="text" class="wms-input" data-key="targetValue" value="${escapeAttr(d.targetValue || d.selector || '')}" placeholder="Tab text (e.g. Putaway) or Pick...">
            <button class="wms-pick-btn" data-pick="selector" title="Pick Tab Element">🎯 Pick</button>
            <button class="wms-pick-btn ${d.zone ? 'zone-active' : ''}" data-draw-zone="true" title="Draw Tab Bar Zone">🔲</button>
          </div>
          ${renderZonePillHtml(d.zone)}
        ` : tabMode === 'browser_tab' ? `
          <div class="wms-field-label">Quick Pick Open Tab</div>
          <select class="wms-select" data-browser-tab-preset="true">
            ${buildBrowserTabPresetOptionsHtml(d.targetValue)}
          </select>
          <div class="wms-pick-row">
            <input type="text" class="wms-input" data-key="targetValue" value="${escapeAttr(d.targetValue || '')}" placeholder="Title, URL, or Tab #...">
            <button class="wms-pick-btn" data-link-browser-tab="true" title="Link/Open Tab once so single-script switching works natively">🔗 Link</button>
            <button class="wms-pick-btn" data-test-browser-tab="true" title="Test switching to this browser tab now">↗️</button>
          </div>
        ` : `
          <select class="wms-select" data-key="targetCanvasId">
            <option value="">-- Choose Canvas Tab --</option>
            ${otherCanvases.map(c => `<option value="${c.id}" ${d.targetCanvasId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
          <label style="font-size:10px; color:#cbd5e1; display:flex; align-items:center; gap:5px; cursor:pointer;">
            <input type="checkbox" data-key="runAfterSwitch" ${d.runAfterSwitch !== false ? 'checked' : ''}> Run That Canvas Immediately
          </label>
        `}
      `;
    }

    if (node.type === 'script') {
      const preset = d.preset || 'run_canvas';
      const otherCanvases = canvases.filter(c => c.id !== activeCanvasId);
      return `
        <button class="wms-pick-btn zone-active" data-split-downstream="true" style="width:100%; text-align:center;">✂️ Move Wired Blocks to Fresh Canvas</button>
        <div class="wms-field-label">Script Action</div>
        <select class="wms-select" data-key="preset">
          <option value="run_canvas" ${preset === 'run_canvas' ? 'selected' : ''}>🚀 Run Another Fresh Canvas</option>
          <option value="custom" ${preset === 'custom' ? 'selected' : ''}>💻 Custom JS Code</option>
          <option value="inc_box1" ${preset === 'inc_box1' ? 'selected' : ''}>➕ Increment Number in Box 1 (+1)</option>
        </select>
        ${preset === 'run_canvas' ? `
          <div class="wms-pick-row">
            <select class="wms-select" data-key="targetCanvasId">
              <option value="">-- Select Fresh Canvas --</option>
              ${otherCanvases.map(c => `<option value="${c.id}" ${d.targetCanvasId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
            ${d.targetCanvasId ? `<button class="wms-pick-btn" data-jump-canvas="${escapeAttr(d.targetCanvasId)}" title="Switch to that Canvas Tab">↗️</button>` : ''}
          </div>
        ` : preset === 'custom' ? `
          <textarea class="wms-textarea" data-key="code" placeholder="return true;">${escapeHtml(d.code || '')}</textarea>
        ` : ''}
      `;
    }

    return '';
  }

  function bindNodeEvents(el, node) {
    el.querySelectorAll('[data-key]').forEach(input => {
      const key = input.getAttribute('data-key');

      if (node.type === 'trigger' && key === 'value' && node.data.triggerType === 'hotkey') {
        input.addEventListener('keydown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const combo = formatKeyCombo(e);
          if (!combo) return;
          node.data.value = combo;
          input.value = combo;
          saveCircuit();
        });
        return;
      }

      const evtName = (input.tagName === 'SELECT' || input.type === 'checkbox') ? 'change' : 'input';
      input.addEventListener(evtName, (e) => {
        node.data[key] = input.type === 'checkbox' ? input.checked : e.target.value;
        saveCircuit();
        if (input.tagName === 'SELECT') renderCanvas();
      });
    });

    el.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetKey = btn.getAttribute('data-pick');
        startElementPicker(node.type, (selector, autoZone, pickedEl) => {
          node.data[targetKey] = selector;
          if (autoZone) {
            node.data.zone = autoZone;
            node.data.expectedTag = pickedEl ? pickedEl.tagName : '';
            node.data.expectedText = pickedEl ? (pickedEl.textContent || pickedEl.value || '').trim().slice(0, 40) : '';
          }
          if (node.type === 'tabswitch' && pickedEl && !node.data.targetValue) {
            node.data.targetValue = (pickedEl.textContent || pickedEl.value || '').trim();
          }
          saveCircuit();
          renderCanvas();
        });
      });
    });

    const drawZoneBtn = el.querySelector('[data-draw-zone]');
    if (drawZoneBtn) {
      drawZoneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startZoneDrawer((zoneRect) => {
          node.data.zone = zoneRect;
          node.data._lastSeenText = zoneRect.baselineText || '';
          saveCircuit();
          renderCanvas();
        });
      });
    }

    const previewZoneBtn = el.querySelector('[data-preview-zone]');
    if (previewZoneBtn) {
      previewZoneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!node.data.zone) return;
        overlay.style.display = 'none';
        flashZoneRect(node.data.zone, 1200, () => {
          overlay.style.display = 'flex';
        });
      });
    }

    const clearZoneBtn = el.querySelector('[data-clear-zone]');
    if (clearZoneBtn) {
      clearZoneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        node.data.zone = null;
        saveCircuit();
        renderCanvas();
      });
    }

    const runTrigBtn = el.querySelector('[data-run-trigger]');
    if (runTrigBtn) {
      runTrigBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        overlay.style.display = 'none';
        executeFromNode(circuit, node.id);
      });
    }

    const splitBtn = el.querySelector('[data-split-downstream]');
    if (splitBtn) {
      splitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        splitDownstreamFromScriptBlock(circuit, node);
      });
    }

    const jumpBtn = el.querySelector('[data-jump-canvas]');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = jumpBtn.getAttribute('data-jump-canvas');
        if (tid && canvases.some(c => c.id === tid)) {
          activeCanvasId = tid;
          syncActiveCanvasRef();
          saveCircuit();
          renderCanvas();
        }
      });
    }

    // Patched Bug: Update dropdown options in-place on mousedown/focus without destroying the select element
    const tabPresetSel = el.querySelector('[data-browser-tab-preset]');
    if (tabPresetSel) {
      tabPresetSel.addEventListener('mousedown', () => {
        refreshOpenTabsFromBackground();
        tabPresetSel.innerHTML = buildBrowserTabPresetOptionsHtml(node.data.targetValue);
      });
      tabPresetSel.addEventListener('change', (e) => {
        if (!e.target.value) return;
        node.data.targetValue = e.target.value;
        const textInp = el.querySelector('[data-key="targetValue"]');
        if (textInp) textInp.value = e.target.value;
        saveCircuit();
      });
    }

    const linkTabBtn = el.querySelector('[data-link-browser-tab]');
    if (linkTabBtn) {
      linkTabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        linkOrOpenBrowserTab(node.data.targetValue);
      });
    }

    const testTabBtn = el.querySelector('[data-test-browser-tab]');
    if (testTabBtn) {
      testTabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        executeTabSwitch(node, 0, null);
      });
    }

    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const tag = (e.target.tagName || '').toUpperCase();
      if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'OPTION', 'LABEL'].includes(tag)) return;
      if (e.target.classList.contains('wms-pin')) return;
      e.stopPropagation();
      activeDragNode = {
        node,
        el,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startNodeX: node.x,
        startNodeY: node.y
      };
    });

    el.querySelectorAll('.wms-pin').forEach(pin => {
      pin.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const nodeId = pin.getAttribute('data-node');
        const port = pin.getAttribute('data-port');
        beginWiringInteraction(nodeId, port, pin);
      });

      pin.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        const nodeId = pin.getAttribute('data-node');
        const port = pin.getAttribute('data-port');
        completeWiringInteraction(nodeId, port);
      });
    });
  }

  // ============================================================================
  // 8. DRAGGING & WIRING ENGINE
  // ============================================================================
  let activeDragNode = null;
  let activeCanvasPan = null;
  let activeWireStart = null;

  function beginWiringInteraction(nodeId, port, pinEl) {
    if (activeWireStart && activeWireStart.nodeId !== nodeId) {
      completeWiringInteraction(nodeId, port);
      return;
    }
    document.querySelectorAll('.wms-pin.pin-selected').forEach(p => p.classList.remove('pin-selected'));
    pinEl.classList.add('pin-selected');

    const startPt = getPinStageCoords(nodeId, port);
    activeWireStart = {
      nodeId,
      port,
      x: startPt.x,
      y: startPt.y,
      currX: startPt.x,
      currY: startPt.y,
      isDragging: true
    };
    renderWires();
  }

  function completeWiringInteraction(targetNodeId, targetPort) {
    if (!activeWireStart) return;
    const src = activeWireStart;

    if (src.nodeId === targetNodeId) {
      activeWireStart.isDragging = false;
      return;
    }

    let fromNode = null, fromPort = null, toNode = null;
    if (src.port !== 'in' && targetPort === 'in') {
      fromNode = src.nodeId;
      fromPort = src.port;
      toNode = targetNodeId;
    } else if (src.port === 'in' && targetPort !== 'in') {
      fromNode = targetNodeId;
      fromPort = targetPort;
      toNode = src.nodeId;
    }

    if (fromNode && toNode) {
      circuit.wires = circuit.wires.filter(w => !(w.from === fromNode && w.fromPort === fromPort && w.to === toNode));
      circuit.wires.push({
        id: 'w_' + Date.now() + '_' + Math.floor(Math.random() * 999),
        from: fromNode,
        fromPort: fromPort,
        to: toNode
      });
      saveCircuit();
    }

    document.querySelectorAll('.wms-pin.pin-selected').forEach(p => p.classList.remove('pin-selected'));
    activeWireStart = null;
    renderWires();
  }

  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (
      e.target === viewport ||
      e.target === stage ||
      e.target === wiresSvg ||
      e.target === nodesLayer
    ) {
      if (activeWireStart) {
        document.querySelectorAll('.wms-pin.pin-selected').forEach(p => p.classList.remove('pin-selected'));
        activeWireStart = null;
        renderWires();
      }
      activeCanvasPan = {
        startX: e.clientX,
        startY: e.clientY,
        origPanX: circuit.panX || 0,
        origPanY: circuit.panY || 0
      };
    }
  });

  function onGlobalMouseMove(e) {
    if (widgetDrag) {
      floatingPos.x = e.clientX - widgetDrag.offsetX;
      floatingPos.y = e.clientY - widgetDrag.offsetY;
      applyFloatingPosition();
    }
    if (activeDragNode) {
      activeDragNode.node.x = Math.max(10, activeDragNode.startNodeX + (e.clientX - activeDragNode.startMouseX));
      activeDragNode.node.y = Math.max(10, activeDragNode.startNodeY + (e.clientY - activeDragNode.startMouseY));
      activeDragNode.el.style.left = activeDragNode.node.x + 'px';
      activeDragNode.el.style.top = activeDragNode.node.y + 'px';
      renderWires();
    }
    if (activeCanvasPan) {
      circuit.panX = activeCanvasPan.origPanX + (e.clientX - activeCanvasPan.startX);
      circuit.panY = activeCanvasPan.origPanY + (e.clientY - activeCanvasPan.startY);
      stage.style.transform = `translate(${circuit.panX}px, ${circuit.panY}px)`;
    }
    if (activeWireStart) {
      const rect = viewport.getBoundingClientRect();
      activeWireStart.currX = e.clientX - rect.left - (circuit.panX || 0);
      activeWireStart.currY = e.clientY - rect.top - (circuit.panY || 0);
      renderWires();
    }
  }

  function onGlobalMouseUp() {
    if (widgetDrag) {
      widgetDrag = null;
      saveFloatingPosition();
    }
    if (activeDragNode) {
      activeDragNode = null;
      saveCircuit();
    }
    if (activeCanvasPan) {
      activeCanvasPan = null;
      saveCircuit();
    }
    if (activeWireStart && activeWireStart.isDragging) {
      activeWireStart.isDragging = false;
    }
  }

  document.addEventListener('mousemove', onGlobalMouseMove);
  document.addEventListener('mouseup', onGlobalMouseUp);

  function getPinStageCoords(nodeId, port) {
    const node = circuit.nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    if (port === 'in') return { x: node.x - 2, y: node.y + 54 };
    if (port === 'true') return { x: node.x + 256, y: node.y + 46 };
    if (port === 'false') return { x: node.x + 256, y: node.y + 84 };
    return { x: node.x + 256, y: node.y + 54 };
  }

  function makeBezierPath(x1, y1, x2, y2) {
    const d = Math.max(Math.abs(x2 - x1) * 0.5, 55);
    return `M ${x1} ${y1} C ${x1 + d} ${y1}, ${x2 - d} ${y2}, ${x2} ${y2}`;
  }

  function renderWires() {
    wiresSvg.innerHTML = '';

    circuit.wires.forEach((w, idx) => {
      const p1 = getPinStageCoords(w.from, w.fromPort);
      const p2 = getPinStageCoords(w.to, 'in');
      const d = makeBezierPath(p1.x, p1.y, p2.x, p2.y);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'wms-wire-group');

      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('d', d);
      hit.setAttribute('class', 'wms-wire-hitbox');

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', d);
      let cls = 'wms-wire-line';
      if (w.fromPort === 'true') cls += ' wire-true';
      if (w.fromPort === 'false') cls += ' wire-false';
      line.setAttribute('class', cls);

      g.appendChild(hit);
      g.appendChild(line);

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        circuit.wires.splice(idx, 1);
        saveCircuit();
        renderWires();
      });

      wiresSvg.appendChild(g);
    });

    if (activeWireStart) {
      const preview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = activeWireStart.port === 'in'
        ? makeBezierPath(activeWireStart.currX, activeWireStart.currY, activeWireStart.x, activeWireStart.y)
        : makeBezierPath(activeWireStart.x, activeWireStart.y, activeWireStart.currX, activeWireStart.currY);
      preview.setAttribute('d', d);
      preview.setAttribute('fill', 'none');
      preview.setAttribute('stroke', '#facc15');
      preview.setAttribute('stroke-width', '3');
      preview.setAttribute('stroke-dasharray', '6,6');
      wiresSvg.appendChild(preview);
    }
  }

  // ============================================================================
  // 9. ZONE ENGINE & ELEMENT PICKER (WITH AUTOMATIC ZONE FALLBACK)
  // ============================================================================
  function createZoneFromElement(el) {
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return null;
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    const padX = Math.max(16, r.width * 0.25);
    const padY = Math.max(12, r.height * 0.35);
    const left = Math.max(0, r.left - padX);
    const top = Math.max(0, r.top - padY);
    const width = Math.min(vw - left, r.width + padX * 2);
    const height = Math.min(vh - top, r.height + padY * 2);

    const zone = {
      xPct: +(left / vw * 100).toFixed(2),
      yPct: +(top / vh * 100).toFixed(2),
      wPct: +(width / vw * 100).toFixed(2),
      hPct: +(height / vh * 100).toFixed(2),
      baselineText: ''
    };
    zone.baselineText = getZoneSnapshotText(zone);
    return zone;
  }

  function startZoneDrawer(callback) {
    overlay.style.display = 'none';
    setStatus('Drag a box around the Screen Zone (ESC to cancel)...', '#10b981');

    const drawer = document.createElement('div');
    drawer.id = 'wms-zone-drawer-overlay';
    drawer.innerHTML = `<div id="wms-zone-drawer-banner">🔲 Drag a rectangle around the Screen Zone (Survives element changes without reassigning)</div>`;
    document.body.appendChild(drawer);

    let startX = 0, startY = 0;
    let rectEl = null;

    function onDown(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      rectEl = document.createElement('div');
      rectEl.className = 'wms-zone-rect-preview';
      document.body.appendChild(rectEl);
    }

    function onMove(e) {
      if (!rectEl) return;
      const left = Math.min(startX, e.clientX);
      const top = Math.min(startY, e.clientY);
      const width = Math.max(12, Math.abs(e.clientX - startX));
      const height = Math.max(12, Math.abs(e.clientY - startY));
      rectEl.style.left = left + 'px';
      rectEl.style.top = top + 'px';
      rectEl.style.width = width + 'px';
      rectEl.style.height = height + 'px';
    }

    function cleanup() {
      drawer.remove();
      if (rectEl) rectEl.remove();
      window.removeEventListener('keydown', onEsc, true);
    }

    function onUp(e) {
      if (!rectEl) return;
      const left = Math.min(startX, e.clientX);
      const top = Math.min(startY, e.clientY);
      const width = Math.max(24, Math.abs(e.clientX - startX));
      const height = Math.max(24, Math.abs(e.clientY - startY));

      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);

      const zoneData = {
        xPct: +(left / vw * 100).toFixed(2),
        yPct: +(top / vh * 100).toFixed(2),
        wPct: +(width / vw * 100).toFixed(2),
        hPct: +(height / vh * 100).toFixed(2),
        baselineText: ''
      };
      zoneData.baselineText = getZoneSnapshotText(zoneData);

      cleanup();
      overlay.style.display = 'flex';
      setStatus('Screen Zone saved!', '#10b981');
      callback(zoneData);
    }

    function onEsc(e) {
      if (e.key === 'Escape') {
        cleanup();
        overlay.style.display = 'flex';
        setStatus('Zone cancelled', '#94a3b8');
      }
    }

    drawer.addEventListener('mousedown', onDown);
    drawer.addEventListener('mousemove', onMove);
    drawer.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onEsc, true);
  }

  function getZonePixelRect(zone) {
    if (!zone) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = (zone.xPct / 100) * vw;
    const top = (zone.yPct / 100) * vh;
    const width = (zone.wPct / 100) * vw;
    const height = (zone.hPct / 100) * vh;
    return { left, top, right: left + width, bottom: top + height, width, height };
  }

  function flashZoneRect(zone, durationMs = 700, onDone) {
    const r = getZonePixelRect(zone);
    if (!r) {
      if (onDone) onDone();
      return;
    }
    const box = document.createElement('div');
    box.className = 'wms-zone-rect-preview';
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
    document.body.appendChild(box);
    setTimeout(() => {
      box.remove();
      if (onDone) onDone();
    }, durationMs);
  }

  function getElementsInZone(zone) {
    const r = getZonePixelRect(zone);
    if (!r) return [];
    const all = document.body.querySelectorAll('*');
    const matched = [];
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (widget.contains(el) || overlay.contains(el)) continue;
      if (el.id === 'wms-zone-drawer-overlay' || el.classList.contains('wms-zone-rect-preview')) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      const er = el.getBoundingClientRect();
      if (er.width <= 1 || er.height <= 1) continue;
      const cx = er.left + er.width / 2;
      const cy = er.top + er.height / 2;
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
        matched.push(el);
      }
    }
    return matched;
  }

  function getZoneSnapshotText(zone) {
    const els = getElementsInZone(zone);
    const parts = [];
    els.forEach(el => {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        const v = String(el.value || el.getAttribute('placeholder') || '').trim();
        if (v) parts.push(v);
      } else if (el.children.length === 0) {
        const t = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
        if (t) parts.push(t);
      }
    });
    if (parts.length === 0 && els.length > 0) return `[elements:${els.length}]`;
    return parts.join(' | ');
  }

  function resolveNodeElement(nodeData, preferInteractive = false) {
    if (!nodeData) return null;
    const sel = nodeData.selector || (nodeData.triggerType === 'element' ? nodeData.value : '');
    if (sel) {
      const direct = safeQuery(sel);
      if (direct && isElementUsable(direct)) return direct;
    }
    if (nodeData.zone) {
      const els = getElementsInZone(nodeData.zone).filter(isElementUsable);
      if (els.length === 0) return null;
      if (preferInteractive === 'input') {
        const inp = els.find(e => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName) || e.isContentEditable);
        if (inp) return inp;
      }
      if (preferInteractive === 'click') {
        const btn = els.slice().reverse().find(e =>
          ['BUTTON', 'A', 'INPUT'].includes(e.tagName) ||
          e.getAttribute('role') === 'button' ||
          e.getAttribute('role') === 'tab' ||
          window.getComputedStyle(e).cursor === 'pointer'
        );
        if (btn) return btn;
      }
      if (nodeData.expectedTag) {
        const byTag = els.find(e => e.tagName === nodeData.expectedTag);
        if (byTag) return byTag;
      }
      return els[els.length - 1];
    }
    return null;
  }

  function normalizePickedTarget(rawEl, nodeType) {
    if (!rawEl) return rawEl;
    let el = rawEl;
    if (typeof SVGElement !== 'undefined' && el instanceof SVGElement) {
      el = el.closest('button, a, [role="button"], [role="tab"], input, div, span') || el.parentElement || el;
    }
    if (nodeType === 'click' || nodeType === 'tabswitch') {
      const interactive = el.closest('button, a, [role="button"], [role="tab"], input[type="button"], input[type="submit"]');
      if (interactive) el = interactive;
    } else if (nodeType === 'type') {
      const inputEl = el.closest('input, textarea, select, [contenteditable="true"]');
      if (inputEl) el = inputEl;
    }
    return el;
  }

  function startElementPicker(nodeType, callback) {
    overlay.style.display = 'none';
    setStatus('Click any element on the page (ESC to cancel)...', '#f59e0b');
    let hovered = null;

    function cleanup() {
      if (hovered) hovered.classList.remove('wms-picker-highlight');
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onEsc, true);
    }

    function onOver(e) {
      if (widget.contains(e.target) || overlay.contains(e.target)) return;
      if (hovered) hovered.classList.remove('wms-picker-highlight');
      hovered = normalizePickedTarget(e.target, nodeType);
      if (hovered && hovered.classList) hovered.classList.add('wms-picker-highlight');
    }

    function onClick(e) {
      if (widget.contains(e.target) || overlay.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const targetEl = normalizePickedTarget(e.target, nodeType);
      cleanup();
      const sel = buildRobustSelector(targetEl);
      const autoZone = createZoneFromElement(targetEl);
      overlay.style.display = 'flex';
      setStatus('Picked: ' + sel, '#10b981');
      callback(sel, autoZone, targetEl);
    }

    function onEsc(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
        overlay.style.display = 'flex';
        setStatus('Picker cancelled', '#94a3b8');
      }
    }

    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onEsc, true);
  }

  function buildRobustSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && !/\d{6,}/.test(el.id)) {
      return '#' + CSS.escape(el.id);
    }
    const uniqueAttrs = ['data-testid', 'data-test', 'name', 'aria-label', 'placeholder'];
    for (const attr of uniqueAttrs) {
      const val = el.getAttribute(attr);
      if (val && val.trim()) {
        const candidate = `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val.trim())}"]`;
        try {
          if (document.querySelectorAll(candidate).length === 1) return candidate;
        } catch (_) {}
      }
    }
    const parts = [];
    let curr = el;
    while (curr && curr.nodeType === 1 && curr !== document.body && parts.length < 4) {
      let seg = curr.tagName.toLowerCase();
      if (curr.id && !/\d{6,}/.test(curr.id)) {
        seg = '#' + CSS.escape(curr.id);
        parts.unshift(seg);
        break;
      }
      const clsAttr = curr.getAttribute('class');
      if (clsAttr && typeof clsAttr === 'string') {
        const validClasses = clsAttr
          .trim()
          .split(/\s+/)
          .filter(c => c && !c.startsWith('wms-') && !/[:[\]/]/.test(c))
          .slice(0, 2);
        if (validClasses.length) {
          seg += '.' + validClasses.map(c => CSS.escape(c)).join('.');
        }
      }
      const parent = curr.parentElement;
      if (parent) {
        const sameTagSiblings = Array.from(parent.children).filter(ch => ch.tagName === curr.tagName);
        if (sameTagSiblings.length > 1) {
          const idx = sameTagSiblings.indexOf(curr) + 1;
          seg += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(seg);
      curr = parent;
    }
    return parts.join(' > ');
  }

  function safeQuery(selector) {
    if (!selector) return null;
    try { return document.querySelector(selector); } catch (_) { return null; }
  }

  function isElementUsable(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    if (rect.width <= 0 || rect.height <= 0) return false;

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (cx >= 0 && cy >= 0 && cx <= window.innerWidth && cy <= window.innerHeight) {
      const hitStack = document.elementsFromPoint ? document.elementsFromPoint(cx, cy) : [document.elementFromPoint(cx, cy)];
      const topPageEl = hitStack.find(item => item && !widget.contains(item) && !overlay.contains(item));
      if (topPageEl && !el.contains(topPageEl) && !topPageEl.contains(el)) {
        return false;
      }
    }
    return true;
  }

  function setNativeValue(el, val) {
    el.focus();
    const lastValue = el.value;
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, val);
    } else {
      el.value = val;
    }
    if (el._valueTracker) {
      try { el._valueTracker.setValue(lastValue); } catch (_) {}
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function triggerRealClick(el) {
    if (!el) return;
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    if (typeof el.click === 'function') {
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent('click', opts));
    }
  }

  // ============================================================================
  // 10. EXECUTION ENGINE (ALL 9 BLOCKS + CROSS-TAB WORKFLOW HANDOFF)
  // ============================================================================
  function snapshotCircuitZones(c) {
    if (!c || !Array.isArray(c.nodes)) return;
    c.nodes.forEach(n => {
      if (n.data && n.data.zone) {
        n.data._preActionZoneText = getZoneSnapshotText(n.data.zone);
      }
    });
  }

  function runCircuitManually(targetCanvas, isSubCall = false, callDepth = 0) {
    const c = targetCanvas || circuit;
    if (!c || !c.nodes.length) {
      setStatus('Circuit is empty!', '#f43f5e');
      return Promise.resolve(false);
    }
    if (callDepth > 5) {
      setStatus('Max sub-canvas depth reached', '#f43f5e');
      return Promise.resolve(false);
    }
    const startNode =
      c.nodes.find(n => (n.type === 'trigger' || n.type === 'listener') && c.wires.some(w => w.from === n.id)) ||
      c.nodes.find(n => n.type === 'trigger' || n.type === 'listener') ||
      c.nodes[0];

    return executeFromNode(c, startNode.id, isSubCall, callDepth);
  }

  async function executeFromNode(targetCanvas, startNodeId, isSubCall = false, callDepth = 0) {
    const c = targetCanvas || circuit;
    if (isRunning && !isSubCall) return false;
    if (!isSubCall) {
      isRunning = true;
      cancelExecution = false;
      widget.style.borderColor = '#f59e0b';
    }
    setStatus('Running circuit...', '#f59e0b');
    snapshotCircuitZones(c);

    let hopCount = 0;

    async function runNodeChain(nodeId) {
      if (!nodeId || cancelExecution || hopCount >= 60) return;
      hopCount++;

      const node = c.nodes.find(n => n.id === nodeId);
      if (!node) return;

      const domNode = document.getElementById(node.id);
      if (domNode) domNode.classList.add('node-running');

      let outPort = 'out';
      let stepSucceeded = true;
      let handedOffToOtherBrowserTab = false;

      try {
        if (node.type === 'click') {
          setStatus('Step: Click Target', '#3b82f6');
          snapshotCircuitZones(c);
          const target = await waitForTargetOrZone(node.data, 'click', 3500);
          if (!target) {
            setStatus('Stopped: Click target missing or covered', '#f43f5e');
            stepSucceeded = false;
          } else {
            triggerRealClick(target);
            await sleep(180);
          }
        }

        else if (node.type === 'type') {
          setStatus('Step: Type Text', '#10b981');
          snapshotCircuitZones(c);
          const target = await waitForTargetOrZone(node.data, 'input', 3500);
          if (!target) {
            setStatus('Stopped: Input box missing or covered', '#f43f5e');
            stepSucceeded = false;
          } else {
            const val = node.data.source === 'box1'
              ? box1El.value
              : node.data.source === 'box2'
                ? box2El.value
                : resolveDynamicValue(node.data.customText || '');
            setNativeValue(target, val);

            if (node.data.pressEnter !== false) {
              const evInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
              target.dispatchEvent(new KeyboardEvent('keydown', evInit));
              target.dispatchEvent(new KeyboardEvent('keypress', evInit));
              target.dispatchEvent(new KeyboardEvent('keyup', evInit));
            }
            await sleep(180);
          }
        }

        else if (node.type === 'wait') {
          const wType = node.data.waitType || 'element';
          if (wType === 'time') {
            const ms = Math.max(50, parseInt(node.data.ms, 10) || 500);
            setStatus(`Waiting ${ms}ms...`, '#94a3b8');
            await sleep(ms);
          } else if (wType === 'zone_change' && node.data.zone) {
            setStatus('Waiting for Zone content to change...', '#10b981');
            flashZoneRect(node.data.zone, 400);
            const ok = await waitForZoneChange(node.data, 10000);
            if (!ok) {
              setStatus('Stopped: Zone did not change (10s)', '#f43f5e');
              stepSucceeded = false;
            }
          } else if (wType === 'zone_appear' && node.data.zone) {
            setStatus('Waiting for element in Zone...', '#10b981');
            flashZoneRect(node.data.zone, 400);
            const ok = await waitForZoneAppear(node.data.zone, 10000);
            if (!ok) {
              setStatus('Stopped: Zone empty (10s)', '#f43f5e');
              stepSucceeded = false;
            }
          } else if (wType === 'zone_text' && node.data.zone) {
            const expected = resolveDynamicValue(node.data.textVal || '');
            setStatus(`Waiting for Zone text "${expected}"...`, '#10b981');
            flashZoneRect(node.data.zone, 400);
            const ok = await waitForZoneText(node.data.zone, expected, 10000);
            if (!ok) {
              setStatus('Stopped: Zone text timeout (10s)', '#f43f5e');
              stepSucceeded = false;
            }
          } else {
            setStatus('Waiting for element / zone...', '#94a3b8');
            const found = await waitForTargetOrZone(node.data, false, 10000);
            if (!found) {
              setStatus('Stopped: Wait timed out (10s)', '#f43f5e');
              stepSucceeded = false;
            }
          }
        }

        else if (node.type === 'extract') {
          setStatus('Step: Extract Data', '#0891b2');
          let text = '';
          const target = await waitForTargetOrZone(node.data, false, 3500);
          if (target) {
            text = (target.value !== undefined && target.value !== '' ? String(target.value) : String(target.textContent || '')).trim();
          } else if (node.data.zone) {
            text = getZoneSnapshotText(node.data.zone);
          } else {
            setStatus('Stopped: Extract target missing', '#f43f5e');
            stepSucceeded = false;
          }
          if (stepSucceeded) {
            if (node.data.targetBox === 'box2') {
              box2El.value = text;
              storage.set({ box2Data: text });
            } else {
              box1El.value = text;
              storage.set({ box1Data: text });
            }
            await sleep(150);
          }
        }

        else if (node.type === 'ifelse') {
          const passed = evaluateCondition(node.data);
          outPort = passed ? 'true' : 'false';
          setStatus(`If/Else -> ${passed ? 'TRUE' : 'FALSE'}`, passed ? '#10b981' : '#f43f5e');
          await sleep(140);
        }

        else if (node.type === 'tabswitch') {
          setStatus('Step: Switching Tab...', '#ca8a04');
          const nextNodeIds = c.wires.filter(w => w.from === nodeId && w.fromPort === 'out').map(w => w.to);
          const result = await executeTabSwitch(node, callDepth, {
            canvasId: c.id,
            nextNodeIds
          });
          if (!result) {
            setStatus('Stopped: Tab target not found', '#f43f5e');
            stepSucceeded = false;
          } else if (result === 'HANDOFF_TO_BROWSER_TAB') {
            handedOffToOtherBrowserTab = true;
          } else {
            await sleep(200);
          }
        }

        else if (node.type === 'script') {
          setStatus('Step: Script Block', '#0e7490');
          const ok = await executeScriptNode(node, callDepth);
          outPort = ok ? 'true' : 'false';
          await sleep(140);
        }
      } catch (err) {
        console.warn('WMS Circuit Execution Error:', err);
        setStatus('Error during circuit execution', '#f43f5e');
        stepSucceeded = false;
      }

      if (domNode) domNode.classList.remove('node-running');
      if (!stepSucceeded || cancelExecution || handedOffToOtherBrowserTab) return;

      const matchingWires = c.wires.filter(w => w.from === nodeId && w.fromPort === outPort);
      for (const w of matchingWires) {
        if (cancelExecution) break;
        await runNodeChain(w.to);
      }
    }

    await runNodeChain(startNodeId);

    if (!isSubCall) {
      isRunning = false;
      widget.style.borderColor = '#334155';
      if (cancelExecution) {
        setStatus('Aborted by user', '#f43f5e');
      } else if (statusLine.textContent.startsWith('Running') || statusLine.textContent.startsWith('Step:')) {
        setStatus('Circuit Complete ✓', '#10b981');
      }
    }
    return !cancelExecution;
  }

  function resolveDynamicValue(raw) {
    return String(raw || '')
      .replace(/\{\{box1\}\}/gi, box1El.value)
      .replace(/\{\{box2\}\}/gi, box2El.value)
      .trim();
  }

  function evaluateCondition(d) {
    const cond = d.condition || 'exists';
    const expected = resolveDynamicValue(d.value || '');
    const el = d.selector ? safeQuery(d.selector) : null;
    const usableEl = (el && isElementUsable(el)) ? el : null;

    if (cond === 'exists' || cond === 'not_exists') {
      let exists = false;
      if (usableEl) {
        exists = true;
      } else if (d.zone) {
        flashZoneRect(d.zone, 300);
        exists = getElementsInZone(d.zone).some(isElementUsable);
      }
      return cond === 'exists' ? exists : !exists;
    }

    let rawText = '';
    if (usableEl) {
      rawText = (usableEl.value !== undefined && usableEl.value !== '' ? String(usableEl.value) : String(usableEl.textContent || '')).trim();
    } else if (d.zone) {
      flashZoneRect(d.zone, 300);
      rawText = getZoneSnapshotText(d.zone);
    } else {
      return false;
    }

    if (cond === 'changed') {
      const prev = d._preActionZoneText !== undefined
        ? d._preActionZoneText
        : (d._lastEvalText !== undefined ? d._lastEvalText : (d.zone ? d.zone.baselineText : undefined));
      d._lastEvalText = rawText;
      d._preActionZoneText = rawText;
      if (d.zone) d.zone.baselineText = rawText;
      return prev !== undefined && rawText !== prev;
    }

    if (cond === 'contains') return rawText.toLowerCase().includes(expected.toLowerCase());
    if (cond === 'equals') return rawText.toLowerCase() === expected.toLowerCase();

    const numActual = parseFloat(rawText.replace(/[^0-9.-]+/g, ''));
    const numTarget = parseFloat(expected);
    if (cond === 'gt') return !isNaN(numActual) && !isNaN(numTarget) && numActual > numTarget;
    if (cond === 'lt') return !isNaN(numActual) && !isNaN(numTarget) && numActual < numTarget;
    return false;
  }

  // Links or opens a target tab once so single-script window.open('', winName) can switch between them natively
  function linkOrOpenBrowserTab(rawTarget) {
    const targetVal = resolveDynamicValue(rawTarget || '');
    if (!targetVal) {
      setStatus('Enter or select a tab first!', '#f59e0b');
      return;
    }
    const matchedInfo = findRegisteredTabInfo(targetVal);
    const targetUrl = matchedInfo ? matchedInfo.url : (/^https?:\/\//i.test(targetVal) || targetVal.startsWith('/') ? targetVal : '');
    const targetWinName = matchedInfo ? matchedInfo.winName : ('wms_tab_' + targetVal.replace(/[^a-z0-9]/gi, '_').slice(0, 32));

    if (!targetUrl) {
      setStatus('Open the target tab once so its URL is detected, or paste its URL', '#f59e0b');
      return;
    }

    const w = window.open(targetUrl, targetWinName);
    if (w) {
      window.__wmsLinkedWindows[targetWinName] = w;
      window.__wmsLinkedWindows[targetVal] = w;
      setStatus(`Linked tab! You can now switch back & forth seamlessly`, '#10b981');
    }
  }

  function findRegisteredTabInfo(query) {
    const raw = String(query || '').trim();
    const needle = raw.toLowerCase();
    const allEntries = getCombinedTabEntries();
    if (allEntries.length === 0) return null;

    if (raw === '[[NEXT_TAB]]' || needle === 'next') {
      const idx = allEntries.findIndex(e => e.winName === THIS_TAB_ID);
      return allEntries[(idx + 1) % allEntries.length];
    }
    if (raw === '[[PREV_TAB]]' || needle === 'prev' || needle === 'previous') {
      const idx = allEntries.findIndex(e => e.winName === THIS_TAB_ID);
      return allEntries[(idx - 1 + allEntries.length) % allEntries.length];
    }
    if (raw === '[[LAST_TAB]]' || needle === 'last') {
      const others = allEntries.filter(e => e.winName !== THIS_TAB_ID).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return others[0] || null;
    }
    if (/^(?:tab\s*)?(\d+)$/i.test(raw)) {
      const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
      if (num >= 1 && num <= allEntries.length) {
        return allEntries[num - 1];
      }
    }

    return allEntries.find(e =>
      e.winName !== THIS_TAB_ID &&
      ((e.title || '').toLowerCase().includes(needle) || (e.url || '').toLowerCase().includes(needle))
    ) || allEntries.find(e =>
      (e.title || '').toLowerCase().includes(needle) || (e.url || '').toLowerCase().includes(needle)
    ) || null;
  }

  // Safely attempts window.open('', winName) without EVER leaving a blank about:blank tab open
  function trySafeNamedWindowFocus(winName) {
    if (!winName) return false;
    try {
      const w = window.open('', winName);
      if (!w) return false;
      try {
        // If Chrome created a brand new blank tab because winName wasn't in this browsing context group, close it immediately!
        if (w.location && w.location.href === 'about:blank' && (!w.history || w.history.length <= 1)) {
          w.close();
          return false;
        }
      } catch (_) {
        // Cross-origin SecurityError means it IS a real existing tab!
      }
      w.focus();
      window.__wmsLinkedWindows[winName] = w;
      return true;
    } catch (_) {
      return false;
    }
  }

  async function executeTabSwitch(node, callDepth = 0, handoffMeta = null) {
    const d = node.data;
    const mode = d.tabMode || 'wms_tab';
    const targetVal = resolveDynamicValue(d.targetValue || '');

    if (mode === 'canvas_tab') {
      const targetCanvas = canvases.find(c => c.id === d.targetCanvasId);
      if (!targetCanvas) return false;
      activeCanvasId = targetCanvas.id;
      syncActiveCanvasRef();
      saveCircuit();
      renderCanvas();
      if (d.runAfterSwitch !== false) {
        await runCircuitManually(targetCanvas, true, callDepth + 1);
      }
      return true;
    }

    if (mode === 'wms_tab') {
      if (d.selector) {
        const direct = safeQuery(d.selector);
        if (direct && isElementUsable(direct)) {
          triggerRealClick(direct);
          return true;
        }
      }
      const pool = d.zone
        ? getElementsInZone(d.zone)
        : Array.from(document.querySelectorAll('[role="tab"], .tab, .nav-link, .mat-tab-label, .p-tabview-nav-link, button, a, li, span'));
      const needle = targetVal.toLowerCase();
      const candidates = pool.filter(el => {
        if (!isElementUsable(el)) return false;
        const txt = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
        return needle ? txt.includes(needle) : (el.getAttribute('role') === 'tab' || ['BUTTON', 'A'].includes(el.tagName));
      });
      const match = candidates.reverse().find(el =>
        el.getAttribute('role') === 'tab' || ['BUTTON', 'A'].includes(el.tagName)
      ) || candidates[0];
      if (match) {
        triggerRealClick(match);
        return true;
      }
      return false;
    }

    if (mode === 'browser_tab') {
      if (!targetVal) return false;

      const matchedTab = findRegisteredTabInfo(targetVal);

      // Broadcast Cross-Tab Handoff so the target tab focuses itself and continues any downstream wired blocks
      const handoffPayload = {
        ts: Date.now(),
        fromTab: THIS_TAB_ID,
        targetWinName: matchedTab ? matchedTab.winName : '',
        query: targetVal,
        box1: box1El.value,
        box2: box2El.value,
        canvasId: handoffMeta ? handoffMeta.canvasId : activeCanvasId,
        nextNodeIds: handoffMeta && Array.isArray(handoffMeta.nextNodeIds) ? handoffMeta.nextNodeIds : []
      };
      storage.set({ wmsTabHandoff: handoffPayload });
      try {
        const bc = new BroadcastChannel('wms_circuit_tab_channel');
        bc.postMessage({ type: 'TAB_HANDOFF', payload: handoffPayload });
        bc.close();
      } catch (_) {}

      const hasDownstream = handoffPayload.nextNodeIds.length > 0;

      // 1. Try Extension Background Service Worker (if active)
      const switchedByExt = await requestExtensionTabSwitch(targetVal);
      if (switchedByExt) {
        setStatus(`Switched to tab: ${targetVal}`, '#10b981');
        return hasDownstream ? 'HANDOFF_TO_BROWSER_TAB' : true;
      }

      // 2. Try direct Window Opener (if target tab opened this tab)
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.focus();
          setStatus(`Switched to parent tab`, '#10b981');
          return hasDownstream ? 'HANDOFF_TO_BROWSER_TAB' : true;
        } catch (_) {}
      }

      // 3. Try cached linked window reference
      const needle = targetVal.toLowerCase();
      for (const [key, winRef] of Object.entries(window.__wmsLinkedWindows)) {
        if (winRef && !winRef.closed && (key === (matchedTab && matchedTab.winName) || key.toLowerCase().includes(needle))) {
          try {
            winRef.focus();
            setStatus(`Switched to linked tab: ${targetVal}`, '#10b981');
            return hasDownstream ? 'HANDOFF_TO_BROWSER_TAB' : true;
          } catch (_) {}
        }
      }

      // 4. Try safe named-window focus (auto-closes if about:blank)
      if (matchedTab && matchedTab.winName && trySafeNamedWindowFocus(matchedTab.winName)) {
        setStatus(`Switched to tab: ${matchedTab.title || targetVal}`, '#10b981');
        return hasDownstream ? 'HANDOFF_TO_BROWSER_TAB' : true;
      }

      // 5. If matched tab exists in registry (or full URL given), open/link it into same browsing context group
      const urlToOpen = (matchedTab && matchedTab.url) || ((/^https?:\/\//i.test(targetVal) || targetVal.startsWith('/')) ? targetVal : '');
      const nameToUse = (matchedTab && matchedTab.winName) || ('wms_tab_' + targetVal.replace(/[^a-z0-9]/gi, '_').slice(0, 32));
      if (urlToOpen) {
        const w = window.open(urlToOpen, nameToUse);
        if (w) {
          window.__wmsLinkedWindows[nameToUse] = w;
          window.__wmsLinkedWindows[targetVal] = w;
          try { w.focus(); } catch (_) {}
          setStatus(`Linked & switched to: ${targetVal}`, '#10b981');
          return hasDownstream ? 'HANDOFF_TO_BROWSER_TAB' : true;
        }
      }

      setStatus(`Tab "${targetVal}" not linked yet — click 🔗 Link on the block once`, '#f59e0b');
      return false;
    }

    return false;
  }

  function handleIncomingTabHandoff(handoff) {
    if (!handoff || !handoff.ts || handoff.ts <= lastHandledHandoffTs) return;
    if (handoff.fromTab === THIS_TAB_ID) return;

    const q = String(handoff.query || '').toLowerCase();
    const isTarget =
      (handoff.targetWinName && handoff.targetWinName === THIS_TAB_ID) ||
      (q && (window.location.href.toLowerCase().includes(q) || document.title.toLowerCase().includes(q)));

    if (!isTarget) return;
    lastHandledHandoffTs = handoff.ts;

    if (handoff.box1 !== undefined) box1El.value = handoff.box1;
    if (handoff.box2 !== undefined) box2El.value = handoff.box2;

    try { window.focus(); } catch (_) {}
    setStatus(`Active from Tab Switch ✓`, '#10b981');

    if (Array.isArray(handoff.nextNodeIds) && handoff.nextNodeIds.length > 0) {
      const targetCanvas = canvases.find(c => c.id === handoff.canvasId) || circuit;
      setTimeout(async () => {
        for (const nextId of handoff.nextNodeIds) {
          await executeFromNode(targetCanvas, nextId, false, 1);
        }
      }, 220);
    }
  }

  async function executeScriptNode(node, callDepth = 0) {
    const d = node.data;
    const preset = d.preset || 'run_canvas';

    if (preset === 'inc_box1') {
      const n = parseFloat(box1El.value) || 0;
      box1El.value = String(n + 1);
      storage.set({ box1Data: box1El.value });
      return true;
    }

    if (preset === 'run_canvas') {
      const targetCanvas = canvases.find(c => c.id === d.targetCanvasId);
      if (!targetCanvas) return false;
      return await runCircuitManually(targetCanvas, true, callDepth + 1);
    }

    try {
      const fn = new Function(
        'box1',
        'box2',
        'setBox1',
        'setBox2',
        'clickText',
        'switchTab',
        'runCanvas',
        d.code || 'return true;'
      );
      const res = await fn(
        box1El.value,
        box2El.value,
        (v) => { box1El.value = String(v); storage.set({ box1Data: box1El.value }); },
        (v) => { box2El.value = String(v); storage.set({ box2Data: box2El.value }); },
        (label) => {
          const all = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
          const m = all.find(el => (el.textContent || el.value || '').toLowerCase().includes(String(label).toLowerCase()) && isElementUsable(el));
          if (m) { triggerRealClick(m); return true; }
          return false;
        },
        (tabName) => executeTabSwitch({ data: { tabMode: 'wms_tab', targetValue: tabName } }, callDepth + 1, null),
        (canvasName) => {
          const target = canvases.find(c => c.name.toLowerCase() === String(canvasName).toLowerCase());
          if (target) return runCircuitManually(target, true, callDepth + 1);
          return false;
        }
      );
      return res !== false;
    } catch (e) {
      console.warn('Custom Script Error:', e);
      return false;
    }
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function waitForTargetOrZone(nodeData, preferInteractive, timeoutMs) {
    return new Promise(resolve => {
      const immediate = resolveNodeElement(nodeData, preferInteractive);
      if (immediate) return resolve(immediate);

      let finished = false;
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        obs.disconnect();
        resolve(resolveNodeElement(nodeData, preferInteractive));
      }, timeoutMs);

      const obs = new MutationObserver(() => {
        if (cancelExecution) {
          finished = true;
          clearTimeout(timer);
          obs.disconnect();
          resolve(null);
          return;
        }
        const candidate = resolveNodeElement(nodeData, preferInteractive);
        if (candidate) {
          finished = true;
          clearTimeout(timer);
          obs.disconnect();
          resolve(candidate);
        }
      });

      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    });
  }

  function waitForZoneChange(nodeData, timeoutMs) {
    return new Promise(resolve => {
      const zone = nodeData.zone;
      if (!zone) return resolve(false);
      const baseline = nodeData._preActionZoneText !== undefined
        ? nodeData._preActionZoneText
        : getZoneSnapshotText(zone);
      const immediateCurr = getZoneSnapshotText(zone);
      if (immediateCurr !== baseline) {
        zone.baselineText = immediateCurr;
        nodeData._preActionZoneText = immediateCurr;
        saveCircuit();
        return resolve(true);
      }

      const start = Date.now();
      const interval = setInterval(() => {
        if (cancelExecution) {
          clearInterval(interval);
          resolve(false);
          return;
        }
        const curr = getZoneSnapshotText(zone);
        if (curr !== baseline) {
          zone.baselineText = curr;
          nodeData._preActionZoneText = curr;
          saveCircuit();
          clearInterval(interval);
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 150);
    });
  }

  function waitForZoneAppear(zone, timeoutMs) {
    return new Promise(resolve => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (cancelExecution) {
          clearInterval(interval);
          resolve(false);
          return;
        }
        if (getElementsInZone(zone).some(isElementUsable)) {
          clearInterval(interval);
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 150);
    });
  }

  function waitForZoneText(zone, expectedText, timeoutMs) {
    return new Promise(resolve => {
      const needle = (expectedText || '').toLowerCase();
      const start = Date.now();
      const interval = setInterval(() => {
        if (cancelExecution) {
          clearInterval(interval);
          resolve(false);
          return;
        }
        const curr = getZoneSnapshotText(zone).toLowerCase();
        if (needle && curr.includes(needle)) {
          clearInterval(interval);
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 150);
    });
  }

  // ============================================================================
  // 11. GLOBAL LISTENERS, HOTKEYS, URL & PASSIVE WATCHERS
  // ============================================================================
  function formatKeyCombo(e) {
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return '';
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    return parts.join('+');
  }

  function onGlobalKeyDown(e) {
    if (e.key === 'Escape') {
      cancelExecution = true;
      isRunning = false;
      widget.style.borderColor = '#334155';
      setStatus('Stopped (ESC)', '#f43f5e');
      return;
    }

    if (overlay.style.display === 'flex') return;

    if (e.altKey && (e.key === '1' || e.code === 'Digit1')) {
      e.preventDefault();
      copyOrPasteSlot(box1El, 'box1Data', 'Box 1');
      return;
    }
    if (e.altKey && (e.key === '2' || e.code === 'Digit2')) {
      e.preventDefault();
      copyOrPasteSlot(box2El, 'box2Data', 'Box 2');
      return;
    }

    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    const isTypingInField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || (document.activeElement && document.activeElement.isContentEditable);
    if (isTypingInField && !e.altKey && !e.ctrlKey) return;

    const combo = formatKeyCombo(e);
    if (!combo) return;

    for (const c of canvases) {
      if (!c.enabled) continue;
      const trig = c.nodes.find(n =>
        n.type === 'trigger' &&
        n.data.triggerType === 'hotkey' &&
        (n.data.value || '').toUpperCase() === combo.toUpperCase()
      );
      if (trig) {
        e.preventDefault();
        executeFromNode(c, trig.id);
        break;
      }
    }
  }

  function copyOrPasteSlot(textarea, storageKey, label) {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      textarea.value = selectedText;
      storage.set({ [storageKey]: selectedText });
      setStatus(`Copied to ${label}`, '#10b981');
      return;
    }
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && !widget.contains(active)) {
      setNativeValue(active, textarea.value);
      const evInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      active.dispatchEvent(new KeyboardEvent('keydown', evInit));
      setStatus(`Pasted ${label}`, '#38bdf8');
    }
  }

  function onHumanMouseDown(e) {
    if (isRunning && e.isTrusted && !widget.contains(e.target) && !overlay.contains(e.target)) {
      cancelExecution = true;
      isRunning = false;
      widget.style.borderColor = '#334155';
      setStatus('Paused: Human click detected', '#f59e0b');
    }
  }

  document.addEventListener('keydown', onGlobalKeyDown, true);
  document.addEventListener('mousedown', onHumanMouseDown, true);

  function checkPassiveAndListenerNodes() {
    if (isRunning || overlay.style.display === 'flex') return;
    const now = Date.now();

    for (const c of canvases) {
      if (!c.enabled) continue;

      for (const node of c.nodes) {
        if (node.type === 'trigger' && node.data.triggerType === 'element' && (node.data.value || node.data.zone)) {
          const el = resolveNodeElement(node.data, false);
          if (el) {
            const last = cooldownMap.get(node.id) || 0;
            if (now - last > 5000) {
              cooldownMap.set(node.id, now);
              executeFromNode(c, node.id);
              return;
            }
          }
        }

        if (node.type === 'listener') {
          const last = cooldownMap.get(node.id) || 0;
          if (now - last <= 3500) continue;

          let raw = '';
          const el = node.data.selector ? safeQuery(node.data.selector) : null;
          if (el && isElementUsable(el)) {
            raw = (el.value !== undefined && el.value !== '' ? String(el.value) : String(el.textContent || '')).trim();
          } else if (node.data.zone) {
            raw = getZoneSnapshotText(node.data.zone);
          } else {
            continue;
          }

          const targetVal = resolveDynamicValue(node.data.targetVal || '');
          const evt = node.data.eventType || 'contains';
          let matched = false;

          if (evt === 'change') {
            const prev = node.data._lastSeenText !== undefined
              ? node.data._lastSeenText
              : (node.data.zone ? node.data.zone.baselineText : undefined);
            if (prev === undefined) {
              node.data._lastSeenText = raw;
            } else if (raw !== prev) {
              node.data._lastSeenText = raw;
              matched = true;
            }
          } else if (raw && evt === 'contains' && targetVal && raw.toLowerCase().includes(targetVal.toLowerCase())) {
            matched = true;
          } else if (raw && evt === 'equals' && targetVal && raw.toLowerCase() === targetVal.toLowerCase()) {
            matched = true;
          } else if (raw && evt === 'length') {
            const minLen = parseInt(targetVal, 10) || 1;
            if (raw.length >= minLen) matched = true;
          } else if (raw && (evt === 'gt' || evt === 'lt')) {
            const nActual = parseFloat(raw.replace(/[^0-9.-]+/g, ''));
            const nTarget = parseFloat(targetVal);
            if (!isNaN(nActual) && !isNaN(nTarget)) {
              matched = evt === 'gt' ? nActual > nTarget : nActual < nTarget;
            }
          }

          if (matched) {
            cooldownMap.set(node.id, now);
            executeFromNode(c, node.id);
            return;
          }
        }
      }
    }
  }

  function updateTabRegistry() {
    const now = Date.now();
    const entry = {
      winName: THIS_TAB_ID,
      url: window.location.href,
      title: document.title || window.location.pathname,
      ts: now
    };
    try {
      const reg = Object.assign({}, sharedTabRegistry, JSON.parse(localStorage.getItem('wms_cs_tab_registry') || '{}'));
      Object.keys(reg).forEach(k => {
        if (!reg[k] || (now - (reg[k].ts || 0) > 43200000)) delete reg[k];
      });
      reg[THIS_TAB_ID] = entry;
      sharedTabRegistry = reg;
      localStorage.setItem('wms_cs_tab_registry', JSON.stringify(reg));
      storage.set({ wmsTabRegistry: reg });
    } catch (_) {}
    refreshOpenTabsFromBackground();
  }

  let cachedExtensionTabs = [];

  function refreshOpenTabsFromBackground(cb) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'WMS_GET_TABS' }, (res) => {
          void chrome.runtime.lastError;
          if (res && Array.isArray(res.tabs)) {
            cachedExtensionTabs = res.tabs;
            if (cb) cb(res.tabs);
          }
        });
      }
    } catch (_) {}
  }

  function getCombinedTabEntries() {
    const entries = [];
    const seen = new Set();

    cachedExtensionTabs.forEach((t, idx) => {
      const key = (t.url || t.title || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      entries.push({
        winName: t.active ? THIS_TAB_ID : ('ext_tab_' + (idx + 1)),
        title: t.title || t.url,
        url: t.url || '',
        ts: Date.now()
      });
    });

    const reg = Object.assign({}, sharedTabRegistry);
    try {
      Object.assign(reg, JSON.parse(localStorage.getItem('wms_cs_tab_registry') || '{}'));
    } catch (_) {}

    Object.keys(reg).forEach(wn => {
      const info = reg[wn];
      if (!info) return;
      const key = (info.url || info.title || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      entries.push({
        winName: wn,
        title: info.title || info.url,
        url: info.url || '',
        ts: info.ts || 0
      });
    });

    return entries;
  }

  function getKnownOpenTabs() {
    const list = [];
    const all = getCombinedTabEntries();
    all.forEach((info, idx) => {
      if (info.winName === THIS_TAB_ID) return;
      list.push({
        label: `[Tab ${idx + 1}] ${(info.title || info.url).slice(0, 38)}`,
        matchValue: info.title || info.url
      });
    });
    return list;
  }

  function requestExtensionTabSwitch(query) {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) { settled = true; resolve(false); }
          }, 350);

          chrome.runtime.sendMessage({
            type: 'WMS_SWITCH_TAB',
            query: String(query || '').trim(),
            currentUrl: window.location.href,
            currentTitle: document.title
          }, (res) => {
            void chrome.runtime.lastError;
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve(Boolean(res && res.ok));
            }
          });
          return;
        }
      } catch (_) {}
      resolve(false);
    });
  }

  window.addEventListener('focus', updateTabRegistry);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateTabRegistry();
  });

  function checkUrlTriggers() {
    updateTabRegistry();
    const href = window.location.href;
    if (href === lastMatchedUrl) return;
    for (const c of canvases) {
      if (!c.enabled) continue;
      const urlTrig = c.nodes.find(n =>
        n.type === 'trigger' &&
        n.data.triggerType === 'url' &&
        n.data.value &&
        href.includes(n.data.value)
      );
      if (urlTrig) {
        lastMatchedUrl = href;
        executeFromNode(c, urlTrig.id);
        break;
      }
    }
  }

  let tabChannel = null;
  try {
    tabChannel = new BroadcastChannel('wms_circuit_tab_channel');
    tabChannel.onmessage = (ev) => {
      if (!ev.data) return;
      if (ev.data.type === 'TAB_HANDOFF' && ev.data.payload) {
        handleIncomingTabHandoff(ev.data.payload);
      }
    };
  } catch (_) {}

  let observerTimer = null;
  const domObserver = new MutationObserver((mutations) => {
    const shouldCheck = mutations.some(m => !widget.contains(m.target) && !overlay.contains(m.target));
    if (!shouldCheck || observerTimer) return;
    observerTimer = setTimeout(() => {
      observerTimer = null;
      checkPassiveAndListenerNodes();
      checkUrlTriggers();
    }, 180);
  });
  domObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });

  window.__wmsCircuitCleanup = function () {
    domObserver.disconnect();
    if (observerTimer) clearTimeout(observerTimer);
    if (tabChannel) {
      try { tabChannel.close(); } catch (_) {}
    }
    document.removeEventListener('mousemove', onGlobalMouseMove);
    document.removeEventListener('mouseup', onGlobalMouseUp);
    document.removeEventListener('keydown', onGlobalKeyDown, true);
    document.removeEventListener('mousedown', onHumanMouseDown, true);
    window.removeEventListener('resize', applyFloatingPosition);
    window.removeEventListener('focus', updateTabRegistry);
  };

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();