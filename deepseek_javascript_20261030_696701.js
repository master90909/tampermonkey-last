(function () {
  if (typeof window.__wmsCircuitCleanup === 'function') {
    try { window.__wmsCircuitCleanup(); } catch (e) { console.warn('WMS cleanup error:', e); }
  }

  function initWMSCircuitStudio() {
    ['wms-helper-utility-node','wms-node-editor','wms-picker-highlight','wms-circuit-studio-styles','wms-dict-manager','wms-dict-insert-menu'].forEach((id) => {
      const ex = document.getElementById(id); if (ex) ex.remove();
    });

    const memoryStore = {};
    const SafeStorage = {
      get(keys, cb) {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) chrome.storage.local.get(keys, (r) => cb(r || {}));
          else { const out = {}; keys.forEach((k) => { if (memoryStore[k] !== undefined) out[k] = memoryStore[k]; }); cb(out); }
        } catch (e) { console.warn('Storage read:', e); cb({}); }
      },
      set(obj) {
        try {
          Object.assign(memoryStore, obj);
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) chrome.storage.local.set(obj);
        } catch (e) { console.warn('Storage write:', e); }
      }
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    function escapeAttr(s) {
      if (s === undefined || s === null) return '';
      return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function getHotkeyCombo(e) {
      if (['Control','Alt','Shift','Meta'].includes(e.key)) return null;
      const keys = [];
      if (e.ctrlKey) keys.push('CTRL');
      if (e.altKey) keys.push('ALT');
      if (e.shiftKey) keys.push('SHIFT');
      let mk = e.key ? e.key.toUpperCase() : '';
      if (e.code && e.code.startsWith('Key')) mk = e.code.slice(3).toUpperCase();
      else if (e.code && e.code.startsWith('Digit')) mk = e.code.slice(5);
      if (!mk) return null;
      keys.push(mk);
      return keys.join('+');
    }

    const style = document.createElement('style');
    style.id = 'wms-circuit-studio-styles';
    style.textContent = `
      #wms-helper-utility-node{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;z-index:2147483640;position:fixed;top:14px;left:calc(100vw - 315px);width:min(295px,calc(100vw - 16px));background:#181920;border:1px solid #2d3139;border-radius:12px;padding:12px;box-shadow:0 16px 36px rgba(0,0,0,0.55);user-select:none;color:#e4e7eb;box-sizing:border-box;cursor:grab;transition:box-shadow 0.15s,border-color 0.15s}
      #wms-helper-utility-node.is-dragging{cursor:grabbing!important;border-color:#00d2ff;box-shadow:0 22px 48px rgba(0,210,255,0.25),0 12px 28px rgba(0,0,0,0.75)}
      #wms-helper-utility-node.is-minimized{width:min(230px,calc(100vw - 16px));padding-bottom:4px}
      #wms-helper-utility-node.is-minimized #wms-widget-body{display:none}
      #wms-helper-utility-node.is-minimized .wms-drag-handle{margin-bottom:-4px;border-bottom:none;border-radius:8px}
      .wms-drag-handle{background:linear-gradient(135deg,#2d323f,#1e212b);color:#00d2ff;padding:9px 10px;display:flex;justify-content:space-between;align-items:center;border-radius:8px 8px 0 0;cursor:grab;font-weight:700;font-size:12px;letter-spacing:0.4px;margin:-12px -12px 10px -12px;border-bottom:1px solid #333846}
      .wms-drag-handle:active{cursor:grabbing}
      .wms-header-controls{display:flex;align-items:center;gap:4px}
      .wms-header-btn{background:#252936;color:#cbd5e1;border:1px solid #3b4254;border-radius:5px;width:22px;height:20px;font-size:11px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
      .wms-header-btn:hover{background:#33394b;color:#00d2ff;border-color:#00d2ff}
      .box-wrapper{background:#22252e;border-radius:8px;padding:7px 9px;margin-bottom:7px;border:1px solid #2c303c}
      .box-label{font-size:10px;font-weight:700;color:#8c96a8;text-transform:uppercase;margin-bottom:4px;letter-spacing:0.4px}
      .box-input{width:100%;box-sizing:border-box;background:#13141a;border:1px solid #353b49;border-radius:6px;padding:6px;font-size:11px;color:#fff;resize:vertical;min-height:36px;outline:none;cursor:text}
      .box-input:focus{border-color:#00d2ff}
      .wms-widget-actions{display:flex;gap:6px;margin-top:4px}
      .btn-open-canvas{flex:1;padding:9px;background:linear-gradient(135deg,#6366f1,#4338ca);color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:transform 0.15s,box-shadow 0.15s;box-shadow:0 4px 14px rgba(99,102,241,0.35)}
      .btn-open-canvas:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(99,102,241,0.45)}
      .btn-quick-run{padding:9px 12px;background:linear-gradient(135deg,#059669,#10b981);color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px}
      .btn-quick-run:hover{filter:brightness(1.1)}
      #wms-status-toast{margin-top:8px;padding:6px 8px;border-radius:6px;font-size:11px;font-weight:600;background:#13141a;border:1px solid #2c303c;color:#94a3b8;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #wms-node-editor{display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0d0e12;z-index:2147483645;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none;color:#e2e8f0}
      .node-toolbar{position:absolute;top:0;left:0;width:100%;height:54px;background:#15171e;border-bottom:1px solid #272a36;display:flex;align-items:center;padding:0 14px;gap:7px;box-sizing:border-box;z-index:1000;box-shadow:0 4px 18px rgba(0,0,0,0.4);overflow-x:auto;overflow-y:hidden}
      .node-toolbar::-webkit-scrollbar{height:6px}
      .node-toolbar::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
      .toolbar-label{font-size:11px;font-weight:700;color:#717d96;text-transform:uppercase;margin-right:4px;white-space:nowrap}
      .node-btn{background:#252834;color:#f1f5f9;border:1px solid #3b4052;border-radius:7px;padding:6px 10px;font-weight:600;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all 0.15s ease;white-space:nowrap}
      .node-btn:hover{background:#323646;border-color:#4e556d;transform:translateY(-1px)}
      .btn-run-studio{background:#2563eb;border-color:#3b82f6}
      .btn-run-studio:hover{background:#3b82f6}
      .btn-save{background:#059669;border-color:#10b981}
      .btn-save:hover{background:#10b981}
      .btn-log-toggle{background:#0f172a;border-color:#334155}
      .btn-log-toggle:hover{background:#1e293b}
      .btn-dict{background:#365314;border-color:#65a30d}
      .btn-dict:hover{background:#65a30d;color:#fff}
      .btn-close{background:#dc2626;border-color:#ef4444;margin-left:auto}
      .btn-close:hover{background:#ef4444}
      .node-canvas-wrapper{position:absolute;top:54px;left:0;right:0;bottom:32px;overflow:auto;background:#0a0b0e;cursor:grab;transition:bottom 0.2s ease}
      #wms-node-editor.log-open .node-canvas-wrapper{bottom:200px}
      @media (max-height:640px){#wms-node-editor.log-open .node-canvas-wrapper{bottom:140px}}
      .node-canvas-wrapper.is-panning{cursor:grabbing}
      .node-canvas{position:relative;width:4000px;height:4000px;background-size:32px 32px;background-image:radial-gradient(circle,#252a38 1.3px,transparent 1.3px),linear-gradient(to right,rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.018) 1px,transparent 1px)}
      #wire-layer{position:absolute;top:0;left:0;width:4000px;height:4000px;pointer-events:none;z-index:2}
      .wire{fill:none;stroke:#64748b;stroke-width:3.5;stroke-linecap:round;transition:stroke 0.15s,stroke-width 0.15s}
      .wire:hover{stroke:#ef4444;stroke-width:6}
      .wire-active{stroke:#38bdf8;stroke-dasharray:8 6;pointer-events:none!important;animation:wireFlow 0.5s linear infinite}
      .wire-true{stroke:#10b981}
      .wire-false{stroke:#f43f5e}
      @keyframes wireFlow{to{stroke-dashoffset:-14}}
      .wms-node{position:absolute;width:245px;background:#161820;border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,0.65),0 0 0 1px #2b3040;display:flex;flex-direction:column;z-index:5;cursor:grab}
      .wms-node:active{cursor:grabbing}
      .wms-node.is-executing{box-shadow:0 0 25px rgba(56,189,248,0.85),0 0 0 2px #38bdf8!important}
      .wms-node.is-success{animation:flashSuccess 0.7s ease}
      .wms-node.is-failure{animation:flashFailure 0.7s ease}
      @keyframes flashSuccess{0%,100%{box-shadow:0 10px 28px rgba(0,0,0,0.65),0 0 0 1px #2b3040}50%{box-shadow:0 0 25px rgba(16,185,129,1),0 0 0 2px #10b981}}
      @keyframes flashFailure{0%,100%{box-shadow:0 10px 28px rgba(0,0,0,0.65),0 0 0 1px #2b3040}50%{box-shadow:0 0 25px rgba(239,68,68,1),0 0 0 2px #ef4444}}
      .wms-node-header{padding:9px 12px;border-radius:9px 9px 0 0;font-weight:700;font-size:11px;cursor:grab;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.08);text-transform:uppercase;letter-spacing:0.5px}
      .wms-node-header:active{cursor:grabbing}
      .wms-node-body{padding:10px 14px;display:flex;flex-direction:column;gap:7px}
      .node-trigger .wms-node-header{background:linear-gradient(90deg,#b45309,#d97706);color:#fff}
      .node-listener .wms-node-header{background:linear-gradient(90deg,#7c3aed,#9333ea);color:#fff}
      .node-if .wms-node-header{background:linear-gradient(90deg,#be123c,#e11d48);color:#fff}
      .node-click .wms-node-header{background:linear-gradient(90deg,#1d4ed8,#2563eb);color:#fff}
      .node-type .wms-node-header{background:linear-gradient(90deg,#047857,#059669);color:#fff}
      .node-wait .wms-node-header{background:linear-gradient(90deg,#c2410c,#ea580c);color:#fff}
      .node-extract .wms-node-header{background:linear-gradient(90deg,#0e7490,#0891b2);color:#fff}
      .node-enter .wms-node-header{background:linear-gradient(90deg,#9d174d,#db2777);color:#fff}
      .node-variable .wms-node-header{background:linear-gradient(90deg,#365314,#65a30d);color:#fff}
      .node-input,.node-select{background:#0f1015;color:#f1f5f9;border:1px solid #2b2f3d;border-radius:6px;padding:6px 8px;font-size:11px;width:100%;box-sizing:border-box;outline:none;cursor:auto}
      .node-input:focus,.node-select:focus{border-color:#38bdf8}
      .node-btn-small{background:#252834;color:#e2e8f0;border:1px solid #3b4053;border-radius:6px;padding:6px;font-size:11px;cursor:pointer;text-align:center;font-weight:600;transition:background 0.15s}
      .node-btn-small:hover{background:#323748;color:#fff;border-color:#38bdf8}
      .n-pick-row{display:flex;gap:4px}
      .n-pick-row .n-pick{flex:1}
      .n-dict-btn{background:#365314;border-color:#65a30d;color:#fff;flex:0 0 34px;font-size:12px;padding:6px 0}
      .n-dict-btn:hover{background:#4d7c0f}
      .n-resolved-hint{font-size:9px;padding:0 4px;font-family:'SF Mono',Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}
      .n-resolved-ok{color:#65a30d}
      .n-resolved-bad{color:#ef4444}
      .port{width:18px;height:18px;border-radius:50%;background:#94a3b8;position:absolute;border:3px solid #161820;cursor:pointer;z-index:20;box-sizing:border-box;transition:transform 0.15s,background-color 0.15s,box-shadow 0.15s}
      .port:hover,.port.port-selected{transform:scale(1.35);background:#38bdf8;box-shadow:0 0 12px #38bdf8}
      .port-in{left:-10px;top:50%;margin-top:-9px}
      .port-out{right:-10px;top:50%;margin-top:-9px}
      .port-true{right:-10px;top:48px;background:#10b981}
      .port-false{right:-10px;top:84px;background:#ef4444}
      .port-tag{position:absolute;right:12px;font-size:9px;font-weight:800;pointer-events:none;text-transform:uppercase}
      .tag-true{top:50px;color:#10b981}
      .tag-false{top:86px;color:#ef4444}
      .n-submit-row{display:flex;align-items:center;gap:6px;font-size:10px;color:#cbd5e1;padding:2px 4px;cursor:pointer;user-select:none;border-radius:4px}
      .n-submit-row:hover{color:#fff;background:#1c1f28}
      .n-submit-row input{accent-color:#10b981;cursor:pointer}
      #wms-log-panel{position:absolute;left:0;right:0;bottom:0;height:32px;background:#0a0b10;border-top:1px solid #272a36;display:flex;flex-direction:column;z-index:999;transition:height 0.2s ease;overflow:hidden}
      #wms-node-editor.log-open #wms-log-panel{height:200px}
      @media (max-height:640px){#wms-node-editor.log-open #wms-log-panel{height:140px}}
      #wms-log-header{height:32px;flex-shrink:0;display:flex;align-items:center;gap:8px;padding:0 12px;font-size:11px;font-weight:700;color:#94a3b8;background:#15171e;border-bottom:1px solid #272a36}
      #wms-log-header .log-title{flex:1;text-transform:uppercase;letter-spacing:0.4px}
      #wms-log-header .log-count{font-weight:500;color:#64748b;text-transform:none}
      .log-btn{background:#252834;color:#cbd5e1;border:1px solid #3b4052;border-radius:5px;padding:3px 8px;font-size:10px;font-weight:600;cursor:pointer}
      .log-btn:hover{background:#323748;color:#fff;border-color:#38bdf8}
      #wms-log-body{flex:1;overflow-y:auto;padding:4px 8px;font-family:'SF Mono',Consolas,Monaco,monospace;font-size:11px;line-height:1.5}
      #wms-log-body::-webkit-scrollbar{width:8px}
      #wms-log-body::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
      .log-entry{padding:2px 0;display:flex;gap:8px;border-bottom:1px solid rgba(255,255,255,0.03)}
      .log-entry .log-time{color:#64748b;flex-shrink:0}
      .log-entry .log-msg{flex:1;word-break:break-word}
      .log-entry .log-detail{color:#94a3b8;font-size:10px;margin-left:auto;flex-shrink:0}
      .log-entry.info .log-msg{color:#38bdf8}
      .log-entry.success .log-msg{color:#10b981}
      .log-entry.warn .log-msg{color:#f59e0b}
      .log-entry.error .log-msg{color:#ef4444}
      .log-entry.error{background:rgba(239,68,68,0.06)}
      #wms-dict-manager{display:none;position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.7);align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
      #wms-dict-manager .dict-box{background:#181920;border:1px solid #2d3139;border-radius:12px;width:min(760px,92vw);max-height:82vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.8);color:#e4e7eb}
      #wms-dict-manager .dict-head{padding:14px 16px;border-bottom:1px solid #2d3139;display:flex;align-items:center;gap:10px}
      #wms-dict-manager .dict-head h2{margin:0;color:#00d2ff;font-size:14px;font-weight:700}
      #wms-dict-manager .dict-head .dict-hint{color:#64748b;font-size:11px}
      #wms-dict-manager .dict-head .dict-hint code{background:#0f1015;color:#65a30d;padding:1px 5px;border-radius:3px;font-family:monospace}
      #wms-dict-manager .dict-close{margin-left:auto;background:#252834;color:#cbd5e1;border:1px solid #3b4052;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px}
      #wms-dict-manager .dict-close:hover{background:#dc2626;color:#fff;border-color:#ef4444}
      #wms-dict-manager .dict-list{flex:1;overflow-y:auto;padding:12px}
      #wms-dict-manager .dict-list::-webkit-scrollbar{width:8px}
      #wms-dict-manager .dict-list::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
      #wms-dict-manager .dict-empty{color:#64748b;text-align:center;padding:30px 20px;font-size:12px;line-height:1.8}
      #wms-dict-manager .dict-row{display:flex;gap:8px;margin-bottom:8px;align-items:center;background:#1c1f28;padding:8px;border-radius:8px;border:1px solid #2d3139}
      #wms-dict-manager .dict-row .dict-name{flex:0 0 130px;background:#0f1015;color:#f1f5f9;border:1px solid #2b2f3d;border-radius:6px;padding:6px 8px;font-size:12px;outline:none;font-weight:600}
      #wms-dict-manager .dict-row .dict-value{flex:1;background:#0f1015;color:#f1f5f9;border:1px solid #2b2f3d;border-radius:6px;padding:6px 8px;font-size:11px;outline:none;font-family:monospace}
      #wms-dict-manager .dict-row input:focus{border-color:#38bdf8}
      #wms-dict-manager .dict-actions{display:flex;gap:6px;padding:12px;border-top:1px solid #2d3139;align-items:center}
      #wms-dict-manager .dict-action-btn{background:#252834;color:#f1f5f9;border:1px solid #3b4052;border-radius:7px;padding:7px 12px;font-weight:600;font-size:11px;cursor:pointer}
      #wms-dict-manager .dict-action-btn:hover{background:#323646;border-color:#4e556d}
      #wms-dict-manager .dict-action-btn.primary{background:#059669;border-color:#10b981}
      #wms-dict-manager .dict-action-btn.primary:hover{background:#10b981}
      #wms-dict-manager .dict-action-btn.pick{background:#2563eb;border-color:#3b82f6}
      #wms-dict-manager .dict-action-btn.pick:hover{background:#3b82f6}
      #wms-dict-manager .dict-usage{font-size:10px;color:#64748b;white-space:nowrap;padding:0 4px;min-width:50px;text-align:right}
      #wms-dict-manager .dict-usage.in-use{color:#10b981}
      #wms-picker-highlight{position:fixed;pointer-events:none;z-index:2147483646;border:3px solid #00d2ff;background:rgba(0,210,255,0.15);border-radius:4px;display:none;transition:all 0.04s ease}
    `;
    (document.head || document.documentElement).appendChild(style);

    const pickerHighlight = document.createElement('div');
    pickerHighlight.id = 'wms-picker-highlight';
    document.body.appendChild(pickerHighlight);

    // ============ LOG ============
    const logEntries = [];
    const MAX_LOG_ENTRIES = 500;
    let logBodyEl = null;
    let logCountEl = null;

    function logStep(level, message, detail = '') {
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
      logEntries.push({ ts, level, message, detail });
      if (logEntries.length > MAX_LOG_ENTRIES) logEntries.shift();
      renderLog();
      if (level === 'success') setStatus(message, '#10b981');
      else if (level === 'error') setStatus(message, '#ef4444');
      else if (level === 'warn') setStatus(message, '#f59e0b');
      else setStatus(message, '#38bdf8');
    }
    function renderLog() {
      if (!logBodyEl) return;
      logBodyEl.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (const e of logEntries) {
        const row = document.createElement('div');
        row.className = `log-entry ${e.level}`;
        const d = e.detail ? `<span class="log-detail">${escapeAttr(e.detail)}</span>` : '';
        row.innerHTML = `<span class="log-time">${e.ts}</span><span class="log-msg">${escapeAttr(e.message)}</span>${d}`;
        frag.appendChild(row);
      }
      logBodyEl.appendChild(frag);
      logBodyEl.scrollTop = logBodyEl.scrollHeight;
      if (logCountEl) logCountEl.textContent = `(${logEntries.length})`;
    }

    // ============ WIDGET ============
    const mainWidget = document.createElement('div');
    mainWidget.id = 'wms-helper-utility-node';
    mainWidget.className = 'fs-exclude';
    mainWidget.setAttribute('data-rr-ignore', 'true');
    mainWidget.setAttribute('data-dd-privacy', 'mask-user-input');

    const box1 = { id: 'wms-box-1', label: 'Box 1 (Copy/Paste: Alt+1)', val: '' };
    const box2 = { id: 'wms-box-2', label: 'Box 2 (Copy/Paste: Alt+2)', val: '' };

    mainWidget.innerHTML = `
      <div id="wms-drag-handle" class="wms-drag-handle">
        <span>⠿ ⚡ WMS Circuit Box</span>
        <div class="wms-header-controls">
          <button id="wms-reset-pos-btn" class="wms-header-btn" title="Reset Box Position">⟲</button>
          <button id="wms-minimize-btn" class="wms-header-btn" title="Minimize / Expand">—</button>
        </div>
      </div>
      <div id="wms-widget-body">
        <div class="box-wrapper"><div class="box-label">${box1.label}</div><textarea id="${box1.id}" class="box-input" placeholder="Copied or extracted text..."></textarea></div>
        <div class="box-wrapper"><div class="box-label">${box2.label}</div><textarea id="${box2.id}" class="box-input" placeholder="Copied or extracted text..."></textarea></div>
        <div class="wms-widget-actions">
          <button id="open-node-editor-btn" class="btn-open-canvas">🧩 Circuit Studio</button>
          <button id="quick-run-circuit-btn" class="btn-quick-run" title="Run circuit immediately">▶ Run</button>
        </div>
        <div id="wms-status-toast">Ready • ESC = Stop</div>
      </div>
    `;
    document.body.appendChild(mainWidget);

    // ============ EDITOR ============
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
        <button class="node-btn" id="add-enter">⏎ Enter</button>
        <button class="node-btn" id="add-wait">⏳ Wait</button>
        <button class="node-btn" id="add-extract">📋 Extract</button>
        <button class="node-btn" id="add-variable">📦 Variable</button>
        <button class="node-btn btn-dict" id="toggle-dict-btn">📚 Dictionary</button>
        <button class="node-btn btn-log-toggle" id="toggle-log-btn">📋 Log</button>
        <button class="node-btn btn-run-studio" id="studio-run-btn">▶ Test Run</button>
        <button class="node-btn btn-save" id="save-graph-btn">💾 Save</button>
        <button class="node-btn btn-close" id="close-editor-btn">✖ Close</button>
      </div>
      <div class="node-canvas-wrapper" id="canvas-wrapper">
        <div class="node-canvas" id="node-canvas">
          <svg id="wire-layer" width="4000" height="4000"></svg>
        </div>
      </div>
      <div id="wms-log-panel">
        <div id="wms-log-header">
          <span class="log-title">📋 Activity Log <span class="log-count" id="wms-log-count">(0)</span></span>
          <button class="log-btn" id="wms-log-clear">Clear</button>
          <button class="log-btn" id="wms-log-copy">Copy</button>
        </div>
        <div id="wms-log-body"></div>
      </div>
    `;
    document.body.appendChild(editorOverlay);

    // ============ DICT MODAL ============
    const dictManagerEl = document.createElement('div');
    dictManagerEl.id = 'wms-dict-manager';
    dictManagerEl.innerHTML = `
      <div class="dict-box">
        <div class="dict-head">
          <h2>📚 Element Dictionary</h2>
          <span class="dict-hint">Use <code>{{name}}</code> in any selector field</span>
          <button class="dict-close" id="dict-close-btn">✕ Close</button>
        </div>
        <div class="dict-list" id="dict-list"></div>
        <div class="dict-actions">
          <button class="dict-action-btn" id="dict-add-btn">+ Add Entry</button>
          <button class="dict-action-btn primary" id="dict-pick-add-btn">🎯 Pick & Add</button>
          <span style="flex:1;"></span>
          <span style="font-size:11px;color:#64748b;">💡 Click 📋 to copy <code>{{name}}</code></span>
        </div>
      </div>
    `;
    document.body.appendChild(dictManagerEl);
    const dictListEl = document.getElementById('dict-list');

    // ============ STATE ============
    let graph = { nodes: [], edges: [], variables: {}, dictionary: [] };
    let cancelMacro = false;
    let isMacroRunning = false;
    let isPickingElement = false;
    let selectedPort = null;
    let activeWire = null;
    let lastCheckedUrl = '';
    const processedEvents = new WeakMap();

    const canvas = document.getElementById('node-canvas');
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const wireLayer = document.getElementById('wire-layer');
    const b1El = document.getElementById(box1.id);
    const b2El = document.getElementById(box2.id);
    const toastEl = document.getElementById('wms-status-toast');
    const minBtn = document.getElementById('wms-minimize-btn');
    const resetPosBtn = document.getElementById('wms-reset-pos-btn');
    logBodyEl = document.getElementById('wms-log-body');
    logCountEl = document.getElementById('wms-log-count');

    function setStatus(msg, color = '#94a3b8') {
      if (toastEl && (toastEl.textContent !== msg || toastEl.style.color !== color)) {
        toastEl.textContent = msg; toastEl.style.color = color;
      }
    }

    // ============ DICT RESOLUTION ============
    function resolveTemplate(str) {
      if (!str || typeof str !== 'string') return { value: str || '', missing: [] };
      const missing = [];
      const value = str.replace(/\{\{([A-Za-z0-9_$-]+)\}\}/g, (match, name) => {
        const entry = (graph.dictionary || []).find(e => e.name === name);
        if (!entry) { missing.push(name); return ''; }
        return entry.value;
      });
      return { value, missing };
    }
    function resolveSelectorForNode(node) {
      if (!node.selector) return { ok: false, reason: 'missing-selector' };
      const { value, missing } = resolveTemplate(node.selector);
      if (missing.length > 0) return { ok: false, reason: `unknown dictionary refs: {{${missing.join('}}, {{')}}}` };
      if (!value.trim()) return { ok: false, reason: 'empty-selector-after-resolve' };
      return { ok: true, selector: value };
    }

    // ============ UI WIRES ============
    document.getElementById('toggle-log-btn').addEventListener('click', () => {
      editorOverlay.classList.toggle('log-open');
      requestAnimationFrame(() => drawAllWires());
    });
    document.getElementById('wms-log-clear').addEventListener('click', () => { logEntries.length = 0; renderLog(); });
    document.getElementById('wms-log-copy').addEventListener('click', () => {
      const text = logEntries.map((e) => `[${e.ts}] ${e.level.toUpperCase()} ${e.message}${e.detail ? ' | ' + e.detail : ''}`).join('\n');
      try { navigator.clipboard.writeText(text).then(() => setStatus('📋 Log copied', '#10b981'), () => setStatus('📋 Copy failed', '#ef4444')); }
      catch (_) { setStatus('📋 Copy unavailable', '#f59e0b'); }
    });
    document.getElementById('toggle-dict-btn').addEventListener('click', () => {
      if (dictManagerEl.style.display === 'flex') dictManagerEl.style.display = 'none';
      else { dictManagerEl.style.display = 'flex'; renderDictList(); }
    });
    document.getElementById('dict-close-btn').addEventListener('click', () => { dictManagerEl.style.display = 'none'; });
    dictManagerEl.addEventListener('click', (e) => { if (e.target === dictManagerEl) dictManagerEl.style.display = 'none'; });
    document.getElementById('dict-add-btn').addEventListener('click', () => {
      if (!graph.dictionary) graph.dictionary = [];
      const idx = graph.dictionary.length + 1;
      graph.dictionary.push({ id: generateDictId(), name: `entry_${idx}`, value: '' });
      saveGraph(); renderDictList();
      logStep('info', `➕ Added dict entry "entry_${idx}"`);
    });
    document.getElementById('dict-pick-add-btn').addEventListener('click', () => startPickAndAdd());

    // ============ HELPERS ============
    function clampWidgetPosition(left, top) {
      const r = mainWidget.getBoundingClientRect();
      const w = r.width || 295, h = r.height || 180;
      return {
        left: Math.min(Math.max(8, left), Math.max(8, window.innerWidth - w - 8)),
        top: Math.min(Math.max(8, top), Math.max(8, window.innerHeight - h - 8))
      };
    }
    function applyWidgetPosition(left, top, save = false) {
      const c = clampWidgetPosition(left, top);
      mainWidget.style.left = c.left + 'px'; mainWidget.style.top = c.top + 'px';
      mainWidget.style.right = 'auto'; mainWidget.style.bottom = 'auto';
      if (save) SafeStorage.set({ wmsWidgetPos: c });
    }
    function generateId() { return 'node_' + Math.random().toString(36).substring(2, 9); }
    function generateDictId() { return 'd_' + Math.random().toString(36).substring(2, 8); }
    function saveGraph() {
      if (!graph.variables) graph.variables = {};
      if (!graph.dictionary) graph.dictionary = [];
      SafeStorage.set({ wmsGraph: graph });
    }

    function deepQuery(selector) {
      if (!selector || typeof selector !== 'string') return null;
      const sel = selector.trim();
      if (!sel) return null;
      try { const d = document.querySelector(sel); if (d) return d; } catch (_) { return null; }
      const walk = (root) => {
        let all;
        try { all = root.querySelectorAll('*'); } catch (_) { return null; }
        for (const el of all) {
          if (!el.shadowRoot) continue;
          try { const hit = el.shadowRoot.querySelector(sel); if (hit) return hit; } catch (_) {}
          const deeper = walk(el.shadowRoot);
          if (deeper) return deeper;
        }
        return null;
      };
      const shadow = walk(document);
      if (shadow) return shadow;
      try {
        for (const iframe of document.querySelectorAll('iframe')) {
          try {
            const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
            if (!doc) continue;
            const hit = doc.querySelector(sel); if (hit) return hit;
          } catch (_) {}
        }
      } catch (_) {}
      return null;
    }
    const safeQuery = deepQuery;

    // ============ STORAGE LOAD ============
    SafeStorage.get(['box1Data','box2Data','wmsGraph','wmsWidgetPos','wmsWidgetMin'], (res) => {
      if (res.box1Data) { b1El.value = res.box1Data; box1.val = res.box1Data; }
      if (res.box2Data) { b2El.value = res.box2Data; box2.val = res.box2Data; }
      if (res.wmsWidgetMin) { mainWidget.classList.add('is-minimized'); minBtn.textContent = '+'; }
      if (res.wmsWidgetPos && typeof res.wmsWidgetPos.left === 'number' && typeof res.wmsWidgetPos.top === 'number') {
        applyWidgetPosition(res.wmsWidgetPos.left, res.wmsWidgetPos.top, false);
      } else {
        applyWidgetPosition(Math.max(8, window.innerWidth - 310), 14, false);
      }
      if (res.wmsGraph && Array.isArray(res.wmsGraph.nodes) && res.wmsGraph.nodes.length > 0) graph = res.wmsGraph;
      else graph = { nodes: [{ id: generateId(), type: 'trigger', subtype: 'hotkey', val: 'ALT+Q', x: 80, y: 100 }], edges: [], variables: {}, dictionary: [] };
      if (!graph.variables) graph.variables = {};
      if (!graph.dictionary) graph.dictionary = [];
      (graph.nodes || []).forEach(n => { if (n.type === 'extract' && !n.mode) n.mode = 'immediate'; });
      renderGraph();
      checkPassiveURLTriggers(true);
    });

    const onStorageChanged = (changes, namespace) => {
      if (namespace !== 'local') return;
      if (changes.box1Data && changes.box1Data.newValue !== box1.val) { box1.val = changes.box1Data.newValue || ''; b1El.value = box1.val; }
      if (changes.box2Data && changes.box2Data.newValue !== box2.val) { box2.val = changes.box2Data.newValue || ''; b2El.value = box2.val; }
      if (changes.wmsGraph && editorOverlay.style.display !== 'block' && !isPickingElement && !isMacroRunning) {
        graph = changes.wmsGraph.newValue || { nodes: [], edges: [], variables: {}, dictionary: [] };
        if (!graph.variables) graph.variables = {};
        if (!graph.dictionary) graph.dictionary = [];
        (graph.nodes || []).forEach(n => { if (n.type === 'extract' && !n.mode) n.mode = 'immediate'; });
        renderGraph();
      }
    };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) chrome.storage.onChanged.addListener(onStorageChanged);

    b1El.addEventListener('input', (e) => { box1.val = e.target.value; SafeStorage.set({ box1Data: box1.val }); });
    b2El.addEventListener('input', (e) => { box2.val = e.target.value; SafeStorage.set({ box2Data: box2.val }); });
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isMin = mainWidget.classList.toggle('is-minimized');
      minBtn.textContent = isMin ? '+' : '—';
      SafeStorage.set({ wmsWidgetMin: isMin });
      const r = mainWidget.getBoundingClientRect();
      applyWidgetPosition(r.left, r.top, true);
    });
    resetPosBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mainWidget.classList.remove('is-minimized'); minBtn.textContent = '—';
      SafeStorage.set({ wmsWidgetMin: false });
      applyWidgetPosition(Math.max(8, window.innerWidth - 310), 14, true);
      setStatus('📍 Position reset', '#00d2ff');
    });
    document.getElementById('open-node-editor-btn').addEventListener('click', () => {
      editorOverlay.style.display = 'block';
      requestAnimationFrame(() => drawAllWires());
    });
    document.getElementById('close-editor-btn').addEventListener('click', () => { editorOverlay.style.display = 'none'; selectedPort = null; });
    document.getElementById('save-graph-btn').addEventListener('click', () => {
      saveGraph();
      const btn = document.getElementById('save-graph-btn');
      const old = btn.innerHTML; btn.innerHTML = '✅ Saved!';
      logStep('success', '💾 Circuit saved');
      setTimeout(() => { btn.innerHTML = old; }, 1200);
    });

    // ============ DICT LIST ============
    function countDictUsage(name) {
      const ref = `{{${name}}}`;
      return (graph.nodes || []).filter(n =>
        (n.selector && n.selector.includes(ref)) || (n.customText && n.customText.includes(ref))
      ).length;
    }
    function renderDictList() {
      if (!dictListEl) return;
      dictListEl.innerHTML = '';
      const entries = graph.dictionary || [];
      if (entries.length === 0) {
        dictListEl.innerHTML = `<div class="dict-empty">No entries yet.<br>Click <strong>🎯 Pick & Add</strong> to save an element from this page, or <strong>+ Add Entry</strong> to type one manually.</div>`;
        return;
      }
      entries.forEach((entry) => {
        const usage = countDictUsage(entry.name);
        const row = document.createElement('div');
        row.className = 'dict-row'; row.setAttribute('data-id', entry.id);
        row.innerHTML = `
          <input type="text" class="dict-name" value="${escapeAttr(entry.name)}" placeholder="name" maxlength="40" spellcheck="false" autocomplete="off">
          <input type="text" class="dict-value" value="${escapeAttr(entry.value)}" placeholder="selector or value">
          <button class="dict-action-btn pick" title="Pick element to replace value">🎯</button>
          <button class="dict-action-btn" title="Copy {{name}} reference">📋</button>
          <button class="dict-action-btn" title="Delete entry" style="background:#dc2626;border-color:#ef4444;">✕</button>
          <span class="dict-usage ${usage > 0 ? 'in-use' : ''}" title="Blocks using this entry">${usage > 0 ? usage + '×' : 'unused'}</span>
        `;
        const nameI = row.querySelector('.dict-name');
        const valueI = row.querySelector('.dict-value');
        const btns = row.querySelectorAll('.dict-action-btn');
        const pickB = btns[0], copyB = btns[1], delB = btns[2];

        nameI.addEventListener('focus', () => { nameI.dataset.prevName = entry.name; });
        nameI.addEventListener('input', (e) => {
          const raw = e.target.value;
          const clean = raw.replace(/[^A-Za-z0-9_$-]/g, '');
          if (clean !== raw) {
            const cb = e.target.selectionStart || 0;
            const kept = raw.slice(0, cb).replace(/[^A-Za-z0-9_$-]/g, '').length;
            e.target.value = clean;
            try { e.target.setSelectionRange(kept, kept); } catch (_) {}
          }
          entry.name = clean; saveGraph();
        });
        nameI.addEventListener('blur', () => {
          const oldName = nameI.dataset.prevName;
          const newName = entry.name;
          if (oldName && newName && oldName !== newName) {
            const affected = (graph.nodes || []).filter(n =>
              (n.selector && n.selector.includes(`{{${oldName}}}`)) ||
              (n.customText && n.customText.includes(`{{${oldName}}}`))
            );
            if (affected.length > 0) {
              affected.forEach(n => {
                if (n.selector) n.selector = n.selector.replaceAll(`{{${oldName}}}`, `{{${newName}}}`);
                if (n.customText) n.customText = n.customText.replaceAll(`{{${oldName}}}`, `{{${newName}}}`);
              });
              saveGraph(); renderGraph();
              logStep('success', `✏️ Renamed "${oldName}" → "${newName}" in ${affected.length} block(s)`);
            }
          }
          delete nameI.dataset.prevName;
          renderDictList();
        });
        valueI.addEventListener('input', (e) => { entry.value = e.target.value; saveGraph(); });
        pickB.addEventListener('click', () => startDictEntryPicker(entry.id));
        copyB.addEventListener('click', () => {
          const ref = `{{${entry.name}}}`;
          try { navigator.clipboard.writeText(ref).then(() => logStep('success', `📋 Copied ${ref}`), () => logStep('warn', '📋 Copy failed')); }
          catch (_) { logStep('warn', '📋 Copy unavailable'); }
        });
        delB.addEventListener('click', () => {
          if (usage > 0 && !confirm(`"${entry.name}" is used in ${usage} block(s). Delete anyway?`)) return;
          graph.dictionary = (graph.dictionary || []).filter(e => e.id !== entry.id);
          saveGraph(); renderDictList();
          logStep('warn', `🗑️ Deleted "${entry.name}"`);
        });
        dictListEl.appendChild(row);
      });
    }

    // ============ PICKERS ============
    function startGenericPicker(onPick, fromWhere = 'editor') {
      isPickingElement = true;
      editorOverlay.style.display = 'none';
      dictManagerEl.style.display = 'none';
      document.body.style.cursor = 'crosshair';
      logStep('info', '🎯 Picker active — click any element (ESC to cancel)');
      function onHover(e) {
        if (mainWidget.contains(e.target) || editorOverlay.contains(e.target) || dictManagerEl.contains(e.target)) { pickerHighlight.style.display = 'none'; return; }
        const r = e.target.getBoundingClientRect();
        pickerHighlight.style.display = 'block';
        pickerHighlight.style.left = r.left + 'px'; pickerHighlight.style.top = r.top + 'px';
        pickerHighlight.style.width = r.width + 'px'; pickerHighlight.style.height = r.height + 'px';
      }
      function swallow(e) {
        if (mainWidget.contains(e.target) || editorOverlay.contains(e.target) || dictManagerEl.contains(e.target)) return;
        e.preventDefault(); e.stopPropagation();
      }
      function cleanup() {
        isPickingElement = false;
        pickerHighlight.style.display = 'none'; document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', onHover, true);
        document.removeEventListener('mousedown', swallow, true);
        document.removeEventListener('mouseup', swallow, true);
        document.removeEventListener('click', onPickHandler, true);
        document.removeEventListener('keydown', onEsc, true);
        if (fromWhere === 'dict') { dictManagerEl.style.display = 'flex'; renderDictList(); }
        else { editorOverlay.style.display = 'block'; requestAnimationFrame(() => drawAllWires()); }
      }
      function onEsc(e) { if (e.key === 'Escape') { e.preventDefault(); cleanup(); logStep('warn', 'Picker cancelled'); } }
      function onPickHandler(e) {
        if (mainWidget.contains(e.target) || editorOverlay.contains(e.target) || dictManagerEl.contains(e.target)) return;
        e.preventDefault(); e.stopPropagation();
        const selector = getExactSelector(e.target);
        try { onPick(e.target, selector); } finally { cleanup(); }
      }
      document.addEventListener('mousemove', onHover, true);
      document.addEventListener('mousedown', swallow, true);
      document.addEventListener('mouseup', swallow, true);
      document.addEventListener('click', onPickHandler, true);
      document.addEventListener('keydown', onEsc, true);
    }
    function startNodePicker(nodeId) {
      startGenericPicker((el, rawSelector) => {
        const node = graph.nodes.find((n) => n.id === nodeId); if (!node) return;
        let target = el;
        if (node.type === 'type' || node.type === 'enter') target = target.closest('input, textarea, [contenteditable="true"]') || target.querySelector('input, textarea') || target;
        else if (node.type === 'click') target = target.closest('button, a, [role="button"], input[type="button"], input[type="submit"]') || target;
        else if (node.type === 'variable' && node.source === 'extract') target = target.closest('input, textarea') || target.querySelector('input, textarea') || target;
        node.selector = getExactSelector(target);
        saveGraph(); renderGraph();
        logStep('success', `✅ Picked: ${node.selector.slice(-40)}`);
      }, 'editor');
    }
    function startDictEntryPicker(entryId) {
      startGenericPicker((el, rawSelector) => {
        const entry = (graph.dictionary || []).find(e => e.id === entryId); if (!entry) return;
        entry.value = rawSelector; saveGraph(); renderDictList();
        logStep('success', `✅ Dict "${entry.name}" = ${rawSelector.slice(-40)}`);
      }, 'dict');
    }
    async function startPickAndAdd() {
      startGenericPicker(async (el, selector) => {
        const defName = `element_${(graph.dictionary || []).length + 1}`;
        const name = await askText('Name this dictionary entry:', defName);
        if (!name) return;
        if (!graph.dictionary) graph.dictionary = [];
        if (graph.dictionary.some(e => e.name === name)) {
          graph.dictionary = graph.dictionary.filter(e => e.name !== name);
          logStep('warn', `⚠️ Overwriting existing "${name}"`);
        }
        const newId = generateDictId();
        graph.dictionary.push({ id: newId, name, value: selector });
        saveGraph(); renderDictList();
        logStep('success', `📚 Added "${name}" = ${selector.slice(-30)}`);
        setTimeout(() => {
          const row = dictListEl && dictListEl.querySelector(`.dict-row[data-id="${newId}"]`);
          if (row) { row.style.transition = 'background 0.3s'; row.style.background = 'rgba(16,185,129,0.2)'; setTimeout(() => { row.style.background = ''; }, 1200); }
        }, 30);
      }, 'dict');
    }
    function askText(title, defaultValue = '') {
      return new Promise((resolve) => {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        ov.innerHTML = `<div style="background:#181920;border:1px solid #2d3139;border-radius:10px;padding:20px;width:min(400px,90vw);box-shadow:0 20px 50px rgba(0,0,0,0.85);">
          <div style="color:#e4e7eb;font-size:13px;font-weight:600;margin-bottom:10px;">${escapeAttr(title)}</div>
          <input type="text" id="ask-input" style="width:100%;box-sizing:border-box;background:#0f1015;color:#fff;border:1px solid #353b49;border-radius:6px;padding:8px;font-size:13px;outline:none;" value="${escapeAttr(defaultValue)}" maxlength="40">
          <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
            <button id="ask-cancel" style="background:#252834;color:#cbd5e1;border:1px solid #3b4052;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px;">Cancel</button>
            <button id="ask-ok" style="background:#059669;color:#fff;border:1px solid #10b981;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600;">OK</button>
          </div></div>`;
        document.body.appendChild(ov);
        const input = ov.querySelector('#ask-input'); input.focus(); input.select();
        function close(result) { ov.remove(); resolve(result); }
        ov.querySelector('#ask-ok').addEventListener('click', () => { const v = input.value.replace(/[^A-Za-z0-9_$-]/g, '').trim(); close(v || null); });
        ov.querySelector('#ask-cancel').addEventListener('click', () => close(null));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); const v = input.value.replace(/[^A-Za-z0-9_$-]/g, '').trim(); close(v || null); }
          else if (e.key === 'Escape') { e.preventDefault(); close(null); }
        });
        ov.addEventListener('click', (e) => { if (e.target === ov) close(null); });
      });
    }

    // ============ INSERT MENU ============
    function showDictInsertMenu(btnEl, targetInput) {
      const existing = document.getElementById('wms-dict-insert-menu'); if (existing) existing.remove();
      const menu = document.createElement('div');
      menu.id = 'wms-dict-insert-menu';
      menu.style.cssText = 'position:fixed;background:#181920;border:1px solid #2d3139;border-radius:8px;padding:6px;z-index:2147483647;box-shadow:0 12px 30px rgba(0,0,0,0.7);min-width:220px;max-height:280px;overflow-y:auto;font-family:-apple-system,sans-serif;';
      const r = btnEl.getBoundingClientRect();
      menu.style.left = Math.max(4, Math.min(r.left, window.innerWidth - 240)) + 'px';
      menu.style.top = Math.min(r.bottom + 4, window.innerHeight - 300) + 'px';
      const entries = graph.dictionary || [];
      if (entries.length === 0) menu.innerHTML = '<div style="color:#64748b;font-size:11px;padding:10px;text-align:center;">No entries. Open 📚 Dictionary to add one.</div>';
      else entries.forEach(entry => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:6px 10px;cursor:pointer;font-size:12px;color:#e4e7eb;border-radius:4px;';
        item.innerHTML = `<div style="font-weight:600;color:#65a30d;">${escapeAttr(entry.name)}</div><div style="color:#64748b;font-size:10px;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeAttr((entry.value || '(empty)').slice(0, 40))}</div>`;
        item.addEventListener('mouseenter', () => item.style.background = '#252834');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');
        item.addEventListener('click', () => {
          const ref = `{{${entry.name}}}`;
          const start = targetInput.selectionStart ?? targetInput.value.length;
          const end = targetInput.selectionEnd ?? targetInput.value.length;
          if (targetInput.value.trim() === '') targetInput.value = ref;
          else targetInput.value = targetInput.value.slice(0, start) + ref + targetInput.value.slice(end);
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          menu.remove();
        });
        menu.appendChild(item);
      });
      document.body.appendChild(menu);
      setTimeout(() => {
        const closer = (e) => { if (!menu.contains(e.target) && e.target !== btnEl) { menu.remove(); document.removeEventListener('mousedown', closer, true); } };
        document.addEventListener('mousedown', closer, true);
      }, 0);
    }

    // ============ STABILITY / CLICK ============
    async function isStable(el, frames = 2) {
      if (!el || !el.isConnected) return false;
      let last = el.getBoundingClientRect();
      for (let i = 0; i < frames; i++) {
        await new Promise(r => requestAnimationFrame(r));
        const cur = el.getBoundingClientRect();
        if (Math.abs(cur.x - last.x) > 1 || Math.abs(cur.y - last.y) > 1 || Math.abs(cur.width - last.width) > 1 || Math.abs(cur.height - last.height) > 1) return false;
        last = cur;
      }
      return true;
    }
    function isSafeToInteract(el, checkOcclusion = false) {
      if (!el) return false;
      try {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none') return false;
        if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('p-disabled')) return false;
        if (rect.width === 0 || rect.height === 0) return false;
        if (checkOcclusion) {
          if (el.ownerDocument !== document) return true;
          const pts = [
            [rect.left + rect.width / 2, rect.top + rect.height / 2],
            [rect.left + 4, rect.top + 4], [rect.right - 4, rect.top + 4],
            [rect.left + 4, rect.bottom - 4], [rect.right - 4, rect.bottom - 4]
          ];
          let anyHit = false;
          for (const [cx, cy] of pts) {
            if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
            const stack = typeof document.elementsFromPoint === 'function'
              ? document.elementsFromPoint(cx, cy)
              : [document.elementFromPoint(cx, cy)].filter(Boolean);
            const topPageEl = stack.find((it) => !mainWidget.contains(it) && !editorOverlay.contains(it) && !dictManagerEl.contains(it) && it !== pickerHighlight);
            if (!topPageEl || el.contains(topPageEl) || topPageEl.contains(el)) { anyHit = true; break; }
            const shared = topPageEl.closest('button, a, label, [role="button"]');
            if (shared && (shared.contains(el) || el.contains(shared))) { anyHit = true; break; }
          }
          return anyHit;
        }
        return true;
      } catch (_) { return false; }
    }
    async function waitForStableElement(selector, timeoutMs = 8000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        if (cancelMacro) return null;
        const el = deepQuery(selector);
        if (el && isSafeToInteract(el, false) && await isStable(el, 2)) return el;
        await sleep(100);
      }
      return null;
    }

    // ============ EXTRACT WAIT MODES ============
    async function waitForExtractValue(selector, mode, waitFor, timeoutMs = 10000) {
      if (mode === 'wait_regex') {
        const rx = waitFor || '.+';
        try { new RegExp(rx); } catch (err) { throw new Error(`invalid regex: ${err.message}`); }
      }
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        if (cancelMacro) return null;
        const el = deepQuery(selector);
        if (el && isSafeToInteract(el, false)) {
          const content = (el.value !== undefined && el.value !== '' ? el.value : (el.innerText || el.textContent || '')).trim();
          let match = false;
          if (mode === 'wait_value') match = content.length > 0;
          else if (mode === 'wait_text') match = content.toLowerCase().includes((waitFor || '').toLowerCase());
          else if (mode === 'wait_regex') {
            const rx = waitFor || '.+';
            try { match = new RegExp(rx).test(content); } catch (_) { match = false; }
          }
          if (match) return content;
        }
        await sleep(150);
      }
      return null;
    }

    async function robustClick(el) {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
      await sleep(140);
      for (let i = 0; i < 10; i++) { if (await isStable(el, 2)) break; await sleep(60); }
      if (!isSafeToInteract(el, true)) {
        try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (_) {}
        await sleep(120);
        if (!isSafeToInteract(el, true)) return { ok: false, reason: 'covered-or-hidden' };
      }
      const preUrl = window.location.href;
      const preChildren = (el.parentElement || el).children.length;
      const wasDisabled = el.disabled === true;
      try { if (typeof el.focus === 'function') el.focus(); } catch (_) {}
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const cmn = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 };
      try { el.dispatchEvent(new PointerEvent('pointerover', { ...cmn, pointerType: 'mouse' })); } catch (_) {}
      try { el.dispatchEvent(new PointerEvent('pointerenter', { ...cmn, pointerType: 'mouse' })); } catch (_) {}
      try { el.dispatchEvent(new PointerEvent('pointerdown', { ...cmn, pointerType: 'mouse' })); } catch (_) {}
      el.dispatchEvent(new MouseEvent('mousedown', cmn));
      try { el.dispatchEvent(new PointerEvent('pointerup', { ...cmn, pointerType: 'mouse' })); } catch (_) {}
      el.dispatchEvent(new MouseEvent('mouseup', cmn));
      try { el.click(); } catch (_) {}
      await sleep(300);
      if (window.location.href !== preUrl) return { ok: true, reason: 'url-changed' };
      if (!el.isConnected) return { ok: true, reason: 'element-removed' };
      if (!wasDisabled && el.disabled === true) return { ok: true, reason: 'became-disabled' };
      if ((el.parentElement || el).children.length !== preChildren) return { ok: true, reason: 'dom-changed' };
      logStep('warn', '⏳ No visible change — retrying click');
      await sleep(200);
      try { el.click(); } catch (_) {}
      await sleep(320);
      if (window.location.href !== preUrl) return { ok: true, reason: 'url-changed-retry' };
      if (!el.isConnected) return { ok: true, reason: 'element-removed-retry' };
      if ((el.parentElement || el).children.length !== preChildren) return { ok: true, reason: 'dom-changed-retry' };
      return { ok: false, reason: 'no-visible-change' };
    }

    // ============ RUN ============
    function runFirstAvailableCircuit() {
      if (graph.nodes.length === 0) { logStep('warn', '⚠️ Add blocks in Circuit Studio first'); return; }
      let start = graph.nodes.find((n) => (n.type === 'trigger' || n.type === 'listener') && graph.edges.some((e) => e.source === n.id));
      if (!start) start = graph.nodes.find((n) => n.type === 'trigger' || n.type === 'listener');
      if (!start) start = graph.nodes.find((n) => !graph.edges.some((e) => e.target === n.id)) || graph.nodes[0];
      if (start) { editorOverlay.style.display = 'none'; executeGraph(start.id); }
    }
    document.getElementById('quick-run-circuit-btn').addEventListener('click', runFirstAvailableCircuit);
    document.getElementById('studio-run-btn').addEventListener('click', runFirstAvailableCircuit);

    // ============ RENDER ============
    function renderGraph() {
      Array.from(canvas.children).forEach((c) => { if (c.id !== 'wire-layer') c.remove(); });
      wireLayer.innerHTML = '';
      graph.nodes.forEach((n) => createNodeDOM(n));
      requestAnimationFrame(() => drawAllWires());
    }

    function createNodeDOM(node) {
      const el = document.createElement('div');
      el.className = `wms-node node-${node.type}`;
      el.id = node.id;
      el.style.left = (node.x || 100) + 'px';
      el.style.top = (node.y || 100) + 'px';

      const icons = { trigger:'⚡', listener:'👂', if:'🔀', click:'👆', type:'⌨️', wait:'⏳', extract:'📋', enter:'⏎', variable:'📦' };
      const headerHtml = `
        <div class="wms-node-header">
          <span>⠿ ${icons[node.type] || '⚡'} ${node.type.toUpperCase()}</span>
          <span class="del-node" style="cursor:pointer; opacity:0.8; padding:0 4px;" title="Delete Block">✖</span>
        </div>`;
      let body = `<div class="wms-node-body">`;
      const pickRow = (label) => `
        <div class="n-pick-row">
          <div class="node-btn-small n-pick">🎯 ${label}</div>
          <div class="node-btn-small n-dict-btn n-dict-insert" title="Insert dictionary reference">📚</div>
        </div>`;
      const resolvedHint = (sel) => {
        if (!sel || !sel.includes('{{')) return '';
        const { value, missing } = resolveTemplate(sel);
        if (missing.length > 0) return `<div class="n-resolved-hint n-resolved-bad">⚠️ Unknown: {{${escapeAttr(missing.join('}}, {{'))}}}</div>`;
        if (!value) return '';
        return `<div class="n-resolved-hint n-resolved-ok">→ ${escapeAttr(value.slice(0, 40))}</div>`;
      };
      const selectorInput = (node) => `<input type="text" class="node-input n-selector" value="${escapeAttr(node.selector)}" placeholder="Click Pick or paste selector...">${resolvedHint(node.selector)}`;

      if (node.type === 'trigger') {
        body += `<select class="node-select n-trig-type"><option value="hotkey" ${node.subtype==='hotkey'?'selected':''}>Keyboard Shortcut</option><option value="url" ${node.subtype==='url'?'selected':''}>Auto URL Match</option></select>
          <input type="text" class="node-input n-trig-val" value="${escapeAttr(node.val)}" placeholder="${node.subtype==='url'?'e.g. /inbound':'Click & press keys'}">
          <div class="node-btn-small n-run-this" style="background:#065f46;border-color:#10b981;color:#fff;">▶ Run This Trigger</div>`;
      } else if (node.type === 'listener') {
        body += `${pickRow('Pick Target to Watch')}${selectorInput(node)}
          <select class="node-select n-listen-mode">
            <option value="text_contains" ${node.mode==='text_contains'?'selected':''}>Text Contains</option>
            <option value="number_greater" ${node.mode==='number_greater'?'selected':''}>Number &gt; Value</option>
            <option value="number_less" ${node.mode==='number_less'?'selected':''}>Number &lt; Value</option>
            <option value="barcode_scan" ${node.mode==='barcode_scan'?'selected':''}>Barcode / Length &gt;=</option>
          </select>
          <input type="text" class="node-input n-listen-val" value="${escapeAttr(node.val)}" placeholder="Target text or number...">`;
      } else if (node.type === 'if') {
        body += `${pickRow('Pick Element to Check')}${selectorInput(node)}
          <select class="node-select n-if-cond">
            <option value="exists" ${node.cond==='exists'?'selected':''}>Element Exists</option>
            <option value="not_exists" ${node.cond==='not_exists'?'selected':''}>Element Does NOT Exist</option>
            <option value="text_equals" ${node.cond==='text_equals'?'selected':''}>Text Equals</option>
            <option value="text_contains" ${node.cond==='text_contains'?'selected':''}>Text Contains</option>
            <option value="number_gt" ${node.cond==='number_gt'?'selected':''}>Number &gt;</option>
            <option value="number_lt" ${node.cond==='number_lt'?'selected':''}>Number &lt;</option>
          </select>
          ${node.cond!=='exists' && node.cond!=='not_exists' ? `<input type="text" class="node-input n-if-val" value="${escapeAttr(node.val)}" placeholder="Compare value...">` : ''}`;
      } else if (node.type === 'click') {
        body += `${pickRow('Pick Button / Element')}${selectorInput(node)}`;
      } else if (node.type === 'type') {
        body += `<select class="node-select n-source">
            <option value="box1" ${node.source==='box1'?'selected':''}>Type From: Box 1</option>
            <option value="box2" ${node.source==='box2'?'selected':''}>Type From: Box 2</option>
            <option value="variable" ${node.source==='variable'?'selected':''}>Type From: Variable</option>
            <option value="custom" ${node.source==='custom'?'selected':''}>Type: Custom Text</option>
          </select>
          ${node.source==='variable' ? `<input type="text" class="node-input n-var-name" value="${escapeAttr(node.varName)}" placeholder="Variable name">` : ''}
          ${node.source==='custom' ? `<input type="text" class="node-input n-custom" value="${escapeAttr(node.customText)}" placeholder="Enter custom text...">` : ''}
          <label class="n-submit-row"><input type="checkbox" class="n-submit-after" ${node.submitAfterType!==false?'checked':''}><span>Press Enter after typing</span></label>
          ${pickRow('Pick Input Box')}${selectorInput(node)}`;
      } else if (node.type === 'enter') {
        body += `${pickRow('Pick Element (optional)')}${selectorInput(node)}
          <div style="font-size:10px;color:#94a3b8;padding:2px 4px;background:#13141a;border-radius:4px;">⏎ Presses Enter key</div>`;
      } else if (node.type === 'wait') {
        body += `<select class="node-select n-wait-mode">
            <option value="element" ${node.mode==='element'?'selected':''}>Wait Until Element Appears</option>
            <option value="delay" ${node.mode==='delay'?'selected':''}>Wait Fixed Time (ms)</option>
          </select>
          ${node.mode==='delay' ? `<input type="number" class="node-input n-wait-ms" value="${escapeAttr(node.ms || 500)}">` : `${pickRow('Pick Element to Wait For')}${selectorInput(node)}`}`;
      } else if (node.type === 'extract') {
        const mode = node.mode || 'immediate';
        body += `${pickRow('Pick Element')}${selectorInput(node)}
          <select class="node-select n-extract-mode">
            <option value="immediate" ${mode==='immediate'?'selected':''}>Extract Immediately</option>
            <option value="wait_value" ${mode==='wait_value'?'selected':''}>Wait Until Value Appears</option>
            <option value="wait_text" ${mode==='wait_text'?'selected':''}>Wait Until Text Contains</option>
            <option value="wait_regex" ${mode==='wait_regex'?'selected':''}>Wait Until Regex Matches</option>
          </select>
          ${(mode==='wait_text' || mode==='wait_regex') ? `<input type="text" class="node-input n-wait-for" value="${escapeAttr(node.waitFor)}" placeholder="${mode==='wait_regex' ? 'Regex (e.g. PO-\\d+)' : 'Text to wait for...'}">` : ''}
          <select class="node-select n-dest">
            <option value="box1" ${node.dest==='box1'?'selected':''}>Save Into: Box 1</option>
            <option value="box2" ${node.dest==='box2'?'selected':''}>Save Into: Box 2</option>
          </select>`;
      } else if (node.type === 'variable') {
        const rawV = (node.varName && graph.variables) ? graph.variables[node.varName] : undefined;
        const s = (rawV === undefined || rawV === null) ? '' : String(rawV);
        const preview = s.length ? s.slice(0, 30) : '(empty)';
        body += `<input type="text" class="node-input n-var-name" value="${escapeAttr(node.varName)}" placeholder="Variable name (e.g. orderId)" maxlength="40" spellcheck="false" autocomplete="off">
          <select class="node-select n-source">
            <option value="box1" ${node.source==='box1'?'selected':''}>Set From: Box 1</option>
            <option value="box2" ${node.source==='box2'?'selected':''}>Set From: Box 2</option>
            <option value="custom" ${node.source==='custom'?'selected':''}>Set: Custom Text</option>
            <option value="extract" ${node.source==='extract'?'selected':''}>Set: From Element</option>
          </select>
          ${node.source==='custom' ? `<input type="text" class="node-input n-custom" value="${escapeAttr(node.customText)}" placeholder="Enter custom text...">` : ''}
          ${node.source==='extract' ? `${pickRow('Pick Element to Extract')}${selectorInput(node)}` : ''}
          <div class="var-current" style="font-size:10px;color:#94a3b8;padding:2px 4px;background:#13141a;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📦 Current: ${escapeAttr(preview)}</div>`;
      }
      body += `</div>`;

      let ports = '';
      if (node.type !== 'trigger' && node.type !== 'listener') ports += `<div class="port port-in" data-nodeid="${node.id}" data-portid="in"></div>`;
      if (node.type === 'if') {
        ports += `<div class="port port-true" data-nodeid="${node.id}" data-portid="true"></div><div class="port-tag tag-true">True</div>
                  <div class="port port-false" data-nodeid="${node.id}" data-portid="false"></div><div class="port-tag tag-false">False</div>`;
      } else ports += `<div class="port port-out" data-nodeid="${node.id}" data-portid="out"></div>`;

      el.innerHTML = headerHtml + body + ports;
      canvas.appendChild(el);

      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('input, select, textarea, button, label, .node-btn-small, .del-node, .port')) return;
        e.preventDefault(); e.stopPropagation();
        const nr = el.getBoundingClientRect();
        const sx = e.clientX - nr.left, sy = e.clientY - nr.top;
        function mv(me) {
          const cr = canvas.getBoundingClientRect();
          node.x = Math.max(10, me.clientX - cr.left - sx);
          node.y = Math.max(10, me.clientY - cr.top - sy);
          el.style.left = node.x + 'px'; el.style.top = node.y + 'px';
          drawAllWires();
        }
        function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); saveGraph(); }
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
      });

      el.querySelector('.del-node').addEventListener('click', () => {
        graph.nodes = graph.nodes.filter((n) => n.id !== node.id);
        graph.edges = graph.edges.filter((e) => e.source !== node.id && e.target !== node.id);
        renderGraph(); saveGraph();
      });
      if (el.querySelector('.n-run-this')) el.querySelector('.n-run-this').addEventListener('click', () => { editorOverlay.style.display = 'none'; executeGraph(node.id); });
      if (el.querySelector('.n-selector')) el.querySelector('.n-selector').addEventListener('input', (e) => { node.selector = e.target.value.trim(); saveGraph(); });

      if (el.querySelector('.n-dict-insert')) {
        el.querySelector('.n-dict-insert').addEventListener('click', (ev) => {
          ev.stopPropagation();
          const selInput = el.querySelector('.n-selector');
          if (selInput) showDictInsertMenu(ev.currentTarget, selInput);
        });
      }

      if (el.querySelector('.n-trig-type')) el.querySelector('.n-trig-type').addEventListener('change', (e) => { node.subtype = e.target.value; node.val = node.subtype==='hotkey'?'ALT+Q':''; renderGraph(); saveGraph(); });
      if (el.querySelector('.n-trig-val') && node.subtype === 'hotkey') {
        el.querySelector('.n-trig-val').addEventListener('keydown', (e) => {
          e.preventDefault(); e.stopPropagation();
          const c = getHotkeyCombo(e); if (!c) return;
          e.target.value = c; node.val = c; saveGraph();
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
      if (el.querySelector('.n-submit-after')) el.querySelector('.n-submit-after').addEventListener('change', (e) => { node.submitAfterType = e.target.checked; saveGraph(); });

      if (el.querySelector('.n-extract-mode')) el.querySelector('.n-extract-mode').addEventListener('change', (e) => {
        node.mode = e.target.value;
        if (node.mode === 'immediate' || node.mode === 'wait_value') node.waitFor = '';
        renderGraph(); saveGraph();
      });
      if (el.querySelector('.n-wait-for')) el.querySelector('.n-wait-for').addEventListener('input', (e) => { node.waitFor = e.target.value; saveGraph(); });

      if (el.querySelector('.n-var-name')) {
        const vi = el.querySelector('.n-var-name');
        vi.addEventListener('input', (e) => {
          const raw = e.target.value;
          const clean = raw.replace(/[^A-Za-z0-9_$-]/g, '');
          if (clean !== raw) {
            const cb = e.target.selectionStart || 0;
            const kept = raw.slice(0, cb).replace(/[^A-Za-z0-9_$-]/g, '').length;
            e.target.value = clean;
            try { e.target.setSelectionRange(kept, kept); } catch (_) {}
          }
          node.varName = clean;
          if (node.type === 'variable') {
            const cur = el.querySelector('.var-current');
            if (cur) {
              const rawV = (node.varName && graph.variables) ? graph.variables[node.varName] : undefined;
              const s = (rawV === undefined || rawV === null) ? '' : String(rawV);
              cur.textContent = `📦 Current: ${s.length ? s.slice(0, 30) : '(empty)'}`;
            }
          }
          saveGraph();
        });
      }
      if (el.querySelector('.n-wait-mode')) el.querySelector('.n-wait-mode').addEventListener('change', (e) => { node.mode = e.target.value; renderGraph(); saveGraph(); });
      if (el.querySelector('.n-wait-ms')) el.querySelector('.n-wait-ms').addEventListener('input', (e) => { node.ms = parseInt(e.target.value, 10) || 500; saveGraph(); });
      if (el.querySelector('.n-dest')) el.querySelector('.n-dest').addEventListener('change', (e) => { node.dest = e.target.value; saveGraph(); });
      if (el.querySelector('.n-pick')) el.querySelector('.n-pick').addEventListener('click', () => startNodePicker(node.id));
    }

    // ============ ADD BUTTONS ============
    ['trigger','listener','if','click','type','enter','wait','extract','variable'].forEach((type) => {
      const b = document.getElementById(`add-${type}`);
      if (!b) return;
      b.addEventListener('click', () => {
        const sx = canvasWrapper.scrollLeft || 0, sy = canvasWrapper.scrollTop || 0;
        const off = (graph.nodes.length % 5) * 28;
        const n = { id: generateId(), type, x: sx + 120 + off, y: sy + 90 + off };
        if (type === 'trigger') { n.subtype = 'hotkey'; n.val = 'ALT+Q'; }
        else if (type === 'listener') { n.mode = 'text_contains'; n.val = ''; }
        else if (type === 'if') { n.cond = 'exists'; n.val = ''; }
        else if (type === 'type') { n.source = 'box1'; n.submitAfterType = true; }
        else if (type === 'enter') { n.selector = ''; }
        else if (type === 'wait') { n.mode = 'element'; n.ms = 500; }
        else if (type === 'extract') { n.dest = 'box1'; n.mode = 'immediate'; n.waitFor = ''; }
        else if (type === 'variable') { n.source = 'box1'; n.varName = ''; }
        graph.nodes.push(n); renderGraph(); saveGraph();
        logStep('info', `➕ Added ${type} block`);
      });
    });

    function connectNodes(src, sport, tgt) {
      if (!src || !tgt || src === tgt) return;
      graph.edges = graph.edges.filter((e) => !(e.source === src && e.sourcePort === sport));
      graph.edges.push({ id: generateId(), source: src, sourcePort: sport, target: tgt, targetPort: 'in' });
      saveGraph(); drawAllWires();
    }

    canvas.addEventListener('mousedown', (e) => {
      const pEl = e.target.closest('.port');
      if (!pEl) {
        if (selectedPort) { document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected')); selectedPort = null; }
        if (e.target === canvas || e.target === wireLayer) {
          e.preventDefault();
          canvasWrapper.classList.add('is-panning');
          const sx = e.clientX, sy = e.clientY;
          const sl = canvasWrapper.scrollLeft, st = canvasWrapper.scrollTop;
          function pm(me) { canvasWrapper.scrollLeft = sl - (me.clientX - sx); canvasWrapper.scrollTop = st - (me.clientY - sy); }
          function pu() { canvasWrapper.classList.remove('is-panning'); document.removeEventListener('mousemove', pm); document.removeEventListener('mouseup', pu); }
          document.addEventListener('mousemove', pm); document.addEventListener('mouseup', pu);
        }
        return;
      }
      e.stopPropagation(); e.preventDefault();
      const pid = pEl.getAttribute('data-portid'), nid = pEl.getAttribute('data-nodeid');
      if (selectedPort && selectedPort.nodeId !== nid) {
        if (selectedPort.portId !== 'in' && pid === 'in') { connectNodes(selectedPort.nodeId, selectedPort.portId, nid); document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected')); selectedPort = null; return; }
        if (selectedPort.portId === 'in' && pid !== 'in') { connectNodes(nid, pid, selectedPort.nodeId); document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected')); selectedPort = null; return; }
      }
      document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected'));
      pEl.classList.add('port-selected');
      selectedPort = { nodeId: nid, portId: pid };
      activeWire = { startNode: nid, startPort: pid, clientX: e.clientX, clientY: e.clientY };
      function wm(me) { activeWire.clientX = me.clientX; activeWire.clientY = me.clientY; drawAllWires(); }
      function wu(ue) {
        document.removeEventListener('mousemove', wm); document.removeEventListener('mouseup', wu);
        const tgt = document.elementFromPoint(ue.clientX, ue.clientY);
        const tPort = tgt ? tgt.closest('.port') : null;
        if (tPort) {
          const tn = tPort.getAttribute('data-nodeid'), tp = tPort.getAttribute('data-portid');
          if (tn && tn !== activeWire.startNode) {
            if (activeWire.startPort !== 'in' && tp === 'in') { connectNodes(activeWire.startNode, activeWire.startPort, tn); document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected')); selectedPort = null; }
            else if (activeWire.startPort === 'in' && tp !== 'in') { connectNodes(tn, tp, activeWire.startNode); document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected')); selectedPort = null; }
          }
        }
        activeWire = null; drawAllWires();
      }
      document.addEventListener('mousemove', wm); document.addEventListener('mouseup', wu);
    });

    function drawAllWires() {
      wireLayer.innerHTML = '';
      const cr = canvas.getBoundingClientRect();
      if (cr.width === 0 && cr.height === 0) return;
      graph.edges.forEach((edge) => {
        const s = canvas.querySelector(`.port[data-nodeid="${edge.source}"][data-portid="${edge.sourcePort}"]`);
        const t = canvas.querySelector(`.port[data-nodeid="${edge.target}"][data-portid="${edge.targetPort}"]`);
        if (s && t) {
          const sr = s.getBoundingClientRect(), tr = t.getBoundingClientRect();
          const x1 = sr.left + sr.width / 2 - cr.left, y1 = sr.top + sr.height / 2 - cr.top;
          const x2 = tr.left + tr.width / 2 - cr.left, y2 = tr.top + tr.height / 2 - cr.top;
          const cls = edge.sourcePort === 'true' ? 'wire wire-true' : edge.sourcePort === 'false' ? 'wire wire-false' : 'wire';
          drawBezier(x1, y1, x2, y2, cls, edge.id);
        }
      });
      if (activeWire) {
        const s = canvas.querySelector(`.port[data-nodeid="${activeWire.startNode}"][data-portid="${activeWire.startPort}"]`);
        if (s) {
          const sr = s.getBoundingClientRect();
          const sx = sr.left + sr.width / 2 - cr.left, sy = sr.top + sr.height / 2 - cr.top;
          const mx = activeWire.clientX - cr.left, my = activeWire.clientY - cr.top;
          if (activeWire.startPort === 'in') drawBezier(mx, my, sx, sy, 'wire wire-active');
          else drawBezier(sx, sy, mx, my, 'wire wire-active');
        }
      }
    }
    function drawBezier(x1, y1, x2, y2, cls = 'wire', edgeId = null) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dx = Math.max(Math.abs(x2 - x1) * 0.5, 45);
      p.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
      p.setAttribute('class', cls);
      if (edgeId) {
        p.style.cursor = 'pointer'; p.style.pointerEvents = 'stroke';
        p.addEventListener('click', (e) => { e.stopPropagation(); graph.edges = graph.edges.filter((ed) => ed.id !== edgeId); drawAllWires(); saveGraph(); });
      }
      wireLayer.appendChild(p);
    }

    // ============ SELECTOR BUILDER ============
    function escapeIdent(s) {
      return (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(s) : s.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
    }
    function getExactSelector(el) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
      if (el.id && document.querySelectorAll(`#${escapeIdent(el.id)}`).length === 1) return `#${escapeIdent(el.id)}`;
      for (const a of ['data-testid','data-test','data-cy','name','aria-label','placeholder']) {
        const v = el.getAttribute(a);
        if (v) {
          const c = `${el.nodeName.toLowerCase()}[${a}="${escapeIdent(v)}"]`;
          if (safeQuery(c) === el && document.querySelectorAll(c).length === 1) return c;
        }
      }
      const path = [];
      let cur = el;
      while (cur && cur.nodeType === Node.ELEMENT_NODE && cur !== document.body && cur !== document.documentElement) {
        const tag = cur.nodeName.toLowerCase();
        if (cur.id && document.querySelectorAll(`#${escapeIdent(cur.id)}`).length === 1) { path.unshift('#' + escapeIdent(cur.id)); break; }
        let nth = 1, sib = cur;
        while ((sib = sib.previousElementSibling)) if (sib.nodeName.toLowerCase() === tag) nth++;
        let total = nth; sib = cur;
        while ((sib = sib.nextElementSibling)) if (sib.nodeName.toLowerCase() === tag) total++;
        path.unshift(total > 1 ? `${tag}:nth-of-type(${nth})` : tag);
        cur = cur.parentNode;
      }
      return path.join(' > ');
    }

    // ============ EXECUTION ENGINE ============
    async function executeGraph(startNodeId) {
      if (isMacroRunning) { logStep('warn', '⚠️ Already running'); return; }
      isMacroRunning = true;
      cancelMacro = false;
      const origOutline = document.body.style.outline;
      document.body.style.outline = '4px solid #10b981';
      logStep('info', '▶️ Circuit started');

      try {
        let cur = startNodeId, step = 0;
        while (cur && !cancelMacro && step < 100) {
          step++;
          const node = graph.nodes.find((n) => n.id === cur);
          if (!node) { logStep('error', `❌ Node not found: ${cur}`); break; }
          const nd = document.getElementById(node.id);
          if (nd) nd.classList.add('is-executing');
          const label = `${node.type} #${node.id.slice(-4)}`;
          logStep('info', `▶ ${label} starting`);
          let nextPort = 'out';
          let outcome = { ok: true, reason: '' };

          try {
            if (node.type === 'wait') {
              if (node.mode === 'delay') {
                logStep('info', `⏳ Waiting ${node.ms || 500}ms`);
                await sleep(node.ms || 500);
              } else {
                const r = resolveSelectorForNode(node);
                if (!r.ok) outcome = r;
                else {
                  logStep('info', `⏳ Waiting for ${r.selector.slice(-30)}`);
                  const el = await waitForStableElement(r.selector, 10000);
                  if (!el) outcome = { ok: false, reason: 'timeout' };
                }
              }
            } else if (node.type === 'click') {
              const r = resolveSelectorForNode(node);
              if (!r.ok) outcome = r;
              else {
                const el = await waitForStableElement(r.selector, 4000);
                if (!el) outcome = { ok: false, reason: 'not-found' };
                else { logStep('info', `👆 Clicking ${r.selector.slice(-30)}`); outcome = await robustClick(el); }
              }
            } else if (node.type === 'type') {
              const r = resolveSelectorForNode(node);
              if (!r.ok) outcome = r;
              else {
                const el = await waitForStableElement(r.selector, 4000);
                if (!el) outcome = { ok: false, reason: 'not-found' };
                else {
                  const txt = node.source === 'box1' ? box1.val
                    : node.source === 'box2' ? box2.val
                    : node.source === 'variable' ? ((graph.variables && graph.variables[node.varName]) || '')
                    : (node.customText || '');
                  logStep('info', `⌨️ Typing ${txt.length} chars`);
                  typeAndSubmitElement(el, txt, node.submitAfterType !== false);
                  outcome = { ok: true, reason: `typed-${txt.length}` };
                  await sleep(220);
                }
              }
            } else if (node.type === 'enter') {
              let tgt = null;
              if (node.selector) {
                const r = resolveSelectorForNode(node);
                if (!r.ok) outcome = r;
                else {
                  tgt = await waitForStableElement(r.selector, 4000);
                  if (!tgt) outcome = { ok: false, reason: 'not-found' };
                  else { try { tgt.scrollIntoView({ block: 'nearest' }); } catch (_) {} if (typeof tgt.focus === 'function') tgt.focus(); }
                }
              } else tgt = document.activeElement || document.body;
              if (outcome.ok && tgt) {
                const o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
                tgt.dispatchEvent(new KeyboardEvent('keydown', o));
                tgt.dispatchEvent(new KeyboardEvent('keypress', o));
                tgt.dispatchEvent(new KeyboardEvent('keyup', o));
                logStep('success', `⏎ Enter pressed`);
                await sleep(220);
              }
            } else if (node.type === 'extract') {
              const r = resolveSelectorForNode(node);
              if (!r.ok) outcome = r;
              else {
                const mode = node.mode || 'immediate';
                let val = '';
                if (mode === 'immediate') {
                  const el = await waitForStableElement(r.selector, 4000);
                  if (!el) outcome = { ok: false, reason: 'not-found' };
                  else val = (el.value !== undefined && el.value !== '' ? el.value : (el.innerText || el.textContent || '')).trim();
                } else {
                  logStep('info', `⏳ Wait for ${mode === 'wait_value' ? 'value' : mode === 'wait_text' ? `text "${(node.waitFor || '').slice(0, 20)}"` : `regex /${(node.waitFor || '').slice(0, 20)}/`}`);
                  try {
                    const matched = await waitForExtractValue(r.selector, mode, node.waitFor, 10000);
                    if (matched === null) outcome = { ok: false, reason: 'timeout-waiting-for-value' };
                    else val = matched;
                  } catch (rxErr) {
                    outcome = { ok: false, reason: rxErr.message || 'invalid-regex' };
                  }
                }
                if (outcome.ok) {
                  if (node.dest === 'box2') { box2.val = val; b2El.value = val; SafeStorage.set({ box2Data: val }); }
                  else { box1.val = val; b1El.value = val; SafeStorage.set({ box1Data: val }); }
                  logStep('success', `📋 Extracted → ${node.dest}: "${val.slice(0, 30)}"`);
                  outcome = { ok: true, reason: `len-${val.length}` };
                  await sleep(120);
                }
              }
            } else if (node.type === 'variable') {
              if (!node.varName) outcome = { ok: false, reason: 'missing-name' };
              else {
                let value = '';
                if (node.source === 'box1') value = box1.val;
                else if (node.source === 'box2') value = box2.val;
                else if (node.source === 'custom') value = node.customText || '';
                else if (node.source === 'extract') {
                  const r = resolveSelectorForNode(node);
                  if (!r.ok) outcome = r;
                  else {
                    const el = await waitForStableElement(r.selector, 4000);
                    if (!el) outcome = { ok: false, reason: 'not-found' };
                    else value = (el.value !== undefined && el.value !== '' ? el.value : (el.innerText || el.textContent || '')).trim();
                  }
                }
                if (outcome.ok) {
                  if (!graph.variables) graph.variables = {};
                  graph.variables[node.varName] = value;
                  saveGraph();
                  if (nd) {
                    const cur2 = nd.querySelector('.var-current');
                    if (cur2) {
                      const s = (value === undefined || value === null) ? '' : String(value);
                      cur2.textContent = `📦 Current: ${s.length ? s.slice(0, 30) : '(empty)'}`;
                    }
                  }
                  logStep('success', `📦 ${node.varName} = "${String(value).slice(0, 30)}"`);
                  await sleep(120);
                }
              }
            } else if (node.type === 'if') {
              const r = resolveSelectorForNode(node);
              if (!r.ok) outcome = r;
              else {
                const el = safeQuery(r.selector);
                let isTrue = false;
                if (node.cond === 'exists') isTrue = Boolean(el);
                else if (node.cond === 'not_exists') isTrue = !el;
                else if (el) {
                  const content = (el.value !== undefined && el.value !== '' ? el.value : (el.innerText || el.textContent || '')).trim();
                  const tv = (node.val || '').trim();
                  if (node.cond === 'text_equals') isTrue = content.toLowerCase() === tv.toLowerCase();
                  else if (node.cond === 'text_contains') isTrue = content.toLowerCase().includes(tv.toLowerCase());
                  else if (node.cond === 'number_gt') { const a = parseFloat(content.replace(/[^0-9.-]/g, '')); const b = parseFloat(tv); isTrue = !isNaN(a) && !isNaN(b) && a > b; }
                  else if (node.cond === 'number_lt') { const a = parseFloat(content.replace(/[^0-9.-]/g, '')); const b = parseFloat(tv); isTrue = !isNaN(a) && !isNaN(b) && a < b; }
                }
                nextPort = isTrue ? 'true' : 'false';
                logStep('success', `🔀 ${node.cond} → ${isTrue ? 'TRUE' : 'FALSE'}`);
                await sleep(120);
              }
            }
          } catch (err) {
            outcome = { ok: false, reason: 'exception: ' + (err && err.message || err) };
          }

          if (nd) { nd.classList.remove('is-executing'); nd.classList.add(outcome.ok ? 'is-success' : 'is-failure'); setTimeout(() => nd.classList.remove('is-success', 'is-failure'), 800); }

          if (!outcome.ok) {
            logStep('error', `❌ ${label} failed: ${outcome.reason}`);
            cancelMacro = true;
            break;
          }
          if (outcome.reason) logStep('success', `✅ ${label} → ${outcome.reason}`);

          const edge = graph.edges.find((e) => e.source === cur && e.sourcePort === nextPort);
          cur = edge ? edge.target : null;
        }
        if (!cancelMacro) logStep('success', `✅ Circuit finished (${step} step${step === 1 ? '' : 's'})`);
      } catch (err) {
        logStep('error', '❌ Execution crashed: ' + (err && err.message || err));
      }

      isMacroRunning = false;
      document.body.style.outline = origOutline;
      document.querySelectorAll('.wms-node').forEach((n) => n.classList.remove('is-executing'));
    }

    function typeAndSubmitElement(rawEl, textToType, doSubmit = true) {
      const el = (rawEl.tagName === 'INPUT' || rawEl.tagName === 'TEXTAREA') ? rawEl : (rawEl.querySelector('input, textarea') || rawEl);
      try { el.scrollIntoView({ block: 'nearest', behavior: 'instant' }); } catch (_) {}
      try { el.focus(); el.click(); } catch (_) {}
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const prev = el.value;
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, textToType); else el.value = textToType;
        if (el._valueTracker) el._valueTracker.setValue(prev);
      } else if (el.isContentEditable) {
        el.innerText = textToType;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (doSubmit) {
        const o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        el.dispatchEvent(new KeyboardEvent('keydown', o));
        el.dispatchEvent(new KeyboardEvent('keypress', o));
        el.dispatchEvent(new KeyboardEvent('keyup', o));
      }
    }

    // ============ GLOBAL HANDLERS ============
    function onGlobalMouseDown(e) {
      if (isMacroRunning && e.isTrusted && !mainWidget.contains(e.target) && !editorOverlay.contains(e.target)) {
        cancelMacro = true;
        document.body.style.outline = 'none';
        logStep('warn', '🛑 Halted by manual click');
      }
    }
    function onGlobalKeyDown(e) {
      if (e.key === 'Escape') {
        cancelMacro = true;
        document.body.style.outline = 'none';
        document.querySelectorAll('.wms-node').forEach((n) => n.classList.remove('is-executing'));
        logStep('warn', '🛑 Halted by Escape');
        return;
      }
      if (editorOverlay.style.display === 'block' || mainWidget.contains(e.target)) return;
      if (e.altKey && (e.key === '1' || e.code === 'Digit1')) { e.preventDefault(); handleCopyPaste(b1El, 'box1Data', box1, e.target); return; }
      if (e.altKey && (e.key === '2' || e.code === 'Digit2')) { e.preventDefault(); handleCopyPaste(b2El, 'box2Data', box2, e.target); return; }
      if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) && !e.altKey && !e.ctrlKey) return;
      const c = getHotkeyCombo(e);
      if (!c) return;
      const tn = graph.nodes.find((n) => n.type === 'trigger' && n.subtype === 'hotkey' && (n.val || '').toUpperCase() === c);
      if (tn) { e.preventDefault(); executeGraph(tn.id); }
    }
    document.addEventListener('mousedown', onGlobalMouseDown, true);
    document.addEventListener('keydown', onGlobalKeyDown);

    function handleCopyPaste(el, key, obj, target) {
      const sel = window.getSelection().toString().trim();
      if (sel) {
        el.value = sel; obj.val = sel;
        SafeStorage.set({ [key]: sel });
        el.style.background = '#064e3b';
        logStep('success', `📋 Copied "${sel.slice(0, 20)}"`);
        setTimeout(() => { el.style.background = '#13141a'; }, 350);
      } else if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) && obj.val) {
        typeAndSubmitElement(target, obj.val);
        logStep('success', `⌨️ Pasted + Enter`);
      }
    }

    function checkPassiveURLTriggers(force = false) {
      const url = window.location.href;
      if (!force && url === lastCheckedUrl) return;
      lastCheckedUrl = url;
      const tn = graph.nodes.find((n) => n.type === 'trigger' && n.subtype === 'url' && n.val && url.includes(n.val));
      if (tn) setTimeout(() => executeGraph(tn.id), 500);
    }

    function evaluateListeners(mutations) {
      if (Array.isArray(mutations)) {
        const ext = mutations.some((m) => !mainWidget.contains(m.target) && !editorOverlay.contains(m.target) && !dictManagerEl.contains(m.target) && !pickerHighlight.contains(m.target));
        if (!ext) return;
      }
      checkPassiveURLTriggers(false);
      if (cancelMacro || isMacroRunning || isPickingElement || editorOverlay.style.display === 'block') return;
      const now = Date.now();
      graph.nodes.filter((n) => n.type === 'listener' && n.selector).forEach((n) => {
        const r = resolveSelectorForNode(n);
        if (!r.ok) return;
        const el = safeQuery(r.selector);
        if (!el) return;
        const content = (el.value !== undefined && el.value !== '' ? el.value : (el.innerText || el.textContent || '')).trim();
        if (!content) return;
        let match = false;
        if (n.mode === 'text_contains' && n.val && content.toLowerCase().includes(n.val.toLowerCase())) match = true;
        else if (n.mode === 'number_greater' && n.val) { const x = parseFloat(content.replace(/[^0-9.-]/g, '')); match = !isNaN(x) && x > parseFloat(n.val); }
        else if (n.mode === 'number_less' && n.val) { const x = parseFloat(content.replace(/[^0-9.-]/g, '')); match = !isNaN(x) && x < parseFloat(n.val); }
        else if (n.mode === 'barcode_scan' && content.length >= (parseInt(n.val, 10) || 4)) match = true;
        if (match) {
          const last = processedEvents.get(el) || 0;
          if (now - last > 3500) { processedEvents.set(el, now); executeGraph(n.id); }
        }
      });
    }

    const passiveWatcher = new MutationObserver(evaluateListeners);
    passiveWatcher.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('input', evaluateListeners, true);
    document.addEventListener('change', evaluateListeners, true);

    const onUrlEvent = () => checkPassiveURLTriggers(true);
    window.addEventListener('popstate', onUrlEvent);
    window.addEventListener('hashchange', onUrlEvent);

    // ============ DRAGGING ============
    let isDragging = false, mox = 0, moy = 0;
    function ds(e) {
      if (e.type === 'mousedown' && e.button !== 0) return;
      if (e.target.closest('textarea, input, button, select')) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const r = mainWidget.getBoundingClientRect();
      isDragging = true; mox = cx - r.left; moy = cy - r.top;
      mainWidget.classList.add('is-dragging');
      if (e.cancelable) e.preventDefault();
    }
    function dm(e) {
      if (!isDragging) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      applyWidgetPosition(cx - mox, cy - moy, false);
    }
    function du() {
      if (!isDragging) return;
      isDragging = false;
      mainWidget.classList.remove('is-dragging');
      const r = mainWidget.getBoundingClientRect();
      applyWidgetPosition(r.left, r.top, true);
    }
    function rs() {
      const r = mainWidget.getBoundingClientRect();
      applyWidgetPosition(r.left, r.top, false);
      if (editorOverlay.style.display === 'block') drawAllWires();
    }

    mainWidget.addEventListener('mousedown', ds);
    mainWidget.addEventListener('touchstart', ds, { passive: false });
    document.addEventListener('mousemove', dm);
    document.addEventListener('touchmove', dm, { passive: false });
    document.addEventListener('mouseup', du);
    document.addEventListener('touchend', du);
    window.addEventListener('blur', du);
    window.addEventListener('resize', rs);

    // ============ CLEANUP ============
    window.__wmsCircuitCleanup = function () {
      passiveWatcher.disconnect();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) chrome.storage.onChanged.removeListener(onStorageChanged);
      document.removeEventListener('mousedown', onGlobalMouseDown, true);
      document.removeEventListener('keydown', onGlobalKeyDown);
      document.removeEventListener('input', evaluateListeners, true);
      document.removeEventListener('change', evaluateListeners, true);
      document.removeEventListener('mousemove', dm);
      document.removeEventListener('touchmove', dm);
      document.removeEventListener('mouseup', du);
      document.removeEventListener('touchend', du);
      window.removeEventListener('blur', du);
      window.removeEventListener('resize', rs);
      window.removeEventListener('popstate', onUrlEvent);
      window.removeEventListener('hashchange', onUrlEvent);
    };
  }

  if (document.body) initWMSCircuitStudio();
  else window.addEventListener('DOMContentLoaded', initWMSCircuitStudio, { once: true });
})();