(function () {
  function initWMSCircuitStudio() {
    if (document.getElementById('wms-helper-utility-node')) document.getElementById('wms-helper-utility-node').remove();
    if (document.getElementById('wms-node-editor')) document.getElementById('wms-node-editor').remove();
    if (document.getElementById('wms-picker-highlight')) document.getElementById('wms-picker-highlight').remove();

    // ============================================================
    //  STORAGE
    // ============================================================
    const memoryStore = {};
    const SafeStorage = {
      get(keys, callback) {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(keys, (res) => callback(res || {}));
          } else {
            const out = {};
            keys.forEach((k) => { if (memoryStore[k] !== undefined) out[k] = memoryStore[k]; });
            callback(out);
          }
        } catch (err) { console.warn('WMS Storage read fallback:', err); callback({}); }
      },
      set(obj) {
        try {
          Object.assign(memoryStore, obj);
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) chrome.storage.local.set(obj);
        } catch (err) { console.warn('WMS Storage write fallback:', err); }
      }
    };

    // ============================================================
    //  STYLES
    // ============================================================
    const style = document.createElement('style');
    style.id = 'wms-circuit-studio-styles';
    style.textContent = `
      #wms-helper-utility-node {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        z-index: 2147483640; position: fixed; top: 14px; right: 14px; width: 295px;
        background: #181920; border: 1px solid #2d3139; border-radius: 12px; padding: 12px;
        box-shadow: 0 16px 36px rgba(0,0,0,0.55); user-select: none; color: #e4e7eb; box-sizing: border-box;
      }
      .wms-drag-handle {
        background: linear-gradient(135deg, #2d323f, #1e212b); color: #00d2ff; padding: 9px 12px;
        display: flex; justify-content: space-between; align-items: center;
        border-radius: 8px 8px 0 0; cursor: grab; font-weight: 700; font-size: 12px;
        letter-spacing: 0.5px; margin: -12px -12px 10px -12px; border-bottom: 1px solid #333846;
      }
      .wms-drag-handle:active { cursor: grabbing; }
      .box-wrapper { background: #22252e; border-radius: 8px; padding: 7px 9px; margin-bottom: 7px; border: 1px solid #2c303c; }
      .box-label { font-size: 10px; font-weight: 700; color: #8c96a8; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.4px; }
      .box-input {
        width: 100%; box-sizing: border-box; background: #13141a; border: 1px solid #353b49;
        border-radius: 6px; padding: 6px; font-size: 11px; color: #fff; resize: vertical; min-height: 36px; outline: none;
        user-select: text; -webkit-user-select: text;
      }
      .box-input:focus { border-color: #00d2ff; }
      .wms-widget-actions { display: flex; gap: 6px; margin-top: 4px; }
      .btn-open-canvas {
        flex: 1; padding: 9px; background: linear-gradient(135deg, #6366f1, #4338ca); color: white;
        border: none; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 5px;
        transition: transform 0.15s, box-shadow 0.15s; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
      }
      .btn-open-canvas:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45); }
      .btn-quick-run {
        padding: 9px 12px; background: linear-gradient(135deg, #059669, #10b981); color: white;
        border: none; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 4px;
      }
      .btn-quick-run:hover { filter: brightness(1.1); }
      #wms-status-toast {
        margin-top: 8px; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;
        background: #13141a; border: 1px solid #2c303c; color: #94a3b8; text-align: center;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #wms-node-editor {
        display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: #0d0e12; z-index: 2147483645;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        user-select: none; color: #e2e8f0;
      }
      .node-toolbar {
        position: absolute; top: 0; left: 0; width: 100%; height: 54px; background: #15171e;
        border-bottom: 1px solid #272a36; display: flex; align-items: center; padding: 0 14px; gap: 7px;
        box-sizing: border-box; z-index: 1000; box-shadow: 0 4px 18px rgba(0,0,0,0.4); overflow-x: auto;
      }
      .toolbar-label { font-size: 11px; font-weight: 700; color: #717d96; text-transform: uppercase; margin-right: 4px; white-space: nowrap; }
      .node-btn {
        background: #252834; color: #f1f5f9; border: 1px solid #3b4052; border-radius: 7px;
        padding: 6px 10px; font-weight: 600; font-size: 11px; cursor: pointer; display: inline-flex;
        align-items: center; gap: 5px; transition: all 0.15s ease; white-space: nowrap;
      }
      .node-btn:hover { background: #323646; border-color: #4e556d; transform: translateY(-1px); }
      .btn-run-studio { background: #2563eb; border-color: #3b82f6; }
      .btn-run-studio:hover { background: #3b82f6; }
      .btn-save { background: #059669; border-color: #10b981; }
      .btn-save:hover { background: #10b981; }
      .btn-close { background: #dc2626; border-color: #ef4444; margin-left: auto; }
      .btn-close:hover { background: #ef4444; }
      .node-canvas-wrapper { position: absolute; top: 54px; left: 0; right: 0; bottom: 0; overflow: auto; background: #0a0b0e; }
      .node-canvas {
        position: relative; width: 4000px; height: 4000px; background-size: 32px 32px;
        background-image:
          radial-gradient(circle, #252a38 1.3px, transparent 1.3px),
          linear-gradient(to right, rgba(255,255,255,0.018) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.018) 1px, transparent 1px);
      }
      #wire-layer { position: absolute; top: 0; left: 0; width: 4000px; height: 4000px; pointer-events: none; z-index: 2; }
      .wire { fill: none; stroke: #64748b; stroke-width: 3.5; stroke-linecap: round; transition: stroke 0.15s, stroke-width 0.15s; }
      .wire:hover { stroke: #ef4444; stroke-width: 6; }
      .wire-active { stroke: #38bdf8; stroke-dasharray: 8 6; pointer-events: none !important; animation: wireFlow 0.5s linear infinite; }
      .wire-true { stroke: #10b981; }
      .wire-false { stroke: #f43f5e; }
      @keyframes wireFlow { to { stroke-dashoffset: -14; } }
      .wms-node {
        position: absolute; width: 245px; background: #161820; border-radius: 10px;
        box-shadow: 0 10px 28px rgba(0,0,0,0.65), 0 0 0 1px #2b3040;
        display: flex; flex-direction: column; z-index: 5;
      }
      .wms-node.is-executing { box-shadow: 0 0 25px rgba(56, 189, 248, 0.85), 0 0 0 2px #38bdf8 !important; }
      .wms-node-header {
        padding: 9px 12px; border-radius: 9px 9px 0 0; font-weight: 700; font-size: 11px;
        cursor: grab; display: flex; justify-content: space-between; align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.08); text-transform: uppercase; letter-spacing: 0.5px;
      }
      .wms-node-header:active { cursor: grabbing; }
      .wms-node-body { padding: 10px 14px; display: flex; flex-direction: column; gap: 7px; }
      .node-trigger .wms-node-header { background: linear-gradient(90deg, #b45309, #d97706); color: #fff; }
      .node-listener .wms-node-header { background: linear-gradient(90deg, #7c3aed, #9333ea); color: #fff; }
      .node-if .wms-node-header { background: linear-gradient(90deg, #be123c, #e11d48); color: #fff; }
      .node-click .wms-node-header { background: linear-gradient(90deg, #1d4ed8, #2563eb); color: #fff; }
      .node-type .wms-node-header { background: linear-gradient(90deg, #047857, #059669); color: #fff; }
      .node-wait .wms-node-header { background: linear-gradient(90deg, #c2410c, #ea580c); color: #fff; }
      .node-extract .wms-node-header { background: linear-gradient(90deg, #0e7490, #0891b2); color: #fff; }
      .node-input, .node-select {
        background: #0f1015; color: #f1f5f9; border: 1px solid #2b2f3d; border-radius: 6px;
        padding: 6px 8px; font-size: 11px; width: 100%; box-sizing: border-box; outline: none;
        user-select: text; -webkit-user-select: text;
      }
      .node-input:focus, .node-select:focus { border-color: #38bdf8; }
      .node-btn-small {
        background: #252834; color: #e2e8f0; border: 1px solid #3b4053; border-radius: 6px;
        padding: 6px; font-size: 11px; cursor: pointer; text-align: center; font-weight: 600;
        transition: background 0.15s;
      }
      .node-btn-small:hover { background: #323748; color: #fff; border-color: #38bdf8; }
      .node-check-row {
        display: flex; align-items: center; gap: 6px; font-size: 10px; color: #94a3b8;
        cursor: pointer; padding: 2px 0;
      }
      .node-check-row input[type="checkbox"] { accent-color: #38bdf8; cursor: pointer; }
      .port {
        width: 18px; height: 18px; border-radius: 50%; background: #94a3b8;
        position: absolute; border: 3px solid #161820; cursor: pointer; z-index: 20;
        box-sizing: border-box; transition: transform 0.15s, background-color 0.15s, box-shadow 0.15s;
      }
      .port:hover, .port.port-selected { transform: scale(1.35); background: #38bdf8; box-shadow: 0 0 12px #38bdf8; }
      .port-in { left: -10px; top: 50%; margin-top: -9px; }
      .port-out { right: -10px; top: 50%; margin-top: -9px; }
      .port-true { right: -10px; top: 48px; background: #10b981; }
      .port-false { right: -10px; top: 84px; background: #ef4444; }
      .port-tag { position: absolute; right: 12px; font-size: 9px; font-weight: 800; pointer-events: none; text-transform: uppercase; }
      .tag-true { top: 50px; color: #10b981; }
      .tag-false { top: 86px; color: #ef4444; }
      #wms-picker-highlight {
        position: fixed; pointer-events: none; z-index: 2147483646;
        border: 3px solid #00d2ff; background: rgba(0, 210, 255, 0.15);
        border-radius: 4px; display: none; transition: all 0.04s ease;
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    // ============================================================
    //  DOM ROOTS
    // ============================================================
    const pickerHighlight = document.createElement('div');
    pickerHighlight.id = 'wms-picker-highlight';
    document.body.appendChild(pickerHighlight);

    const mainWidget = document.createElement('div');
    mainWidget.id = 'wms-helper-utility-node';
    mainWidget.className = 'fs-exclude';
    mainWidget.setAttribute('data-rr-ignore', 'true');
    mainWidget.setAttribute('data-dd-privacy', 'mask-user-input');

    const box1 = { id: 'wms-box-1', label: 'Box 1 (Copy/Paste: Alt+1)', val: '' };
    const box2 = { id: 'wms-box-2', label: 'Box 2 (Copy/Paste: Alt+2)', val: '' };

    mainWidget.innerHTML = `
      <div id="wms-drag-handle" class="wms-drag-handle">
        <span>⚡ WMS Circuit Assistant</span>
        <span style="font-size:10px; color:#94a3b8;">ESC = Stop</span>
      </div>
      <div class="box-wrapper">
        <div class="box-label">${box1.label}</div>
        <textarea id="${box1.id}" class="box-input" placeholder="Copied or extracted text..."></textarea>
      </div>
      <div class="box-wrapper">
        <div class="box-label">${box2.label}</div>
        <textarea id="${box2.id}" class="box-input" placeholder="Copied or extracted text..."></textarea>
      </div>
      <div class="wms-widget-actions">
        <button id="open-node-editor-btn" class="btn-open-canvas">🧩 Circuit Studio</button>
        <button id="quick-run-circuit-btn" class="btn-quick-run" title="Run circuit immediately">▶ Run</button>
      </div>
      <div id="wms-status-toast">Ready • Build or press ▶ Run</div>
    `;
    document.body.appendChild(mainWidget);

    function clampWidgetPosition(left, top) {
      const w = mainWidget.offsetWidth || 295;
      const h = mainWidget.offsetHeight || 100;
      return {
        left: Math.min(Math.max(0, left), Math.max(0, window.innerWidth - w - 4)),
        top: Math.min(Math.max(0, top), Math.max(0, window.innerHeight - h - 4))
      };
    }
    function applyWidgetPosition(left, top) {
      const { left: l, top: t } = clampWidgetPosition(left, top);
      mainWidget.style.left = l + 'px';
      mainWidget.style.top = t + 'px';
      mainWidget.style.right = 'auto';
    }

    SafeStorage.get(['wmsWidgetPos'], (res) => {
      if (res && res.wmsWidgetPos && Number.isFinite(res.wmsWidgetPos.left) && Number.isFinite(res.wmsWidgetPos.top)) {
        requestAnimationFrame(() => applyWidgetPosition(res.wmsWidgetPos.left, res.wmsWidgetPos.top));
      }
    });

    const editorOverlay = document.createElement('div');
    editorOverlay.id = 'wms-node-editor';
    editorOverlay.className = 'fs-exclude';
    editorOverlay.setAttribute('data-rr-ignore', 'true');
    editorOverlay.innerHTML = `
      <div class="node-toolbar">
        <span class="toolbar-label">Add Block:</span>
        <button class="node-btn" id="add-trigger">⚡ Trigger</button>
        <button class="node-btn" id="add-listener">👂 Listener</button>
        <button class="node-btn" id="add-if">🔀 If / Else</button>
        <button class="node-btn" id="add-click">👆 Click</button>
        <button class="node-btn" id="add-type">⌨️ Type</button>
        <button class="node-btn" id="add-wait">⏳ Wait</button>
        <button class="node-btn" id="add-extract">📋 Extract</button>
        <button class="node-btn btn-run-studio" id="studio-run-btn">▶ Test Run</button>
        <button class="node-btn btn-save" id="save-graph-btn">💾 Save</button>
        <button class="node-btn btn-close" id="close-editor-btn">✖ Close</button>
      </div>
      <div class="node-canvas-wrapper" id="canvas-wrapper">
        <div class="node-canvas" id="node-canvas">
          <svg id="wire-layer" width="4000" height="4000"></svg>
        </div>
      </div>
    `;
    document.body.appendChild(editorOverlay);

    // ============================================================
    //  STATE
    // ============================================================
    let graph = { nodes: [], edges: [] };
    let cancelMacro = false;
    let isMacroRunning = false;
    let isPickingElement = false;
    let selectedPort = null;
    let activeWire = null;
    let lastCheckedUrl = '';
    const pendingListenerNodes = new Set();
    const processedEvents = new Map();
    const barcodeDebounces = new Map();
    let isDraining = false;
    let listenerDebounceTimer = null;

    const canvas = document.getElementById('node-canvas');
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const wireLayer = document.getElementById('wire-layer');
    const b1El = document.getElementById(box1.id);
    const b2El = document.getElementById(box2.id);
    const toastEl = document.getElementById('wms-status-toast');

    // ============================================================
    //  HELPERS
    // ============================================================
    function setStatus(msg, color = '#94a3b8') {
      if (toastEl) { toastEl.textContent = msg; toastEl.style.color = color; }
    }
    function generateId() { return 'node_' + Math.random().toString(36).substring(2, 9); }
    function saveGraph() { SafeStorage.set({ wmsGraph: graph }); }
    function safeQuery(selector) {
      if (!selector || typeof selector !== 'string' || !selector.trim()) return null;
      try { return document.querySelector(selector.trim()); } catch (err) { return null; }
    }

    function sleep(ms) {
      return new Promise((resolve) => {
        let done = false;
        let t, i;
        const finish = () => {
          if (done) return;
          done = true;
          if (t) clearTimeout(t);
          if (i) clearInterval(i);
          resolve();
        };
        t = setTimeout(finish, ms);
        i = setInterval(() => { if (cancelMacro) finish(); }, 80);
        setTimeout(() => { if (i) clearInterval(i); }, ms + 200);
      });
    }

    function parseNumber(str) {
      if (str === null || str === undefined) return NaN;
      const s = String(str).trim();
      if (!s) return NaN;
      const m = s.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/);
      if (!m) return NaN;
      return parseFloat(m[0].replace(/,/g, ''));
    }

    function readElementContent(el) {
      if (!el) return '';
      if ('value' in el && typeof el.value === 'string') return el.value.trim();
      return (el.innerText || el.textContent || '').trim();
    }

    // ============================================================
    //  STORAGE LOAD
    // ============================================================
    SafeStorage.get(['box1Data', 'box2Data', 'wmsGraph'], (res) => {
      if (res.box1Data) { b1El.value = res.box1Data; box1.val = res.box1Data; }
      if (res.box2Data) { b2El.value = res.box2Data; box2.val = res.box2Data; }
      if (res.wmsGraph && Array.isArray(res.wmsGraph.nodes) && res.wmsGraph.nodes.length > 0) {
        graph = res.wmsGraph;
      } else {
        graph = {
          nodes: [{ id: generateId(), type: 'trigger', subtype: 'hotkey', val: 'ALT+Q', x: 80, y: 100 }],
          edges: []
        };
      }
      renderGraph();
      checkPassiveURLTriggers(true);
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;
        if (changes.box1Data && changes.box1Data.newValue !== box1.val) {
          box1.val = changes.box1Data.newValue || '';
          b1El.value = box1.val;
        }
        if (changes.box2Data && changes.box2Data.newValue !== box2.val) {
          box2.val = changes.box2Data.newValue || '';
          b2El.value = box2.val;
        }
        if (changes.wmsGraph && editorOverlay.style.display !== 'block' && !isPickingElement) {
          graph = changes.wmsGraph.newValue || { nodes: [], edges: [] };
          renderGraph();
        }
      });
    }

    // ============================================================
    //  WIDGET WIRING
    // ============================================================
    b1El.addEventListener('input', (e) => { box1.val = e.target.value; SafeStorage.set({ box1Data: box1.val }); });
    b2El.addEventListener('input', (e) => { box2.val = e.target.value; SafeStorage.set({ box2Data: box2.val }); });

    document.getElementById('open-node-editor-btn').addEventListener('click', () => {
      editorOverlay.style.display = 'block';
      requestAnimationFrame(() => drawAllWires());
    });
    document.getElementById('close-editor-btn').addEventListener('click', () => {
      editorOverlay.style.display = 'none';
      selectedPort = null;
    });
    document.getElementById('save-graph-btn').addEventListener('click', () => {
      saveGraph();
      const btn = document.getElementById('save-graph-btn');
      const oldText = btn.innerHTML;
      btn.innerHTML = '✅ Saved!';
      setStatus('Circuit saved!', '#10b981');
      setTimeout(() => { btn.innerHTML = oldText; }, 1200);
    });

    function runFirstAvailableCircuit() {
      if (isMacroRunning) { setStatus('⚡ Already running…', '#f59e0b'); return; }
      const starts = graph.nodes.filter((n) => n.type === 'trigger' || n.type === 'listener');
      if (starts.length === 0) {
        const root = graph.nodes.find((n) => !graph.edges.some((e) => e.target === n.id)) || graph.nodes[0];
        if (!root) { setStatus('⚠️ Add blocks in Circuit Studio first!', '#f59e0b'); return; }
        editorOverlay.style.display = 'none';
        executeGraph(root.id);
        return;
      }
      if (starts.length === 1) {
        editorOverlay.style.display = 'none';
        executeGraph(starts[0].id);
        return;
      }
      const names = starts.map((n, i) => `${i + 1}. ${n.type.toUpperCase()} → ${n.val || n.selector || '(unconfigured)'}`).join('\n');
      let pick;
      try { pick = parseInt(prompt(`Which circuit to run?\n\n${names}`, '1'), 10); }
      catch { pick = 1; }
      if (Number.isInteger(pick) && starts[pick - 1]) {
        editorOverlay.style.display = 'none';
        executeGraph(starts[pick - 1].id);
      }
    }
    document.getElementById('quick-run-circuit-btn').addEventListener('click', runFirstAvailableCircuit);
    document.getElementById('studio-run-btn').addEventListener('click', runFirstAvailableCircuit);

    // ============================================================
    //  GRAPH RENDERING
    // ============================================================
    function renderGraph() {
      Array.from(canvas.children).forEach((child) => {
        if (child.id !== 'wire-layer') child.remove();
      });
      wireLayer.innerHTML = '';
      graph.nodes.forEach((node) => createNodeDOM(node));
      requestAnimationFrame(() => drawAllWires());
    }

    function createNodeDOM(node) {
      const el = document.createElement('div');
      el.className = `wms-node node-${node.type}`;
      el.id = node.id;
      el.style.left = (node.x || 100) + 'px';
      el.style.top = (node.y || 100) + 'px';

      const icons = { trigger: '⚡', listener: '👂', if: '🔀', click: '👆', type: '⌨️', wait: '⏳', extract: '📋' };
      const headerIcon = icons[node.type] || '⚡';
      const title = node.type.toUpperCase();

      const headerHtml = `
        <div class="wms-node-header">
          <span>${headerIcon} ${title}</span>
          <span class="del-node" style="cursor:pointer; opacity:0.8; padding:0 4px;" title="Delete Block">✖</span>
        </div>
      `;

      let bodyHtml = `<div class="wms-node-body">`;

      if (node.type === 'trigger') {
        bodyHtml += `
          <select class="node-select n-trig-type">
            <option value="hotkey" ${node.subtype === 'hotkey' ? 'selected' : ''}>Keyboard Shortcut</option>
            <option value="url" ${node.subtype === 'url' ? 'selected' : ''}>Auto URL Match</option>
          </select>
          <input type="text" class="node-input n-trig-val" value="${node.val || ''}" placeholder="${node.subtype === 'url' ? 'e.g. /inbound' : 'Click & press keys (e.g. Alt+Q)'}">
          <div class="node-btn-small n-run-this" style="background:#065f46; border-color:#10b981; color:#fff;">▶ Run This Trigger</div>
        `;
      } else if (node.type === 'listener') {
        bodyHtml += `
          <div class="node-btn-small n-pick">🎯 Pick Target to Watch</div>
          <input type="text" class="node-input n-selector" value="${node.selector || ''}" placeholder="Click Pick or paste selector...">
          <select class="node-select n-listen-mode">
            <option value="text_contains" ${node.mode === 'text_contains' ? 'selected' : ''}>Text Contains</option>
            <option value="number_greater" ${node.mode === 'number_greater' ? 'selected' : ''}>Number > Value</option>
            <option value="number_less" ${node.mode === 'number_less' ? 'selected' : ''}>Number < Value</option>
            <option value="barcode_scan" ${node.mode === 'barcode_scan' ? 'selected' : ''}>Barcode / Input Length >=</option>
          </select>
          <input type="text" class="node-input n-listen-val" value="${node.val || ''}" placeholder="Target text or number...">
        `;
      } else if (node.type === 'if') {
        bodyHtml += `
          <div class="node-btn-small n-pick">🎯 Pick Element to Check</div>
          <input type="text" class="node-input n-selector" value="${node.selector || ''}" placeholder="Click Pick or paste selector...">
          <select class="node-select n-if-cond">
            <option value="exists" ${node.cond === 'exists' ? 'selected' : ''}>Element Exists & Visible</option>
            <option value="text_equals" ${node.cond === 'text_equals' ? 'selected' : ''}>Text Equals</option>
            <option value="text_contains" ${node.cond === 'text_contains' ? 'selected' : ''}>Text Contains</option>
            <option value="number_gt" ${node.cond === 'number_gt' ? 'selected' : ''}>Number Greater Than (>)</option>
            <option value="number_lt" ${node.cond === 'number_lt' ? 'selected' : ''}>Number Less Than (<)</option>
          </select>
          ${node.cond !== 'exists' ? `<input type="text" class="node-input n-if-val" value="${node.val || ''}" placeholder="Compare value...">` : ''}
        `;
      } else if (node.type === 'click') {
        bodyHtml += `
          <div class="node-btn-small n-pick">🎯 Pick Button / Element</div>
          <input type="text" class="node-input n-selector" value="${node.selector || ''}" placeholder="Click Pick or paste selector...">
        `;
      } else if (node.type === 'type') {
        bodyHtml += `
          <select class="node-select n-source">
            <option value="box1" ${node.source === 'box1' ? 'selected' : ''}>Type From: Box 1</option>
            <option value="box2" ${node.source === 'box2' ? 'selected' : ''}>Type From: Box 2</option>
            <option value="custom" ${node.source === 'custom' ? 'selected' : ''}>Type: Custom Text</option>
          </select>
          ${node.source === 'custom' ? `<input type="text" class="node-input n-custom" value="${node.customText || ''}" placeholder="Enter custom text...">` : ''}
          <div class="node-btn-small n-pick">🎯 Pick Input Box</div>
          <input type="text" class="node-input n-selector" value="${node.selector || ''}" placeholder="Click Pick or paste selector...">
          <label class="node-check-row">
            <input type="checkbox" class="n-press-enter" ${node.pressEnter !== false ? 'checked' : ''}>
            Press Enter after typing
          </label>
        `;
      } else if (node.type === 'wait') {
        bodyHtml += `
          <select class="node-select n-wait-mode">
            <option value="element" ${node.mode === 'element' ? 'selected' : ''}>Wait Until Element Appears</option>
            <option value="delay" ${node.mode === 'delay' ? 'selected' : ''}>Wait Fixed Time (ms)</option>
          </select>
          ${node.mode === 'delay' ? `
            <input type="number" class="node-input n-wait-ms" value="${node.ms || 500}" placeholder="Milliseconds (e.g. 500)">
          ` : `
            <div class="node-btn-small n-pick">🎯 Pick Element to Wait For</div>
            <input type="text" class="node-input n-selector" value="${node.selector || ''}" placeholder="Click Pick or paste selector...">
          `}
        `;
      } else if (node.type === 'extract') {
        bodyHtml += `
          <div class="node-btn-small n-pick">🎯 Pick Element to Copy From</div>
          <input type="text" class="node-input n-selector" value="${node.selector || ''}" placeholder="Click Pick or paste selector...">
          <select class="node-select n-dest">
            <option value="box1" ${node.dest === 'box1' ? 'selected' : ''}>Save Into: Box 1</option>
            <option value="box2" ${node.dest === 'box2' ? 'selected' : ''}>Save Into: Box 2</option>
          </select>
        `;
      }
      bodyHtml += `</div>`;

      let portsHtml = '';
      if (node.type !== 'trigger' && node.type !== 'listener') {
        portsHtml += `<div class="port port-in" data-nodeid="${node.id}" data-portid="in" title="Input Port"></div>`;
      }
      if (node.type === 'if') {
        portsHtml += `
          <div class="port port-true" data-nodeid="${node.id}" data-portid="true" title="TRUE Output"></div>
          <div class="port-tag tag-true">True</div>
          <div class="port port-false" data-nodeid="${node.id}" data-portid="false" title="FALSE Output"></div>
          <div class="port-tag tag-false">False</div>
        `;
      } else {
        portsHtml += `<div class="port port-out" data-nodeid="${node.id}" data-portid="out" title="Output Port"></div>`;
      }

      el.innerHTML = headerHtml + bodyHtml + portsHtml;
      canvas.appendChild(el);

      const header = el.querySelector('.wms-node-header');
      header.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('del-node')) return;
        e.preventDefault();
        const nodeRect = el.getBoundingClientRect();
        const shiftX = e.clientX - nodeRect.left;
        const shiftY = e.clientY - nodeRect.top;
        function onMouseMove(moveEvent) {
          const canvasRect = canvas.getBoundingClientRect();
          node.x = Math.max(10, moveEvent.clientX - canvasRect.left - shiftX);
          node.y = Math.max(10, moveEvent.clientY - canvasRect.top - shiftY);
          el.style.left = node.x + 'px';
          el.style.top = node.y + 'px';
          drawAllWires();
        }
        function onMouseUp() {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          saveGraph();
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      el.querySelector('.del-node').addEventListener('click', () => {
        graph.nodes = graph.nodes.filter((n) => n.id !== node.id);
        graph.edges = graph.edges.filter((e) => e.source !== node.id && e.target !== node.id);
        renderGraph();
        saveGraph();
      });

      if (el.querySelector('.n-run-this')) {
        el.querySelector('.n-run-this').addEventListener('click', () => {
          editorOverlay.style.display = 'none';
          executeGraph(node.id);
        });
      }
      if (el.querySelector('.n-selector')) {
        el.querySelector('.n-selector').addEventListener('input', (e) => {
          node.selector = e.target.value.trim();
          saveGraph();
        });
      }
      if (el.querySelector('.n-trig-type')) {
        el.querySelector('.n-trig-type').addEventListener('change', (e) => {
          node.subtype = e.target.value;
          node.val = node.subtype === 'hotkey' ? 'ALT+Q' : '';
          renderGraph();
          saveGraph();
        });
      }
      if (el.querySelector('.n-trig-val') && node.subtype === 'hotkey') {
        const input = el.querySelector('.n-trig-val');
        input.addEventListener('keydown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
          if (e.key === 'Escape') {
            setStatus('⚠️ ESC is reserved by the widget — pick another key', '#f59e0b');
            return;
          }
          const keys = [];
          if (e.ctrlKey) keys.push('CTRL');
          if (e.altKey) keys.push('ALT');
          if (e.shiftKey) keys.push('SHIFT');
          if (e.metaKey) keys.push('META');
          keys.push(e.key.toUpperCase());
          const combo = keys.join('+');
          if (combo === 'ALT+1' || combo === 'ALT+2') {
            setStatus(`⚠️ ${combo} is reserved for Box copy/paste — pick another`, '#f59e0b');
            return;
          }
          input.value = combo;
          node.val = combo;
          saveGraph();
        });
      } else if (el.querySelector('.n-trig-val')) {
        el.querySelector('.n-trig-val').addEventListener('input', (e) => { node.val = e.target.value; saveGraph(); });
      }

      if (el.querySelector('.n-listen-mode')) el.querySelector('.n-listen-mode').addEventListener('change', (e) => { node.mode = e.target.value; renderGraph(); saveGraph(); });
      if (el.querySelector('.n-listen-val')) el.querySelector('.n-listen-val').addEventListener('input', (e) => { node.val = e.target.value; saveGraph(); });
      if (el.querySelector('.n-if-cond')) el.querySelector('.n-if-cond').addEventListener('change', (e) => { node.cond = e.target.value; renderGraph(); saveGraph(); });
      if (el.querySelector('.n-if-val')) el.querySelector('.n-if-val').addEventListener('input', (e) => { node.val = e.target.value; saveGraph(); });
      if (el.querySelector('.n-source')) el.querySelector('.n-source').addEventListener('change', (e) => { node.source = e.target.value; renderGraph(); saveGraph(); });
      if (el.querySelector('.n-custom')) el.querySelector('.n-custom').addEventListener('input', (e) => { node.customText = e.target.value; saveGraph(); });
      if (el.querySelector('.n-wait-mode')) el.querySelector('.n-wait-mode').addEventListener('change', (e) => { node.mode = e.target.value; renderGraph(); saveGraph(); });
      if (el.querySelector('.n-wait-ms')) el.querySelector('.n-wait-ms').addEventListener('input', (e) => { node.ms = parseInt(e.target.value, 10) || 500; saveGraph(); });
      if (el.querySelector('.n-dest')) el.querySelector('.n-dest').addEventListener('change', (e) => { node.dest = e.target.value; saveGraph(); });
      if (el.querySelector('.n-press-enter')) el.querySelector('.n-press-enter').addEventListener('change', (e) => { node.pressEnter = e.target.checked; saveGraph(); });

      if (el.querySelector('.n-pick')) {
        el.querySelector('.n-pick').addEventListener('click', () => startNodePicker(node.id));
      }
    }

    ['trigger', 'listener', 'if', 'click', 'type', 'wait', 'extract'].forEach((type) => {
      const btn = document.getElementById(`add-${type}`);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const scrollX = canvasWrapper.scrollLeft || 0;
        const scrollY = canvasWrapper.scrollTop || 0;
        const offset = (graph.nodes.length % 5) * 28;
        const node = { id: generateId(), type: type, x: scrollX + 120 + offset, y: scrollY + 90 + offset };
        if (type === 'trigger') { node.subtype = 'hotkey'; node.val = 'ALT+Q'; }
        else if (type === 'listener') { node.mode = 'text_contains'; node.val = ''; }
        else if (type === 'if') { node.cond = 'exists'; node.val = ''; }
        else if (type === 'type') { node.source = 'box1'; node.pressEnter = true; }
        else if (type === 'wait') { node.mode = 'element'; node.ms = 500; }
        else if (type === 'extract') { node.dest = 'box1'; }
        graph.nodes.push(node);
        renderGraph();
        saveGraph();
      });
    });

    // ============================================================
    //  WIRE GRAPH
    // ============================================================
    function connectNodes(sourceNodeId, sourcePort, targetNodeId) {
      if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return;
      graph.edges = graph.edges.filter((edge) => !(edge.source === sourceNodeId && edge.sourcePort === sourcePort));
      graph.edges.push({ id: generateId(), source: sourceNodeId, sourcePort: sourcePort, target: targetNodeId, targetPort: 'in' });
      saveGraph();
      drawAllWires();
    }

    canvas.addEventListener('mousedown', (e) => {
      const portEl = e.target.closest('.port');
      if (!portEl) {
        if (selectedPort) {
          document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected'));
          selectedPort = null;
        }
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      const portId = portEl.getAttribute('data-portid');
      const nodeId = portEl.getAttribute('data-nodeid');

      if (portId === 'in' && selectedPort && selectedPort.nodeId !== nodeId) {
        connectNodes(selectedPort.nodeId, selectedPort.portId, nodeId);
        document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected'));
        selectedPort = null;
        return;
      }
      if (portId !== 'in') {
        document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected'));
        portEl.classList.add('port-selected');
        selectedPort = { nodeId, portId };
        activeWire = { source: nodeId, sourcePort: portId, clientX: e.clientX, clientY: e.clientY };

        function onWireMove(moveEvent) {
          activeWire.clientX = moveEvent.clientX;
          activeWire.clientY = moveEvent.clientY;
          drawAllWires();
        }
        function onWireUp(upEvent) {
          document.removeEventListener('mousemove', onWireMove);
          document.removeEventListener('mouseup', onWireUp);
          const targetEl = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
          const targetPort = targetEl ? targetEl.closest('.port') : null;
          if (targetPort && targetPort.getAttribute('data-portid') === 'in') {
            const targetNodeId = targetPort.getAttribute('data-nodeid');
            if (targetNodeId !== activeWire.source) {
              connectNodes(activeWire.source, activeWire.sourcePort, targetNodeId);
              document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected'));
              selectedPort = null;
            }
          }
          activeWire = null;
          drawAllWires();
        }
        document.addEventListener('mousemove', onWireMove);
        document.addEventListener('mouseup', onWireUp);
      }
    });

    function drawAllWires() {
      wireLayer.innerHTML = '';
      const canvasRect = canvas.getBoundingClientRect();
      graph.edges.forEach((edge) => {
        const sourceEl = canvas.querySelector(`.port[data-nodeid="${edge.source}"][data-portid="${edge.sourcePort}"]`);
        const targetEl = canvas.querySelector(`.port[data-nodeid="${edge.target}"][data-portid="${edge.targetPort}"]`);
        if (sourceEl && targetEl) {
          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();
          const x1 = sRect.left + sRect.width / 2 - canvasRect.left;
          const y1 = sRect.top + sRect.height / 2 - canvasRect.top;
          const x2 = tRect.left + tRect.width / 2 - canvasRect.left;
          const y2 = tRect.top + tRect.height / 2 - canvasRect.top;
          const wireClass = edge.sourcePort === 'true' ? 'wire wire-true' : edge.sourcePort === 'false' ? 'wire wire-false' : 'wire';
          drawBezier(x1, y1, x2, y2, wireClass, edge.id);
        }
      });
      if (activeWire) {
        const sourceEl = canvas.querySelector(`.port[data-nodeid="${activeWire.source}"][data-portid="${activeWire.sourcePort}"]`);
        if (sourceEl) {
          const sRect = sourceEl.getBoundingClientRect();
          const x1 = sRect.left + sRect.width / 2 - canvasRect.left;
          const y1 = sRect.top + sRect.height / 2 - canvasRect.top;
          const x2 = activeWire.clientX - canvasRect.left;
          const y2 = activeWire.clientY - canvasRect.top;
          drawBezier(x1, y1, x2, y2, 'wire wire-active');
        }
      }
    }

    function drawBezier(x1, y1, x2, y2, className = 'wire', edgeId = null) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dx = Math.max(Math.abs(x2 - x1) * 0.5, 45);
      path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
      path.setAttribute('class', className);
      if (edgeId) {
        path.style.cursor = 'pointer';
        path.style.pointerEvents = 'stroke';
        path.addEventListener('click', (e) => {
          e.stopPropagation();
          graph.edges = graph.edges.filter((edge) => edge.id !== edgeId);
          drawAllWires();
          saveGraph();
        });
      }
      wireLayer.appendChild(path);
    }

    // ============================================================
    //  DOM QUERY HELPERS
    // ============================================================
    function escapeIdent(str) {
      if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(str);
      return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
    }

    function getExactSelector(el) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
      if (el.id && document.querySelectorAll(`#${escapeIdent(el.id)}`).length === 1) return `#${escapeIdent(el.id)}`;
      const path = [];
      let curr = el;
      while (curr && curr.nodeType === Node.ELEMENT_NODE && curr !== document.body && curr !== document.documentElement) {
        let selector = curr.nodeName.toLowerCase();
        if (curr.id && document.querySelectorAll(`#${escapeIdent(curr.id)}`).length === 1) {
          selector = '#' + escapeIdent(curr.id);
          path.unshift(selector);
          break;
        }
        let sibling = curr;
        let nth = 1;
        while ((sibling = sibling.previousElementSibling)) {
          if (sibling.nodeName.toLowerCase() === selector) nth++;
        }
        if (nth > 1) selector += `:nth-of-type(${nth})`;
        path.unshift(selector);
        curr = curr.parentNode;
      }
      return path.join(' > ');
    }

    function isSafeToInteract(el, checkOcclusion = false) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0 || style.pointerEvents === 'none') return false;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('p-disabled')) return false;
      if (rect.width === 0 || rect.height === 0) return false;
      if (checkOcclusion) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        if (cx >= 0 && cy >= 0 && cx <= window.innerWidth && cy <= window.innerHeight) {
          const topEl = document.elementFromPoint(cx, cy);
          if (topEl && !el.contains(topEl) && !topEl.contains(el) && !mainWidget.contains(topEl)) return false;
        }
      }
      return true;
    }

    // ============================================================
    //  ELEMENT PICKER
    // ============================================================
    function startNodePicker(nodeId) {
      isPickingElement = true;
      editorOverlay.style.display = 'none';
      document.body.style.cursor = 'crosshair';
      setStatus('🎯 Click any element on page (ESC to cancel)', '#00d2ff');

      function onHover(e) {
        if (mainWidget.contains(e.target) || editorOverlay.contains(e.target)) {
          pickerHighlight.style.display = 'none';
          return;
        }
        const rect = e.target.getBoundingClientRect();
        pickerHighlight.style.display = 'block';
        pickerHighlight.style.left = rect.left + 'px';
        pickerHighlight.style.top = rect.top + 'px';
        pickerHighlight.style.width = rect.width + 'px';
        pickerHighlight.style.height = rect.height + 'px';
      }
      function cleanupPicker() {
        isPickingElement = false;
        pickerHighlight.style.display = 'none';
        document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', onHover, true);
        document.removeEventListener('click', onPick, true);
        document.removeEventListener('keydown', onEscCancel, true);
        editorOverlay.style.display = 'block';
        requestAnimationFrame(() => drawAllWires());
      }
      function onEscCancel(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cleanupPicker();
          setStatus('Picker cancelled', '#94a3b8');
        }
      }
      function onPick(e) {
        if (mainWidget.contains(e.target) || editorOverlay.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        const node = graph.nodes.find((n) => n.id === nodeId);
        let targetEl = e.target;
        if (node && node.type === 'type') {
          let inputEl = targetEl.closest('input, textarea, [contenteditable="true"]');
          if (!inputEl) inputEl = targetEl.querySelector('input, textarea, [contenteditable="true"]');
          if (!inputEl && targetEl.tagName === 'LABEL' && targetEl.htmlFor) {
            inputEl = document.getElementById(targetEl.htmlFor);
          }
          if (inputEl) targetEl = inputEl;
        } else if (node && node.type === 'click') {
          const clickable = targetEl.closest('button, a, [role="button"], input[type="button"], input[type="submit"]');
          if (clickable) targetEl = clickable;
        }
        if (node) {
          node.selector = getExactSelector(targetEl);
          saveGraph();
          renderGraph();
          setStatus(`✅ Picked: ${node.selector.slice(-28)}`, '#10b981');
        }
        cleanupPicker();
      }
      document.addEventListener('mousemove', onHover, true);
      document.addEventListener('click', onPick, true);
      document.addEventListener('keydown', onEscCancel, true);
    }

    // ============================================================
    //  TYPE + SUBMIT
    // ============================================================
    function typeAndSubmitElement(rawEl, textToType, pressEnter = true) {
      const el = (rawEl.tagName === 'INPUT' || rawEl.tagName === 'TEXTAREA')
        ? rawEl
        : (rawEl.querySelector('input, textarea') || rawEl);
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      el.focus();
      el.click();
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) nativeSetter.call(el, textToType);
        else el.value = textToType;
      } else if (el.isContentEditable) {
        el.innerText = textToType;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (pressEnter) {
        const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        el.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
        el.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
        el.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
      }
    }

    // ============================================================
    //  WAIT FOR ELEMENT (cancellable, no TDZ)
    // ============================================================
    function waitForElement(selector, timeoutMs = 8000) {
      return new Promise((resolve) => {
        if (cancelMacro) return resolve(false);
        if (!selector || typeof selector !== 'string' || !selector.trim()) return resolve(false);

        const existing = safeQuery(selector);
        if (existing && isSafeToInteract(existing, false)) return resolve(true);

        let settled = false;
        let observer, timer, poll;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          if (observer) observer.disconnect();
          if (timer) clearTimeout(timer);
          if (poll) clearInterval(poll);
          resolve(result);
        };

        observer = new MutationObserver(() => {
          if (cancelMacro) return finish(false);
          const el = safeQuery(selector);
          if (el && isSafeToInteract(el, false)) finish(true);
        });
        timer = setTimeout(() => finish(false), timeoutMs);
        poll = setInterval(() => {
          if (cancelMacro) return finish(false);
          const el = safeQuery(selector);
          if (el && isSafeToInteract(el, false)) finish(true);
        }, 150);

        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      });
    }

    // ============================================================
    //  EXECUTE GRAPH
    // ============================================================
    async function executeGraph(startNodeId) {
      if (isMacroRunning) return;
      isMacroRunning = true;
      cancelMacro = false;
      const originalOutline = document.body.style.outline;
      document.body.style.outline = '4px solid #10b981';
      setStatus('⚡ Running circuit...', '#38bdf8');

      try {
        let currentNodeId = startNodeId;
        let stepsCount = 0;

        while (currentNodeId && !cancelMacro && stepsCount < 100) {
          stepsCount++;
          const node = graph.nodes.find((n) => n.id === currentNodeId);
          if (!node) break;

          const nodeDom = document.getElementById(node.id);
          if (nodeDom) nodeDom.classList.add('is-executing');

          let nextPort = 'out';

          if (node.type === 'wait') {
            if (node.mode === 'delay') {
              setStatus(`⏳ Waiting ${node.ms || 500}ms...`, '#f59e0b');
              await sleep(node.ms || 500);
            } else {
              if (!node.selector) {
                setStatus('⚠️ Wait block missing target!', '#f59e0b');
                cancelMacro = true;
                break;
              }
              setStatus('⏳ Waiting for element...', '#f59e0b');
              const found = await waitForElement(node.selector, 10000);
              if (!found) {
                if (cancelMacro) setStatus('🛑 Halted during wait', '#f59e0b');
                else { setStatus('🛑 Wait timed out: Element not found', '#ef4444'); cancelMacro = true; }
                break;
              }
            }
          } else if (node.type === 'click') {
            if (!node.selector) { setStatus('⚠️ Click block missing target!', '#f59e0b'); cancelMacro = true; break; }
            const isReady = await waitForElement(node.selector, 4000);
            if (cancelMacro) { setStatus('🛑 Halted', '#f59e0b'); break; }
            const el = safeQuery(node.selector);
            if (isReady && el) {
              el.scrollIntoView({ block: 'center', behavior: 'auto' });
              if (!isSafeToInteract(el, true)) {
                setStatus('🛑 Halted: Target covered by popup or disabled', '#ef4444');
                cancelMacro = true;
                break;
              }
              setStatus('👆 Clicking target...', '#38bdf8');
              el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              el.click();
              await sleep(220);
            } else {
              setStatus('🛑 Click target not visible/found', '#ef4444');
              cancelMacro = true;
              break;
            }
          } else if (node.type === 'type') {
            if (!node.selector) { setStatus('⚠️ Type block missing target!', '#f59e0b'); cancelMacro = true; break; }
            const isReady = await waitForElement(node.selector, 4000);
            if (cancelMacro) { setStatus('🛑 Halted', '#f59e0b'); break; }
            const el = safeQuery(node.selector);
            if (isReady && el) {
              setStatus('⌨️ Typing into field...', '#10b981');
              const textToType = node.source === 'box1' ? box1.val : node.source === 'box2' ? box2.val : (node.customText || '');
              typeAndSubmitElement(el, textToType, node.pressEnter !== false);
              await sleep(220);
            } else {
              setStatus('🛑 Input target not found', '#ef4444');
              cancelMacro = true;
              break;
            }
          } else if (node.type === 'extract') {
            if (!node.selector) { setStatus('⚠️ Extract block missing target!', '#f59e0b'); cancelMacro = true; break; }
            const isReady = await waitForElement(node.selector, 4000);
            if (cancelMacro) { setStatus('🛑 Halted', '#f59e0b'); break; }
            const el = safeQuery(node.selector);
            if (isReady && el) {
              const extracted = readElementContent(el);
              if (node.dest === 'box2') {
                box2.val = extracted; b2El.value = extracted; SafeStorage.set({ box2Data: extracted });
              } else {
                box1.val = extracted; b1El.value = extracted; SafeStorage.set({ box1Data: extracted });
              }
              setStatus(`📋 Extracted: "${extracted.slice(0, 18)}"`, '#10b981');
              await sleep(120);
            } else {
              setStatus('🛑 Extract target not found', '#ef4444');
              cancelMacro = true;
              break;
            }
          } else if (node.type === 'if') {
            await waitForElement(node.selector, 250);
            if (cancelMacro) { setStatus('🛑 Halted', '#f59e0b'); break; }
            const el = safeQuery(node.selector);
            let isTrue = false;
            if (node.cond === 'exists') {
              isTrue = Boolean(el && isSafeToInteract(el, false));
            } else if (el) {
              const content = readElementContent(el);
              const targetVal = (node.val || '').trim();
              if (node.cond === 'text_equals') {
                isTrue = content.toLowerCase() === targetVal.toLowerCase();
              } else if (node.cond === 'text_contains') {
                isTrue = content.toLowerCase().includes(targetVal.toLowerCase());
              } else if (node.cond === 'number_gt') {
                const num = parseNumber(content);
                const comp = parseNumber(targetVal);
                isTrue = !isNaN(num) && !isNaN(comp) && num > comp;
              } else if (node.cond === 'number_lt') {
                const num = parseNumber(content);
                const comp = parseNumber(targetVal);
                isTrue = !isNaN(num) && !isNaN(comp) && num < comp;
              }
            }
            setStatus(`🔀 If evaluated: ${isTrue ? 'TRUE' : 'FALSE'}`, isTrue ? '#10b981' : '#f43f5e');
            nextPort = isTrue ? 'true' : 'false';
            await sleep(120);
          }

          if (nodeDom) nodeDom.classList.remove('is-executing');
          const nextEdge = graph.edges.find((e) => e.source === currentNodeId && e.sourcePort === nextPort);
          currentNodeId = nextEdge ? nextEdge.target : null;
        }

        if (!cancelMacro) setStatus('✅ Circuit finished!', '#10b981');
      } catch (err) {
        console.error('WMS Circuit Execution Error:', err);
        setStatus('🛑 Error executing circuit', '#ef4444');
      }

      isMacroRunning = false;
      document.body.style.outline = originalOutline;
      document.querySelectorAll('.wms-node').forEach((n) => n.classList.remove('is-executing'));

      if (pendingListenerNodes.size > 0 && !cancelMacro && !isDraining) drainPendingListeners();
    }

    // ============================================================
    //  DRAIN PENDING LISTENERS
    // ============================================================
    async function drainPendingListeners() {
      if (isDraining) return;
      isDraining = true;
      try {
        let safetyCounter = 0;
        while (pendingListenerNodes.size > 0 && !cancelMacro && safetyCounter < 500) {
          safetyCounter++;
          if (isMacroRunning) { await sleep(200); continue; }
          const nodeId = pendingListenerNodes.values().next().value;
          pendingListenerNodes.delete(nodeId);
          const n = graph.nodes.find((x) => x.id === nodeId);
          if (!n) continue;
          await sleep(100);
          if (cancelMacro) break;
          if (isMacroRunning) { pendingListenerNodes.add(nodeId); continue; }
          await executeGraph(nodeId);
        }
      } finally {
        isDraining = false;
      }
    }

    // ============================================================
    //  CANCEL ON MANUAL CLICK
    // ============================================================
    document.addEventListener('mousedown', (e) => {
      if (isMacroRunning && e.isTrusted && !mainWidget.contains(e.target) && !editorOverlay.contains(e.target)) {
        cancelMacro = true;
        document.body.style.outline = 'none';
        setStatus('🛑 Halted by manual mouse click', '#f59e0b');
      }
    }, true);

    // ============================================================
    //  KEYBOARD
    // ============================================================
    document.addEventListener('keydown', (e) => {
      if (!e.key) return;

      if (e.key === 'Escape') {
        if (isMacroRunning || isDraining) {
          cancelMacro = true;
          pendingListenerNodes.clear();
          document.body.style.outline = 'none';
          document.querySelectorAll('.wms-node').forEach((n) => n.classList.remove('is-executing'));
          setStatus('🛑 Halted by Escape key', '#ef4444');
        }
        return;
      }

      // Alt+1 / Alt+2 — reserved for widget; always active regardless of focus
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1')) {
        e.preventDefault();
        e.stopPropagation();
        handleCopyOrQuickPaste(b1El, 'box1Data', box1, e.target);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.code === 'Digit2' || e.code === 'Numpad2' || e.key === '2')) {
        e.preventDefault();
        e.stopPropagation();
        handleCopyOrQuickPaste(b2El, 'box2Data', box2, e.target);
        return;
      }

      if (editorOverlay.style.display === 'block' || mainWidget.contains(e.target)) return;
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

      const isTypingInPageInput = (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)
        && !e.altKey && !e.ctrlKey && !e.metaKey;
      if (isTypingInPageInput) return;

      const keys = [];
      if (e.ctrlKey) keys.push('CTRL');
      if (e.altKey) keys.push('ALT');
      if (e.shiftKey) keys.push('SHIFT');
      if (e.metaKey) keys.push('META');
      keys.push(e.key.toUpperCase());
      const combo = keys.join('+');

      const triggerNode = graph.nodes.find(
        (n) => n.type === 'trigger' && n.subtype === 'hotkey' && (n.val || '').toUpperCase() === combo
      );
      if (triggerNode) {
        e.preventDefault();
        executeGraph(triggerNode.id);
      }
    });

    // ============================================================
    //  COPY / PASTE (Alt+1 / Alt+2)
    // ============================================================
    function handleCopyOrQuickPaste(el, storageKey, boxObj, activeTarget) {
      const selectedText = window.getSelection().toString().trim();
      if (selectedText) {
        el.value = selectedText;
        boxObj.val = selectedText;
        SafeStorage.set({ [storageKey]: selectedText });
        el.style.background = '#064e3b';
        setStatus(`📋 Copied "${selectedText.slice(0, 15)}"`, '#10b981');
        setTimeout(() => { el.style.background = '#13141a'; }, 350);
      } else if (
        activeTarget &&
        !mainWidget.contains(activeTarget) &&
        (activeTarget.tagName === 'INPUT' || activeTarget.tagName === 'TEXTAREA' || activeTarget.isContentEditable) &&
        boxObj.val
      ) {
        typeAndSubmitElement(activeTarget, boxObj.val, true);
        setStatus(`⌨️ Pasted "${boxObj.val.slice(0, 15)}" + Enter`, '#38bdf8');
      }
    }

    // ============================================================
    //  URL TRIGGERS (path-aware for /-prefixed values)
    // ============================================================
    function checkPassiveURLTriggers(force = false) {
      const currentUrl = window.location.href;
      if (!force && currentUrl === lastCheckedUrl) return;
      lastCheckedUrl = currentUrl;

      const triggerNode = graph.nodes.find((n) => {
        if (n.type !== 'trigger' || n.subtype !== 'url' || !n.val) return false;
        const target = n.val.trim();
        if (!target) return false;
        try {
          if (target.startsWith('/')) {
            const pathname = window.location.pathname;
            if (pathname === target) return true;
            const withSlash = target.endsWith('/') ? target : target + '/';
            return pathname.startsWith(withSlash);
          }
          return currentUrl.includes(target);
        } catch { return false; }
      });
      if (triggerNode) setTimeout(() => executeGraph(triggerNode.id), 500);
    }

    // ============================================================
    //  LISTENER EVALUATION (debounced)
    // ============================================================
    function evaluateListenersDebounced() {
      if (listenerDebounceTimer) clearTimeout(listenerDebounceTimer);
      listenerDebounceTimer = setTimeout(() => {
        listenerDebounceTimer = null;
        evaluateListeners();
      }, 150);
    }

    function evaluateListeners() {
      if (cancelMacro || isPickingElement || editorOverlay.style.display === 'block') return;
      checkPassiveURLTriggers(false);
      const now = Date.now();

      graph.nodes.filter((n) => n.type === 'listener' && n.selector).forEach((n) => {
        const el = safeQuery(n.selector);
        if (!el) return;
        const content = readElementContent(el);
        if (!content) return;

        let matched = false;

        if (n.mode === 'text_contains' && n.val && content.toLowerCase().includes(n.val.toLowerCase())) {
          matched = true;
        } else if (n.mode === 'number_greater' && n.val) {
          const num = parseNumber(content);
          const comp = parseNumber(n.val);
          matched = !isNaN(num) && !isNaN(comp) && num > comp;
        } else if (n.mode === 'number_less' && n.val) {
          const num = parseNumber(content);
          const comp = parseNumber(n.val);
          matched = !isNaN(num) && !isNaN(comp) && num < comp;
        } else if (n.mode === 'barcode_scan') {
          const threshold = parseInt(n.val, 10) || 4;
          const state = barcodeDebounces.get(n.id) || { len: 0, time: 0, reportedLen: -1 };
          const prevTime = state.time;
          if (state.len !== content.length) {
            state.len = content.length;
            state.time = now;
            barcodeDebounces.set(n.id, state);
          }
          const stable = (now - prevTime) > 100;
          if (content.length >= threshold && stable && state.reportedLen !== content.length) {
            state.reportedLen = content.length;
            barcodeDebounces.set(n.id, state);
            matched = true;
          }
        }

        if (matched) {
          const lastTriggered = processedEvents.get(n.id) || 0;
          if (now - lastTriggered > 3500) {
            processedEvents.set(n.id, now);
            if (isMacroRunning) {
              pendingListenerNodes.add(n.id);
            } else {
              executeGraph(n.id);
            }
          }
        }
      });
    }

    const passiveWatcher = new MutationObserver(evaluateListenersDebounced);
    passiveWatcher.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('input', evaluateListenersDebounced, true);
    document.addEventListener('change', evaluateListenersDebounced, true);
    window.addEventListener('popstate', () => checkPassiveURLTriggers(true));
    window.addEventListener('hashchange', () => checkPassiveURLTriggers(true));

    // ============================================================
    //  WIDGET DRAG
    // ============================================================
    const handle = document.getElementById('wms-drag-handle');
    let isMainDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      isMainDragging = true;
      const r = mainWidget.getBoundingClientRect();
      dragOffsetX = e.clientX - r.left;
      dragOffsetY = e.clientY - r.top;
      document.body.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isMainDragging) return;
      const w = mainWidget.offsetWidth || 295;
      const h = mainWidget.offsetHeight || 100;
      const newLeft = Math.max(0, Math.min(window.innerWidth - w - 4, e.clientX - dragOffsetX));
      const newTop = Math.max(0, Math.min(window.innerHeight - h - 4, e.clientY - dragOffsetY));
      mainWidget.style.left = newLeft + 'px';
      mainWidget.style.top = newTop + 'px';
      mainWidget.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!isMainDragging) return;
      isMainDragging = false;
      document.body.style.cursor = '';
      const r = mainWidget.getBoundingClientRect();
      SafeStorage.set({ wmsWidgetPos: { left: Math.round(r.left), top: Math.round(r.top) } });
    });

    window.addEventListener('resize', () => {
      if (!mainWidget.style.left) return;
      const r = mainWidget.getBoundingClientRect();
      applyWidgetPosition(r.left, r.top);
    });
  }

  if (document.body) {
    initWMSCircuitStudio();
  } else {
    window.addEventListener('DOMContentLoaded', initWMSCircuitStudio, { once: true });
  }
})();