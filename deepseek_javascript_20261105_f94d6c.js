(function () {
  if (typeof window.__wmsCircuitCleanup === 'function') {
    try { window.__wmsCircuitCleanup(); } catch (e) { console.warn('WMS cleanup error:', e); }
  }

  function initWMSCircuitStudio() {
    ['wms-helper-utility-node','wms-node-editor','wms-picker-highlight','wms-circuit-studio-styles','wms-dict-manager','wms-dict-insert-menu','wms-ask-text-overlay','wms-ask-raw-overlay','wms-coord-picker-overlay','wms-coord-picker-label','wms-coord-picker-hint'].forEach((id) => {
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
      .n-locate-toggle{display:flex;gap:6px 10px;padding:4px 2px;font-size:10px;color:#cbd5e1;flex-wrap:wrap}
      .n-locate-toggle label{display:flex;align-items:center;gap:3px;cursor:pointer;user-select:none}
      .n-locate-toggle input{accent-color:#38bdf8;cursor:pointer;margin:0}
      .n-locate-toggle label:hover{color:#fff}
      .n-coord-row{display:flex;gap:4px;align-items:center}
      .n-coord-input{flex:1;background:#0f1015;color:#f1f5f9;border:1px solid #2b2f3d;border-radius:6px;padding:4px 6px;font-size:11px;width:0;min-width:0;box-sizing:border-box;outline:none}
      .n-coord-input:focus{border-color:#38bdf8}
      .n-pick-coord{flex:0 0 auto;background:#365314;border-color:#65a30d;color:#fff;padding:4px 8px;font-size:12px}
      .n-pick-coord:hover{background:#4d7c0f}
      .n-pick-zone{background:#1d4ed8;border-color:#3b82f6;color:#fff;padding:5px 8px;font-size:11px;font-weight:600;border-radius:6px;border:1px solid #3b82f6;cursor:pointer;text-align:center;transition:background 0.15s}
      .n-pick-zone:hover{background:#2563eb}
      .n-zone-info{font-size:10px;color:#94a3b8;padding:3px 6px;background:#13141a;border-radius:4px;font-family:'SF Mono',Consolas,monospace;line-height:1.4;word-break:break-all}
      .n-zone-hint{font-size:9px;color:#64748b;padding:0 4px;line-height:1.3}
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
      #wms-coord-picker-overlay{position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,210,255,0.04)}
      #wms-coord-picker-label{position:fixed;background:#181920;color:#00d2ff;padding:4px 8px;border-radius:4px;font-family:monospace;font-size:12px;pointer-events:none;border:1px solid #00d2ff;box-shadow:0 4px 12px rgba(0,0,0,0.6);white-space:nowrap;display:none}
      #wms-coord-picker-hint{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#181920;color:#e4e7eb;padding:8px 16px;border-radius:6px;font-size:12px;border:1px solid #2d3139;box-shadow:0 8px 20px rgba(0,0,0,0.7);pointer-events:none;font-family:-apple-system,sans-serif}
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

    function makeLogRow(e) {
      const row = document.createElement('div');
      row.className = `log-entry ${e.level}`;
      const d = e.detail ? `<span class="log-detail">${escapeAttr(e.detail)}</span>` : '';
      row.innerHTML = `<span class="log-time">${e.ts}</span><span class="log-msg">${escapeAttr(e.message)}</span>${d}`;
      return row;
    }
    function appendLogEntry(e) {
      if (!logBodyEl) return;
      logBodyEl.appendChild(makeLogRow(e));
      while (logBodyEl.children.length > MAX_LOG_ENTRIES) logBodyEl.removeChild(logBodyEl.firstChild);
      logBodyEl.scrollTop = logBodyEl.scrollHeight;
      if (logCountEl) logCountEl.textContent = `(${logEntries.length})`;
    }
    function renderLog() {
      if (!logBodyEl) return;
      logBodyEl.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (const e of logEntries) frag.appendChild(makeLogRow(e));
      logBodyEl.appendChild(frag);
      logBodyEl.scrollTop = logBodyEl.scrollHeight;
      if (logCountEl) logCountEl.textContent = `(${logEntries.length})`;
    }

    function logStep(level, message, detail = '') {
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
      const entry = { ts, level, message, detail };
      logEntries.push(entry);
      if (logEntries.length > MAX_LOG_ENTRIES) logEntries.shift();
      appendLogEntry(entry);
      if (level === 'success') setStatus(message, '#10b981');
      else if (level === 'error') setStatus(message, '#ef4444');
      else if (level === 'warn') setStatus(message, '#f59e0b');
      else setStatus(message, '#38bdf8');
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
    let listenerPollInterval = null;
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
      if (missing.length > 0) return { ok: false, reason: `unknown dictionary refs: ${missing.map(m => `{{${m}}}`).join(', ')}` };
      if (!value.trim()) return { ok: false, reason: 'empty-selector-after-resolve' };
      return { ok: true, selector: value };
    }

    // ============ COORDINATE & ZONE HELPERS ============
    function resolveCoords(node) {
      if (node.coordX == null || node.coordY == null) return null;
      const refVW = node.coordRefVW || window.innerWidth;
      const refVH = node.coordRefVH || window.innerHeight;
      const scaleX = window.innerWidth / refVW;
      const scaleY = window.innerHeight / refVH;
      return {
        x: Math.round(node.coordX * scaleX),
        y: Math.round(node.coordY * scaleY),
        scaled: Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01
      };
    }
    function resolveZoneCoords(node) {
      if (node.zoneX1 == null || node.zoneY1 == null || node.zoneX2 == null || node.zoneY2 == null) return null;
      const refVW = node.zoneRefVW || window.innerWidth;
      const refVH = node.zoneRefVH || window.innerHeight;
      const scaleX = window.innerWidth / refVW;
      const scaleY = window.innerHeight / refVH;
      return {
        x1: Math.round(node.zoneX1 * scaleX),
        y1: Math.round(node.zoneY1 * scaleY),
        x2: Math.round(node.zoneX2 * scaleX),
        y2: Math.round(node.zoneY2 * scaleY),
        scaled: Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01
      };
    }
    function getScrollPath(el) {
      const path = [];
      let cur = el;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const parent = cur.parentElement;
        if (!parent) break;
        const idx = Array.prototype.indexOf.call(parent.children, cur);
        path.unshift(idx);
        cur = parent;
      }
      return path;
    }
    function resolveScrollPath(path) {
      let cur = document.body;
      for (const idx of path) {
        if (!cur || !cur.children || cur.children.length <= idx) return null;
        cur = cur.children[idx];
      }
      return cur;
    }
    function fingerprintElement(el) {
      if (!el) return null;
      const text = (el.value || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: text.slice(0, 60),
        ariaLabel: el.getAttribute('aria-label') || '',
        w: Math.round(rect.width),
        h: Math.round(rect.height)
      };
    }
    function getDeepActiveElement() {
      let el = document.activeElement;
      for (let i = 0; i < 8 && el; i++) {
        if (el.tagName === 'IFRAME') {
          try {
            const doc = el.contentDocument || (el.contentWindow && el.contentWindow.document);
            const inner = doc && doc.activeElement;
            if (inner && inner !== doc.body && inner !== doc.documentElement) { el = inner; continue; }
          } catch (_) {}
          break;
        }
        if (el.shadowRoot && el.shadowRoot.activeElement) {
          el = el.shadowRoot.activeElement;
          continue;
        }
        break;
      }
      return el;
    }
    function flashCoord(x, y) {
      const f = document.createElement('div');
      f.style.cssText = `position:fixed;left:${x-14}px;top:${y-14}px;width:28px;height:28px;border:2px solid #00d2ff;border-radius:50%;pointer-events:none;z-index:2147483646;background:rgba(0,210,255,0.2);box-shadow:0 0 18px rgba(0,210,255,0.8);transition:opacity 0.45s ease-out,transform 0.45s ease-out;transform:scale(1);`;
      document.body.appendChild(f);
      requestAnimationFrame(() => {
        f.style.opacity = '0';
        f.style.transform = 'scale(2)';
      });
      setTimeout(() => f.remove(), 500);
    }
    function flashZone(x1, y1, x2, y2) {
      const f = document.createElement('div');
      f.style.cssText = `position:fixed;left:${x1}px;top:${y1}px;width:${x2-x1}px;height:${y2-y1}px;border:2px solid #00d2ff;pointer-events:none;z-index:2147483646;background:rgba(0,210,255,0.08);box-shadow:0 0 18px rgba(0,210,255,0.5);transition:opacity 0.45s ease-out;`;
      document.body.appendChild(f);
      requestAnimationFrame(() => { f.style.opacity = '0'; });
      setTimeout(() => f.remove(), 500);
    }
    function dispatchClickAt(target, x, y) {
      const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
      try { target.dispatchEvent(new PointerEvent('pointerover', { ...opts, pointerType: 'mouse' })); } catch (_) {}
      try { target.dispatchEvent(new PointerEvent('pointerenter', { ...opts, pointerType: 'mouse' })); } catch (_) {}
      try { target.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse' })); } catch (_) {}
      target.dispatchEvent(new MouseEvent('mousedown', opts));
      try { target.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse' })); } catch (_) {}
      target.dispatchEvent(new MouseEvent('mouseup', opts));
      try { target.click(); } catch (_) {}
    }

    function restoreScrollState(node, prefix) {
      const p = prefix || 'coord';
      const sx = node[p + 'RefScrollX'];
      const sy = node[p + 'RefScrollY'];
      let changed = false;
      if (sx !== undefined && sy !== undefined) {
        if (Math.abs(window.scrollX - sx) > 2 || Math.abs(window.scrollY - sy) > 2) {
          window.scrollTo(sx, sy);
          changed = true;
        }
      }
      if (prefix === 'coord' && Array.isArray(node.coordRefScrolls)) {
        for (const entry of node.coordRefScrolls) {
          const el = resolveScrollPath(entry.path);
          if (!el) continue;
          if (Math.abs(el.scrollTop - entry.top) > 2 || Math.abs(el.scrollLeft - entry.left) > 2) {
            el.scrollTop = entry.top;
            el.scrollLeft = entry.left;
            changed = true;
          }
        }
      }
      return changed;
    }

    function isInteractable(el) {
      if (!el || el.nodeType !== 1) return false;
      const tag = el.tagName.toLowerCase();
      if (['button','a','input','textarea','select'].includes(tag)) return true;
      const role = el.getAttribute('role');
      if (role === 'button' || role === 'link' || role === 'textbox' || role === 'menuitem' || role === 'tab' || role === 'checkbox' || role === 'radio') return true;
      if (el.hasAttribute('onclick')) return true;
      const tabindex = el.getAttribute('tabindex');
      if (tabindex != null && tabindex !== '-1') return true;
      try {
        const cs = window.getComputedStyle(el);
        if (cs.cursor === 'pointer') return true;
      } catch (_) {}
      return false;
    }
    function interactableTier(el) {
      const tag = el.tagName.toLowerCase();
      if (['button','a','input','select','textarea'].includes(tag)) return 0;
      const role = el.getAttribute('role');
      if (role === 'button' || role === 'link' || role === 'textbox' || role === 'menuitem') return 0;
      if (el.hasAttribute('onclick')) return 1;
      const tabindex = el.getAttribute('tabindex');
      if (tabindex != null && tabindex !== '-1') return 2;
      return 3;
    }

    // FIX Bug 2: whitelist text-like inputs instead of blacklisting buttons
    function matchesTargetType(el, targetType) {
      if (!targetType || targetType === 'any') return true;
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      if (targetType === 'button') {
        if (tag === 'button') return true;
        if (role === 'button') return true;
        if (tag === 'input') {
          const t = (el.getAttribute('type') || 'text').toLowerCase();
          return t === 'button' || t === 'submit' || t === 'reset' || t === 'image';
        }
        return false;
      }
      if (targetType === 'input') {
        if (tag === 'textarea') return true;
        if (role === 'textbox') return true;
        if (el.isContentEditable) return true;
        if (tag === 'input') {
          const t = (el.getAttribute('type') || 'text').toLowerCase();
          const textTypes = ['text', 'password', 'email', 'tel', 'url', 'number', 'search',
                             'date', 'datetime-local', 'month', 'week', 'time'];
          return textTypes.includes(t);
        }
        return false;
      }
      if (targetType === 'link') {
        if (tag === 'a') return true;
        if (role === 'link') return true;
        return false;
      }
      return true;
    }

    function getDirectText(el) {
      let s = '';
      for (const n of el.childNodes) {
        if (n.nodeType === 3) s += n.textContent;
      }
      return s.replace(/\s+/g, ' ').trim();
    }
    function normalizeText(s) {
      return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }
    function matchesText(text, needle, mode) {
      const t = normalizeText(text);
      if (!t) return false;
      const n = normalizeText(needle);
      if (mode === 'equals') return t === n;
      if (mode === 'contains') return t.includes(n);
      if (mode === 'regex') {
        try { return new RegExp(needle, 'i').test(text); } catch (_) { return false; }
      }
      return false;
    }

    function findInteractableInDoc(doc, x1, y1, x2, y2, checkOwnUi, targetType) {
      const candidates = [];
      const zcx = (x1 + x2) / 2, zcy = (y1 + y2) / 2;
      const walk = (root) => {
        let all;
        try { all = root.querySelectorAll('*'); } catch (_) { return; }
        for (const el of all) {
          if (checkOwnUi && isOwnUi(el)) continue;
          if (el.tagName === 'IFRAME') continue;
          if (!isInteractable(el)) continue;
          if (!matchesTargetType(el, targetType)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 4 || rect.height < 4) continue;
          if (rect.right < x1 || rect.left > x2 || rect.bottom < y1 || rect.top > y2) continue;
          const overlapX = Math.max(0, Math.min(rect.right, x2) - Math.max(rect.left, x1));
          const overlapY = Math.max(0, Math.min(rect.bottom, y2) - Math.max(rect.top, y1));
          const overlap = overlapX * overlapY;
          if (overlap < 4) continue;
          const dist = Math.abs(rect.left + rect.width / 2 - zcx) + Math.abs(rect.top + rect.height / 2 - zcy);
          candidates.push({ el, overlap, area: rect.width * rect.height, dist });
        }
        for (const el of all) {
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(doc);
      candidates.sort((a, b) => {
        const ta = interactableTier(a.el), tb = interactableTier(b.el);
        if (ta !== tb) return ta - tb;
        if (Math.abs(a.overlap - b.overlap) > 20) return b.overlap - a.overlap;
        if (Math.abs(a.area - b.area) > 20) return a.area - b.area;
        return a.dist - b.dist;
      });
      return candidates[0]?.el || null;
    }
    function findInteractableInZone(x1, y1, x2, y2, targetType) {
      return findInteractableInDoc(document, x1, y1, x2, y2, true, targetType);
    }

    function findTextInDoc(doc, text, mode, x1, y1, x2, y2, checkOwnUi, targetType) {
      const matches = [];
      const walk = (root) => {
        let all;
        try { all = root.querySelectorAll('*'); } catch (_) { return; }
        for (const el of all) {
          if (checkOwnUi && isOwnUi(el)) continue;
          if (el.tagName === 'IFRAME') continue;
          if (el === doc.body || el === doc.documentElement) continue;
          if (targetType && targetType !== 'any' && !matchesTargetType(el, targetType)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) continue;
          if (rect.right < x1 || rect.left > x2 || rect.bottom < y1 || rect.top > y2) continue;
          const directText = getDirectText(el);
          const fullText = el.value || el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '';
          const directMatch = directText ? matchesText(directText, text, mode) : false;
          const anyMatch = matchesText(fullText, text, mode);
          if (!directMatch && !anyMatch) continue;
          matches.push({
            el,
            interactable: isInteractable(el),
            directMatch,
            area: rect.width * rect.height
          });
        }
        for (const el of all) {
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(doc);
      matches.sort((a, b) => {
        if (a.interactable !== b.interactable) return a.interactable ? -1 : 1;
        if (a.directMatch !== b.directMatch) return a.directMatch ? -1 : 1;
        return a.area - b.area;
      });
      return matches[0]?.el || null;
    }
    function findTextInZone(text, mode, x1, y1, x2, y2, targetType) {
      return findTextInDoc(document, text, mode, x1, y1, x2, y2, true, targetType);
    }

    function verifyElementAt(node, x, y) {
      const cur = document.elementFromPoint(x, y);
      if (!cur) return { ok: false, reason: 'nothing-at-coord' };
      const ownUi = [mainWidget, editorOverlay, dictManagerEl];
      const menu = document.getElementById('wms-dict-insert-menu');
      if (menu) ownUi.push(menu);
      const askOv = document.getElementById('wms-ask-text-overlay');
      if (askOv) ownUi.push(askOv);
      const askRawOv = document.getElementById('wms-ask-raw-overlay');
      if (askRawOv) ownUi.push(askRawOv);
      if (ownUi.some(el => el.contains(cur))) {
        return { ok: false, reason: 'coord-hits-own-ui' };
      }
      if (!node.coordRefTag) return { ok: true, element: cur, skipped: true };
      const curTag = cur.tagName.toLowerCase();
      if (curTag !== node.coordRefTag) {
        return {
          ok: false,
          reason: `tag-mismatch (expected <${node.coordRefTag}>, got <${curTag}>)`,
          detail: `"${(node.coordRefText || '').slice(0, 30)}" vs "${(cur.textContent || '').trim().slice(0, 30)}"`
        };
      }
      const curText = (cur.value || cur.textContent || cur.getAttribute('aria-label') || '').trim();
      if (node.coordRefText && curText && !curText.includes(node.coordRefText.slice(0, 20)) && !node.coordRefText.includes(curText.slice(0, 20))) {
        return {
          ok: false,
          reason: 'text-mismatch',
          detail: `"${node.coordRefText.slice(0, 30)}" vs "${curText.slice(0, 30)}"`
        };
      }
      if (node.coordRefW && node.coordRefH) {
        const scaleX = window.innerWidth / (node.coordRefVW || window.innerWidth);
        const scaleY = window.innerHeight / (node.coordRefVH || window.innerHeight);
        const expectedW = node.coordRefW * scaleX;
        const expectedH = node.coordRefH * scaleY;
        const curRect = cur.getBoundingClientRect();
        const wRatio = Math.abs(curRect.width - expectedW) / Math.max(expectedW, 1);
        const hRatio = Math.abs(curRect.height - expectedH) / Math.max(expectedH, 1);
        if (wRatio > 0.2 || hRatio > 0.2) {
          return {
            ok: false,
            reason: `size-mismatch (${Math.round(expectedW)}×${Math.round(expectedH)} vs ${Math.round(curRect.width)}×${Math.round(curRect.height)})`
          };
        }
      }
      return { ok: true, element: cur };
    }

    async function performClickOnElement(el, x, y) {
      if (!el || !el.isConnected) return { ok: false, reason: 'element-gone' };
      flashCoord(x, y);
      if (!isSafeToInteract(el, true)) {
        for (let i = 0; i < 4; i++) {
          await sleep(150);
          if (!el.isConnected) return { ok: false, reason: 'element-gone' };
          if (isSafeToInteract(el, true)) break;
        }
        if (!isSafeToInteract(el, true)) logStep('warn', '⚠️ Target may be covered — clicking anyway');
      }
      if (el.tagName === 'IFRAME') {
        try {
          const doc = el.contentDocument || (el.contentWindow && el.contentWindow.document);
          if (doc) {
            const rect = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            const offX = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0);
            const offY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0);
            const localX = x - rect.left - offX;
            const localY = y - rect.top - offY;
            const innerTarget = doc.elementFromPoint(localX, localY);
            if (innerTarget) {
              try { if (typeof innerTarget.focus === 'function') innerTarget.focus(); } catch (_) {}
              dispatchClickAt(innerTarget, localX, localY);
              await sleep(250);
              return { ok: true, reason: `clicked-iframe-(${Math.round(localX)},${Math.round(localY)})` };
            }
          }
        } catch (_) {}
      }
      try { if (typeof el.focus === 'function') el.focus(); } catch (_) {}
      dispatchClickAt(el, x, y);
      await sleep(250);
      return { ok: true, reason: `clicked-(${x},${y})` };
    }

    async function clickAtCoordinate(node) {
      const resolved = resolveCoords(node);
      if (!resolved) return { ok: false, reason: 'no-coordinate-set' };
      const { x, y, scaled } = resolved;
      if (scaled) logStep('warn', `⚠️ Viewport changed since pick — scaled coord to (${x}, ${y})`);
      if (node.coordRefDPR && Math.abs(node.coordRefDPR - (window.devicePixelRatio || 1)) > 0.01) {
        logStep('warn', `⚠️ DPR changed since pick (${node.coordRefDPR} → ${window.devicePixelRatio}) — coordinate may not land precisely`);
      }
      if (document.hidden) logStep('warn', '⚠️ Tab hidden — click will fire but you cannot see it (background timers are throttled)');
      if (restoreScrollState(node, 'coord')) {
        logStep('info', '📍 Scroll restored to pick-time position');
        await sleep(220);
      }
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
        return { ok: false, reason: `coord-off-screen (${x},${y} vs ${window.innerWidth}×${window.innerHeight})` };
      }
      const verify = verifyElementAt(node, x, y);
      if (!verify.ok) {
        logStep('warn', `⚠️ Coordinate sanity check failed: ${verify.reason}${verify.detail ? ' — ' + verify.detail : ''}`);
        if (node.coordStrict) return { ok: false, reason: `element-changed-at-coord: ${verify.reason}` };
        logStep('warn', '⚠️ Strict mode OFF — clicking anyway');
      }
      const target = verify.element || document.elementFromPoint(x, y);
      if (!target) return { ok: false, reason: `nothing-at-coord-${x}-${y}` };
      return await performClickOnElement(target, x, y);
    }

    async function clickInZone(node) {
      const zone = resolveZoneCoords(node);
      if (!zone) return { ok: false, reason: 'no-zone-set' };
      if (zone.scaled) logStep('warn', `⚠️ Viewport changed — scaled zone to (${zone.x1},${zone.y1})→(${zone.x2},${zone.y2})`);
      if (document.hidden) logStep('warn', '⚠️ Tab hidden — click will fire but you cannot see it');
      if (restoreScrollState(node, 'zone')) {
        logStep('info', '📍 Scroll restored');
        await sleep(220);
      }
      flashZone(zone.x1, zone.y1, zone.x2, zone.y2);
      // FIX Bug 1: runtime fallback for pre-existing Type-in-zone nodes
      const targetType = node.zoneTargetType || ((node.type === 'type') ? 'input' : 'any');
      let el = findInteractableInZone(zone.x1, zone.y1, zone.x2, zone.y2, targetType);
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = Math.round(rect.left + rect.width / 2);
        const cy = Math.round(rect.top + rect.height / 2);
        logStep('info', `👆 Found <${el.tagName.toLowerCase()}> in zone at (${cx},${cy})`);
        return await performClickOnElement(el, cx, cy);
      }
      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          const rect = iframe.getBoundingClientRect();
          if (rect.right < zone.x1 || rect.left > zone.x2 || rect.bottom < zone.y1 || rect.top > zone.y2) continue;
          const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
          if (!doc) continue;
          const cs = window.getComputedStyle(iframe);
          const offX = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0);
          const offY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0);
          const ix1 = zone.x1 - rect.left - offX;
          const iy1 = zone.y1 - rect.top - offY;
          const ix2 = zone.x2 - rect.left - offX;
          const iy2 = zone.y2 - rect.top - offY;
          const innerEl = findInteractableInDoc(doc, ix1, iy1, ix2, iy2, false, targetType);
          if (innerEl) {
            const ir = innerEl.getBoundingClientRect();
            const lx = Math.round(ir.left + ir.width / 2);
            const ly = Math.round(ir.top + ir.height / 2);
            logStep('info', `👆 Found <${innerEl.tagName.toLowerCase()}> in iframe zone`);
            try { if (typeof innerEl.focus === 'function') innerEl.focus(); } catch (_) {}
            dispatchClickAt(innerEl, lx, ly);
            await sleep(250);
            return { ok: true, reason: `clicked-iframe-zone-(${lx},${ly})` };
          }
        } catch (_) {}
      }
      // FIX Bug 7: friendlier message for 'any'
      const desc = targetType === 'any' ? 'interactable' : targetType;
      return { ok: false, reason: `no-${desc}-in-zone` };
    }

    async function clickByView(node) {
      let zone = resolveZoneCoords(node);
      if (!zone) {
        zone = { x1: 0, y1: 0, x2: window.innerWidth, y2: window.innerHeight, scaled: false };
        logStep('info', 'ℹ️ No zone set — searching entire viewport');
      } else if (zone.scaled) {
        logStep('warn', `⚠️ Viewport changed — scaled zone to (${zone.x1},${zone.y1})→(${zone.x2},${zone.y2})`);
      }
      if (document.hidden) logStep('warn', '⚠️ Tab hidden — click will fire but you cannot see it');
      const text = (node.viewText || '').trim();
      if (!text) return { ok: false, reason: 'no-search-text-set' };
      if (restoreScrollState(node, 'zone')) {
        logStep('info', '📍 Scroll restored');
        await sleep(220);
      }
      flashZone(zone.x1, zone.y1, zone.x2, zone.y2);
      // FIX Bug 1: runtime fallback for pre-existing Type-in-view nodes
      const targetType = node.zoneTargetType || ((node.type === 'type') ? 'input' : 'any');
      let el = findTextInZone(text, node.viewMatchMode || 'contains', zone.x1, zone.y1, zone.x2, zone.y2, targetType);
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = Math.round(rect.left + rect.width / 2);
        const cy = Math.round(rect.top + rect.height / 2);
        logStep('info', `👆 Found "${text.slice(0, 30)}" → clicking (${cx},${cy})`);
        return await performClickOnElement(el, cx, cy);
      }
      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          const rect = iframe.getBoundingClientRect();
          if (rect.right < zone.x1 || rect.left > zone.x2 || rect.bottom < zone.y1 || rect.top > zone.y2) continue;
          const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
          if (!doc) continue;
          const cs = window.getComputedStyle(iframe);
          const offX = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0);
          const offY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0);
          const ix1 = zone.x1 - rect.left - offX;
          const iy1 = zone.y1 - rect.top - offY;
          const ix2 = zone.x2 - rect.left - offX;
          const iy2 = zone.y2 - rect.top - offY;
          const innerEl = findTextInDoc(doc, text, node.viewMatchMode || 'contains', ix1, iy1, ix2, iy2, false, targetType);
          if (innerEl) {
            const ir = innerEl.getBoundingClientRect();
            const lx = Math.round(ir.left + ir.width / 2);
            const ly = Math.round(ir.top + ir.height / 2);
            logStep('info', `👆 Found "${text.slice(0, 20)}" in iframe → clicking`);
            try { if (typeof innerEl.focus === 'function') innerEl.focus(); } catch (_) {}
            dispatchClickAt(innerEl, lx, ly);
            await sleep(250);
            return { ok: true, reason: `clicked-iframe-view-(${lx},${ly})` };
          }
        } catch (_) {}
      }
      return { ok: false, reason: `text-not-found-in-zone: "${text.slice(0, 30)}"` };
    }

    async function typeAtCoordinate(node, text, submit) {
      const clickRes = await clickAtCoordinate(node);
      if (!clickRes.ok) return clickRes;
      await sleep(150);
      const active = getDeepActiveElement();
      if (!active || active === document.body || active === document.documentElement) return { ok: false, reason: 'no-focused-element-after-click' };
      if (mainWidget.contains(active) || editorOverlay.contains(active)) return { ok: false, reason: 'focused-own-ui' };
      const wrote = typeAndSubmitElement(active, text, submit);
      return wrote ? { ok: true, reason: `typed-${text.length}-at-coord` } : { ok: false, reason: 'not-a-typeable-element-at-coord' };
    }
    async function typeInZone(node, text, submit) {
      const clickRes = await clickInZone(node);
      if (!clickRes.ok) return clickRes;
      await sleep(150);
      const active = getDeepActiveElement();
      if (!active || active === document.body || active === document.documentElement) return { ok: false, reason: 'no-focused-element-after-click' };
      if (mainWidget.contains(active) || editorOverlay.contains(active)) return { ok: false, reason: 'focused-own-ui' };
      const wrote = typeAndSubmitElement(active, text, submit);
      return wrote ? { ok: true, reason: `typed-${text.length}-in-zone` } : { ok: false, reason: 'not-a-typeable-element-in-zone' };
    }
    async function typeByView(node, text, submit) {
      const clickRes = await clickByView(node);
      if (!clickRes.ok) return clickRes;
      await sleep(150);
      const active = getDeepActiveElement();
      if (!active || active === document.body || active === document.documentElement) return { ok: false, reason: 'no-focused-element-after-click' };
      if (mainWidget.contains(active) || editorOverlay.contains(active)) return { ok: false, reason: 'focused-own-ui' };
      const wrote = typeAndSubmitElement(active, text, submit);
      return wrote ? { ok: true, reason: `typed-${text.length}-by-view` } : { ok: false, reason: 'not-a-typeable-element-by-view' };
    }

    // ============ COORDINATE PICKER ============
    function startCoordPicker(node) {
      if (isPickingElement) return;
      isPickingElement = true;
      const widgetWasVisible = mainWidget.style.display !== 'none';
      const editorWasOpen = editorOverlay.style.display === 'block';
      const dictWasOpen = dictManagerEl.style.display === 'flex';
      mainWidget.style.display = 'none';
      editorOverlay.style.display = 'none';
      dictManagerEl.style.display = 'none';

      const refVW = window.innerWidth, refVH = window.innerHeight;
      const refScrollX = window.scrollX, refScrollY = window.scrollY;

      const overlay = document.createElement('div');
      overlay.id = 'wms-coord-picker-overlay';
      const hint = document.createElement('div');
      hint.id = 'wms-coord-picker-hint';
      hint.textContent = '🎯 Click anywhere to capture coordinate — ESC to cancel';
      overlay.appendChild(hint);
      const label = document.createElement('div');
      label.id = 'wms-coord-picker-label';
      label.textContent = 'X: –, Y: –';
      label.style.left = '20px'; label.style.top = '20px';
      overlay.appendChild(label);
      document.body.appendChild(overlay);
      logStep('info', '🎯 Coordinate picker active');

      function onMove(e) {
        label.textContent = `X: ${e.clientX}, Y: ${e.clientY}`;
        label.style.left = Math.min(e.clientX + 16, window.innerWidth - 160) + 'px';
        label.style.top = Math.min(e.clientY + 16, window.innerHeight - 40) + 'px';
      }
      function onDown(e) {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        const x = e.clientX, y = e.clientY;
        node.locateBy = 'coord';
        node.coordX = x; node.coordY = y;
        node.coordRefVW = refVW; node.coordRefVH = refVH;
        node.coordRefScrollX = refScrollX; node.coordRefScrollY = refScrollY;
        node.coordRefDPR = window.devicePixelRatio || 1;
        overlay.style.display = 'none';
        const el = document.elementFromPoint(x, y);
        const fp = fingerprintElement(el);
        overlay.style.display = '';
        if (fp) {
          node.coordRefTag = fp.tag; node.coordRefText = fp.text;
          node.coordRefAriaLabel = fp.ariaLabel;
          node.coordRefW = fp.w; node.coordRefH = fp.h;
        } else {
          node.coordRefTag = null; node.coordRefText = '';
          node.coordRefAriaLabel = ''; node.coordRefW = 0; node.coordRefH = 0;
        }
        node.coordRefScrolls = [];
        if (el) {
          let cur = el.parentElement;
          while (cur && cur !== document.body && cur !== document.documentElement) {
            if (cur.scrollHeight > cur.clientHeight + 2 || cur.scrollWidth > cur.clientWidth + 2) {
              node.coordRefScrolls.push({ path: getScrollPath(cur), top: cur.scrollTop, left: cur.scrollLeft });
            }
            cur = cur.parentElement;
          }
        }
        saveGraph(); cleanup(); renderGraph();
        requestAnimationFrame(() => drawAllWires());
        const tagMsg = node.coordRefTag ? ` on <${node.coordRefTag}>` : '';
        logStep('success', `🎯 Captured (${x}, ${y})${tagMsg} at ${refVW}×${refVH}`);
      }
      function onEsc(e) { if (e.key === 'Escape') { e.preventDefault(); cleanup(); logStep('warn', 'Coord picker cancelled'); } }
      function cleanup() {
        isPickingElement = false;
        overlay.remove();
        if (widgetWasVisible) mainWidget.style.display = '';
        if (editorWasOpen) editorOverlay.style.display = 'block';
        if (dictWasOpen) dictManagerEl.style.display = 'flex';
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mousedown', onDown, true);
        document.removeEventListener('keydown', onEsc, true);
        requestAnimationFrame(() => drawAllWires());
      }
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mousedown', onDown, true);
      document.addEventListener('keydown', onEsc, true);
    }

    // ============ ZONE PICKER ============
    function startZonePicker(node, mode) {
      if (isPickingElement) return;
      isPickingElement = true;
      const widgetWasVisible = mainWidget.style.display !== 'none';
      const editorWasOpen = editorOverlay.style.display === 'block';
      const dictWasOpen = dictManagerEl.style.display === 'flex';
      mainWidget.style.display = 'none';
      editorOverlay.style.display = 'none';
      dictManagerEl.style.display = 'none';

      const refVW = window.innerWidth, refVH = window.innerHeight;

      const overlay = document.createElement('div');
      overlay.id = 'wms-coord-picker-overlay';
      const hint = document.createElement('div');
      hint.id = 'wms-coord-picker-hint';
      hint.textContent = mode === 'view'
        ? '🎯 Drag to define search zone — ESC to cancel'
        : '🎯 Drag to define click zone — ESC to cancel';
      overlay.appendChild(hint);
      const label = document.createElement('div');
      label.id = 'wms-coord-picker-label';
      label.textContent = '';
      overlay.appendChild(label);
      const selRect = document.createElement('div');
      selRect.style.cssText = 'position:fixed;border:2px dashed #00d2ff;background:rgba(0,210,255,0.1);pointer-events:none;display:none;box-shadow:0 0 20px rgba(0,210,255,0.4);';
      overlay.appendChild(selRect);
      document.body.appendChild(overlay);
      logStep('info', `🎯 Zone picker active (${mode})`);

      let startX = 0, startY = 0, dragging = false;

      function onMove(e) {
        if (!dragging) {
          label.style.display = 'block';
          label.textContent = `X: ${e.clientX}, Y: ${e.clientY}`;
          label.style.left = Math.min(e.clientX + 16, window.innerWidth - 160) + 'px';
          label.style.top = Math.min(e.clientY + 16, window.innerHeight - 40) + 'px';
          return;
        }
        const x1 = Math.min(startX, e.clientX), y1 = Math.min(startY, e.clientY);
        const x2 = Math.max(startX, e.clientX), y2 = Math.max(startY, e.clientY);
        selRect.style.display = 'block';
        selRect.style.left = x1 + 'px'; selRect.style.top = y1 + 'px';
        selRect.style.width = (x2 - x1) + 'px'; selRect.style.height = (y2 - y1) + 'px';
        label.style.display = 'block';
        label.textContent = `Zone: ${(x2-x1)}×${(y2-y1)} px`;
        label.style.left = Math.min(x2 + 16, window.innerWidth - 200) + 'px';
        label.style.top = Math.min(y1, window.innerHeight - 40) + 'px';
      }
      function onDown(e) {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        dragging = true;
        startX = e.clientX; startY = e.clientY;
      }
      function onUp(e) {
        if (e.button !== 0) return;
        if (!dragging) return;
        dragging = false;
        e.preventDefault(); e.stopPropagation();
        const x1 = Math.min(startX, e.clientX), y1 = Math.min(startY, e.clientY);
        const x2 = Math.max(startX, e.clientX), y2 = Math.max(startY, e.clientY);
        if (x2 - x1 < 16 || y2 - y1 < 16) {
          logStep('warn', '⚠️ Zone too small — drag a larger area');
          startX = 0; startY = 0;
          selRect.style.display = 'none';
          label.style.display = 'none';
          return;
        }
        node.zoneX1 = x1; node.zoneY1 = y1;
        node.zoneX2 = x2; node.zoneY2 = y2;
        node.zoneRefVW = refVW; node.zoneRefVH = refVH;
        node.zoneRefScrollX = window.scrollX;
        node.zoneRefScrollY = window.scrollY;
        node.zoneRefDPR = window.devicePixelRatio || 1;
        saveGraph();
        const wasMode = mode;
        cleanup();
        logStep('success', `🎯 Zone captured (${x2-x1}×${y2-y1}) at (${x1},${y1})`);
        if (wasMode === 'view') {
          (async () => {
            const txt = await askTextRaw('Text / value to find in zone:', node.viewText || '', 'e.g. Save, Submit, Inbound');
            if (txt) { node.viewText = txt; saveGraph(); }
            renderGraph();
          })();
        } else {
          renderGraph();
        }
      }
      function onEsc(e) { if (e.key === 'Escape') { e.preventDefault(); cleanup(); logStep('warn', 'Zone picker cancelled'); } }
      function cleanup() {
        isPickingElement = false;
        overlay.remove();
        if (widgetWasVisible) mainWidget.style.display = '';
        if (editorWasOpen) editorOverlay.style.display = 'block';
        if (dictWasOpen) dictManagerEl.style.display = 'flex';
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mousedown', onDown, true);
        document.removeEventListener('mouseup', onUp, true);
        document.removeEventListener('keydown', onEsc, true);
        requestAnimationFrame(() => drawAllWires());
      }
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mousedown', onDown, true);
      document.addEventListener('mouseup', onUp, true);
      document.addEventListener('keydown', onEsc, true);
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

    let saveDebounceTimer = null;
    function saveGraph() {
      if (!graph.variables) graph.variables = {};
      if (!graph.dictionary) graph.dictionary = [];
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = setTimeout(() => {
        SafeStorage.set({ wmsGraph: graph });
      }, 250);
    }
    function safeSaveGraphNow() {
      if (!graph.variables) graph.variables = {};
      if (!graph.dictionary) graph.dictionary = [];
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
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

    // FIX Bug 1: migrate existing Type-in-zone/view nodes to 'input' so old graphs behave correctly
    function migrateZoneTargetTypes() {
      let changed = false;
      (graph.nodes || []).forEach(n => {
        if (n.type === 'extract' && !n.mode) n.mode = 'immediate';
        if ((n.locateBy === 'zone' || n.locateBy === 'view') && n.zoneTargetType == null) {
          n.zoneTargetType = (n.type === 'type') ? 'input' : 'any';
          changed = true;
        }
      });
      return changed;
    }

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
      const migrated = migrateZoneTargetTypes();
      renderGraph();
      if (migrated) saveGraph();
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
        migrateZoneTargetTypes();
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
    document.getElementById('close-editor-btn').addEventListener('click', () => {
      editorOverlay.style.display = 'none';
      selectedPort = null;
      setTimeout(() => { try { evaluateListeners(); } catch (_) {} }, 100);
    });
    document.getElementById('save-graph-btn').addEventListener('click', () => {
      safeSaveGraphNow();
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
    function refreshDictUsage() {
      if (!dictListEl) return;
      dictListEl.querySelectorAll('.dict-row').forEach((row) => {
        const entry = (graph.dictionary || []).find(e => e.id === row.getAttribute('data-id'));
        if (!entry) return;
        const usage = countDictUsage(entry.name);
        const badge = row.querySelector('.dict-usage');
        if (badge) {
          badge.textContent = usage > 0 ? usage + '×' : 'unused';
          badge.classList.toggle('in-use', usage > 0);
        }
      });
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
          delete nameI.dataset.prevName;
          if (oldName && newName && oldName !== newName) {
            const affected = (graph.nodes || []).filter(n =>
              (n.selector && n.selector.includes(`{{${oldName}}}`)) ||
              (n.customText && n.customText.includes(`{{${oldName}}}`))
            );
            if (affected.length > 0) {
              affected.forEach(n => {
                if (n.selector) n.selector = n.selector.split(`{{${oldName}}}`).join(`{{${newName}}}`);
                if (n.customText) n.customText = n.customText.split(`{{${oldName}}}`).join(`{{${newName}}}`);
              });
              saveGraph(); renderGraph();
              logStep('success', `✏️ Renamed "${oldName}" → "${newName}" in ${affected.length} block(s)`);
            }
          }
          refreshDictUsage();
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
      const editorWasOpen = editorOverlay.style.display === 'block';
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
        if (editorWasOpen || fromWhere === 'editor') {
          editorOverlay.style.display = 'block';
          requestAnimationFrame(() => drawAllWires());
        }
        if (fromWhere === 'dict') {
          dictManagerEl.style.display = 'flex';
          renderDictList();
        }
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
    let activeAsk = null;
    function askText(title, defaultValue = '') {
      return new Promise((resolve) => {
        if (activeAsk) { try { activeAsk(null); } catch (_) {} }
        if (activeAskRaw) { try { activeAskRaw(null); } catch (_) {} }
        const prev = document.getElementById('wms-ask-text-overlay');
        if (prev) prev.remove();
        const ov = document.createElement('div');
        ov.id = 'wms-ask-text-overlay';
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
        function close(result) {
          ov.remove();
          if (activeAsk === close) activeAsk = null;
          resolve(result);
        }
        activeAsk = close;
        ov.querySelector('#ask-ok').addEventListener('click', () => { const v = input.value.replace(/[^A-Za-z0-9_$-]/g, '').trim(); close(v || null); });
        ov.querySelector('#ask-cancel').addEventListener('click', () => close(null));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); const v = input.value.replace(/[^A-Za-z0-9_$-]/g, '').trim(); close(v || null); }
          else if (e.key === 'Escape') { e.preventDefault(); close(null); }
        });
        ov.addEventListener('click', (e) => { if (e.target === ov) close(null); });
      });
    }
    let activeAskRaw = null;
    function askTextRaw(title, defaultValue = '', placeholder = '') {
      return new Promise((resolve) => {
        if (activeAsk) { try { activeAsk(null); } catch (_) {} }
        if (activeAskRaw) { try { activeAskRaw(null); } catch (_) {} }
        const prev = document.getElementById('wms-ask-raw-overlay');
        if (prev) prev.remove();
        const ov = document.createElement('div');
        ov.id = 'wms-ask-raw-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        ov.innerHTML = `<div style="background:#181920;border:1px solid #2d3139;border-radius:10px;padding:20px;width:min(440px,90vw);box-shadow:0 20px 50px rgba(0,0,0,0.85);">
          <div style="color:#e4e7eb;font-size:13px;font-weight:600;margin-bottom:10px;">${escapeAttr(title)}</div>
          <input type="text" id="ask-raw-input" style="width:100%;box-sizing:border-box;background:#0f1015;color:#fff;border:1px solid #353b49;border-radius:6px;padding:8px;font-size:13px;outline:none;" value="${escapeAttr(defaultValue)}" placeholder="${escapeAttr(placeholder)}" maxlength="200">
          <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
            <button id="ask-raw-cancel" style="background:#252834;color:#cbd5e1;border:1px solid #3b4052;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px;">Cancel</button>
            <button id="ask-raw-ok" style="background:#059669;color:#fff;border:1px solid #10b981;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600;">OK</button>
          </div></div>`;
        document.body.appendChild(ov);
        const input = ov.querySelector('#ask-raw-input'); input.focus(); input.select();
        function close(result) {
          ov.remove();
          if (activeAskRaw === close) activeAskRaw = null;
          resolve(result);
        }
        activeAskRaw = close;
        ov.querySelector('#ask-raw-ok').addEventListener('click', () => close(input.value || null));
        ov.querySelector('#ask-raw-cancel').addEventListener('click', () => close(null));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); close(input.value || null); }
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
      let closerRef = null;
      function removeMenu() {
        menu.remove();
        if (closerRef) { document.removeEventListener('mousedown', closerRef, true); closerRef = null; }
      }
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
          const focused = document.activeElement === targetInput;
          const start = focused && targetInput.selectionStart != null ? targetInput.selectionStart : targetInput.value.length;
          const end = focused && targetInput.selectionEnd != null ? targetInput.selectionEnd : targetInput.value.length;
          if (targetInput.value.trim() === '') targetInput.value = ref;
          else targetInput.value = targetInput.value.slice(0, start) + ref + targetInput.value.slice(end);
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          removeMenu();
        });
        menu.appendChild(item);
      });
      document.body.appendChild(menu);
      setTimeout(() => {
        closerRef = (e) => { if (!menu.contains(e.target) && e.target !== btnEl) removeMenu(); };
        document.addEventListener('mousedown', closerRef, true);
      }, 0);
    }

    // ============ STABILITY / CLICK ============
    function nextFrame() {
      return new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(finish);
        setTimeout(finish, 50);
      });
    }
    async function isStable(el, frames = 2) {
      if (!el || !el.isConnected) return false;
      let last = el.getBoundingClientRect();
      for (let i = 0; i < frames; i++) {
        await nextFrame();
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
      logStep('warn', '⚠️ Click had no locally-visible effect — continuing (next Wait block will gate progress)');
      return { ok: true, reason: 'no-visible-change' };
    }

    // ============ RUN ============
    function runFirstAvailableCircuit() {
      if (graph.nodes.length === 0) { logStep('warn', '⚠️ Add blocks in Circuit Studio first'); return; }
      let start = graph.nodes.find((n) => (n.type === 'trigger' || n.type === 'listener') && graph.edges.some((e) => e.source === n.id));
      if (!start) start = graph.nodes.find((n) => n.type === 'trigger' || n.type === 'listener');
      if (!start) start = graph.nodes.find((n) => !graph.edges.some((e) => e.target === n.id)) || graph.nodes[0];
      if (!start) return;
      const hasOut = graph.edges.some((e) => e.source === start.id);
      if (!hasOut) { logStep('warn', '⚠️ Start node has no outgoing connection — nothing to run'); return; }
      editorOverlay.style.display = 'none';
      executeGraph(start.id);
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
        if (missing.length > 0) return `<div class="n-resolved-hint n-resolved-bad">⚠️ Unknown: ${escapeAttr(missing.map(m => `{{${m}}}`).join(', '))}</div>`;
        if (!value) return '';
        return `<div class="n-resolved-hint n-resolved-ok">→ ${escapeAttr(value.slice(0, 40))}</div>`;
      };
      const selectorInput = (node) => `<input type="text" class="node-input n-selector" value="${escapeAttr(node.selector)}" placeholder="Click Pick or paste selector...">${resolvedHint(node.selector)}`;

      const locateToggle = (node) => {
        const m = node.locateBy || 'selector';
        return `<div class="n-locate-toggle">
          <label><input type="radio" name="loc_${node.id}" class="n-loc-sel" ${m==='selector'?'checked':''}>Selector</label>
          <label><input type="radio" name="loc_${node.id}" class="n-loc-coord" ${m==='coord'?'checked':''}>Coord</label>
          <label><input type="radio" name="loc_${node.id}" class="n-loc-zone" ${m==='zone'?'checked':''}>Zone</label>
          <label><input type="radio" name="loc_${node.id}" class="n-loc-view" ${m==='view'?'checked':''}>View</label>
        </div>`;
      };
      const coordInput = (node) => {
        const has = node.coordX != null && node.coordY != null;
        const refVW = node.coordRefVW || window.innerWidth;
        const refVH = node.coordRefVH || window.innerHeight;
        const fp = node.coordRefTag ? `on <${node.coordRefTag}>${node.coordRefText ? ' "' + escapeAttr(node.coordRefText.slice(0, 20)) + '"' : ''}` : 'no fingerprint';
        return `<div class="n-coord-row">
            <input type="number" class="n-coord-input n-coord-x" value="${has ? node.coordX : ''}" placeholder="X">
            <input type="number" class="n-coord-input n-coord-y" value="${has ? node.coordY : ''}" placeholder="Y">
            <div class="node-btn-small n-pick-coord">🎯</div>
          </div>
          <div style="font-size:9px;color:#64748b;padding:0 4px;font-family:monospace;line-height:1.3;">ref: ${refVW}×${refVH} • ${has ? fp : 'not set'}</div>
          <label class="n-submit-row"><input type="checkbox" class="n-coord-strict" ${node.coordStrict?'checked':''}><span>Halt if target looks different</span></label>`;
      };
      const zoneTargetSelect = (node) => {
        const t = node.zoneTargetType || 'any';
        return `<select class="node-select n-zone-target" title="Which kind of element to find in the zone">
          <option value="any" ${t==='any'?'selected':''}>Any clickable (button/link/input)</option>
          <option value="button" ${t==='button'?'selected':''}>Button / Submit only</option>
          <option value="input" ${t==='input'?'selected':''}>Text input only</option>
          <option value="link" ${t==='link'?'selected':''}>Link only</option>
        </select>`;
      };
      const zoneDisplay = (node) => {
        const has = node.zoneX1 != null && node.zoneY1 != null && node.zoneX2 != null && node.zoneY2 != null;
        const refVW = node.zoneRefVW || window.innerWidth;
        const refVH = node.zoneRefVH || window.innerHeight;
        if (!has) {
          return `<div class="n-pick-zone">🎯 Draw Zone</div>`;
        }
        const w = node.zoneX2 - node.zoneX1;
        const h = node.zoneY2 - node.zoneY1;
        return `<div class="n-zone-info">
            zone ${w}×${h} @ (${node.zoneX1}, ${node.zoneY1})
            <div style="font-size:9px;color:#64748b;">ref: ${refVW}×${refVH}</div>
          </div>
          <div class="n-pick-zone">🔄 Re-draw Zone</div>`;
      };
      const viewTextInput = (node) => `
        <input type="text" class="node-input n-view-text" value="${escapeAttr(node.viewText || '')}" placeholder="Text to find in zone...">
        <select class="node-select n-view-mode">
          <option value="contains" ${(node.viewMatchMode||'contains')==='contains'?'selected':''}>Text Contains</option>
          <option value="equals" ${node.viewMatchMode==='equals'?'selected':''}>Text Equals</option>
          <option value="regex" ${node.viewMatchMode==='regex'?'selected':''}>Regex</option>
        </select>`;
      const zoneHint = (mode, targetType) => {
        if (mode === 'view') return `<div class="n-zone-hint">Finds element matching text in zone, then ${targetType === 'type' ? 'types into it' : 'clicks it'}</div>`;
        return `<div class="n-zone-hint">Finds first matching element in zone, then ${targetType === 'type' ? 'types into it' : 'clicks it'}</div>`;
      };

      if (node.type === 'trigger') {
        body += `<select class="node-select n-trig-type"><option value="hotkey" ${node.subtype==='hotkey'?'selected':''}>Keyboard Shortcut</option><option value="url" ${node.subtype==='url'?'selected':''}>Auto URL Match</option></select>
          <input type="text" class="node-input n-trig-val" value="${escapeAttr(node.val)}" placeholder="${node.subtype==='url'?'e.g. /inbound':'Click & press keys'}">
          <div class="node-btn-small n-run-this" style="background:#065f46;border-color:#10b981;color:#fff;">▶ Run This Trigger</div>`;
      } else if (node.type === 'listener') {
        body += `${pickRow('Pick Target to Watch')}${selectorInput(node)}
          <select class="node-select n-listen-mode">
            <option value="text_contains" ${node.mode==='text_contains'?'selected':''}>Text Contains (empty = any)</option>
            <option value="number_greater" ${node.mode==='number_greater'?'selected':''}>Number &gt; Value</option>
            <option value="number_less" ${node.mode==='number_less'?'selected':''}>Number &lt; Value</option>
            <option value="barcode_scan" ${node.mode==='barcode_scan'?'selected':''}>Barcode / Length &gt;=</option>
          </select>
          <input type="text" class="node-input n-listen-val" value="${escapeAttr(node.val)}" placeholder="Target text or number (empty = any content)">`;
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
        body += locateToggle(node);
        if (node.locateBy === 'coord') body += coordInput(node);
        else if (node.locateBy === 'zone') body += zoneTargetSelect(node) + zoneDisplay(node) + zoneHint('zone', 'click');
        else if (node.locateBy === 'view') body += zoneTargetSelect(node) + zoneDisplay(node) + viewTextInput(node) + zoneHint('view', 'click');
        else body += pickRow('Pick Button / Element') + selectorInput(node);
      } else if (node.type === 'type') {
        body += locateToggle(node);
        body += `<select class="node-select n-source">
            <option value="box1" ${node.source==='box1'?'selected':''}>Type From: Box 1</option>
            <option value="box2" ${node.source==='box2'?'selected':''}>Type From: Box 2</option>
            <option value="variable" ${node.source==='variable'?'selected':''}>Type From: Variable</option>
            <option value="custom" ${node.source==='custom'?'selected':''}>Type: Custom Text</option>
          </select>
          ${node.source==='variable' ? `<input type="text" class="node-input n-var-name" value="${escapeAttr(node.varName)}" placeholder="Variable name">` : ''}
          ${node.source==='custom' ? `<input type="text" class="node-input n-custom" value="${escapeAttr(node.customText)}" placeholder="Enter custom text...">` : ''}
          <label class="n-submit-row"><input type="checkbox" class="n-submit-after" ${node.submitAfterType!==false?'checked':''}><span>Press Enter after typing</span></label>`;
        if (node.locateBy === 'coord') body += coordInput(node);
        else if (node.locateBy === 'zone') body += zoneTargetSelect(node) + zoneDisplay(node) + zoneHint('zone', 'type');
        else if (node.locateBy === 'view') body += zoneTargetSelect(node) + zoneDisplay(node) + viewTextInput(node) + zoneHint('view', 'type');
        else body += pickRow('Pick Input Box') + selectorInput(node);
      } else if (node.type === 'enter') {
        body += `${pickRow('Pick Element (optional)')}${selectorInput(node)}
          <div style="font-size:10px;color:#94a3b8;padding:2px 4px;background:#13141a;border-radius:4px;">⏎ Presses Enter key</div>`;
      } else if (node.type === 'wait') {
        body += `<select class="node-select n-wait-mode">
            <option value="element" ${node.mode==='element'?'selected':''}>Wait Until Element Appears</option>
            <option value="delay" ${node.mode==='delay'?'selected':''}>Wait Fixed Time (ms)</option>
          </select>
          ${node.mode==='delay' ? `<input type="number" class="node-input n-wait-ms" value="${escapeAttr(node.ms ?? 500)}">` : `${pickRow('Pick Element to Wait For')}${selectorInput(node)}`}`;
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
        if (e.target.closest('input, select, textarea, button, label, .node-btn-small, .n-pick-zone, .del-node, .port')) return;
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

      const locSel = el.querySelector('.n-loc-sel');
      const locCoord = el.querySelector('.n-loc-coord');
      const locZone = el.querySelector('.n-loc-zone');
      const locView = el.querySelector('.n-loc-view');
      if (locSel) locSel.addEventListener('change', () => { if (node.locateBy !== 'selector') { node.locateBy = 'selector'; renderGraph(); saveGraph(); } });
      if (locCoord) locCoord.addEventListener('change', () => { if (node.locateBy !== 'coord') { node.locateBy = 'coord'; renderGraph(); saveGraph(); } });
      if (locZone) locZone.addEventListener('change', () => {
        if (node.locateBy !== 'zone') {
          node.locateBy = 'zone';
          if (!node.zoneTargetType) node.zoneTargetType = (node.type === 'type') ? 'input' : 'any';
          renderGraph(); saveGraph();
        }
      });
      if (locView) locView.addEventListener('change', () => {
        if (node.locateBy !== 'view') {
          node.locateBy = 'view';
          if (!node.zoneTargetType) node.zoneTargetType = (node.type === 'type') ? 'input' : 'any';
          renderGraph(); saveGraph();
        }
      });

      const coordXEl = el.querySelector('.n-coord-x');
      const coordYEl = el.querySelector('.n-coord-y');
      if (coordXEl) coordXEl.addEventListener('change', (e) => { const n = parseInt(e.target.value, 10); node.coordX = Number.isFinite(n) ? n : null; saveGraph(); });
      if (coordYEl) coordYEl.addEventListener('change', (e) => { const n = parseInt(e.target.value, 10); node.coordY = Number.isFinite(n) ? n : null; saveGraph(); });
      const pickCoordBtn = el.querySelector('.n-pick-coord');
      if (pickCoordBtn) pickCoordBtn.addEventListener('click', (ev) => { ev.stopPropagation(); startCoordPicker(node); });
      const strictEl = el.querySelector('.n-coord-strict');
      if (strictEl) strictEl.addEventListener('change', (e) => { node.coordStrict = e.target.checked; saveGraph(); });

      const zoneTargetEl = el.querySelector('.n-zone-target');
      if (zoneTargetEl) zoneTargetEl.addEventListener('change', (e) => { node.zoneTargetType = e.target.value; saveGraph(); });

      const pickZoneBtn = el.querySelector('.n-pick-zone');
      if (pickZoneBtn) pickZoneBtn.addEventListener('click', (ev) => { ev.stopPropagation(); startZonePicker(node, node.locateBy); });
      const viewTextEl = el.querySelector('.n-view-text');
      if (viewTextEl) viewTextEl.addEventListener('input', (e) => { node.viewText = e.target.value; saveGraph(); });
      const viewModeEl = el.querySelector('.n-view-mode');
      if (viewModeEl) viewModeEl.addEventListener('change', (e) => { node.viewMatchMode = e.target.value; saveGraph(); });

      const selInput = el.querySelector('.n-selector');
      if (selInput) {
        selInput.addEventListener('input', (e) => {
          node.selector = e.target.value.trim();
          let hint = selInput.nextElementSibling;
          if (!hint || !hint.classList.contains('n-resolved-hint')) hint = null;
          const html = resolvedHint(node.selector);
          if (html) {
            if (hint) hint.outerHTML = html;
            else selInput.insertAdjacentHTML('afterend', html);
          } else if (hint) {
            hint.remove();
          }
          saveGraph();
        });
      }

      if (el.querySelector('.n-dict-insert')) {
        el.querySelector('.n-dict-insert').addEventListener('click', (ev) => {
          ev.stopPropagation();
          const selInput2 = el.querySelector('.n-selector');
          if (selInput2) showDictInsertMenu(ev.currentTarget, selInput2);
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
      if (el.querySelector('.n-wait-ms')) el.querySelector('.n-wait-ms').addEventListener('input', (e) => {
        const n = parseInt(e.target.value, 10);
        node.ms = Number.isFinite(n) && n >= 0 ? n : 500;
        saveGraph();
      });
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
        else if (type === 'type') { n.source = 'box1'; n.submitAfterType = true; n.locateBy = 'selector'; n.zoneTargetType = 'input'; }
        else if (type === 'enter') { n.selector = ''; }
        else if (type === 'wait') { n.mode = 'element'; n.ms = 500; }
        else if (type === 'extract') { n.dest = 'box1'; n.mode = 'immediate'; n.waitFor = ''; }
        else if (type === 'variable') { n.source = 'box1'; n.varName = ''; }
        else if (type === 'click') { n.locateBy = 'selector'; n.zoneTargetType = 'any'; }
        graph.nodes.push(n); renderGraph(); saveGraph();
        logStep('info', `➕ Added ${type} block`);
      });
    });

    function wouldCycle(src, tgt) {
      const seen = new Set();
      const stack = [tgt];
      while (stack.length) {
        const n = stack.pop();
        if (n === src) return true;
        if (seen.has(n)) continue;
        seen.add(n);
        graph.edges.filter(e => e.source === n).forEach(e => stack.push(e.target));
      }
      return false;
    }
    function connectNodes(src, sport, tgt) {
      if (!src || !tgt || src === tgt) return;
      if (wouldCycle(src, tgt)) { logStep('warn', '⚠️ Refusing to create a cycle'); return; }
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
      if (document.hidden) logStep('warn', '⚠️ Tab is hidden — background throttling will slow this run');

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
                logStep('info', `⏳ Waiting ${node.ms || 0}ms`);
                await sleep(node.ms || 0);
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
              if (node.locateBy === 'coord') {
                logStep('info', `👆 Clicking coord (${node.coordX}, ${node.coordY})`);
                outcome = await clickAtCoordinate(node);
              } else if (node.locateBy === 'zone') {
                logStep('info', `👆 Clicking in zone (target: ${node.zoneTargetType || 'any'})`);
                outcome = await clickInZone(node);
              } else if (node.locateBy === 'view') {
                logStep('info', `👆 Finding "${(node.viewText||'').slice(0, 30)}" in zone (target: ${node.zoneTargetType || 'any'})`);
                outcome = await clickByView(node);
              } else {
                const r = resolveSelectorForNode(node);
                if (!r.ok) outcome = r;
                else {
                  const el = await waitForStableElement(r.selector, 4000);
                  if (!el) outcome = { ok: false, reason: 'not-found' };
                  else { logStep('info', `👆 Clicking ${r.selector.slice(-30)}`); outcome = await robustClick(el); }
                }
              }
            } else if (node.type === 'type') {
              const txt = node.source === 'box1' ? box1.val
                : node.source === 'box2' ? box2.val
                : node.source === 'variable' ? ((graph.variables && graph.variables[node.varName]) || '')
                : (node.customText || '');
              if (node.locateBy === 'coord') {
                logStep('info', `⌨️ Coord + typing ${txt.length} chars`);
                outcome = await typeAtCoordinate(node, txt, node.submitAfterType !== false);
              } else if (node.locateBy === 'zone') {
                logStep('info', `⌨️ Zone + typing ${txt.length} chars (target: ${node.zoneTargetType || 'any'})`);
                outcome = await typeInZone(node, txt, node.submitAfterType !== false);
              } else if (node.locateBy === 'view') {
                logStep('info', `⌨️ View "${(node.viewText||'').slice(0, 20)}" + typing ${txt.length} chars`);
                outcome = await typeByView(node, txt, node.submitAfterType !== false);
              } else {
                const r = resolveSelectorForNode(node);
                if (!r.ok) outcome = r;
                else {
                  const el = await waitForStableElement(r.selector, 4000);
                  if (!el) outcome = { ok: false, reason: 'not-found' };
                  else {
                    logStep('info', `⌨️ Typing ${txt.length} chars`);
                    const wrote = typeAndSubmitElement(el, txt, node.submitAfterType !== false);
                    outcome = wrote
                      ? { ok: true, reason: `typed-${txt.length}` }
                      : { ok: false, reason: 'not-a-typeable-element' };
                    await sleep(220);
                  }
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
      setTimeout(() => { try { evaluateListeners(); } catch (_) {} }, 100);
    }

    function typeAndSubmitElement(rawEl, textToType, doSubmit = true) {
      const el = (rawEl.tagName === 'INPUT' || rawEl.tagName === 'TEXTAREA') ? rawEl
        : (rawEl.querySelector('input, textarea, [contenteditable="true"]') || rawEl);
      try { el.scrollIntoView({ block: 'nearest', behavior: 'instant' }); } catch (_) {}
      try { el.focus(); el.click(); } catch (_) {}
      let wrote = false;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const prev = el.value;
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, textToType); else el.value = textToType;
        if (el._valueTracker) el._valueTracker.setValue(prev);
        wrote = true;
      } else if (el.isContentEditable) {
        el.innerText = textToType;
        wrote = true;
      }
      if (!wrote) return false;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (doSubmit) {
        const o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        el.dispatchEvent(new KeyboardEvent('keydown', o));
        el.dispatchEvent(new KeyboardEvent('keypress', o));
        el.dispatchEvent(new KeyboardEvent('keyup', o));
      }
      return true;
    }

    // ============ GLOBAL HANDLERS ============
    function onGlobalMouseDown(e) {
      if (!isMacroRunning || !e.isTrusted) return;
      if (mainWidget.contains(e.target) || editorOverlay.contains(e.target)) return;
      const menu = document.getElementById('wms-dict-insert-menu');
      if (menu && menu.contains(e.target)) return;
      cancelMacro = true;
      document.body.style.outline = 'none';
      logStep('warn', '🛑 Halted by manual click');
    }
    function onGlobalKeyDown(e) {
      if (e.key === 'Escape') {
        if (!isMacroRunning) return;
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
    document.addEventListener('keydown', onGlobalKeyDown, true);

    function handleCopyPaste(el, key, obj, target) {
      const sel = window.getSelection().toString().trim();
      if (sel) {
        el.value = sel; obj.val = sel;
        SafeStorage.set({ [key]: sel });
        el.style.background = '#064e3b';
        logStep('success', `📋 Copied "${sel.slice(0, 20)}"`);
        setTimeout(() => { el.style.background = '#13141a'; }, 350);
      } else if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) && obj.val) {
        const ok = typeAndSubmitElement(target, obj.val);
        if (ok) logStep('success', `⌨️ Pasted + Enter`);
        else logStep('warn', `⚠️ Could not paste — target is not editable`);
      }
    }

    function checkPassiveURLTriggers(force = false) {
      const url = window.location.href;
      if (!force && url === lastCheckedUrl) return;
      lastCheckedUrl = url;
      const tn = graph.nodes.find((n) => n.type === 'trigger' && n.subtype === 'url' && n.val && url.includes(n.val));
      if (tn) setTimeout(() => executeGraph(tn.id), 500);
    }

    function isOwnUi(node) {
      if (!node) return false;
      const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      if (!el) return false;
      if (mainWidget.contains(el) || editorOverlay.contains(el) || dictManagerEl.contains(el) || pickerHighlight.contains(el)) return true;
      const askRaw = document.getElementById('wms-ask-raw-overlay');
      if (askRaw && askRaw.contains(el)) return true;
      const ask = document.getElementById('wms-ask-text-overlay');
      if (ask && ask.contains(el)) return true;
      const menu = document.getElementById('wms-dict-insert-menu');
      if (menu && menu.contains(el)) return true;
      return false;
    }

    // FIX Bug 4: content-change based firing
    // FIX Bug 5: isMacroRunning check before log
    function evaluateListeners(mutations) {
      if (Array.isArray(mutations)) {
        const ext = mutations.some((m) => !isOwnUi(m.target));
        if (!ext) return;
      } else if (mutations && isOwnUi(mutations.target)) {
        return;
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
        let match = false;
        if (n.mode === 'text_contains') {
          if (!n.val) match = content.length > 0;
          else match = content.toLowerCase().includes(n.val.toLowerCase());
        } else if (!content) return;
        else if (n.mode === 'number_greater' && n.val) { const x = parseFloat(content.replace(/[^0-9.-]/g, '')); match = !isNaN(x) && x > parseFloat(n.val); }
        else if (n.mode === 'number_less' && n.val) { const x = parseFloat(content.replace(/[^0-9.-]/g, '')); match = !isNaN(x) && x < parseFloat(n.val); }
        else if (n.mode === 'barcode_scan' && content.length >= (parseInt(n.val, 10) || 4)) match = true;
        if (!match) return;
        // FIX Bug 4: only fire when content changed OR first-ever fire
        const state = processedEvents.get(el);
        const contentKey = content.slice(0, 120);
        const isNewContent = !state || contentKey !== state.lastContent;
        const hasCooldownElapsed = !state || now - state.fired > 500;
        if (!isNewContent || !hasCooldownElapsed) return;
        processedEvents.set(el, { fired: now, lastContent: contentKey });
        // FIX Bug 5: don't log if we can't actually run
        if (isMacroRunning) return;
        logStep('info', `👂 Listener fired: "${content.slice(0, 30)}" matched ${n.mode}`);
        executeGraph(n.id);
      });
    }

    const passiveWatcher = new MutationObserver(evaluateListeners);
    passiveWatcher.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('input', evaluateListeners, true);
    document.addEventListener('change', evaluateListeners, true);

    // FIX Bug 3: short-circuit poll when no listeners exist
    listenerPollInterval = setInterval(() => {
      try {
        if (!graph.nodes.some(n => n.type === 'listener')) return;
        evaluateListeners();
      } catch (_) {}
    }, 500);

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
      if (listenerPollInterval) { clearInterval(listenerPollInterval); listenerPollInterval = null; }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) chrome.storage.onChanged.removeListener(onStorageChanged);
      document.removeEventListener('mousedown', onGlobalMouseDown, true);
      document.removeEventListener('keydown', onGlobalKeyDown, true);
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
      const ask = document.getElementById('wms-ask-text-overlay'); if (ask) ask.remove();
      const askRaw = document.getElementById('wms-ask-raw-overlay'); if (askRaw) askRaw.remove();
      const menu = document.getElementById('wms-dict-insert-menu'); if (menu) menu.remove();
      if (saveDebounceTimer) { clearTimeout(saveDebounceTimer); saveDebounceTimer = null; }
    };
  }

  if (document.body) initWMSCircuitStudio();
  else window.addEventListener('DOMContentLoaded', initWMSCircuitStudio, { once: true });
})();