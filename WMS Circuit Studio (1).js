(function () {
  'use strict';

  // Clean up any previous instance if re-injected
  if (typeof window.__wmsCircuitCleanup === 'function') {
    try { window.__wmsCircuitCleanup(); } catch (_) {}
  }

  // ============================================================================
  // 1. GLOBAL STATE & MULTI-CANVAS ARCHITECTURE
  // ============================================================================
  let canvases = [];
  let activeCanvasId = '';

  let isRunning = false;
  let cancelExecution = false;
  let isLocalStorageWrite = false;
  let lastMatchedUrl = '';
  const cooldownMap = new Map();

  let floatingPos = {
    x: Math.max(16, window.innerWidth - 290),
    y: 20,
    minimized: false
  };

  function createDefaultCanvas(name) {
    return {
      id: 'canvas_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: name || 'Workflow 1',
      enabled: true,
      panX: 0,
      panY: 0,
      nodes: [
        {
          id: 'n_start',
          type: 'trigger',
          x: 50,
          y: 120,
          data: { triggerType: 'hotkey', value: 'Alt+Q' }
        }
      ],
      wires: []
    };
  }

  function getActiveCanvas() {
    let c = canvases.find(item => item.id === activeCanvasId);
    if (!c) {
      if (canvases.length === 0) {
        canvases.push(createDefaultCanvas('Main Workflow'));
      }
      activeCanvasId = canvases[0].id;
      c = canvases[0];
    }
    return c;
  }

  // Storage wrapper (Chrome Extension storage with localStorage fallback)
  const storage = {
    get(keys, cb) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(keys, (res) => cb(res || {}));
          return;
        }
      } catch (_) {}
      const out = {};
      keys.forEach(k => {
        try {
          const raw = localStorage.getItem('wms_cs_' + k);
          if (raw !== null) out[k] = JSON.parse(raw);
        } catch (_) {}
      });
      cb(out);
    },
    set(obj) {
      isLocalStorageWrite = true;
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set(obj, () => {
            setTimeout(() => { isLocalStorageWrite = false; }, 120);
          });
          return;
        }
      } catch (_) {}
      Object.keys(obj).forEach(k => {
        try { localStorage.setItem('wms_cs_' + k, JSON.stringify(obj[k])); } catch (_) {}
      });
      setTimeout(() => { isLocalStorageWrite = false; }, 120);
    }
  };

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
      width: 268px;
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
    #wms-floating-widget * {
      box-sizing: border-box;
    }
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
    .wms-mini-icon-btn:hover {
      color: #f8fafc;
      border-color: #38bdf8;
    }
    .wms-clip-label {
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      margin-bottom: 3px;
      display: flex;
      justify-content: space-between;
    }
    .wms-clip-input {
      width: 100%;
      height: 32px;
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
    .wms-btn-row {
      display: flex;
      gap: 6px;
    }
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

    /* FULLSCREEN CIRCUIT BOARD OVERLAY */
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

    /* CANVAS WORKSPACE TABS BAR */
    #wms-canvas-tabs-bar {
      height: 42px;
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
      padding: 5px 11px;
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
      border-radius: 7px 7px 0 0;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .wms-canvas-tab.active {
      background: #1e1b4b;
      color: #38bdf8;
      border-color: #6366f1;
      border-bottom-color: #38bdf8;
    }
    .wms-canvas-tab-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      cursor: pointer;
    }
    .wms-canvas-tab-dot.disabled {
      background: #64748b;
    }
    .wms-tab-action {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 11px;
      padding: 0 2px;
    }
    .wms-tab-action:hover { color: #f8fafc; }

    /* STUDIO TOOLBAR */
    #wms-circuit-toolbar {
      height: 52px;
      background: #0f172a;
      border-bottom: 2px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      gap: 8px;
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
      height: calc(100vh - 94px);
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

    .wms-wire-group {
      pointer-events: stroke;
      cursor: pointer;
    }
    .wms-wire-hitbox {
      fill: none;
      stroke: transparent;
      stroke-width: 16px;
    }
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
      min-height: 58px;
      resize: vertical;
      color: #a5f3fc;
    }
    .wms-input:focus, .wms-select:focus, .wms-textarea:focus { border-color: #38bdf8; }
    .wms-pick-row {
      display: flex;
      gap: 4px;
    }
    .wms-pick-btn {
      background: #334155;
      color: #f8fafc;
      border: 1px solid #475569;
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .wms-pick-btn:hover { background: #475569; }
    .wms-pick-btn.zone-btn {
      background: #065f46;
      border-color: #10b981;
      color: #d1fae5;
    }
    .wms-pick-btn.zone-btn:hover { background: #047857; }
    .wms-zone-badge {
      font-size: 10px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10b981;
      color: #6ee7b7;
      padding: 4px 6px;
      border-radius: 5px;
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
    .wms-pin-in {
      left: -10px;
      top: 46px;
    }
    .wms-pin-out {
      right: -10px;
      top: 46px;
    }
    .wms-pin-true {
      right: -10px;
      top: 38px;
      border-color: #10b981;
    }
    .wms-pin-true:hover, .wms-pin-true.pin-selected { background: #10b981; box-shadow: 0 0 10px #10b981; }
    .wms-pin-false {
      right: -10px;
      top: 76px;
      border-color: #f43f5e;
    }
    .wms-pin-false:hover, .wms-pin-false.pin-selected { background: #f43f5e; box-shadow: 0 0 10px #f43f5e; }

    .wms-pin-tag {
      position: absolute;
      right: 12px;
      font-size: 9px;
      font-weight: 800;
      pointer-events: none;
      text-transform: uppercase;
    }
    .wms-pin-tag-true { top: 38px; color: #10b981; }
    .wms-pin-tag-false { top: 76px; color: #f43f5e; }

    /* PICKER & ZONE HIGHLIGHT OVERLAYS */
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
  // 3. FLOATING WIDGET & CIRCUIT BOARD DOM
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
      <div class="wms-clip-label">
        <span>ACTIVE WORKFLOW CANVAS</span>
        <span style="display:flex; gap:3px;">
          <button class="wms-mini-icon-btn" id="wms-prev-canvas-btn" title="Previous Canvas Tab">◀</button>
          <button class="wms-mini-icon-btn" id="wms-next-canvas-btn" title="Next Canvas Tab">▶</button>
        </span>
      </div>
      <select id="wms-widget-canvas-select" class="wms-select" style="margin-bottom:8px; font-weight:700; color:#38bdf8;"></select>
      <div class="wms-clip-label"><span>BOX 1</span><span>Alt + 1</span></div>
      <textarea id="wms-box1" class="wms-clip-input" placeholder="Box 1 data..."></textarea>
      <div class="wms-clip-label"><span>BOX 2</span><span>Alt + 2</span></div>
      <textarea id="wms-box2" class="wms-clip-input" placeholder="Box 2 data..."></textarea>
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
        <button class="wms-add-node-btn" data-add="listener" style="background:#7c3aed;">+ 📡 Listener / Zone</button>
        <button class="wms-add-node-btn" data-add="ifelse" style="background:#e11d48;">+ 🔀 If / Else Zone</button>
        <button class="wms-add-node-btn" data-add="click" style="background:#2563eb;">+ 👆 Click</button>
        <button class="wms-add-node-btn" data-add="type" style="background:#059669;">+ ⌨️ Type</button>
        <button class="wms-add-node-btn" data-add="wait" style="background:#475569;">+ ⏳ Wait / Zone</button>
        <button class="wms-add-node-btn" data-add="tabswitch" style="background:#ca8a04;">+ 🗂️ Tab Select</button>
        <button class="wms-add-node-btn" data-add="script" style="background:#0e7490;">+ 💻 Script / Split</button>
      </div>
      <div style="display:flex; gap:6px; align-items:center;">
        <button id="wms-split-messy-btn" class="wms-add-node-btn" style="background:#0e7490;" title="Separate extra or messy block chains into their own fresh Canvas tabs">✂️ Split Mess to Fresh Canvas</button>
        <button id="wms-tidy-canvas-btn" class="wms-add-node-btn" style="background:#334155;" title="Auto-organize messy nodes into clean columns">✨ Clean Layout</button>
        <button id="wms-test-circuit-btn" class="wms-add-node-btn" style="background:#10b981;">▶ Run Canvas</button>
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
    const maxX = Math.max(10, window.innerWidth - (widget.offsetWidth || 268) - 10);
    const maxY = Math.max(10, window.innerHeight - (widget.offsetHeight || 60) - 10);
    floatingPos.x = Math.min(Math.max(10, floatingPos.x), maxX);
    floatingPos.y = Math.min(Math.max(10, floatingPos.y), maxY);
    widget.style.left = floatingPos.x + 'px';
    widget.style.top = floatingPos.y + 'px';
    widget.style.right = 'auto';
    if (widgetBody) {
      widgetBody.style.display = floatingPos.minimized ? 'none' : 'block';
    }
    if (minBtn) {
      minBtn.textContent = floatingPos.minimized ? '▢' : '—';
    }
  }

  function saveFloatingPosition() {
    storage.set({ wmsFloatingPos: floatingPos });
  }

  // ============================================================================
  // 4. STORAGE LOAD & SYNC
  // ============================================================================
  function saveAllCanvases() {
    storage.set({
      savedCanvases: canvases,
      activeCanvasId: activeCanvasId
    });
  }

  function refreshWidgetCanvasDropdown() {
    if (!widgetCanvasSelect) return;
    widgetCanvasSelect.innerHTML = canvases.map(c =>
      `<option value="${c.id}" ${c.id === activeCanvasId ? 'selected' : ''}>${escapeHtml(c.name)} ${c.enabled ? '🟢' : '⚪'}</option>`
    ).join('');
  }

  widgetCanvasSelect.addEventListener('change', (e) => {
    activeCanvasId = e.target.value;
    saveAllCanvases();
    renderWorkspace();
    setStatus(`Switched to "${getActiveCanvas().name}"`, '#38bdf8');
  });

  document.getElementById('wms-prev-canvas-btn').addEventListener('click', () => {
    if (canvases.length <= 1) return;
    const idx = canvases.findIndex(c => c.id === activeCanvasId);
    const prevIdx = (idx - 1 + canvases.length) % canvases.length;
    activeCanvasId = canvases[prevIdx].id;
    saveAllCanvases();
    renderWorkspace();
    setStatus(`Tab: ${canvases[prevIdx].name}`, '#38bdf8');
  });

  document.getElementById('wms-next-canvas-btn').addEventListener('click', () => {
    if (canvases.length <= 1) return;
    const idx = canvases.findIndex(c => c.id === activeCanvasId);
    const nextIdx = (idx + 1) % canvases.length;
    activeCanvasId = canvases[nextIdx].id;
    saveAllCanvases();
    renderWorkspace();
    setStatus(`Tab: ${canvases[nextIdx].name}`, '#38bdf8');
  });

  storage.get(['box1Data', 'box2Data', 'savedCanvases', 'activeCanvasId', 'savedCircuit', 'wmsFloatingPos'], (res) => {
    if (res.box1Data !== undefined) box1El.value = res.box1Data;
    if (res.box2Data !== undefined) box2El.value = res.box2Data;
    if (res.wmsFloatingPos && typeof res.wmsFloatingPos.x === 'number') {
      floatingPos = Object.assign(floatingPos, res.wmsFloatingPos);
    }
    applyFloatingPosition();

    if (Array.isArray(res.savedCanvases) && res.savedCanvases.length > 0) {
      canvases = res.savedCanvases;
      activeCanvasId = res.activeCanvasId || canvases[0].id;
    } else if (res.savedCircuit && Array.isArray(res.savedCircuit.nodes)) {
      const migrated = createDefaultCanvas('Main Workflow');
      migrated.nodes = res.savedCircuit.nodes;
      migrated.wires = res.savedCircuit.wires || [];
      migrated.panX = res.savedCircuit.panX || 0;
      migrated.panY = res.savedCircuit.panY || 0;
      canvases = [migrated];
      activeCanvasId = migrated.id;
      saveAllCanvases();
    } else {
      canvases = [createDefaultCanvas('Receiving Workflow')];
      activeCanvasId = canvases[0].id;
      saveAllCanvases();
    }

    renderWorkspace();
    setTimeout(checkUrlTriggers, 500);
  });

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (isLocalStorageWrite) return;
        if (changes.box1Data) box1El.value = changes.box1Data.newValue || '';
        if (changes.box2Data) box2El.value = changes.box2Data.newValue || '';
        if (changes.savedCanvases && Array.isArray(changes.savedCanvases.newValue)) {
          canvases = changes.savedCanvases.newValue;
          renderWorkspace();
        }
      });
    }
  } catch (_) {}

  box1El.addEventListener('input', () => storage.set({ box1Data: box1El.value }));
  box2El.addEventListener('input', () => storage.set({ box2Data: box2El.value }));

  // ============================================================================
  // 5. DRAGGABLE FLOATING WIDGET
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
    setStatus('Widget position reset', '#38bdf8');
  });

  window.addEventListener('resize', applyFloatingPosition);

  document.getElementById('wms-open-studio-btn').addEventListener('click', () => {
    overlay.style.display = 'flex';
    renderWorkspace();
  });

  document.getElementById('wms-close-studio-btn').addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  document.getElementById('wms-quick-run-btn').addEventListener('click', () => {
    runCanvasManually(getActiveCanvas());
  });

  document.getElementById('wms-test-circuit-btn').addEventListener('click', () => {
    overlay.style.display = 'none';
    runCanvasManually(getActiveCanvas());
  });

  // 2-step inline confirmation for Clear button (no confirm() popups)
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
    const current = getActiveCanvas();
    current.nodes = [];
    current.wires = [];
    current.panX = 0;
    current.panY = 0;
    saveAllCanvases();
    renderWorkspace();
    setStatus(`Cleared "${current.name}"`, '#f59e0b');
  });

  // Auto-Tidy / Clean Layout button to separate messy blocks into neat columns
  document.getElementById('wms-tidy-canvas-btn').addEventListener('click', () => {
    const current = getActiveCanvas();
    autoOrganizeCanvas(current);
    saveAllCanvases();
    renderWorkspace();
    setStatus(`Organized "${current.name}"`, '#10b981');
  });

  // Split messy / extra circuit chains into their own fresh Canvas tabs
  document.getElementById('wms-split-messy-btn').addEventListener('click', () => {
    const current = getActiveCanvas();
    const count = splitMessyCanvasIntoFreshTabs(current);
    if (count > 0) {
      saveAllCanvases();
      renderWorkspace();
      setStatus(`Split ${count} chain(s) into fresh Canvas tabs!`, '#10b981');
    } else {
      autoOrganizeCanvas(current);
      saveAllCanvases();
      renderWorkspace();
      setStatus('Tidied layout (use Script block ✂️ to split mid-chain)', '#38bdf8');
    }
  });

  function splitDownstreamToFreshCanvas(sourceCanvas, scriptNode) {
    const downstreamIds = new Set();
    const queue = [];
    sourceCanvas.wires.forEach(w => {
      if (w.from === scriptNode.id) queue.push(w.to);
    });

    while (queue.length > 0) {
      const currId = queue.shift();
      if (!currId || currId === scriptNode.id || downstreamIds.has(currId)) continue;
      downstreamIds.add(currId);
      sourceCanvas.wires.forEach(w => {
        if (w.from === currId && !downstreamIds.has(w.to)) {
          queue.push(w.to);
        }
      });
    }

    if (downstreamIds.size === 0) {
      setStatus('Wire blocks to the right of this Script block first!', '#f59e0b');
      return null;
    }

    const freshName = `${sourceCanvas.name} - Part ${canvases.length + 1}`;
    const freshCanvas = createDefaultCanvas(freshName);
    freshCanvas.nodes = sourceCanvas.nodes.filter(n => downstreamIds.has(n.id));
    freshCanvas.wires = sourceCanvas.wires.filter(w => downstreamIds.has(w.from) && downstreamIds.has(w.to));

    sourceCanvas.nodes = sourceCanvas.nodes.filter(n => !downstreamIds.has(n.id));
    sourceCanvas.wires = sourceCanvas.wires.filter(w => !downstreamIds.has(w.from) && !downstreamIds.has(w.to));

    autoOrganizeCanvas(freshCanvas);
    autoOrganizeCanvas(sourceCanvas);
    canvases.push(freshCanvas);

    scriptNode.data.preset = 'run_canvas';
    scriptNode.data.targetCanvasId = freshCanvas.id;

    saveAllCanvases();
    renderWorkspace();
    setStatus(`Moved ${downstreamIds.size} block(s) to "${freshName}"!`, '#10b981');
    return freshCanvas;
  }

  function splitMessyCanvasIntoFreshTabs(canvas) {
    if (!canvas || canvas.nodes.length <= 1) return 0;
    const adj = {};
    canvas.nodes.forEach(n => { adj[n.id] = new Set(); });
    canvas.wires.forEach(w => {
      if (adj[w.from] && adj[w.to]) {
        adj[w.from].add(w.to);
        adj[w.to].add(w.from);
      }
    });

    const visited = new Set();
    const components = [];
    canvas.nodes.forEach(n => {
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
      components.push(comp);
    });

    if (components.length === 1 && canvas.nodes.length >= 6) {
      autoOrganizeCanvas(canvas);
      const sorted = [...canvas.nodes].sort((a, b) => a.x - b.x);
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
        canvas.nodes.push(scriptNode);
        canvas.wires.forEach(w => {
          if (w.from === midNode.id) w.from = scriptId;
        });
        canvas.wires.push({
          id: 'w_' + Date.now() + '_link',
          from: midNode.id,
          fromPort: midNode.type === 'ifelse' || midNode.type === 'script' ? 'true' : 'out',
          to: scriptId
        });
        splitDownstreamToFreshCanvas(canvas, scriptNode);
        return 1;
      }
      return 0;
    }

    if (components.length <= 1) return 0;

    let movedChains = 0;
    for (let i = 1; i < components.length; i++) {
      const compIds = components[i];
      const fresh = createDefaultCanvas(`${canvas.name} #${canvases.length + 1}`);
      fresh.nodes = canvas.nodes.filter(n => compIds.has(n.id));
      fresh.wires = canvas.wires.filter(w => compIds.has(w.from) && compIds.has(w.to));
      autoOrganizeCanvas(fresh);
      canvases.push(fresh);

      canvas.nodes = canvas.nodes.filter(n => !compIds.has(n.id));
      canvas.wires = canvas.wires.filter(w => !compIds.has(w.from) && !compIds.has(w.to));
      movedChains++;
    }
    autoOrganizeCanvas(canvas);
    return movedChains;
  }

  function autoOrganizeCanvas(canvas) {
    if (!canvas || !canvas.nodes.length) return;
    const depthMap = {};
    canvas.nodes.forEach(n => {
      depthMap[n.id] = (n.type === 'trigger' || n.type === 'listener') ? 0 : 1;
    });
    for (let pass = 0; pass < canvas.nodes.length; pass++) {
      canvas.wires.forEach(w => {
        if (depthMap[w.from] !== undefined) {
          depthMap[w.to] = Math.max(depthMap[w.to] || 0, depthMap[w.from] + 1);
        }
      });
    }
    const columns = {};
    canvas.nodes.forEach(n => {
      const col = depthMap[n.id] || 0;
      if (!columns[col]) columns[col] = [];
      columns[col].push(n);
    });
    Object.keys(columns).forEach(colKey => {
      const colIdx = Number(colKey);
      columns[colKey].forEach((node, rowIdx) => {
        node.x = 50 + colIdx * 320;
        node.y = 70 + rowIdx * 230;
      });
    });
    canvas.panX = 0;
    canvas.panY = 0;
  }

  // ============================================================================
  // 6. MULTI-CANVAS TABS & WORKSPACE RENDERING
  // ============================================================================
  const NODE_META = {
    trigger:   { title: '⚡ START TRIGGER',        color: '#d97706', hasIn: false, outType: 'single' },
    listener:  { title: '📡 EVENT / ZONE WATCH',   color: '#7c3aed', hasIn: false, outType: 'single' },
    ifelse:    { title: '🔀 IF / ELSE (ZONE/EL)',  color: '#e11d48', hasIn: true,  outType: 'branch' },
    click:     { title: '👆 CLICK TARGET',         color: '#2563eb', hasIn: true,  outType: 'single' },
    type:      { title: '⌨️ TYPE TEXT',            color: '#059669', hasIn: true,  outType: 'single' },
    wait:      { title: '⏳ WAIT / ZONE WATCH',    color: '#475569', hasIn: true,  outType: 'single' },
    tabswitch: { title: '🗂️ TAB SELECT / MOVE',    color: '#ca8a04', hasIn: true,  outType: 'single' },
    script:    { title: '💻 SCRIPT / SUB-CANVAS',  color: '#0e7490', hasIn: true,  outType: 'branch' }
  };

  document.querySelectorAll('.wms-add-node-btn[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-add');
      const current = getActiveCanvas();
      const id = 'n_' + Date.now() + '_' + Math.floor(Math.random() * 999);
      const offset = (current.nodes.length % 6) * 28;

      const defaults = {
        trigger:   { triggerType: 'hotkey', value: 'Alt+W' },
        listener:  { mode: 'zone', eventType: 'zone_change', selector: '', zone: null, targetVal: '' },
        ifelse:    { mode: 'zone', condition: 'contains', selector: '', zone: null, value: '' },
        click:     { mode: 'selector', selector: '', clickText: '', zone: null },
        type:      { selector: '', source: 'box1', customText: '', pressEnter: true },
        wait:      { waitType: 'zone_change', selector: '', zone: null, textVal: '', ms: '800' },
        tabswitch: { tabMode: 'wms_tab', targetValue: '', zone: null, targetCanvasId: '', runAfterSwitch: false },
        script:    { preset: 'run_canvas', targetCanvasId: '', code: '// Available: box1, box2, setBox1(v), setBox2(v), clickText("OK"), switchTab("Putaway")\nreturn true;' }
      };

      current.nodes.push({
        id,
        type,
        x: Math.max(40, 140 - (current.panX || 0) + offset),
        y: Math.max(40, 90 - (current.panY || 0) + offset),
        data: JSON.parse(JSON.stringify(defaults[type]))
      });

      saveAllCanvases();
      renderWorkspace();
    });
  });

  function renderTabsBar() {
    tabsBar.innerHTML = '';
    canvases.forEach((c) => {
      const tab = document.createElement('div');
      tab.className = 'wms-canvas-tab' + (c.id === activeCanvasId ? ' active' : '');
      tab.innerHTML = `
        <span class="wms-canvas-tab-dot ${c.enabled ? '' : 'disabled'}" title="${c.enabled ? 'Canvas Active (Click to pause)' : 'Canvas Paused (Click to enable)'}"></span>
        <span class="wms-tab-name">${escapeHtml(c.name)}</span>
        <span style="font-size:10px; color:#64748b;">(${c.nodes.length})</span>
        ${canvases.length > 1 ? `<button class="wms-tab-action wms-tab-del" title="Delete Canvas">✖</button>` : ''}
      `;

      tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('wms-canvas-tab-dot') || e.target.classList.contains('wms-tab-del')) return;
        activeCanvasId = c.id;
        saveAllCanvases();
        renderWorkspace();
      });

      const nameSpan = tab.querySelector('.wms-tab-name');
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = c.name;
        inp.className = 'wms-input';
        inp.style.width = '110px';
        inp.style.padding = '2px 5px';
        nameSpan.replaceWith(inp);
        inp.focus();
        inp.select();
        const commit = () => {
          c.name = inp.value.trim() || c.name;
          saveAllCanvases();
          renderWorkspace();
        };
        inp.addEventListener('blur', commit);
        inp.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') commit();
        });
      });

      tab.querySelector('.wms-canvas-tab-dot').addEventListener('click', (e) => {
        e.stopPropagation();
        c.enabled = !c.enabled;
        saveAllCanvases();
        renderWorkspace();
      });

      const delBtn = tab.querySelector('.wms-tab-del');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (canvases.length <= 1) return;
          canvases = canvases.filter(item => item.id !== c.id);
          if (activeCanvasId === c.id) activeCanvasId = canvases[0].id;
          saveAllCanvases();
          renderWorkspace();
        });
      }

      tabsBar.appendChild(tab);
    });

    const addCanvasBtn = document.createElement('button');
    addCanvasBtn.className = 'wms-add-node-btn';
    addCanvasBtn.style.background = '#1e293b';
    addCanvasBtn.style.borderColor = '#38bdf8';
    addCanvasBtn.style.color = '#38bdf8';
    addCanvasBtn.textContent = '+ New Fresh Canvas';
    addCanvasBtn.addEventListener('click', () => {
      const fresh = createDefaultCanvas(`Workflow ${canvases.length + 1}`);
      canvases.push(fresh);
      activeCanvasId = fresh.id;
      saveAllCanvases();
      renderWorkspace();
      setStatus(`Created fresh canvas "${fresh.name}"`, '#10b981');
    });
    tabsBar.appendChild(addCanvasBtn);
  }

  function renderWorkspace() {
    const current = getActiveCanvas();
    renderTabsBar();
    refreshWidgetCanvasDropdown();

    stage.style.transform = `translate(${current.panX || 0}px, ${current.panY || 0}px)`;
    nodesLayer.innerHTML = '';

    current.nodes.forEach(node => {
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
          <div class="wms-pin wms-pin-true" data-node="${node.id}" data-port="true" title="True / Success Output"></div>
          <span class="wms-pin-tag wms-pin-tag-false">FALSE</span>
          <div class="wms-pin wms-pin-false" data-node="${node.id}" data-port="false" title="False / Fallback Output"></div>
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
        current.nodes = current.nodes.filter(n => n.id !== node.id);
        current.wires = current.wires.filter(w => w.from !== node.id && w.to !== node.id);
        saveAllCanvases();
        renderWorkspace();
      });

      bindNodeEvents(el, node, current);
      nodesLayer.appendChild(el);
    });

    renderWires();
  }

  function formatZoneSummary(zone) {
    if (!zone) return 'No Zone Drawn Yet';
    return `Zone (${Math.round(zone.xPct)}%, ${Math.round(zone.yPct)}% · ${Math.round(zone.wPct)}×${Math.round(zone.hPct)}%)`;
  }

  function buildNodeFields(node) {
    const d = node.data;

    if (node.type === 'trigger') {
      return `
        <div class="wms-field-label">When to Start</div>
        <select class="wms-select" data-key="triggerType">
          <option value="hotkey" ${d.triggerType === 'hotkey' ? 'selected' : ''}>⌨️ Hotkey Press</option>
          <option value="element" ${d.triggerType === 'element' ? 'selected' : ''}>⚡ Passive Element Appears</option>
          <option value="url" ${d.triggerType === 'url' ? 'selected' : ''}>🌐 Passive URL Contains</option>
        </select>
        <div class="wms-pick-row">
          <input type="text" class="wms-input" data-key="value" value="${escapeAttr(d.value || '')}" placeholder="${d.triggerType === 'hotkey' ? 'Press shortcut...' : d.triggerType === 'url' ? '/wms/pack' : 'Pick element...'}" ${d.triggerType === 'hotkey' ? 'readonly' : ''}>
          ${d.triggerType === 'element' ? `<button class="wms-pick-btn" data-pick="value">🎯</button>` : ''}
        </div>
      `;
    }

    if (node.type === 'listener') {
      const mode = d.mode || 'zone';
      return `
        <div class="wms-field-label">Watch Mode</div>
        <select class="wms-select" data-key="mode">
          <option value="zone" ${mode === 'zone' ? 'selected' : ''}>🔲 Screen Zone (Survives DOM Changes)</option>
          <option value="selector" ${mode === 'selector' ? 'selected' : ''}>🎯 Specific Element Selector</option>
        </select>
        ${mode === 'zone' ? `
          <div class="wms-zone-badge">
            <span>${formatZoneSummary(d.zone)}</span>
            <button class="wms-mini-icon-btn" data-preview-zone="true" title="Flash Zone on Screen">👁️</button>
          </div>
          <button class="wms-pick-btn zone-btn" data-draw-zone="true">🔲 Draw Screen Zone</button>
        ` : `
          <div class="wms-pick-row">
            <input type="text" class="wms-input" data-key="selector" value="${escapeAttr(d.selector || '')}" placeholder="Target selector...">
            <button class="wms-pick-btn" data-pick="selector">🎯</button>
          </div>
        `}
        <div class="wms-field-label">Trigger Event</div>
        <select class="wms-select" data-key="eventType">
          <option value="zone_change" ${d.eventType === 'zone_change' ? 'selected' : ''}>🔄 Any Change Inside Zone/Target</option>
          <option value="contains_text" ${d.eventType === 'contains_text' ? 'selected' : ''}>🔤 Text Contains</option>
          <option value="equals_text" ${d.eventType === 'equals_text' ? 'selected' : ''}>✅ Text Equals</option>
          <option value="num_gt" ${d.eventType === 'num_gt' ? 'selected' : ''}>🔢 Number &gt; Value</option>
          <option value="num_lt" ${d.eventType === 'num_lt' ? 'selected' : ''}>🔉 Number &lt; Value</option>
        </select>
        ${d.eventType !== 'zone_change' ? `
          <input type="text" class="wms-input" data-key="targetVal" value="${escapeAttr(d.targetVal || '')}" placeholder="Expected text or number...">
        ` : ''}
      `;
    }

    if (node.type === 'ifelse') {
      const mode = d.mode || 'zone';
      return `
        <div class="wms-field-label">Target Mode</div>
        <select class="wms-select" data-key="mode">
          <option value="zone" ${mode === 'zone' ? 'selected' : ''}>🔲 Screen Zone (Survives Element Changes)</option>
          <option value="selector" ${mode === 'selector' ? 'selected' : ''}>🎯 Specific Element Selector</option>
        </select>
        ${mode === 'zone' ? `
          <div class="wms-zone-badge">
            <span>${formatZoneSummary(d.zone)}</span>
            <div style="display:flex; gap:3px;">
              <button class="wms-mini-icon-btn" data-snapshot-zone="true" title="Update Zone Baseline Snapshot">🔄</button>
              <button class="wms-mini-icon-btn" data-preview-zone="true" title="Flash Zone on Screen">👁️</button>
            </div>
          </div>
          <button class="wms-pick-btn zone-btn" data-draw-zone="true">🔲 Draw Screen Zone</button>
        ` : `
          <div class="wms-pick-row">
            <input type="text" class="wms-input" data-key="selector" value="${escapeAttr(d.selector || '')}" placeholder="Element selector...">
            <button class="wms-pick-btn" data-pick="selector">🎯</button>
          </div>
        `}
        <div class="wms-field-label">If Condition</div>
        <select class="wms-select" data-key="condition">
          <option value="changed" ${d.condition === 'changed' ? 'selected' : ''}>🔄 Zone Content Changed (No Reassign)</option>
          <option value="exists" ${d.condition === 'exists' ? 'selected' : ''}>✔️ Has Visible Element / Content</option>
          <option value="contains" ${d.condition === 'contains' ? 'selected' : ''}>🔤 Text Contains</option>
          <option value="equals" ${d.condition === 'equals' ? 'selected' : ''}>🟰 Text Equals</option>
          <option value="gt" ${d.condition === 'gt' ? 'selected' : ''}>📈 Number &gt; Value</option>
          <option value="lt" ${d.condition === 'lt' ? 'selected' : ''}>📉 Number &lt; Value</option>
        </select>
        ${(d.condition !== 'exists' && d.condition !== 'changed') ? `
          <input type="text" class="wms-input" data-key="value" value="${escapeAttr(d.value || '')}" placeholder="Compare value (or {{box1}})...">
        ` : ''}
      `;
    }

    if (node.type === 'click') {
      const mode = d.mode || 'selector';
      return `
        <div class="wms-field-label">Click Method</div>
        <select class="wms-select" data-key="mode">
          <option value="selector" ${mode === 'selector' ? 'selected' : ''}>🎯 Element Selector</option>
          <option value="zone_text" ${mode === 'zone_text' ? 'selected' : ''}>🔲 Click Button Inside Zone</option>
        </select>
        ${mode === 'zone_text' ? `
          <div class="wms-zone-badge">
            <span>${formatZoneSummary(d.zone)}</span>
            <button class="wms-mini-icon-btn" data-preview-zone="true">👁️</button>
          </div>
          <button class="wms-pick-btn zone-btn" data-draw-zone="true">🔲 Draw Zone</button>
          <input type="text" class="wms-input" data-key="clickText" value="${escapeAttr(d.clickText || '')}" placeholder="Optional button label inside zone...">
        ` : `
          <div class="wms-pick-row">
            <input type="text" class="wms-input" data-key="selector" value="${escapeAttr(d.selector || '')}" placeholder="Button selector...">
            <button class="wms-pick-btn" data-pick="selector">🎯 Pick</button>
          </div>
        `}
      `;
    }

    if (node.type === 'type') {
      return `
        <div class="wms-field-label">Input Field</div>
        <div class="wms-pick-row">
          <input type="text" class="wms-input" data-key="selector" value="${escapeAttr(d.selector || '')}" placeholder="Input selector...">
          <button class="wms-pick-btn" data-pick="selector">🎯</button>
        </div>
        <div class="wms-field-label">Text Source</div>
        <select class="wms-select" data-key="source">
          <option value="box1" ${d.source === 'box1' ? 'selected' : ''}>📋 Box 1 Data</option>
          <option value="box2" ${d.source === 'box2' ? 'selected' : ''}>📋 Box 2 Data</option>
          <option value="custom" ${d.source === 'custom' ? 'selected' : ''}>✏️ Custom Text</option>
        </select>
        ${d.source === 'custom' ? `<input type="text" class="wms-input" data-key="customText" value="${escapeAttr(d.customText || '')}" placeholder="Custom text...">` : ''}
        <label style="font-size:10px; color:#cbd5e1; display:flex; align-items:center; gap:5px; cursor:pointer;">
          <input type="checkbox" data-key="pressEnter" ${d.pressEnter !== false ? 'checked' : ''}> Press Enter After Typing
        </label>
      `;
    }

    if (node.type === 'wait') {
      return `
        <div class="wms-field-label">Wait Mode</div>
        <select class="wms-select" data-key="waitType">
          <option value="zone_change" ${d.waitType === 'zone_change' ? 'selected' : ''}>🔲 Wait for Zone Content to Change</option>
          <option value="zone_appear" ${d.waitType === 'zone_appear' ? 'selected' : ''}>🔲 Wait for Any Element in Zone</option>
          <option value="zone_text" ${d.waitType === 'zone_text' ? 'selected' : ''}>🔲 Wait for Specific Text in Zone</option>
          <option value="element" ${d.waitType === 'element' ? 'selected' : ''}>🎯 Wait for Element Selector</option>
          <option value="time" ${d.waitType === 'time' ? 'selected' : ''}>⏱️ Fixed Time (ms)</option>
        </select>
        ${(d.waitType === 'zone_change' || d.waitType === 'zone_appear' || d.waitType === 'zone_text') ? `
          <div class="wms-zone-badge">
            <span>${formatZoneSummary(d.zone)}</span>
            <button class="wms-mini-icon-btn" data-preview-zone="true" title="Flash Zone on Screen">👁️</button>
          </div>
          <button class="wms-pick-btn zone-btn" data-draw-zone="true">🔲 Draw Screen Zone</button>
          ${d.waitType === 'zone_text' ? `<input type="text" class="wms-input" data-key="textVal" value="${escapeAttr(d.textVal || '')}" placeholder="Wait until zone contains text (or {{box1}})...">` : ''}
        ` : d.waitType === 'time' ? `
          <input type="number" class="wms-input" data-key="ms" value="${escapeAttr(d.ms || '800')}" placeholder="Milliseconds (e.g. 800)">
        ` : `
          <div class="wms-pick-row">
            <input type="text" class="wms-input" data-key="selector" value="${escapeAttr(d.selector || '')}" placeholder="Selector to wait for...">
            <button class="wms-pick-btn" data-pick="selector">🎯 Pick</button>
          </div>
        `}
      `;
    }

    if (node.type === 'tabswitch') {
      const tabMode = d.tabMode || 'wms_tab';
      const otherCanvases = canvases.filter(c => c.id !== activeCanvasId);
      return `
        <div class="wms-field-label">Tab Destination Type</div>
        <select class="wms-select" data-key="tabMode">
          <option value="wms_tab" ${tabMode === 'wms_tab' ? 'selected' : ''}>📑 In-Page WMS Tab (By Name / Zone)</option>
          <option value="browser_tab" ${tabMode === 'browser_tab' ? 'selected' : ''}>🌐 Browser Tab (By URL or Title)</option>
          <option value="canvas_tab" ${tabMode === 'canvas_tab' ? 'selected' : ''}>🧩 Workflow Canvas Tab</option>
        </select>
        ${tabMode === 'wms_tab' ? `
          <input type="text" class="wms-input" data-key="targetValue" value="${escapeAttr(d.targetValue || '')}" placeholder="Tab text (e.g. Putaway, Lines)...">
          <div class="wms-zone-badge">
            <span>${formatZoneSummary(d.zone)}</span>
            <button class="wms-mini-icon-btn" data-preview-zone="true" title="Optional Zone for Tab Bar">👁️</button>
          </div>
          <button class="wms-pick-btn zone-btn" data-draw-zone="true">🔲 Optional: Draw Tab Bar Zone</button>
        ` : tabMode === 'browser_tab' ? `
          <input type="text" class="wms-input" data-key="targetValue" value="${escapeAttr(d.targetValue || '')}" placeholder="URL part or Tab name (e.g. /outbound)...">
          <div style="font-size:10px; color:#94a3b8;">Moves focus to matching open Browser Tab (or opens it).</div>
        ` : `
          <select class="wms-select" data-key="targetCanvasId">
            <option value="">-- Select Canvas Tab --</option>
            ${otherCanvases.map(c => `<option value="${c.id}" ${d.targetCanvasId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
          <label style="font-size:10px; color:#cbd5e1; display:flex; align-items:center; gap:5px; cursor:pointer;">
            <input type="checkbox" data-key="runAfterSwitch" ${d.runAfterSwitch ? 'checked' : ''}> Also Run Target Canvas Immediately
          </label>
        `}
      `;
    }

    if (node.type === 'script') {
      const preset = d.preset || 'run_canvas';
      const otherCanvases = canvases.filter(c => c.id !== activeCanvasId);
      return `
        <div class="wms-field-label">Script / Canvas Organizer</div>
        <select class="wms-select" data-key="preset">
          <option value="run_canvas" ${preset === 'run_canvas' ? 'selected' : ''}>🚀 Run Another Fresh Canvas</option>
          <option value="custom" ${preset === 'custom' ? 'selected' : ''}>💻 Custom JS Code</option>
          <option value="inc_box1" ${preset === 'inc_box1' ? 'selected' : ''}>➕ Increment Number in Box 1 (+1)</option>
        </select>
        <button class="wms-pick-btn zone-btn" data-split-downstream="true" title="Moves all blocks wired after this block into a brand-new fresh Canvas tab!">✂️ Move Downstream Blocks to Fresh Canvas</button>
        ${preset === 'run_canvas' ? `
          <div class="wms-field-label">Target Fresh Canvas</div>
          <div class="wms-pick-row">
            <select class="wms-select" data-key="targetCanvasId">
              <option value="">-- Choose Workflow Canvas --</option>
              ${otherCanvases.map(c => `<option value="${c.id}" ${d.targetCanvasId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
            ${d.targetCanvasId ? `<button class="wms-pick-btn" data-jump-canvas="${escapeAttr(d.targetCanvasId)}" title="Open that Canvas Tab">↗️</button>` : ''}
          </div>
        ` : preset === 'custom' ? `
          <textarea class="wms-textarea" data-key="code" placeholder="return true;">${escapeHtml(d.code || '')}</textarea>
        ` : `
          <div style="font-size:10px; color:#94a3b8;">Adds +1 to Box 1 numeric value and continues to TRUE.</div>
        `}
      `;
    }

    return '';
  }

  function bindNodeEvents(el, node, currentCanvas) {
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
          saveAllCanvases();
        });
        return;
      }

      const evtName = (input.tagName === 'SELECT' || input.type === 'checkbox') ? 'change' : 'input';
      input.addEventListener(evtName, (e) => {
        node.data[key] = input.type === 'checkbox' ? input.checked : e.target.value;
        saveAllCanvases();
        if (input.tagName === 'SELECT') renderWorkspace();
      });
    });

    el.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetKey = btn.getAttribute('data-pick');
        startElementPicker((selector) => {
          node.data[targetKey] = selector;
          saveAllCanvases();
          renderWorkspace();
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
          saveAllCanvases();
          renderWorkspace();
        });
      });
    }

    const previewZoneBtn = el.querySelector('[data-preview-zone]');
    if (previewZoneBtn) {
      previewZoneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!node.data.zone) {
          setStatus('Draw a zone first with 🔲 Draw Screen Zone', '#f59e0b');
          return;
        }
        overlay.style.display = 'none';
        flashZoneRect(node.data.zone, 1400, () => {
          overlay.style.display = 'flex';
        });
      });
    }

    const snapshotZoneBtn = el.querySelector('[data-snapshot-zone]');
    if (snapshotZoneBtn) {
      snapshotZoneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!node.data.zone) {
          setStatus('Draw a zone first!', '#f59e0b');
          return;
        }
        node.data.zone.baselineText = getZoneSnapshotText(node.data.zone);
        node.data._lastSeenText = node.data.zone.baselineText;
        saveAllCanvases();
        setStatus('Zone baseline updated!', '#10b981');
      });
    }

    const splitDownstreamBtn = el.querySelector('[data-split-downstream]');
    if (splitDownstreamBtn) {
      splitDownstreamBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        splitDownstreamToFreshCanvas(currentCanvas, node);
      });
    }

    const jumpCanvasBtn = el.querySelector('[data-jump-canvas]');
    if (jumpCanvasBtn) {
      jumpCanvasBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = jumpCanvasBtn.getAttribute('data-jump-canvas');
        if (targetId && canvases.some(c => c.id === targetId)) {
          activeCanvasId = targetId;
          saveAllCanvases();
          renderWorkspace();
          setStatus(`Switched to "${getActiveCanvas().name}"`, '#38bdf8');
        }
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
        beginWiringInteraction(nodeId, port, pin, e);
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
  // 7. WIRING & CANVAS PANNING INTERACTIONS
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
    const current = getActiveCanvas();

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
      current.wires = current.wires.filter(w => !(w.from === fromNode && w.fromPort === fromPort && w.to === toNode));
      current.wires.push({
        id: 'w_' + Date.now() + '_' + Math.floor(Math.random() * 999),
        from: fromNode,
        fromPort: fromPort,
        to: toNode
      });
      saveAllCanvases();
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
      const current = getActiveCanvas();
      activeCanvasPan = {
        startX: e.clientX,
        startY: e.clientY,
        origPanX: current.panX || 0,
        origPanY: current.panY || 0
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
      const current = getActiveCanvas();
      current.panX = activeCanvasPan.origPanX + (e.clientX - activeCanvasPan.startX);
      current.panY = activeCanvasPan.origPanY + (e.clientY - activeCanvasPan.startY);
      stage.style.transform = `translate(${current.panX}px, ${current.panY}px)`;
    }
    if (activeWireStart) {
      const current = getActiveCanvas();
      const rect = viewport.getBoundingClientRect();
      activeWireStart.currX = e.clientX - rect.left - (current.panX || 0);
      activeWireStart.currY = e.clientY - rect.top - (current.panY || 0);
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
      saveAllCanvases();
    }
    if (activeCanvasPan) {
      activeCanvasPan = null;
      saveAllCanvases();
    }
    if (activeWireStart && activeWireStart.isDragging) {
      activeWireStart.isDragging = false;
    }
  }

  document.addEventListener('mousemove', onGlobalMouseMove);
  document.addEventListener('mouseup', onGlobalMouseUp);

  function getPinStageCoords(nodeId, port) {
    const current = getActiveCanvas();
    const node = current.nodes.find(n => n.id === nodeId);
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
    const current = getActiveCanvas();
    wiresSvg.innerHTML = '';

    current.wires.forEach((w, idx) => {
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
        current.wires.splice(idx, 1);
        saveAllCanvases();
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
  // 8. SCREEN ZONE DRAWER & ZONE ENGINE (SURVIVES ELEMENT REBUILDS)
  // ============================================================================
  function startZoneDrawer(callback) {
    overlay.style.display = 'none';
    setStatus('Drag a rectangle on screen to define Zone...', '#10b981');

    const drawer = document.createElement('div');
    drawer.id = 'wms-zone-drawer-overlay';
    drawer.innerHTML = `<div id="wms-zone-drawer-banner">🔲 Click & Drag a box around the WMS Zone you want to watch/check (ESC to cancel)</div>`;
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
      setStatus('Zone captured!', '#10b981');
      callback(zoneData);
    }

    function onEsc(e) {
      if (e.key === 'Escape') {
        cleanup();
        overlay.style.display = 'flex';
        setStatus('Zone drawing cancelled', '#94a3b8');
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

  function flashZoneRect(zone, durationMs = 900, onDone) {
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
    const candidates = document.body.querySelectorAll('*');
    const matched = [];
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
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
    if (parts.length === 0 && els.length > 0) {
      return `[elements:${els.length}]`;
    }
    return parts.join(' | ');
  }

  // ============================================================================
  // 9. TARGET ELEMENT PICKER & SAFETY VALIDATORS
  // ============================================================================
  function startElementPicker(callback) {
    overlay.style.display = 'none';
    setStatus('Click an element on the page (ESC to cancel)...', '#f59e0b');
    let hovered = null;

    function cleanupPicker() {
      if (hovered) hovered.classList.remove('wms-picker-highlight');
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onEsc, true);
    }

    function onOver(e) {
      if (widget.contains(e.target) || overlay.contains(e.target)) return;
      if (hovered) hovered.classList.remove('wms-picker-highlight');
      hovered = e.target;
      hovered.classList.add('wms-picker-highlight');
    }

    function onClick(e) {
      if (widget.contains(e.target) || overlay.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      cleanupPicker();
      const sel = buildRobustSelector(e.target);
      overlay.style.display = 'flex';
      setStatus('Picked: ' + sel, '#10b981');
      callback(sel);
    }

    function onEsc(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanupPicker();
        overlay.style.display = 'flex';
        setStatus('Element picker cancelled', '#94a3b8');
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
      if (curr.className && typeof curr.className === 'string') {
        const validClasses = curr.className
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
    el.click();
  }

  // ============================================================================
  // 10. CIRCUIT EXECUTION ENGINE (ZONE + MULTI-CANVAS + SCRIPT BLOCKS)
  // ============================================================================
  function runCanvasManually(canvas, isSubCall = false, callDepth = 0) {
    if (!canvas || !canvas.nodes.length) {
      setStatus('Canvas is empty!', '#f43f5e');
      return Promise.resolve(false);
    }
    if (callDepth > 5) {
      setStatus('Stop: Max sub-canvas depth reached', '#f43f5e');
      return Promise.resolve(false);
    }
    const startNode =
      canvas.nodes.find(n => (n.type === 'trigger' || n.type === 'listener') && canvas.wires.some(w => w.from === n.id)) ||
      canvas.nodes.find(n => n.type === 'trigger' || n.type === 'listener') ||
      canvas.nodes[0];

    return executeFromNode(canvas, startNode.id, isSubCall, callDepth);
  }

  async function executeFromNode(canvas, startNodeId, isSubCall = false, callDepth = 0) {
    if (isRunning && !isSubCall) return false;
    if (!isSubCall) {
      isRunning = true;
      cancelExecution = false;
      widget.style.borderColor = '#f59e0b';
    }
    setStatus(`Running "${canvas.name}"...`, '#f59e0b');

    let currentId = startNodeId;
    let hopCount = 0;

    while (currentId && !cancelExecution && hopCount < 60) {
      hopCount++;
      const node = canvas.nodes.find(n => n.id === currentId);
      if (!node) break;

      const domNode = document.getElementById(node.id);
      if (domNode) domNode.classList.add('node-running');

      let outPort = 'out';

      try {
        if (node.type === 'click') {
          setStatus('Step: Click', '#3b82f6');
          if (node.data.mode === 'zone_text' && node.data.zone) {
            flashZoneRect(node.data.zone, 350);
            const els = getElementsInZone(node.data.zone);
            const filterText = resolveDynamicValue(node.data.clickText || '').toLowerCase();
            const candidates = els.filter(el => {
              if (!isElementUsable(el)) return false;
              const isInteractive = ['BUTTON', 'A', 'INPUT'].includes(el.tagName) ||
                el.getAttribute('role') === 'button' ||
                el.getAttribute('role') === 'tab' ||
                typeof el.onclick === 'function' ||
                window.getComputedStyle(el).cursor === 'pointer';
              if (!filterText) return isInteractive;
              const txt = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
              return txt.includes(filterText);
            });
            const clickable = candidates.reverse().find(el =>
              ['BUTTON', 'A', 'INPUT'].includes(el.tagName) || el.getAttribute('role') === 'button'
            ) || candidates[0];
            if (!clickable) {
              setStatus('Stop: No clickable target in Zone', '#f43f5e');
              if (domNode) domNode.classList.remove('node-running');
              break;
            }
            triggerRealClick(clickable);
          } else {
            const target = await waitForTarget(node.data.selector, 3500);
            if (!target) {
              setStatus('Stop: Click target missing/blocked', '#f43f5e');
              if (domNode) domNode.classList.remove('node-running');
              break;
            }
            triggerRealClick(target);
          }
          await sleep(180);
        }

        else if (node.type === 'type') {
          setStatus('Step: Type Text', '#10b981');
          const target = await waitForTarget(node.data.selector, 3500);
          if (!target) {
            setStatus('Stop: Input target missing/blocked', '#f43f5e');
            if (domNode) domNode.classList.remove('node-running');
            break;
          }
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

        else if (node.type === 'wait') {
          if (node.data.waitType === 'time') {
            const ms = Math.max(50, parseInt(node.data.ms, 10) || 500);
            setStatus(`Waiting ${ms}ms...`, '#94a3b8');
            await sleep(ms);
          } else if (node.data.waitType === 'zone_change' && node.data.zone) {
            setStatus('Waiting for Zone content to change...', '#10b981');
            flashZoneRect(node.data.zone, 450);
            const changed = await waitForZoneChange(node.data.zone, 10000);
            if (!changed) {
              setStatus('Stop: Zone did not change (10s)', '#f43f5e');
              if (domNode) domNode.classList.remove('node-running');
              break;
            }
          } else if (node.data.waitType === 'zone_appear' && node.data.zone) {
            setStatus('Waiting for any element in Zone...', '#10b981');
            flashZoneRect(node.data.zone, 450);
            const appeared = await waitForZoneAppear(node.data.zone, 10000);
            if (!appeared) {
              setStatus('Stop: Zone remained empty (10s)', '#f43f5e');
              if (domNode) domNode.classList.remove('node-running');
              break;
            }
          } else if (node.data.waitType === 'zone_text' && node.data.zone) {
            const expected = resolveDynamicValue(node.data.textVal || '');
            setStatus(`Waiting for Zone text "${expected}"...`, '#10b981');
            flashZoneRect(node.data.zone, 450);
            const matched = await waitForZoneText(node.data.zone, expected, 10000);
            if (!matched) {
              setStatus('Stop: Zone text timeout (10s)', '#f43f5e');
              if (domNode) domNode.classList.remove('node-running');
              break;
            }
          } else {
            setStatus('Waiting for element...', '#94a3b8');
            const found = await waitForTarget(node.data.selector, 10000);
            if (!found) {
              setStatus('Stop: Wait timed out (10s)', '#f43f5e');
              if (domNode) domNode.classList.remove('node-running');
              break;
            }
          }
        }

        else if (node.type === 'tabswitch') {
          setStatus('Step: Switching Tab...', '#ca8a04');
          const switched = await executeTabSwitchBlock(node, callDepth);
          if (!switched) {
            setStatus('Stop: Target tab not found', '#f43f5e');
            if (domNode) domNode.classList.remove('node-running');
            break;
          }
          await sleep(220);
        }

        else if (node.type === 'ifelse') {
          const passed = evaluateIfElseNode(node);
          outPort = passed ? 'true' : 'false';
          setStatus(`If/Else -> ${passed ? 'TRUE' : 'FALSE'}`, passed ? '#10b981' : '#f43f5e');
          await sleep(140);
        }

        else if (node.type === 'script') {
          setStatus('Step: Script Block', '#0e7490');
          const result = await executeScriptBlock(node, callDepth);
          outPort = result ? 'true' : 'false';
          await sleep(140);
        }
      } catch (err) {
        console.warn('WMS Circuit Error:', err);
        setStatus('Circuit stopped on error', '#f43f5e');
        if (domNode) domNode.classList.remove('node-running');
        break;
      }

      if (domNode) domNode.classList.remove('node-running');

      const nextWire = canvas.wires.find(w => w.from === currentId && w.fromPort === outPort);
      currentId = nextWire ? nextWire.to : null;
    }

    if (!isSubCall) {
      isRunning = false;
      widget.style.borderColor = '#334155';
      if (cancelExecution) {
        setStatus('Aborted by user', '#f43f5e');
      } else if (statusLine.textContent.startsWith('Running') || statusLine.textContent.startsWith('Step:')) {
        setStatus('Done ✓', '#10b981');
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

  function evaluateIfElseNode(node) {
    const cond = node.data.condition;
    const expected = resolveDynamicValue(node.data.value);
    const mode = node.data.mode || 'zone';

    if (mode === 'zone' && node.data.zone) {
      flashZoneRect(node.data.zone, 350);
      const els = getElementsInZone(node.data.zone);
      if (cond === 'exists') return els.length > 0;
      const text = getZoneSnapshotText(node.data.zone);
      if (cond === 'changed') {
        const prev = node.data.zone.baselineText || '';
        const hasChanged = text !== prev;
        if (hasChanged) {
          node.data.zone.baselineText = text;
          saveAllCanvases();
        }
        return hasChanged;
      }
      if (cond === 'contains') return text.toLowerCase().includes(expected.toLowerCase());
      if (cond === 'equals') return text.toLowerCase() === expected.toLowerCase();
      const numActual = parseFloat(text.replace(/[^0-9.-]+/g, ''));
      const numTarget = parseFloat(expected);
      if (cond === 'gt') return !isNaN(numActual) && !isNaN(numTarget) && numActual > numTarget;
      if (cond === 'lt') return !isNaN(numActual) && !isNaN(numTarget) && numActual < numTarget;
      return false;
    }

    const el = safeQuery(node.data.selector);
    if (cond === 'exists') return isElementUsable(el);
    if (!el) return false;

    const raw = (el.value !== undefined && el.value !== '' ? String(el.value) : String(el.textContent || '')).trim();
    if (cond === 'changed') {
      const prev = node.data._lastElText;
      node.data._lastElText = raw;
      return prev !== undefined && raw !== prev;
    }
    if (cond === 'contains') return raw.toLowerCase().includes(expected.toLowerCase());
    if (cond === 'equals') return raw === expected;

    const numActual = parseFloat(raw.replace(/[^0-9.-]+/g, ''));
    const numTarget = parseFloat(expected);
    if (cond === 'gt') return !isNaN(numActual) && !isNaN(numTarget) && numActual > numTarget;
    if (cond === 'lt') return !isNaN(numActual) && !isNaN(numTarget) && numActual < numTarget;
    return false;
  }

  async function executeTabSwitchBlock(node, callDepth = 0) {
    const mode = node.data.tabMode || 'wms_tab';
    const targetVal = resolveDynamicValue(node.data.targetValue || '');

    if (mode === 'canvas_tab') {
      const targetCanvas = canvases.find(c => c.id === node.data.targetCanvasId);
      if (!targetCanvas) return false;
      activeCanvasId = targetCanvas.id;
      saveAllCanvases();
      renderWorkspace();
      if (node.data.runAfterSwitch) {
        await runCanvasManually(targetCanvas, true, callDepth + 1);
      }
      return true;
    }

    if (mode === 'wms_tab') {
      const pool = (node.data.zone)
        ? getElementsInZone(node.data.zone)
        : Array.from(document.querySelectorAll('[role="tab"], .tab, .nav-link, .mat-tab-label, .p-tabview-nav-link, button, a, li, span'));
      const needle = targetVal.toLowerCase();
      const candidates = pool.filter(el => {
        if (!isElementUsable(el)) return false;
        const txt = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
        return needle ? txt.includes(needle) : (el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON' || el.tagName === 'A');
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
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: 'WMS_SWITCH_TAB', query: targetVal });
        }
      } catch (_) {}

      try {
        const bc = new BroadcastChannel('wms_circuit_tab_channel');
        bc.postMessage({ type: 'FOCUS_TAB', query: targetVal });
        bc.close();
      } catch (_) {}

      if (/^https?:\/\//i.test(targetVal) || targetVal.startsWith('/')) {
        window.open(targetVal, 'wms_target_' + targetVal.replace(/[^a-z0-9]/gi, '_'));
      }
      return true;
    }

    return false;
  }

  async function executeScriptBlock(node, callDepth = 0) {
    const preset = node.data.preset || 'custom';
    if (preset === 'inc_box1') {
      const currentNum = parseFloat(box1El.value) || 0;
      box1El.value = String(currentNum + 1);
      storage.set({ box1Data: box1El.value });
      return true;
    }
    if (preset === 'run_canvas') {
      const targetCanvas = canvases.find(c => c.id === node.data.targetCanvasId);
      if (!targetCanvas) return false;
      return await runCanvasManually(targetCanvas, true, callDepth + 1);
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
        node.data.code || 'return true;'
      );
      const res = await fn(
        box1El.value,
        box2El.value,
        (v) => { box1El.value = String(v); storage.set({ box1Data: box1El.value }); },
        (v) => { box2El.value = String(v); storage.set({ box2Data: box2El.value }); },
        (label) => {
          const all = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
          const match = all.find(el => (el.textContent || el.value || '').toLowerCase().includes(String(label).toLowerCase()) && isElementUsable(el));
          if (match) { triggerRealClick(match); return true; }
          return false;
        },
        (tabName) => executeTabSwitchBlock({ data: { tabMode: 'wms_tab', targetValue: tabName } }, callDepth + 1),
        (canvasName) => {
          const target = canvases.find(c => c.name.toLowerCase() === String(canvasName).toLowerCase());
          if (target) {
            return runCanvasManually(target, true, callDepth + 1);
          }
          return false;
        }
      );
      return res !== false;
    } catch (e) {
      console.warn('Custom Script Block Error:', e);
      return false;
    }
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function waitForTarget(selector, timeoutMs) {
    return new Promise(resolve => {
      const immediate = safeQuery(selector);
      if (immediate && isElementUsable(immediate)) return resolve(immediate);

      let finished = false;
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        obs.disconnect();
        resolve(null);
      }, timeoutMs);

      const obs = new MutationObserver(() => {
        if (cancelExecution) {
          finished = true;
          clearTimeout(timer);
          obs.disconnect();
          resolve(null);
          return;
        }
        const candidate = safeQuery(selector);
        if (candidate && isElementUsable(candidate)) {
          finished = true;
          clearTimeout(timer);
          obs.disconnect();
          resolve(candidate);
        }
      });

      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    });
  }

  function waitForZoneChange(zone, timeoutMs) {
    return new Promise(resolve => {
      const initialText = getZoneSnapshotText(zone);
      const start = Date.now();
      const interval = setInterval(() => {
        if (cancelExecution) {
          clearInterval(interval);
          resolve(false);
          return;
        }
        const currentText = getZoneSnapshotText(zone);
        if (currentText !== initialText) {
          zone.baselineText = currentText;
          saveAllCanvases();
          clearInterval(interval);
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 160);
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
        const els = getElementsInZone(zone);
        if (els.length > 0) {
          clearInterval(interval);
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 160);
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
        const currentText = getZoneSnapshotText(zone).toLowerCase();
        if (needle && currentText.includes(needle)) {
          clearInterval(interval);
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 160);
    });
  }

  // ============================================================================
  // 11. TRIGGERS, LISTENERS, HOTKEYS & HUMAN SAFETY OVERRIDE
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

    for (const canvas of canvases) {
      if (!canvas.enabled) continue;
      const trig = canvas.nodes.find(n =>
        n.type === 'trigger' &&
        n.data.triggerType === 'hotkey' &&
        (n.data.value || '').toUpperCase() === combo.toUpperCase()
      );
      if (trig) {
        e.preventDefault();
        executeFromNode(canvas, trig.id);
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

    for (const canvas of canvases) {
      if (!canvas.enabled) continue;

      for (const node of canvas.nodes) {
        if (node.type === 'trigger' && node.data.triggerType === 'element' && node.data.value) {
          const el = safeQuery(node.data.value);
          if (el && isElementUsable(el)) {
            const last = cooldownMap.get(node.id) || 0;
            if (now - last > 5000) {
              cooldownMap.set(node.id, now);
              executeFromNode(canvas, node.id);
              return;
            }
          }
        }

        if (node.type === 'listener') {
          const last = cooldownMap.get(node.id) || 0;
          if (now - last <= 4000) continue;

          const mode = node.data.mode || 'zone';
          let raw = '';

          if (mode === 'zone' && node.data.zone) {
            raw = getZoneSnapshotText(node.data.zone);
          } else {
            const el = safeQuery(node.data.selector);
            if (!el || !isElementUsable(el)) continue;
            raw = (el.value !== undefined && el.value !== '' ? String(el.value) : String(el.textContent || '')).trim();
          }

          const targetVal = resolveDynamicValue(node.data.targetVal || '');
          const evt = node.data.eventType;
          let matched = false;

          if (evt === 'zone_change') {
            const prev = node.data._lastSeenText !== undefined
              ? node.data._lastSeenText
              : (node.data.zone ? node.data.zone.baselineText : undefined);
            if (prev === undefined) {
              node.data._lastSeenText = raw;
            } else if (raw !== prev) {
              node.data._lastSeenText = raw;
              matched = true;
            }
          } else if (raw && evt === 'contains_text' && targetVal && raw.toLowerCase().includes(targetVal.toLowerCase())) {
            matched = true;
          } else if (raw && evt === 'equals_text' && targetVal && raw.toLowerCase() === targetVal.toLowerCase()) {
            matched = true;
          } else if (raw && (evt === 'num_gt' || evt === 'num_lt')) {
            const nActual = parseFloat(raw.replace(/[^0-9.-]+/g, ''));
            const nTarget = parseFloat(targetVal);
            if (!isNaN(nActual) && !isNaN(nTarget)) {
              matched = evt === 'num_gt' ? nActual > nTarget : nActual < nTarget;
            }
          }

          if (matched) {
            cooldownMap.set(node.id, now);
            executeFromNode(canvas, node.id);
            return;
          }
        }
      }
    }
  }

  function checkUrlTriggers() {
    const href = window.location.href;
    if (href === lastMatchedUrl) return;
    for (const canvas of canvases) {
      if (!canvas.enabled) continue;
      const urlTrig = canvas.nodes.find(n =>
        n.type === 'trigger' &&
        n.data.triggerType === 'url' &&
        n.data.value &&
        href.includes(n.data.value)
      );
      if (urlTrig) {
        lastMatchedUrl = href;
        executeFromNode(canvas, urlTrig.id);
        break;
      }
    }
  }

  let tabChannel = null;
  try {
    tabChannel = new BroadcastChannel('wms_circuit_tab_channel');
    tabChannel.onmessage = (ev) => {
      if (!ev.data || ev.data.type !== 'FOCUS_TAB') return;
      const q = String(ev.data.query || '').toLowerCase();
      if (!q) return;
      if (window.location.href.toLowerCase().includes(q) || document.title.toLowerCase().includes(q)) {
        try { window.focus(); } catch (_) {}
        setStatus(`Tab focused via "${ev.data.query}"`, '#10b981');
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