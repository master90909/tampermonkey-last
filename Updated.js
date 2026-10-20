(function () {
  // Prevent duplicate injection if script runs twice
  if (document.getElementById('wms-helper-utility-node')) {
    document.getElementById('wms-helper-utility-node').remove();
  }
  if (document.getElementById('wms-node-editor')) {
    document.getElementById('wms-node-editor').remove();
  }

  // Safe storage wrapper (prevents crashes if chrome.storage permission is missing)
  const memoryStore = {};
  const SafeStorage = {
    get(keys, callback) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(keys, (res) => callback(res || {}));
        } else {
          const out = {};
          keys.forEach(k => { if (memoryStore[k] !== undefined) out[k] = memoryStore[k]; });
          callback(out);
        }
      } catch (err) {
        console.warn('WMS Storage read fallback:', err);
        callback({});
      }
    },
    set(obj) {
      try {
        Object.assign(memoryStore, obj);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set(obj);
        }
      } catch (err) {
        console.warn('WMS Storage write fallback:', err);
      }
    }
  };

  const style = document.createElement('style');
  style.textContent = `
    #wms-helper-utility-node {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 2147483640;
      position: fixed;
      top: 14px;
      right: 14px;
      width: 295px;
      background: #181920;
      border: 1px solid #2d3139;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 16px 36px rgba(0,0,0,0.55);
      user-select: none;
      color: #e4e7eb;
    }
    .wms-drag-handle {
      background: linear-gradient(135deg, #2d323f, #1e212b);
      color: #00d2ff;
      padding: 9px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 8px 8px 0 0;
      cursor: grab;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.5px;
      margin: -12px -12px 10px -12px;
      border-bottom: 1px solid #333846;
    }
    .wms-drag-handle:active { cursor: grabbing; }

    .box-wrapper { background: #22252e; border-radius: 8px; padding: 7px 9px; margin-bottom: 7px; border: 1px solid #2c303c; }
    .box-label { font-size: 10px; font-weight: 700; color: #8c96a8; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.4px; }
    .box-input {
      width: 100%; box-sizing: border-box; background: #13141a; border: 1px solid #353b49;
      border-radius: 6px; padding: 6px; font-size: 11px; color: #fff; resize: vertical; min-height: 36px; outline: none;
    }
    .box-input:focus { border-color: #00d2ff; }
    .wms-widget-actions { display: flex; gap: 6px; margin-top: 4px; }
    .btn-open-canvas {
      flex: 1; padding: 9px; background: linear-gradient(135deg, #6366f1, #4338ca);
      color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 12px;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;
      transition: transform 0.15s, box-shadow 0.15s; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
    }
    .btn-open-canvas:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45); }
    .btn-quick-run {
      padding: 9px 12px; background: linear-gradient(135deg, #059669, #10b981);
      color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 12px;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;
    }
    .btn-quick-run:hover { filter: brightness(1.1); }
    #wms-status-toast {
      margin-top: 8px; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;
      background: #13141a; border: 1px solid #2c303c; color: #94a3b8; text-align: center;
    }

    #wms-node-editor {
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: #0d0e12;
      z-index: 2147483645;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
      color: #e2e8f0;
    }
    .node-toolbar {
      position: absolute; top: 0; left: 0; width: 100%; height: 54px;
      background: #15171e; border-bottom: 1px solid #272a36;
      display: flex; align-items: center; padding: 0 14px; gap: 7px;
      box-sizing: border-box; z-index: 1000; box-shadow: 0 4px 18px rgba(0,0,0,0.4);
      overflow-x: auto;
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

    .node-canvas-wrapper {
      position: absolute; top: 54px; left: 0; right: 0; bottom: 0;
      overflow: auto; background: #0a0b0e;
    }
    .node-canvas {
      position: relative; width: 4000px; height: 4000px;
      background-size: 32px 32px;
      background-image: 
        radial-gradient(circle, #252a38 1.3px, transparent 1.3px),
        linear-gradient(to right, rgba(255,255,255,0.018) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.018) 1px, transparent 1px);
    }
    #wire-layer {
      position: absolute; top: 0; left: 0; width: 4000px; height: 4000px; pointer-events: none; z-index: 2;
    }
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
    .wms-node.is-executing {
      box-shadow: 0 0 25px rgba(56, 189, 248, 0.85), 0 0 0 2px #38bdf8 !important;
    }
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
      background: #0f1015; color: #f1f5f9; border: 1px solid #2b2f3d;
      border-radius: 6px; padding: 6px 8px; font-size: 11px; width: 100%; box-sizing: border-box; outline: none;
    }
    .node-input:focus, .node-select:focus { border-color: #38bdf8; }
    .node-btn-small {
      background: #252834; color: #e2e8f0; border: 1px solid #3b4053;
      border-radius: 6px; padding: 6px; font-size: 11px; cursor: pointer; text-align: center;
      font-weight: 600; transition: background 0.15s;
    }
    .node-btn-small:hover { background: #323748; color: #fff; border-color: #38bdf8; }

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
      border-radius: 4px; display: none; transition: all 0.05s ease;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  const pickerHighlight = document.createElement('div');
  pickerHighlight.id = 'wms-picker-highlight';
  document.body.appendChild(pickerHighlight);

  const mainWidget = document.createElement('div');
  mainWidget.id = 'wms-helper-utility-node';
  mainWidget.className = 'fs-exclude';
  mainWidget.setAttribute('data-rr-ignore', 'true');
  mainWidget.setAttribute('data-dd-privacy', 'mask-user-input');

  const box1 = { id: 'wms-box-1', label: 'Box 1 (Highlight + Alt+1)', val: '' };
  const box2 = { id: 'wms-box-2', label: 'Box 2 (Highlight + Alt+2)', val: '' };

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

  let graph = { nodes: [], edges: [] };
  let cancelMacro = false;
  let isMacroRunning = false;
  let isPickingElement = false;
  let selectedPort = null;
  let activeWire = null;
  let processedEvents = new WeakMap();

  const canvas = document.getElementById('node-canvas');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const wireLayer = document.getElementById('wire-layer');
  const b1El = document.getElementById(box1.id);
  const b2El = document.getElementById(box2.id);
  const toastEl = document.getElementById('wms-status-toast');

  function setStatus(msg, color = '#94a3b8') {
    if (toastEl) {
      toastEl.textContent = msg;
      toastEl.style.color = color;
    }
  }

  function generateId() {
    return 'node_' + Math.random().toString(36).substring(2, 9);
  }

  function saveGraph() {
    SafeStorage.set({ wmsGraph: graph });
  }

  SafeStorage.get(['box1Data', 'box2Data', 'wmsGraph'], (res) => {
    if (res.box1Data) { b1El.value = res.box1Data; box1.val = res.box1Data; }
    if (res.box2Data) { b2El.value = res.box2Data; box2.val = res.box2Data; }
    if (res.wmsGraph && Array.isArray(res.wmsGraph.nodes) && res.wmsGraph.nodes.length > 0) {
      graph = res.wmsGraph;
    } else {
      // Create a helpful default starter node if empty
      const trigId = generateId();
      graph = {
        nodes: [{ id: trigId, type: 'trigger', subtype: 'hotkey', val: 'ALT+Q', x: 80, y: 100 }],
        edges: []
      };
    }
    renderGraph();
    checkPassiveURLTriggers();
  });

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
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
      }
    });
  }

  b1El.addEventListener('input', e => { box1.val = e.target.value; SafeStorage.set({ box1Data: box1.val }); });
  b2El.addEventListener('input', e => { box2.val = e.target.value; SafeStorage.set({ box2Data: box2.val }); });

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
    if (graph.nodes.length === 0) {
      setStatus('⚠️ Add blocks in Circuit Studio first!', '#f59e0b');
      return;
    }
    // Find a trigger/listener node, or fallback to any root node without incoming wires
    let startNode = graph.nodes.find(n => n.type === 'trigger' || n.type === 'listener');
    if (!startNode) {
      startNode = graph.nodes.find(n => !graph.edges.some(e => e.target === n.id)) || graph.nodes[0];
    }
    if (startNode) {
      editorOverlay.style.display = 'none';
      executeGraph(startNode.id);
    }
  }

  document.getElementById('quick-run-circuit-btn').addEventListener('click', runFirstAvailableCircuit);
  document.getElementById('studio-run-btn').addEventListener('click', runFirstAvailableCircuit);

  function renderGraph() {
    Array.from(canvas.children).forEach(child => {
      if (child.id !== 'wire-layer') child.remove();
    });
    wireLayer.innerHTML = '';
    graph.nodes.forEach(node => createNodeDOM(node));
    requestAnimationFrame(() => drawAllWires());
  }

  function createNodeDOM(node) {
    const el = document.createElement('div');
    el.className = `wms-node node-${node.type}`;
    el.id = node.id;
    el.style.left = (node.x || 100) + 'px';
    el.style.top = (node.y || 100) + 'px';

    const icons = {
      trigger: '⚡', listener: '👂', if: '🔀',
      click: '👆', type: '⌨️', wait: '⏳', extract: '📋'
    };
    const headerIcon = icons[node.type] || '⚡';
    const title = node.type.toUpperCase();

    const headerHtml = `
      <div class="wms-node-header">
        <span>${headerIcon} ${title}</span>
        <span class="del-node" style="cursor:pointer; opacity:0.8; padding:0 4px;" title="Delete Node">✖</span>
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
          <option value="number_gt" ${node.cond === 'number_gt' ? 'selected' : ''}>Number Greater Than (>)</op
