(function () {
  if (typeof window.__wmsCircuitCleanup === 'function') {
    try { window.__wmsCircuitCleanup(); } catch (e) { console.warn('WMS cleanup error:', e); }
  }

  function initWMSCircuitStudio() {
    ['wms-helper-utility-node','wms-node-editor','wms-picker-highlight','wms-circuit-studio-styles','wms-dict-manager','wms-dict-insert-menu','wms-ask-text-overlay','wms-ask-raw-overlay','wms-coord-picker-overlay','wms-coord-picker-label','wms-coord-picker-hint','wms-import-file-input','wms-canvas-context-menu','wms-marquee-box'].forEach((id) => {
      const ex = document.getElementById(id); if (ex) ex.remove();
    });

    const INSTANCE_TAB_ID = 'tab_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
    const memoryStore = {};
    const SafeStorage = {
      get(keys, cb) {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(keys, (r) => cb(r || {}));
          } else {
            const out = {};
            keys.forEach((k) => {
              if (memoryStore[k] !== undefined) out[k] = memoryStore[k];
              else {
                try {
                  const raw = localStorage.getItem('__wms_' + k);
                  if (raw !== null) {
                    out[k] = JSON.parse(raw);
                    memoryStore[k] = out[k];
                  }
                } catch (_) {}
              }
            });
            cb(out);
          }
        } catch (e) { console.warn('Storage read:', e); cb({}); }
      },
      set(obj, cb) {
        try {
          Object.assign(memoryStore, obj);
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set(obj, () => { if (cb) cb(); });
          } else {
            Object.keys(obj).forEach((k) => {
              try { localStorage.setItem('__wms_' + k, JSON.stringify(obj[k])); } catch (_) {}
            });
            if (cb) cb();
          }
        } catch (e) { console.warn('Storage write:', e); if (cb) cb(); }
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
      .wms-widget-file-actions{display:flex;gap:6px;margin-top:6px}
      .btn-widget-sub{flex:1;padding:6px 8px;background:#252834;color:#cbd5e1;border:1px solid #3b4052;border-radius:6px;font-weight:600;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;transition:background 0.15s,border-color 0.15s}
      .btn-widget-sub:hover{background:#323646;border-color:#00d2ff;color:#fff}
      .btn-open-canvas{flex:1;padding:9px;background:linear-gradient(135deg,#6366f1,#4338ca);color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:transform 0.15s,box-shadow 0.15s;box-shadow:0 4px 14px rgba(99,102,241,0.35)}
      .btn-open-canvas:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(99,102,241,0.45)}
      .btn-quick-run{padding:9px 12px;background:linear-gradient(135deg,#059669,#10b981);color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px}
      .btn-quick-run:hover{filter:brightness(1.1)}
      #wms-status-toast{margin-top:8px;padding:6px 8px;border-radius:6px;font-size:11px;font-weight:600;background:#13141a;border:1px solid #2c303c;color:#94a3b8;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #wms-node-editor{display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0d0e12;z-index:2147483645;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none;color:#e2e8f0}
      .node-toolbar{position:absolute;top:0;left:0;width:100%;height:54px;background:#15171e;border-bottom:1px solid #272a36;display:flex;align-items:center;padding:0 14px;gap:6px;box-sizing:border-box;z-index:1000;box-shadow:0 4px 18px rgba(0,0,0,0.4);overflow-x:auto;overflow-y:hidden}
      .node-toolbar::-webkit-scrollbar{height:6px}
      .node-toolbar::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
      .toolbar-label{font-size:11px;font-weight:700;color:#717d96;text-transform:uppercase;margin-right:2px;white-space:nowrap}
      .node-btn{background:#252834;color:#f1f5f9;border:1px solid #3b4052;border-radius:7px;padding:6px 9px;font-weight:600;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all 0.15s ease;white-space:nowrap}
      .node-btn:hover{background:#323646;border-color:#4e556d;transform:translateY(-1px)}
      .btn-arrange{background:#4f46e5;border-color:#6366f1;color:#fff}
      .btn-arrange:hover{background:#6366f1;border-color:#818cf8}
      .btn-run-studio{background:#2563eb;border-color:#3b82f6}
      .btn-run-studio:hover{background:#3b82f6}
      .btn-save{background:#059669;border-color:#10b981}
      .btn-save:hover{background:#10b981}
      .btn-file-io{background:#0f766e;border-color:#14b8a6}
      .btn-file-io:hover{background:#14b8a6;color:#fff}
      .btn-log-toggle{background:#0f172a;border-color:#334155}
      .btn-log-toggle:hover{background:#1e293b}
      .btn-dict{background:#365314;border-color:#65a30d}
      .btn-dict:hover{background:#65a30d;color:#fff}
      .btn-close{background:#dc2626;border-color:#ef4444;margin-left:auto}
      .btn-close:hover{background:#ef4444}
      .canvas-tab-bar{position:absolute;top:54px;left:0;width:100%;height:38px;background:#11131a;border-bottom:1px solid #272a36;display:flex;align-items:center;padding:0 12px;gap:6px;box-sizing:border-box;z-index:999;overflow-x:auto;overflow-y:hidden}
      .canvas-tab-bar::-webkit-scrollbar{height:4px}
      .canvas-tab-bar::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
      .canvas-tab-item{background:#1c1f2b;color:#94a3b8;border:1px solid #2d3244;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:all 0.15s}
      .canvas-tab-item:hover{background:#25293a;color:#e2e8f0;border-color:#3b4259}
      .canvas-tab-item.active{background:linear-gradient(135deg,#0284c7,#2563eb);color:#fff;border-color:#38bdf8;box-shadow:0 2px 10px rgba(56,189,248,0.28)}
      .canvas-tab-count{font-size:9px;opacity:0.8;background:rgba(0,0,0,0.28);padding:1px 5px;border-radius:4px}
      .canvas-tab-rename,.canvas-tab-del{opacity:0.7;font-size:10px;padding:0 2px;cursor:pointer;border-radius:3px}
      .canvas-tab-rename:hover{opacity:1;color:#fde047}
      .canvas-tab-del:hover{opacity:1;color:#fca5a5}
      .canvas-tab-add{background:#1e293b;color:#38bdf8;border:1px dashed #38bdf8;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all 0.15s}
      .canvas-tab-add:hover{background:#0284c7;color:#fff;border-style:solid}
      .canvas-tab-bar-right{margin-left:auto;display:flex;align-items:center;gap:5px}
      .canvas-tab-action{background:#252834;color:#cbd5e1;border:1px solid #3b4052;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:600;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;transition:all 0.12s}
      .canvas-tab-action:hover{background:#323646;color:#fff;border-color:#00d2ff}
      .canvas-tab-action.has-clip{border-color:#10b981;color:#34d399}
      .node-canvas-wrapper{position:absolute;top:92px;left:0;right:0;bottom:32px;overflow:auto;background:#0a0b0e;cursor:grab;transition:bottom 0.2s ease}
      #wms-node-editor.log-open .node-canvas-wrapper{bottom:200px}
      @media (max-height:640px){#wms-node-editor.log-open .node-canvas-wrapper{bottom:140px}}
      .node-canvas-wrapper.is-panning{cursor:grabbing}
      .node-canvas{position:relative;width:4000px;height:4000px;background-size:32px 32px;background-image:radial-gradient(circle,#252a38 1.3px,transparent 1.3px),linear-gradient(to right,rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.018) 1px,transparent 1px)}
      #wire-layer{position:absolute;top:0;left:0;width:4000px;height:4000px;pointer-events:none;z-index:2}
      .wire{fill:none;stroke:#64748b;stroke-width:3.5;stroke-linecap:round;transition:stroke 0.15s,stroke-width 0.15s}
      .wire:hover{stroke:#ef4444;stroke-width:6}
      .wire-active{stroke:#38bdf8;stroke-dasharray:8 6;pointer-events:none!important;animation:wireFlow 0.5s linear infinite}
      .wire-true,.wire-loop{stroke:#10b981}
      .wire-false,.wire-done{stroke:#f43f5e}
      @keyframes wireFlow{to{stroke-dashoffset:-14}}
      .wms-node{position:absolute;width:254px;background:#161820;border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,0.65),0 0 0 1px #2b3040;display:flex;flex-direction:column;z-index:5;cursor:grab;transition:left 0.18s ease,top 0.18s ease,box-shadow 0.15s}
      .wms-node.is-dragging-node{transition:none!important}
      .wms-node:active{cursor:grabbing}
      .wms-node.is-selected{box-shadow:0 0 0 2px #00d2ff,0 12px 32px rgba(0,210,255,0.28)!important;z-index:12}
      .wms-node.is-executing{box-shadow:0 0 25px rgba(56,189,248,0.85),0 0 0 2px #38bdf8!important}
      .wms-node.is-success{animation:flashSuccess 0.7s ease}
      .wms-node.is-failure{animation:flashFailure 0.7s ease}
      @keyframes flashSuccess{0%,100%{box-shadow:0 10px 28px rgba(0,0,0,0.65),0 0 0 1px #2b3040}50%{box-shadow:0 0 25px rgba(16,185,129,1),0 0 0 2px #10b981}}
      @keyframes flashFailure{0%,100%{box-shadow:0 10px 28px rgba(0,0,0,0.65),0 0 0 1px #2b3040}50%{box-shadow:0 0 25px rgba(239,68,68,1),0 0 0 2px #ef4444}}
      .wms-node-header{padding:9px 12px;border-radius:9px 9px 0 0;font-weight:700;font-size:11px;cursor:grab;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.08);text-transform:uppercase;letter-spacing:0.5px}
      .wms-node-header:active{cursor:grabbing}
      .node-head-actions{display:flex;align-items:center;gap:6px}
      .copy-node,.del-node{cursor:pointer;opacity:0.8;padding:0 3px;font-size:12px;border-radius:4px;transition:opacity 0.12s,background 0.12s}
      .copy-node:hover{opacity:1;background:rgba(255,255,255,0.18)}
      .del-node:hover{opacity:1;background:rgba(239,68,68,0.35)}
      .wms-node-body{padding:10px 14px;display:flex;flex-direction:column;gap:7px}
      .node-trigger .wms-node-header{background:linear-gradient(90deg,#b45309,#d97706);color:#fff}
      .node-listener .wms-node-header{background:linear-gradient(90deg,#7c3aed,#9333ea);color:#fff}
      .node-if .wms-node-header{background:linear-gradient(90deg,#be123c,#e11d48);color:#fff}
      .node-for .wms-node-header{background:linear-gradient(90deg,#4f46e5,#6366f1);color:#fff}
      .node-while .wms-node-header{background:linear-gradient(90deg,#6d28d9,#8b5cf6);color:#fff}
      .node-click .wms-node-header{background:linear-gradient(90deg,#1d4ed8,#2563eb);color:#fff}
      .node-tabs .wms-node-header{background:linear-gradient(90deg,#0369a1,#0ea5e9);color:#fff}
      .node-type .wms-node-header{background:linear-gradient(90deg,#047857,#059669);color:#fff}
      .node-select .wms-node-header{background:linear-gradient(90deg,#0284c7,#38bdf8);color:#fff}
      .node-scroll .wms-node-header{background:linear-gradient(90deg,#475569,#64748b);color:#fff}
      .node-wait .wms-node-header{background:linear-gradient(90deg,#c2410c,#ea580c);color:#fff}
      .node-extract .wms-node-header{background:linear-gradient(90deg,#0e7490,#0891b2);color:#fff}
      .node-enter .wms-node-header{background:linear-gradient(90deg,#9d174d,#db2777);color:#fff}
      .node-variable .wms-node-header{background:linear-gradient(90deg,#365314,#65a30d);color:#fff}
      .node-savefile .wms-node-header{background:linear-gradient(90deg,#0f766e,#14b8a6);color:#fff}
      .node-input,.node-select{background:#0f1015;color:#f1f5f9;border:1px solid #2b2f3d;border-radius:6px;padding:6px 8px;font-size:11px;width:100%;box-sizing:border-box;outline:none;cursor:auto}
      .node-input:focus,.node-select:focus{border-color:#38bdf8}
      .node-btn-small{background:#252834;color:#e2e8f0;border:1px solid #3b4053;border-radius:6px;padding:6px;font-size:11px;cursor:pointer;text-align:center;font-weight:600;transition:background 0.15s}
      .node-btn-small:hover{background:#323748;color:#fff;border-color:#38bdf8}
      .tab-num-grid{display:grid;grid-template-columns:repeat(9,1fr);gap:3px;margin:2px 0}
      .tab-num-pill{background:#1e2230;color:#94a3b8;border:1px solid #2f3548;border-radius:5px;padding:4px 0;font-size:10px;font-weight:700;text-align:center;cursor:pointer;transition:all 0.12s}
      .tab-num-pill:hover{background:#2d3448;color:#fff;border-color:#38bdf8}
      .tab-num-pill.active{background:#0284c7;color:#fff;border-color:#38bdf8;box-shadow:0 0 8px rgba(56,189,248,0.4)}
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
      .port-true,.port-loop{right:-10px;top:48px;background:#10b981}
      .port-false,.port-done{right:-10px;top:84px;background:#ef4444}
      .port-tag{position:absolute;right:12px;font-size:9px;font-weight:800;pointer-events:none;text-transform:uppercase}
      .tag-true,.tag-loop{top:50px;color:#10b981}
      .tag-false,.tag-done{top:86px;color:#ef4444}
      .n-submit-row{display:flex;align-items:center;gap:6px;font-size:10px;color:#cbd5e1;padding:2px 4px;cursor:pointer;user-select:none;border-radius:4px}
      .n-submit-row:hover{color:#fff;background:#1c1f28}
      .n-submit-row input{accent-color:#10b981;cursor:pointer}
      #wms-canvas-context-menu{position:fixed;background:#181922;border:1px solid #33394b;border-radius:9px;padding:5px;z-index:2147483647;box-shadow:0 14px 34px rgba(0,0,0,0.75);min-width:210px;display:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none}
      .ctx-item{padding:7px 10px;font-size:11px;font-weight:600;color:#e2e8f0;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .ctx-item:hover{background:#2563eb;color:#fff}
      .ctx-item.ctx-danger:hover{background:#dc2626;color:#fff}
      .ctx-item.ctx-disabled{opacity:0.4;pointer-events:none}
      .ctx-kbd{font-size:10px;color:#94a3b8;font-family:monospace}
      .ctx-item:hover .ctx-kbd{color:#e2e8f0}
      .ctx-sep{height:1px;background:#272a36;margin:4px 2px}
      #wms-marquee-box{position:absolute;border:1.5px dashed #00d2ff;background:rgba(0,210,255,0.12);pointer-events:none;z-index:30;display:none}
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

    // Hidden file input for loading circuits from JSON file
    const importFileInput = document.createElement('input');
    importFileInput.id = 'wms-import-file-input';
    importFileInput.type = 'file';
    importFileInput.accept = '.json,application/json';
    importFileInput.style.display = 'none';
    document.body.appendChild(importFileInput);

    // Custom Right-Click Context Menu for Canvas Copy/Paste
    const ctxMenuEl = document.createElement('div');
    ctxMenuEl.id = 'wms-canvas-context-menu';
    document.body.appendChild(ctxMenuEl);

    // ============ LOG ============
    const logEntries = [];
    const MAX_LOG_ENTRIES = 500;
    let logBodyEl = null;
    let logCountEl = null;
    const fileAppendBuffers = {};

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

    function sanitizeFilename(name, fallback = 'wms_export.txt') {
      const cleaned = String(name || '')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .trim();
      return cleaned || fallback;
    }

    function triggerDownloadFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
      try {
        const safeName = sanitizeFilename(filename, 'wms_export.txt');
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 1500);
        return true;
      } catch (err) {
        console.warn('File download error:', err);
        return false;
      }
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
        <div class="wms-widget-file-actions">
          <button id="widget-save-file-btn" class="btn-widget-sub" title="Export circuit & boxes to JSON file">📥 Save to File</button>
          <button id="widget-load-file-btn" class="btn-widget-sub" title="Import circuit from JSON file">📤 Load File</button>
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
        <span class="toolbar-label">Add:</span>
        <button class="node-btn" id="add-trigger">⚡ Trigger</button>
        <button class="node-btn" id="add-listener">👂 Listener</button>
        <button class="node-btn" id="add-if">🔀 If / Else</button>
        <button class="node-btn" id="add-for">🔁 For Loop</button>
        <button class="node-btn" id="add-while">🔄 While Loop</button>
        <button class="node-btn" id="add-click">👆 Click</button>
        <button class="node-btn" id="add-tabs" title="Switch existing browser tabs (Ctrl+1, Ctrl+2, Next/Prev Tab) or page tabs">🗂️ Tabs</button>
        <button class="node-btn" id="add-type">⌨️ Type</button>
        <button class="node-btn" id="add-select">🔽 Select</button>
        <button class="node-btn" id="add-scroll">📜 Scroll</button>
        <button class="node-btn" id="add-enter">⏎ Key</button>
        <button class="node-btn" id="add-wait">⏳ Wait</button>
        <button class="node-btn" id="add-extract">📋 Extract</button>
        <button class="node-btn" id="add-variable">📦 Variable</button>
        <button class="node-btn" id="add-savefile">💾 Save File</button>
        <button class="node-btn btn-arrange" id="arrange-nodes-btn" title="Auto-arrange & fix messed-up blocks in the active canvas">✨ Arrange</button>
        <button class="node-btn btn-dict" id="toggle-dict-btn">📚 Dict</button>
        <button class="node-btn btn-log-toggle" id="toggle-log-btn">📋 Log</button>
        <button class="node-btn btn-run-studio" id="studio-run-btn">▶ Test Run</button>
        <button class="node-btn btn-save" id="save-graph-btn" title="Save circuit to browser storage">💾 Save</button>
        <button class="node-btn btn-file-io" id="export-file-btn" title="Download circuit as JSON file">📥 Save File</button>
        <button class="node-btn btn-file-io" id="import-file-btn" title="Load circuit from JSON file">📤 Load File</button>
        <button class="node-btn btn-close" id="close-editor-btn">✖ Close</button>
      </div>
      <div class="canvas-tab-bar" id="wms-canvas-tab-bar"></div>
      <div class="node-canvas-wrapper" id="canvas-wrapper">
        <div class="node-canvas" id="node-canvas">
          <svg id="wire-layer" width="4000" height="4000"></svg>
          <div id="wms-marquee-box"></div>
        </div>
      </div>
      <div id="wms-log-panel">
        <div id="wms-log-header">
          <span class="log-title">📋 Activity Log <span class="log-count" id="wms-log-count">(0)</span></span>
          <button class="log-btn" id="wms-log-save-file">Save Log</button>
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
          <span class="dict-hint">Use <code>{{name}}</code> in any selector, custom text, or filename</span>
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
    let graph = {
      nodes: [],
      edges: [],
      variables: {},
      dictionary: [],
      canvases: [{ id: 'canvas_main', name: 'Canvas 1' }],
      activeCanvasId: 'canvas_main'
    };
    let cancelMacro = false;
    let isMacroRunning = false;
    let isPickingElement = false;
    let selectedPort = null;
    let activeWire = null;
    let lastCheckedUrl = '';
    let listenerPollInterval = null;
    const processedEvents = new WeakMap();
    const handledHandoffIds = new Set();

    // Selection & Copy-Paste Clipboard State
    const selectedNodeIds = new Set();
    let canvasClipboard = null; // { nodes: [...], edges: [...], pasteCount: 0 }
    let lastCanvasMousePos = { x: 220, y: 140 };

    const canvas = document.getElementById('node-canvas');
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const canvasTabBarEl = document.getElementById('wms-canvas-tab-bar');
    const wireLayer = document.getElementById('wire-layer');
    const marqueeEl = document.getElementById('wms-marquee-box');
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

    // ============ MULTI-CANVAS & SELECTION / COPY / PASTE ============
    function generateId() { return 'node_' + Math.random().toString(36).substring(2, 9); }
    function generateDictId() { return 'd_' + Math.random().toString(36).substring(2, 8); }
    function generateCanvasId() { return 'canvas_' + Math.random().toString(36).substring(2, 8); }

    function ensureCanvases() {
      if (!Array.isArray(graph.canvases) || graph.canvases.length === 0) {
        graph.canvases = [{ id: 'canvas_main', name: 'Canvas 1' }];
      }
      if (!graph.activeCanvasId || !graph.canvases.some(c => c.id === graph.activeCanvasId)) {
        graph.activeCanvasId = graph.canvases[0].id;
      }
      const validIds = new Set(graph.canvases.map(c => c.id));
      const fallbackId = graph.canvases[0].id;
      (graph.nodes || []).forEach(n => {
        if (!n.canvasId || !validIds.has(n.canvasId)) n.canvasId = fallbackId;
      });
    }

    function getActiveCanvasNodes() {
      ensureCanvases();
      return (graph.nodes || []).filter(n => n.canvasId === graph.activeCanvasId);
    }

    function getActiveCanvasEdges() {
      const activeNodeIds = new Set(getActiveCanvasNodes().map(n => n.id));
      return (graph.edges || []).filter(e => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));
    }

    function updateNodeSelectionVisuals() {
      canvas.querySelectorAll('.wms-node').forEach((el) => {
        el.classList.toggle('is-selected', selectedNodeIds.has(el.id));
      });
      const copyBtn = document.getElementById('wms-btn-copy-nodes');
      if (copyBtn) {
        copyBtn.textContent = selectedNodeIds.size > 0 ? `📋 Copy (${selectedNodeIds.size})` : '📋 Copy';
      }
      const pasteBtn = document.getElementById('wms-btn-paste-nodes');
      if (pasteBtn) {
        const count = canvasClipboard && Array.isArray(canvasClipboard.nodes) ? canvasClipboard.nodes.length : 0;
        pasteBtn.textContent = count > 0 ? `📥 Paste (${count})` : '📥 Paste';
        pasteBtn.classList.toggle('has-clip', count > 0);
      }
    }

    function selectSingleNode(nodeId, additive = false) {
      if (!additive) selectedNodeIds.clear();
      if (nodeId) {
        if (additive && selectedNodeIds.has(nodeId)) selectedNodeIds.delete(nodeId);
        else selectedNodeIds.add(nodeId);
      }
      updateNodeSelectionVisuals();
    }

    function selectAllActiveNodes() {
      selectedNodeIds.clear();
      getActiveCanvasNodes().forEach(n => selectedNodeIds.add(n.id));
      updateNodeSelectionVisuals();
      logStep('info', `🔲 Selected ${selectedNodeIds.size} block(s)`);
    }

    function copySelectedNodesToClipboard(specificNodeIds = null) {
      const targetIds = specificNodeIds
        ? new Set(specificNodeIds)
        : (selectedNodeIds.size > 0 ? new Set(selectedNodeIds) : new Set(getActiveCanvasNodes().map(n => n.id)));
      const nodesToCopy = (graph.nodes || []).filter(n => targetIds.has(n.id));
      if (nodesToCopy.length === 0) {
        logStep('warn', '⚠️ Select at least one block to copy');
        return false;
      }
      const edgesToCopy = (graph.edges || []).filter(e => targetIds.has(e.source) && targetIds.has(e.target));
      canvasClipboard = {
        nodes: JSON.parse(JSON.stringify(nodesToCopy)),
        edges: JSON.parse(JSON.stringify(edgesToCopy)),
        pasteCount: 0
      };
      SafeStorage.set({ wmsCanvasClipboard: canvasClipboard });
      updateNodeSelectionVisuals();
      logStep('success', `📋 Copied ${nodesToCopy.length} block${nodesToCopy.length === 1 ? '' : 's'} (${edgesToCopy.length} wire${edgesToCopy.length === 1 ? '' : 's'})`);
      return true;
    }

    function pasteNodesFromClipboard(atPosition = null, targetCanvasId = null) {
      if (!canvasClipboard || !Array.isArray(canvasClipboard.nodes) || canvasClipboard.nodes.length === 0) {
        logStep('warn', '⚠️ Canvas clipboard is empty — copy a block first (Ctrl+C)');
        return [];
      }
      ensureCanvases();
      const destCanvasId = targetCanvasId || graph.activeCanvasId;
      canvasClipboard.pasteCount = (canvasClipboard.pasteCount || 0) + 1;
      const offsetStep = 34 * canvasClipboard.pasteCount;

      const minX = Math.min(...canvasClipboard.nodes.map(n => n.x || 0));
      const minY = Math.min(...canvasClipboard.nodes.map(n => n.y || 0));

      const idMap = new Map();
      const newNodes = [];

      canvasClipboard.nodes.forEach((orig) => {
        const clone = JSON.parse(JSON.stringify(orig));
        const newId = generateId();
        idMap.set(orig.id, newId);
        clone.id = newId;
        clone.canvasId = destCanvasId;
        if (atPosition && typeof atPosition.x === 'number' && typeof atPosition.y === 'number') {
          clone.x = Math.max(16, Math.round(atPosition.x + ((orig.x || 0) - minX)));
          clone.y = Math.max(16, Math.round(atPosition.y + ((orig.y || 0) - minY)));
        } else {
          clone.x = Math.max(16, (orig.x || 100) + offsetStep);
          clone.y = Math.max(16, (orig.y || 100) + offsetStep);
        }
        graph.nodes.push(clone);
        newNodes.push(clone);
      });

      (canvasClipboard.edges || []).forEach((origEdge) => {
        const newSrc = idMap.get(origEdge.source);
        const newTgt = idMap.get(origEdge.target);
        if (newSrc && newTgt) {
          graph.edges.push({
            id: generateId(),
            source: newSrc,
            sourcePort: origEdge.sourcePort,
            target: newTgt,
            targetPort: origEdge.targetPort || 'in'
          });
        }
      });

      selectedNodeIds.clear();
      newNodes.forEach(n => selectedNodeIds.add(n.id));
      saveGraph();
      renderGraph();
      logStep('success', `📥 Pasted ${newNodes.length} block${newNodes.length === 1 ? '' : 's'} onto "${(graph.canvases.find(c => c.id === destCanvasId) || {}).name || 'Canvas'}"`);
      return newNodes;
    }

    function duplicateSelectedNodes(specificNodeIds = null) {
      if (copySelectedNodesToClipboard(specificNodeIds)) {
        pasteNodesFromClipboard(null, graph.activeCanvasId);
      }
    }

    function deleteSelectedNodes() {
      if (selectedNodeIds.size === 0) {
        logStep('warn', '⚠️ No blocks selected to delete');
        return;
      }
      const count = selectedNodeIds.size;
      graph.nodes = (graph.nodes || []).filter(n => !selectedNodeIds.has(n.id));
      graph.edges = (graph.edges || []).filter(e => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target));
      selectedNodeIds.clear();
      saveGraph();
      renderGraph();
      logStep('warn', `🗑️ Deleted ${count} selected block${count === 1 ? '' : 's'}`);
    }

    function switchCanvasTab(canvasId) {
      ensureCanvases();
      if (!graph.canvases.some(c => c.id === canvasId)) return false;
      graph.activeCanvasId = canvasId;
      selectedPort = null;
      activeWire = null;
      selectedNodeIds.clear();
      saveGraph();
      renderGraph();
      return true;
    }

    function addNewCanvasTab(customName) {
      ensureCanvases();
      const idx = graph.canvases.length + 1;
      const newId = generateCanvasId();
      const name = (customName && String(customName).trim()) ? String(customName).trim() : `Canvas ${idx}`;
      graph.canvases.push({ id: newId, name });
      graph.activeCanvasId = newId;
      selectedNodeIds.clear();
      graph.nodes.push({
        id: generateId(),
        type: 'trigger',
        subtype: 'hotkey',
        val: `ALT+${Math.min(9, idx)}`,
        x: 80,
        y: 90,
        canvasId: newId
      });
      saveGraph();
      renderGraph();
      canvasWrapper.scrollLeft = 0;
      canvasWrapper.scrollTop = 0;
      logStep('success', `🗂️ Created "${name}"`);
      return newId;
    }

    async function renameCanvasTab(canvasId) {
      ensureCanvases();
      const c = graph.canvases.find(x => x.id === canvasId);
      if (!c) return;
      const newName = await askTextRaw('Rename Canvas Tab:', c.name, 'e.g. Inbound Flow, Outbound Tab');
      if (newName && newName.trim()) {
        c.name = newName.trim();
        saveGraph();
        renderGraph();
        logStep('success', `✏️ Renamed canvas to "${c.name}"`);
      }
    }

    function deleteCanvasTab(canvasId) {
      ensureCanvases();
      if (graph.canvases.length <= 1) {
        logStep('warn', '⚠️ Cannot delete the last remaining canvas');
        return;
      }
      const c = graph.canvases.find(x => x.id === canvasId);
      if (!c) return;
      const nodeCount = (graph.nodes || []).filter(n => n.canvasId === canvasId).length;
      if (nodeCount > 0 && !confirm(`Delete "${c.name}" and its ${nodeCount} block(s)?`)) return;
      const removedNodeIds = new Set((graph.nodes || []).filter(n => n.canvasId === canvasId).map(n => n.id));
      graph.nodes = (graph.nodes || []).filter(n => n.canvasId !== canvasId);
      graph.edges = (graph.edges || []).filter(e => !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target));
      graph.canvases = graph.canvases.filter(x => x.id !== canvasId);
      if (graph.activeCanvasId === canvasId) {
        graph.activeCanvasId = graph.canvases[0].id;
      }
      selectedNodeIds.clear();
      saveGraph();
      renderGraph();
      logStep('warn', `🗑️ Deleted canvas "${c.name}"`);
    }

    function renderCanvasTabs() {
      if (!canvasTabBarEl) return;
      ensureCanvases();
      canvasTabBarEl.innerHTML = '';

      const label = document.createElement('span');
      label.className = 'toolbar-label';
      label.textContent = 'Canvases:';
      canvasTabBarEl.appendChild(label);

      graph.canvases.forEach((c) => {
        const count = (graph.nodes || []).filter(n => n.canvasId === c.id).length;
        const tab = document.createElement('div');
        tab.className = 'canvas-tab-item' + (c.id === graph.activeCanvasId ? ' active' : '');
        tab.title = 'Click to switch canvas • Double-click to rename';
        tab.innerHTML = `
          <span class="canvas-tab-title">${escapeAttr(c.name)}</span>
          <span class="canvas-tab-count">${count}</span>
          <span class="canvas-tab-rename" title="Rename canvas">✎</span>
          ${graph.canvases.length > 1 ? `<span class="canvas-tab-del" title="Delete canvas">✕</span>` : ''}
        `;
        tab.addEventListener('click', (e) => {
          if (e.target.closest('.canvas-tab-rename')) {
            e.stopPropagation();
            renameCanvasTab(c.id);
            return;
          }
          if (e.target.closest('.canvas-tab-del')) {
            e.stopPropagation();
            deleteCanvasTab(c.id);
            return;
          }
          switchCanvasTab(c.id);
        });
        tab.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          renameCanvasTab(c.id);
        });
        canvasTabBarEl.appendChild(tab);
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'canvas-tab-add';
      addBtn.innerHTML = '+ New Canvas';
      addBtn.title = 'Add a new workspace canvas tab';
      addBtn.addEventListener('click', () => addNewCanvasTab());
      canvasTabBarEl.appendChild(addBtn);

      const rightWrap = document.createElement('div');
      rightWrap.className = 'canvas-tab-bar-right';

      const copyBtn = document.createElement('button');
      copyBtn.id = 'wms-btn-copy-nodes';
      copyBtn.className = 'canvas-tab-action';
      copyBtn.innerHTML = selectedNodeIds.size > 0 ? `📋 Copy (${selectedNodeIds.size})` : '📋 Copy';
      copyBtn.title = 'Copy selected block(s) (Ctrl+C) — or copies all blocks in canvas if none selected';
      copyBtn.addEventListener('click', () => copySelectedNodesToClipboard());
      rightWrap.appendChild(copyBtn);

      const clipCount = canvasClipboard && Array.isArray(canvasClipboard.nodes) ? canvasClipboard.nodes.length : 0;
      const pasteBtn = document.createElement('button');
      pasteBtn.id = 'wms-btn-paste-nodes';
      pasteBtn.className = 'canvas-tab-action' + (clipCount > 0 ? ' has-clip' : '');
      pasteBtn.innerHTML = clipCount > 0 ? `📥 Paste (${clipCount})` : '📥 Paste';
      pasteBtn.title = 'Paste copied block(s) onto active canvas (Ctrl+V)';
      pasteBtn.addEventListener('click', () => pasteNodesFromClipboard());
      rightWrap.appendChild(pasteBtn);

      const dupBtn = document.createElement('button');
      dupBtn.className = 'canvas-tab-action';
      dupBtn.innerHTML = '📑 Duplicate';
      dupBtn.title = 'Duplicate selected block(s) immediately (Ctrl+D)';
      dupBtn.addEventListener('click', () => duplicateSelectedNodes());
      rightWrap.appendChild(dupBtn);

      const arrangeBtn = document.createElement('button');
      arrangeBtn.className = 'canvas-tab-action';
      arrangeBtn.innerHTML = '✨ Arrange';
      arrangeBtn.title = 'Automatically untangle and align all blocks in this canvas';
      arrangeBtn.addEventListener('click', () => arrangeNodes(false));
      rightWrap.appendChild(arrangeBtn);

      const centerBtn = document.createElement('button');
      centerBtn.className = 'canvas-tab-action';
      centerBtn.innerHTML = '🎯 Fit View';
      centerBtn.title = 'Scroll canvas to the first block';
      centerBtn.addEventListener('click', () => {
        const nodes = getActiveCanvasNodes();
        if (nodes.length === 0) {
          canvasWrapper.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
          return;
        }
        const minX = Math.max(0, Math.min(...nodes.map(n => n.x || 0)) - 60);
        const minY = Math.max(0, Math.min(...nodes.map(n => n.y || 0)) - 60);
        canvasWrapper.scrollTo({ left: minX, top: minY, behavior: 'smooth' });
      });
      rightWrap.appendChild(centerBtn);

      canvasTabBarEl.appendChild(rightWrap);
    }

    // ============ RIGHT-CLICK CONTEXT MENU ON CANVAS ============
    function hideContextMenu() {
      ctxMenuEl.style.display = 'none';
    }
    function showCanvasContextMenu(clientX, clientY, targetNodeId = null) {
      if (targetNodeId && !selectedNodeIds.has(targetNodeId)) {
        selectSingleNode(targetNodeId, false);
      }
      const cr = canvas.getBoundingClientRect();
      const canvasX = Math.max(20, clientX - cr.left);
      const canvasY = Math.max(20, clientY - cr.top);
      lastCanvasMousePos = { x: canvasX, y: canvasY };

      const selCount = selectedNodeIds.size;
      const clipCount = canvasClipboard && Array.isArray(canvasClipboard.nodes) ? canvasClipboard.nodes.length : 0;

      ctxMenuEl.innerHTML = `
        <div class="ctx-item ${selCount === 0 && getActiveCanvasNodes().length === 0 ? 'ctx-disabled' : ''}" data-act="copy">
          <span>📋 Copy ${selCount > 0 ? `Selected (${selCount})` : 'All Canvas Blocks'}</span>
          <span class="ctx-kbd">Ctrl+C</span>
        </div>
        <div class="ctx-item ${clipCount === 0 ? 'ctx-disabled' : ''}" data-act="paste-here">
          <span>📥 Paste Here ${clipCount > 0 ? `(${clipCount})` : ''}</span>
          <span class="ctx-kbd">Ctrl+V</span>
        </div>
        <div class="ctx-item ${selCount === 0 ? 'ctx-disabled' : ''}" data-act="duplicate">
          <span>📑 Duplicate Selected</span>
          <span class="ctx-kbd">Ctrl+D</span>
        </div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" data-act="select-all">
          <span>🔲 Select All Blocks</span>
          <span class="ctx-kbd">Ctrl+A</span>
        </div>
        <div class="ctx-item" data-act="arrange">
          <span>✨ Auto-Arrange Blocks</span>
          <span class="ctx-kbd"></span>
        </div>
        <div class="ctx-item" data-act="new-canvas-paste">
          <span>🗂️ Paste into New Canvas Tab</span>
          <span class="ctx-kbd"></span>
        </div>
        <div class="ctx-sep"></div>
        <div class="ctx-item ctx-danger ${selCount === 0 ? 'ctx-disabled' : ''}" data-act="delete">
          <span>🗑️ Delete Selected (${selCount})</span>
          <span class="ctx-kbd">Del</span>
        </div>
      `;

      ctxMenuEl.style.display = 'block';
      ctxMenuEl.style.left = Math.min(clientX, window.innerWidth - 230) + 'px';
      ctxMenuEl.style.top = Math.min(clientY, window.innerHeight - 260) + 'px';

      ctxMenuEl.querySelectorAll('.ctx-item').forEach((item) => {
        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const act = item.getAttribute('data-act');
          hideContextMenu();
          if (act === 'copy') copySelectedNodesToClipboard();
          else if (act === 'paste-here') pasteNodesFromClipboard({ x: canvasX, y: canvasY });
          else if (act === 'duplicate') duplicateSelectedNodes();
          else if (act === 'select-all') selectAllActiveNodes();
          else if (act === 'arrange') arrangeNodes(false);
          else if (act === 'new-canvas-paste') {
            if (selCount > 0) copySelectedNodesToClipboard();
            if (canvasClipboard && canvasClipboard.nodes && canvasClipboard.nodes.length > 0) {
              const newCid = addNewCanvasTab();
              // Remove starter trigger if pasting a full set
              graph.nodes = graph.nodes.filter(n => n.canvasId !== newCid);
              pasteNodesFromClipboard({ x: 80, y: 90 }, newCid);
            }
          }
          else if (act === 'delete') deleteSelectedNodes();
        });
      });
    }

    document.addEventListener('mousedown', (e) => {
      if (ctxMenuEl.style.display === 'block' && !ctxMenuEl.contains(e.target)) {
        hideContextMenu();
      }
    }, true);

    canvas.addEventListener('contextmenu', (e) => {
      if (editorOverlay.style.display !== 'block') return;
      e.preventDefault();
      const nodeEl = e.target.closest('.wms-node');
      showCanvasContextMenu(e.clientX, e.clientY, nodeEl ? nodeEl.id : null);
    });

    canvas.addEventListener('mousemove', (e) => {
      const cr = canvas.getBoundingClientRect();
      lastCanvasMousePos = {
        x: Math.max(20, e.clientX - cr.left),
        y: Math.max(20, e.clientY - cr.top)
      };
    });

    // ============ AUTO-ARRANGE / UNTANGLE NODES ============
    function arrangeNodes(allCanvases = false) {
      ensureCanvases();
      const targetCanvasIds = allCanvases
        ? graph.canvases.map(c => c.id)
        : [graph.activeCanvasId];

      let totalArranged = 0;

      targetCanvasIds.forEach((cid) => {
        const cNodes = (graph.nodes || []).filter(n => n.canvasId === cid);
        if (cNodes.length === 0) return;
        const nodeMap = new Map(cNodes.map(n => [n.id, n]));
        const cEdges = (graph.edges || []).filter(e => nodeMap.has(e.source) && nodeMap.has(e.target));

        const inDegree = new Map();
        const outEdges = new Map();
        cNodes.forEach(n => {
          inDegree.set(n.id, 0);
          outEdges.set(n.id, []);
        });
        cEdges.forEach(e => {
          inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
          outEdges.get(e.source).push(e);
        });

        const portOrder = { out: 0, true: 1, loop: 1, false: 2, done: 2 };
        outEdges.forEach((list) => {
          list.sort((a, b) => (portOrder[a.sourcePort] ?? 9) - (portOrder[b.sourcePort] ?? 9));
        });

        const roots = cNodes.filter(n => n.type === 'trigger' || n.type === 'listener' || (inDegree.get(n.id) || 0) === 0);
        roots.sort((a, b) => {
          const aStart = (a.type === 'trigger' || a.type === 'listener') ? 0 : 1;
          const bStart = (b.type === 'trigger' || b.type === 'listener') ? 0 : 1;
          if (aStart !== bStart) return aStart - bStart;
          return (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0);
        });

        const colMap = new Map();
        const rowOrder = new Map();
        const visited = new Set();
        let nextOrder = 0;

        function assignLevels(startId) {
          const queue = [{ id: startId, col: 0 }];
          while (queue.length > 0) {
            const { id, col } = queue.shift();
            if (!nodeMap.has(id)) continue;
            if (!visited.has(id)) {
              visited.add(id);
              colMap.set(id, col);
              rowOrder.set(id, nextOrder++);
            } else {
              const prevCol = colMap.get(id) || 0;
              if (col > prevCol && col < 18) {
                colMap.set(id, col);
              }
              continue;
            }
            const outs = outEdges.get(id) || [];
            outs.forEach((edge) => {
              if (!visited.has(edge.target)) {
                queue.push({ id: edge.target, col: (colMap.get(id) || 0) + 1 });
              }
            });
          }
        }

        roots.forEach(r => {
          if (!visited.has(r.id)) assignLevels(r.id);
        });
        cNodes.forEach(n => {
          if (!visited.has(n.id)) assignLevels(n.id);
        });

        const columns = new Map();
        cNodes.forEach(n => {
          const c = colMap.get(n.id) ?? 0;
          if (!columns.has(c)) columns.set(c, []);
          columns.get(c).push(n);
        });

        const START_X = 60;
        const START_Y = 60;
        const COL_STRIDE = 310;
        const ROW_GAP = 32;

        const sortedCols = Array.from(columns.keys()).sort((a, b) => a - b);
        sortedCols.forEach((colIdx) => {
          const colNodes = columns.get(colIdx);
          colNodes.sort((a, b) => {
            const oa = rowOrder.get(a.id) ?? 0;
            const ob = rowOrder.get(b.id) ?? 0;
            return oa - ob;
          });

          let curY = START_Y;
          colNodes.forEach((node) => {
            const domEl = document.getElementById(node.id);
            const h = (domEl && domEl.offsetHeight > 40) ? domEl.offsetHeight : 195;
            node.x = START_X + colIdx * COL_STRIDE;
            node.y = curY;
            curY += h + ROW_GAP;
            totalArranged++;
          });
        });
      });

      saveGraph();
      renderGraph();
      canvasWrapper.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
      setTimeout(() => drawAllWires(), 200);
      logStep('success', `✨ Arranged ${totalArranged} block${totalArranged === 1 ? '' : 's'} into clean columns`);
    }

    document.getElementById('arrange-nodes-btn').addEventListener('click', () => arrangeNodes(false));

    // ============ ELEMENT STATE INSPECTORS ============
    function isElementDisabled(el) {
      if (!el || el.nodeType !== 1) return true;
      const checkOne = (node) => {
        if (!node || node.nodeType !== 1) return false;
        if (node.disabled === true) return true;
        if (node.hasAttribute('disabled')) {
          const dv = (node.getAttribute('disabled') || '').toLowerCase();
          if (dv !== 'false' && dv !== '0') return true;
        }
        const ariaD = (node.getAttribute('aria-disabled') || '').toLowerCase();
        if (ariaD === 'true' || ariaD === '1') return true;
        const dataD = (node.getAttribute('data-disabled') || '').toLowerCase();
        if (dataD === 'true' || dataD === '1') return true;
        const cls = typeof node.className === 'string' ? node.className : (node.getAttribute('class') || '');
        if (/\b(p-disabled|is-disabled|btn-disabled|mat-button-disabled|mat-mdc-button-disabled|mui-disabled|Mui-disabled|ant-btn-disabled|v-btn--disabled|disabled|k-disabled|dx-state-disabled)\b/i.test(cls)) {
          return true;
        }
        try {
          const cs = window.getComputedStyle(node);
          if (cs.pointerEvents === 'none' && parseFloat(cs.opacity || '1') < 0.75) return true;
          if (cs.cursor === 'not-allowed') return true;
        } catch (_) {}
        return false;
      };
      if (checkOne(el)) return true;
      const interactiveAncestor = el.closest('button, a, input, select, textarea, fieldset, [role="button"], [role="menuitem"], [role="option"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"]');
      if (interactiveAncestor && interactiveAncestor !== el && checkOne(interactiveAncestor)) return true;
      const fieldset = el.closest('fieldset[disabled]');
      if (fieldset) return true;
      return false;
    }

    function isElementReadonly(el) {
      if (!el || el.nodeType !== 1) return false;
      if (el.readOnly === true || el.hasAttribute('readonly')) return true;
      const ariaR = (el.getAttribute('aria-readonly') || '').toLowerCase();
      return ariaR === 'true';
    }

    function isElementChecked(el) {
      if (!el || el.nodeType !== 1) return false;
      if (typeof el.checked === 'boolean' && (el.tagName === 'INPUT')) return el.checked;
      const ariaC = (el.getAttribute('aria-checked') || el.getAttribute('aria-pressed') || el.getAttribute('aria-selected') || '').toLowerCase();
      if (ariaC === 'true') return true;
      const cls = typeof el.className === 'string' ? el.className : '';
      return /\b(is-checked|p-highlight|Mui-checked|ant-checkbox-checked|ant-switch-checked|active|selected)\b/.test(cls);
    }

    function isElementVisible(el) {
      if (!el || !el.isConnected) return false;
      try {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      } catch (_) { return false; }
    }

    function getElementContent(el, attr = 'text') {
      if (!el) return '';
      const mode = attr || 'text';
      if (mode === 'value') return String(el.value ?? el.getAttribute('value') ?? '').trim();
      if (mode === 'innerText') return String(el.innerText || el.textContent || '').trim();
      if (mode === 'html') return String(el.innerHTML || '').trim();
      if (mode === 'href') return String(el.href || el.getAttribute('href') || el.getAttribute('src') || '').trim();
      if (mode === 'aria') return String(el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
      if (mode === 'class') return String(typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '')).trim();
      if (mode === 'disabled_state') return isElementDisabled(el) ? 'disabled' : 'enabled';
      if (mode === 'checked_state') return isElementChecked(el) ? 'true' : 'false';
      if (el.tagName === 'SELECT') {
        const selOpt = el.options && el.options[el.selectedIndex];
        return String((selOpt && (selOpt.text || selOpt.value)) || el.value || '').trim();
      }
      if (el.value !== undefined && el.value !== '') return String(el.value).trim();
      return String(el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
    }

    // ============ TEMPLATE & DICT RESOLUTION ============
    function resolveTemplate(str) {
      if (str === undefined || str === null || typeof str !== 'string') return { value: str || '', missing: [] };
      const missing = [];
      const value = str.replace(/\{\{([A-Za-z0-9_$-]+)\}\}/g, (match, name) => {
        if (name === 'box1') return box1.val || '';
        if (name === 'box2') return box2.val || '';
        if (name === 'timestamp') return new Date().toISOString().replace(/[:.]/g, '-');
        if (name === 'date') return new Date().toISOString().slice(0, 10);
        if (name === 'url') return window.location.href;
        const entry = (graph.dictionary || []).find(e => e.name === name);
        if (entry) return entry.value;
        if (graph.variables && Object.prototype.hasOwnProperty.call(graph.variables, name)) {
          return String(graph.variables[name] ?? '');
        }
        missing.push(name);
        return '';
      });
      return { value, missing };
    }
    function resolveSelectorForNode(node) {
      if (!node.selector) return { ok: false, reason: 'missing-selector' };
      const { value, missing } = resolveTemplate(node.selector);
      if (missing.length > 0) return { ok: false, reason: `unknown refs: ${missing.map(m => `{{${m}}}`).join(', ')}` };
      if (!value.trim()) return { ok: false, reason: 'empty-selector-after-resolve' };
      return { ok: true, selector: value };
    }

    // ============ CIRCUIT EXPORT / IMPORT TO FILE ============
    function exportCircuitToFile() {
      safeSaveGraphNow();
      const payload = {
        version: '2.3',
        exportedAt: new Date().toISOString(),
        box1Data: box1.val || '',
        box2Data: box2.val || '',
        graph: graph
      };
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const fname = `wms-circuit-${stamp}.json`;
      const ok = triggerDownloadFile(fname, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
      if (ok) logStep('success', `📥 Circuit saved to ${fname}`);
      else logStep('error', '❌ Failed to save circuit file');
    }

    function importCircuitFromFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(String(ev.target.result || ''));
          const loadedGraph = (parsed && parsed.graph && Array.isArray(parsed.graph.nodes))
            ? parsed.graph
            : (parsed && Array.isArray(parsed.nodes) ? parsed : null);
          if (!loadedGraph) {
            logStep('error', '❌ Invalid circuit JSON file');
            return;
          }
          graph = {
            nodes: Array.isArray(loadedGraph.nodes) ? loadedGraph.nodes : [],
            edges: Array.isArray(loadedGraph.edges) ? loadedGraph.edges : [],
            variables: (loadedGraph.variables && typeof loadedGraph.variables === 'object') ? loadedGraph.variables : {},
            dictionary: Array.isArray(loadedGraph.dictionary) ? loadedGraph.dictionary : [],
            canvases: Array.isArray(loadedGraph.canvases) && loadedGraph.canvases.length > 0
              ? loadedGraph.canvases
              : [{ id: 'canvas_main', name: 'Canvas 1' }],
            activeCanvasId: loadedGraph.activeCanvasId || 'canvas_main'
          };
          if (typeof parsed.box1Data === 'string') {
            box1.val = parsed.box1Data;
            b1El.value = box1.val;
            SafeStorage.set({ box1Data: box1.val });
          }
          if (typeof parsed.box2Data === 'string') {
            box2.val = parsed.box2Data;
            b2El.value = box2.val;
            SafeStorage.set({ box2Data: box2.val });
          }
          selectedNodeIds.clear();
          ensureCanvases();
          migrateZoneTargetTypes();
          safeSaveGraphNow();
          renderGraph();
          if (dictManagerEl.style.display === 'flex') renderDictList();
          logStep('success', `📤 Loaded circuit (${graph.nodes.length} blocks across ${graph.canvases.length} canvas tab${graph.canvases.length === 1 ? '' : 's'})`);
        } catch (err) {
          logStep('error', '❌ Could not parse JSON file: ' + (err && err.message || err));
        }
      };
      reader.readAsText(file);
    }

    importFileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importCircuitFromFile(f);
      importFileInput.value = '';
    });

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
      if (role === 'button' || role === 'link' || role === 'textbox' || role === 'menuitem' || role === 'tab') return 0;
      if (el.hasAttribute('onclick')) return 1;
      const tabindex = el.getAttribute('tabindex');
      if (tabindex != null && tabindex !== '-1') return 2;
      return 3;
    }

    function matchesTargetType(el, targetType) {
      if (!targetType || targetType === 'any') return true;
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      if (targetType === 'button') {
        if (tag === 'button') return true;
        if (role === 'button' || role === 'tab') return true;
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

    // ============ EXISTING BROWSER TAB SWITCHING (Ctrl+1..9 / Next / Prev / Title) & CROSS-TAB HANDOFF ============
    function isLikelyTabElement(el) {
      if (!el || el.nodeType !== 1) return false;
      const role = (el.getAttribute('role') || '').toLowerCase();
      if (role === 'tab' || role === 'menuitem') return true;
      const cls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
      if (/\b(tab|tabs-tab|nav-link|nav-item|ant-tabs-tab|el-tabs__item|p-tabview-nav-link|mat-tab-label|mat-mdc-tab|v-tab|mui-tab|MuiTab-root|k-tabstrip-items|tab-item|page-tab)\b/i.test(cls)) {
        return true;
      }
      if (el.closest('[role="tablist"], .nav-tabs, .ant-tabs-nav, .el-tabs__nav, .p-tabview-nav, .mat-tab-labels, .v-tabs, .tabs, .tab-bar, .tabbar, header, nav')) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'button' || tag === 'a' || tag === 'li' || role === 'button' || el.hasAttribute('data-tab') || el.hasAttribute('data-bs-toggle')) {
          return true;
        }
      }
      return false;
    }

    function isTabActive(el) {
      if (!el || el.nodeType !== 1) return false;
      const ariaSel = (el.getAttribute('aria-selected') || el.getAttribute('aria-current') || '').toLowerCase();
      if (ariaSel === 'true' || ariaSel === 'page' || ariaSel === 'step') return true;
      const cls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
      if (/\b(active|is-active|selected|is-selected|ant-tabs-tab-active|p-highlight|Mui-selected|mat-tab-label-active|mat-mdc-tab-active|v-tab--active)\b/i.test(cls)) {
        return true;
      }
      const parentLi = el.closest('li, .ant-tabs-tab, .nav-item');
      if (parentLi && parentLi !== el) {
        const pCls = typeof parentLi.className === 'string' ? parentLi.className : '';
        if (/\b(active|is-active|selected|ant-tabs-tab-active|p-highlight)\b/i.test(pCls)) return true;
      }
      return false;
    }

    function collectTabElementsInContainer(containerRoot) {
      const root = containerRoot || document;
      const primarySelectors = [
        '[role="tab"]',
        '[role="tablist"] [role="button"]',
        '[role="tablist"] button',
        '[role="tablist"] a',
        '.ant-tabs-tab',
        '.el-tabs__item',
        '.nav-tabs .nav-link',
        '.nav-tabs a',
        '.nav-tabs button',
        '.p-tabview-nav li a',
        '.p-tabview-nav li button',
        '.mat-tab-label',
        '.mat-mdc-tab',
        '.MuiTab-root',
        '.v-tab',
        '[data-tab]',
        '[data-bs-toggle="tab"]',
        '.tab-bar button',
        '.tab-bar a',
        '.tabs button',
        '.tabs a'
      ];
      const seen = new Set();
      const results = [];
      for (const sel of primarySelectors) {
        let list = [];
        try { list = root.querySelectorAll(sel); } catch (_) {}
        for (const el of list) {
          if (isOwnUi(el) || !isElementVisible(el) || isElementDisabled(el)) continue;
          if (seen.has(el)) continue;
          seen.add(el);
          results.push(el);
        }
      }
      if (results.length === 0 && containerRoot && containerRoot !== document) {
        const children = containerRoot.querySelectorAll('button, a, [role="tab"], [role="button"], li');
        for (const el of children) {
          if (isOwnUi(el) || !isElementVisible(el) || isElementDisabled(el)) continue;
          if (seen.has(el)) continue;
          seen.add(el);
          results.push(el);
        }
      }
      results.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        if (Math.abs(ra.top - rb.top) > 18) return ra.top - rb.top;
        return ra.left - rb.left;
      });
      return results;
    }

    function sendBrowserTabSwitchRequest(payload) {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
          try {
            chrome.runtime.sendMessage(
              { type: 'WMS_SWITCH_BROWSER_TAB', ...payload },
              (response) => {
                const lastErr = chrome.runtime.lastError;
                if (lastErr || !response) {
                  resolve({
                    ok: false,
                    noBackground: true,
                    reason: (lastErr && lastErr.message) || 'no-background-listener'
                  });
                } else {
                  resolve(response);
                }
              }
            );
            return;
          } catch (err) {
            resolve({ ok: false, noBackground: true, reason: err.message });
            return;
          }
        }
        resolve({ ok: false, noBackground: true, reason: 'chrome-runtime-unavailable' });
      });
    }

    async function executeTabsNode(node) {
      const action = node.tabAction || 'browser_tab_index';
      const matchMode = node.tabMatchMode || 'contains';
      const rawTarget = node.source === 'box1' ? box1.val
        : node.source === 'box2' ? box2.val
        : node.source === 'variable' ? ((graph.variables && graph.variables[node.varName]) || '')
        : resolveTemplate(node.tabTarget || '').value;
      const targetStr = String(rawTarget ?? '').trim();

      // 1. Switch Existing Browser Tabs (like Ctrl+1, Ctrl+2, Ctrl+Tab, Ctrl+Shift+Tab, or by Title/URL)
      if (action.startsWith('browser_tab_')) {
        const outEdge = graph.edges.find(e => e.source === node.id && e.sourcePort === 'out');
        const nextNodeId = (node.continueInTargetTab !== false && outEdge) ? outEdge.target : null;
        const handoffId = 'hoff_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
        handledHandoffIds.add(handoffId);

        const handoffPayload = nextNodeId ? {
          id: handoffId,
          ts: Date.now(),
          fromInstanceId: INSTANCE_TAB_ID,
          resumeNodeId: nextNodeId,
          canvasId: graph.activeCanvasId,
          variables: graph.variables || {},
          box1Data: box1.val || '',
          box2Data: box2.val || ''
        } : null;

        if (handoffPayload) {
          safeSaveGraphNow();
          SafeStorage.set({
            box1Data: box1.val || '',
            box2Data: box2.val || '',
            wmsGraph: graph,
            wmsPendingTabHandoff: handoffPayload
          });
        }

        let mode = 'index';
        let tabNumber = 1;
        if (action === 'browser_tab_index') {
          mode = 'index';
          if (targetStr.toLowerCase() === 'last' || targetStr === '9') {
            tabNumber = parseInt(targetStr, 10) || 9;
          } else {
            tabNumber = parseInt(targetStr || '1', 10);
          }
          if (!Number.isFinite(tabNumber) || tabNumber < 1) {
            return { ok: false, reason: `invalid-browser-tab-number: "${targetStr}"` };
          }
          logStep('info', `🗂️ Switching to existing Browser Tab #${tabNumber} (Ctrl+${tabNumber})`);
        } else if (action === 'browser_tab_next') {
          mode = 'next';
          logStep('info', '🗂️ Switching to Next Open Browser Tab (Ctrl+Tab)');
        } else if (action === 'browser_tab_prev') {
          mode = 'prev';
          logStep('info', '🗂️ Switching to Previous Open Browser Tab (Ctrl+Shift+Tab)');
        } else if (action === 'browser_tab_title') {
          mode = 'title';
          if (!targetStr) return { ok: false, reason: 'missing-browser-tab-title-or-url' };
          logStep('info', `🗂️ Switching to existing Browser Tab matching "${targetStr.slice(0, 30)}"`);
        }

        const res = await sendBrowserTabSwitchRequest({
          mode,
          tabIndex: tabNumber, // 1-based (1 = first tab, like Ctrl+1)
          query: targetStr,
          matchMode,
          handoff: handoffPayload
        });

        if (res && res.ok) {
          const tabDesc = res.tabTitle ? `"${res.tabTitle.slice(0, 28)}" (Tab #${res.tabNumber})` : `Tab #${res.tabNumber || tabNumber}`;
          if (res.sameTab) {
            // Already on the target browser tab; clear pending external handoff and continue locally
            if (handoffPayload) SafeStorage.set({ wmsPendingTabHandoff: null });
            return { ok: true, reason: `already-on-${tabDesc}` };
          }
          if (nextNodeId) {
            return { ok: true, reason: `switched-to-${tabDesc}-and-handed-off`, stopLocalChain: true };
          }
          return { ok: true, reason: `switched-to-${tabDesc}` };
        }

        if (res && res.noBackground) {
          logStep('warn', '⚠️ Enable background.js in your extension to auto-switch browser tabs (or press Ctrl+' + (tabNumber || 'Tab') + ' now — circuit will auto-resume in that tab)');
          if (nextNodeId) {
            // Wait up to 4 seconds for user/macro to focus the target browser tab so handoff still works
            await sleep(400);
            return { ok: true, reason: 'awaiting-tab-focus-handoff', stopLocalChain: true };
          }
          return { ok: false, reason: 'background-worker-needed-for-browser-tab-switch' };
        }

        if (handoffPayload) SafeStorage.set({ wmsPendingTabHandoff: null });
        return { ok: false, reason: (res && res.reason) || 'browser-tab-not-found' };
      }

      // 2. Switch Circuit Studio Canvas Tab
      if (action === 'canvas_switch' || action === 'canvas_run') {
        ensureCanvases();
        let targetCanvas = null;
        const asIdx = parseInt(targetStr, 10);
        if (Number.isFinite(asIdx) && String(asIdx) === targetStr && asIdx >= 1 && asIdx <= graph.canvases.length) {
          targetCanvas = graph.canvases[asIdx - 1];
        } else {
          targetCanvas = graph.canvases.find(c =>
            c.id === targetStr ||
            matchesText(c.name, targetStr, matchMode)
          );
        }
        if (!targetCanvas) {
          return { ok: false, reason: `canvas-tab-not-found: "${targetStr}"` };
        }
        switchCanvasTab(targetCanvas.id);
        logStep('success', `🗂️ Switched active canvas to "${targetCanvas.name}"`);
        if (action === 'canvas_run') {
          const cNodes = (graph.nodes || []).filter(n => n.canvasId === targetCanvas.id);
          let start = cNodes.find(n => (n.type === 'trigger' || n.type === 'listener') && graph.edges.some(e => e.source === n.id));
          if (!start) start = cNodes.find(n => !graph.edges.some(e => e.target === n.id)) || cNodes[0];
          if (!start) return { ok: false, reason: `canvas-empty: "${targetCanvas.name}"` };
          return { ok: true, reason: `run-canvas-${targetCanvas.name}`, jumpToNodeId: start.id };
        }
        return { ok: true, reason: `switched-canvas-${targetCanvas.name}` };
      }

      // 3. In-Page WMS Tab Bar Navigation
      let containerEl = null;
      if (node.selector && node.selector.trim()) {
        const r = resolveSelectorForNode(node);
        if (!r.ok) return r;
        const picked = await waitForStableElement(r.selector, 4000, false);
        if (picked) {
          if (action === 'page_tab_picked') {
            return await robustClick(picked, false, 'single');
          }
          containerEl = picked.closest('[role="tablist"], .nav-tabs, .ant-tabs-nav, .el-tabs__nav, .p-tabview-nav, .mat-tab-labels, .v-tabs, .tabs, .tab-bar, .tabbar, nav, ul') || picked.parentElement || picked;
        }
      }

      const tabs = collectTabElementsInContainer(containerEl || document);

      if (action === 'page_tab_index') {
        const idx = parseInt(targetStr || '1', 10);
        if (!Number.isFinite(idx) || idx < 1) return { ok: false, reason: `invalid-tab-index: "${targetStr}"` };
        if (tabs.length < idx) return { ok: false, reason: `tab-index-${idx}-out-of-range (found ${tabs.length} tabs)` };
        const chosen = tabs[idx - 1];
        logStep('info', `🗂️ Clicking in-page tab #${idx}: "${getElementContent(chosen, 'text').slice(0, 25)}"`);
        return await robustClick(chosen, false, 'single');
      }

      if (action === 'page_tab_next' || action === 'page_tab_prev') {
        if (tabs.length === 0) return { ok: false, reason: 'no-tabs-found-on-page' };
        let activeIdx = tabs.findIndex(t => isTabActive(t));
        if (activeIdx === -1) activeIdx = 0;
        const delta = action === 'page_tab_next' ? 1 : -1;
        const nextIdx = (activeIdx + delta + tabs.length) % tabs.length;
        const chosen = tabs[nextIdx];
        logStep('info', `🗂️ Switching to ${action === 'page_tab_next' ? 'next' : 'previous'} in-page tab (#${nextIdx + 1}: "${getElementContent(chosen, 'text').slice(0, 25)}")`);
        return await robustClick(chosen, false, 'single');
      }

      if (!targetStr) return { ok: false, reason: 'missing-tab-name' };

      let matchedTab = tabs.find(el => {
        const txt = getElementContent(el, 'text') || el.getAttribute('data-tab') || '';
        return matchesText(txt, targetStr, matchMode);
      });

      if (!matchedTab) {
        const scope = containerEl || document;
        const candidates = [];
        const all = scope.querySelectorAll('button, a, [role="tab"], [role="menuitem"], [role="button"], li, span, div');
        for (const el of all) {
          if (isOwnUi(el) || !isElementVisible(el) || isElementDisabled(el)) continue;
          const direct = getDirectText(el);
          const full = getElementContent(el, 'text');
          if (!matchesText(direct || full, targetStr, matchMode)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 8 || rect.height < 8) continue;
          candidates.push({
            el: el.closest('button, a, [role="tab"], [role="menuitem"], [role="button"], li') || el,
            isTab: isLikelyTabElement(el),
            directMatch: Boolean(direct && matchesText(direct, targetStr, matchMode)),
            area: rect.width * rect.height
          });
        }
        candidates.sort((a, b) => {
          if (a.isTab !== b.isTab) return a.isTab ? -1 : 1;
          if (a.directMatch !== b.directMatch) return a.directMatch ? -1 : 1;
          return a.area - b.area;
        });
        if (candidates.length > 0) matchedTab = candidates[0].el;
      }

      if (!matchedTab) {
        return { ok: false, reason: `tab-not-found: "${targetStr.slice(0, 30)}"` };
      }
      logStep('info', `🗂️ Clicking in-page tab "${targetStr.slice(0, 30)}"`);
      return await robustClick(matchedTab, false, 'single');
    }

    // Receive Cross-Tab Circuit Handoff when this browser tab is activated!
    function tryResumePendingTabHandoff(handoff) {
      if (!handoff || !handoff.id || !handoff.resumeNodeId) return;
      if (handoff.fromInstanceId === INSTANCE_TAB_ID) return;
      if (handledHandoffIds.has(handoff.id)) return;
      if (Date.now() - (handoff.ts || 0) > 12000) return;
      if (document.hidden) return; // Only the newly active visible browser tab claims the handoff

      handledHandoffIds.add(handoff.id);
      SafeStorage.set({ wmsPendingTabHandoff: null });

      if (typeof handoff.box1Data === 'string') {
        box1.val = handoff.box1Data;
        b1El.value = box1.val;
      }
      if (typeof handoff.box2Data === 'string') {
        box2.val = handoff.box2Data;
        b2El.value = box2.val;
      }
      SafeStorage.get(['wmsGraph'], (res) => {
        if (res && res.wmsGraph && Array.isArray(res.wmsGraph.nodes)) {
          graph = res.wmsGraph;
        }
        if (handoff.variables && typeof handoff.variables === 'object') {
          graph.variables = Object.assign({}, graph.variables || {}, handoff.variables);
        }
        if (handoff.canvasId) {
          graph.activeCanvasId = handoff.canvasId;
        }
        ensureCanvases();
        renderGraph();
        logStep('info', '🔗 Continuing circuit from previous browser tab...');
        setTimeout(() => {
          executeGraph(handoff.resumeNodeId);
        }, 180);
      });
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg && msg.type === 'WMS_RESUME_FROM_TAB_SWITCH' && msg.handoff) {
          tryResumePendingTabHandoff(msg.handoff);
          sendResponse({ ok: true });
        }
      });
    }

    function checkStorageForTabHandoff() {
      if (document.hidden || isMacroRunning) return;
      SafeStorage.get(['wmsPendingTabHandoff'], (res) => {
        if (res && res.wmsPendingTabHandoff) {
          tryResumePendingTabHandoff(res.wmsPendingTabHandoff);
        }
      });
    }
    window.addEventListener('focus', checkStorageForTabHandoff);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkStorageForTabHandoff();
    });

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
          if (isElementDisabled(el)) continue;
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
          if (isElementDisabled(el)) continue;
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
      if (isOwnUi(cur)) return { ok: false, reason: 'coord-hits-own-ui' };
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

    async function performClickOnElement(el, x, y, forceDisabled = false) {
      if (!el || !el.isConnected) return { ok: false, reason: 'element-gone' };
      if (!forceDisabled && isElementDisabled(el)) {
        return { ok: false, reason: 'element-is-disabled' };
      }
      flashCoord(x, y);
      if (!isSafeToInteract(el, true, forceDisabled)) {
        for (let i = 0; i < 4; i++) {
          await sleep(150);
          if (!el.isConnected) return { ok: false, reason: 'element-gone' };
          if (isSafeToInteract(el, true, forceDisabled)) break;
        }
        if (!isSafeToInteract(el, true, forceDisabled)) logStep('warn', '⚠️ Target may be covered — clicking anyway');
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
      return await performClickOnElement(target, x, y, Boolean(node.forceDisabled));
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
      const targetType = node.zoneTargetType || ((node.type === 'type') ? 'input' : 'any');
      let el = findInteractableInZone(zone.x1, zone.y1, zone.x2, zone.y2, targetType);
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = Math.round(rect.left + rect.width / 2);
        const cy = Math.round(rect.top + rect.height / 2);
        logStep('info', `👆 Found <${el.tagName.toLowerCase()}> in zone at (${cx},${cy})`);
        return await performClickOnElement(el, cx, cy, Boolean(node.forceDisabled));
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
      const desc = targetType === 'any' ? 'enabled-interactable' : `enabled-${targetType}`;
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
      const rawText = (node.viewText || '').trim();
      const text = resolveTemplate(rawText).value.trim();
      if (!text) return { ok: false, reason: 'no-search-text-set' };
      if (restoreScrollState(node, 'zone')) {
        logStep('info', '📍 Scroll restored');
        await sleep(220);
      }
      flashZone(zone.x1, zone.y1, zone.x2, zone.y2);
      const targetType = node.zoneTargetType || ((node.type === 'type') ? 'input' : 'any');
      let el = findTextInZone(text, node.viewMatchMode || 'contains', zone.x1, zone.y1, zone.x2, zone.y2, targetType);
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = Math.round(rect.left + rect.width / 2);
        const cy = Math.round(rect.top + rect.height / 2);
        logStep('info', `👆 Found "${text.slice(0, 30)}" → clicking (${cx},${cy})`);
        return await performClickOnElement(el, cx, cy, Boolean(node.forceDisabled));
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

    async function typeAtCoordinate(node, text, submit, clearFirst = true) {
      const clickRes = await clickAtCoordinate(node);
      if (!clickRes.ok) return clickRes;
      await sleep(150);
      const active = getDeepActiveElement();
      if (!active || active === document.body || active === document.documentElement) return { ok: false, reason: 'no-focused-element-after-click' };
      if (isOwnUi(active)) return { ok: false, reason: 'focused-own-ui' };
      const wrote = typeAndSubmitElement(active, text, submit, clearFirst);
      return wrote ? { ok: true, reason: `typed-${text.length}-at-coord` } : { ok: false, reason: 'not-a-typeable-element-at-coord' };
    }
    async function typeInZone(node, text, submit, clearFirst = true) {
      const clickRes = await clickInZone(node);
      if (!clickRes.ok) return clickRes;
      await sleep(150);
      const active = getDeepActiveElement();
      if (!active || active === document.body || active === document.documentElement) return { ok: false, reason: 'no-focused-element-after-click' };
      if (isOwnUi(active)) return { ok: false, reason: 'focused-own-ui' };
      const wrote = typeAndSubmitElement(active, text, submit, clearFirst);
      return wrote ? { ok: true, reason: `typed-${text.length}-in-zone` } : { ok: false, reason: 'not-a-typeable-element-in-zone' };
    }
    async function typeByView(node, text, submit, clearFirst = true) {
      const clickRes = await clickByView(node);
      if (!clickRes.ok) return clickRes;
      await sleep(150);
      const active = getDeepActiveElement();
      if (!active || active === document.body || active === document.documentElement) return { ok: false, reason: 'no-focused-element-after-click' };
      if (isOwnUi(active)) return { ok: false, reason: 'focused-own-ui' };
      const wrote = typeAndSubmitElement(active, text, submit, clearFirst);
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
        label.style.display = 'block';
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
    document.getElementById('wms-log-save-file').addEventListener('click', () => {
      const text = logEntries.map((e) => `[${e.ts}] ${e.level.toUpperCase()} ${e.message}${e.detail ? ' | ' + e.detail : ''}`).join('\n');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      triggerDownloadFile(`wms-log-${stamp}.txt`, text || '(empty log)', 'text/plain;charset=utf-8');
      setStatus('💾 Log saved to file', '#10b981');
    });

    document.getElementById('export-file-btn').addEventListener('click', exportCircuitToFile);
    document.getElementById('widget-save-file-btn').addEventListener('click', exportCircuitToFile);
    document.getElementById('import-file-btn').addEventListener('click', () => importFileInput.click());
    document.getElementById('widget-load-file-btn').addEventListener('click', () => importFileInput.click());

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

    let saveDebounceTimer = null;
    function saveGraph() {
      if (!graph.variables) graph.variables = {};
      if (!graph.dictionary) graph.dictionary = [];
      ensureCanvases();
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = setTimeout(() => {
        SafeStorage.set({ wmsGraph: graph });
      }, 250);
    }
    function safeSaveGraphNow() {
      if (!graph.variables) graph.variables = {};
      if (!graph.dictionary) graph.dictionary = [];
      ensureCanvases();
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

    function migrateZoneTargetTypes() {
      let changed = false;
      ensureCanvases();
      (graph.nodes || []).forEach(n => {
        if (!n.canvasId) { n.canvasId = graph.activeCanvasId; changed = true; }
        if (n.type === 'extract') {
          if (!n.mode) { n.mode = 'immediate'; changed = true; }
          if (!n.attr) { n.attr = 'text'; changed = true; }
        }
        if ((n.locateBy === 'zone' || n.locateBy === 'view') && n.zoneTargetType == null) {
          n.zoneTargetType = (n.type === 'type') ? 'input' : 'any';
          changed = true;
        }
        if (n.type === 'for') {
          if (n.count == null) { n.count = 5; changed = true; }
          if (n.varName == null) { n.varName = 'i'; changed = true; }
        }
        if (n.type === 'while') {
          if (!n.cond) { n.cond = 'exists'; changed = true; }
          if (n.maxIter == null) { n.maxIter = 25; changed = true; }
        }
        if (n.type === 'savefile') {
          if (!n.source) { n.source = 'box1'; changed = true; }
          if (!n.filename) { n.filename = 'wms_output.txt'; changed = true; }
          if (!n.fileMode) { n.fileMode = 'overwrite'; changed = true; }
        }
        if (n.type === 'enter' && !n.keyName) {
          n.keyName = 'Enter';
          changed = true;
        }
        if (n.type === 'select' && !n.selectBy) {
          n.selectBy = 'text';
          n.source = n.source || 'custom';
          changed = true;
        }
        if (n.type === 'scroll' && !n.scrollMode) {
          n.scrollMode = 'element_center';
          n.amount = n.amount ?? 400;
          changed = true;
        }
        if (n.type === 'tabs') {
          // Migrate legacy URL actions to existing browser tab actions
          if (!n.tabAction || n.tabAction === 'url_same_tab' || n.tabAction === 'url_new_tab' || n.tabAction === 'history_back' || n.tabAction === 'history_forward') {
            n.tabAction = 'browser_tab_index';
            if (!n.tabTarget) n.tabTarget = '1';
            changed = true;
          }
          if (!n.tabMatchMode) { n.tabMatchMode = 'contains'; changed = true; }
          if (!n.source) { n.source = 'custom'; changed = true; }
          if (n.continueInTargetTab === undefined) { n.continueInTargetTab = true; changed = true; }
        }
      });
      return changed;
    }

    // ============ STORAGE LOAD ============
    SafeStorage.get(['box1Data','box2Data','wmsGraph','wmsWidgetPos','wmsWidgetMin','wmsCanvasClipboard','wmsPendingTabHandoff'], (res) => {
      if (res.box1Data) { b1El.value = res.box1Data; box1.val = res.box1Data; }
      if (res.box2Data) { b2El.value = res.box2Data; box2.val = res.box2Data; }
      if (res.wmsCanvasClipboard && Array.isArray(res.wmsCanvasClipboard.nodes)) {
        canvasClipboard = res.wmsCanvasClipboard;
      }
      if (res.wmsWidgetMin) { mainWidget.classList.add('is-minimized'); minBtn.textContent = '+'; }
      if (res.wmsWidgetPos && typeof res.wmsWidgetPos.left === 'number' && typeof res.wmsWidgetPos.top === 'number') {
        applyWidgetPosition(res.wmsWidgetPos.left, res.wmsWidgetPos.top, false);
      } else {
        applyWidgetPosition(Math.max(8, window.innerWidth - 310), 14, false);
      }
      if (res.wmsGraph && Array.isArray(res.wmsGraph.nodes) && res.wmsGraph.nodes.length > 0) {
        graph = res.wmsGraph;
      } else {
        graph = {
          nodes: [{ id: generateId(), type: 'trigger', subtype: 'hotkey', val: 'ALT+Q', x: 80, y: 100, canvasId: 'canvas_main' }],
          edges: [],
          variables: {},
          dictionary: [],
          canvases: [{ id: 'canvas_main', name: 'Canvas 1' }],
          activeCanvasId: 'canvas_main'
        };
      }
      if (!graph.variables) graph.variables = {};
      if (!graph.dictionary) graph.dictionary = [];
      ensureCanvases();
      const migrated = migrateZoneTargetTypes();
      renderGraph();
      if (migrated) saveGraph();
      if (res.wmsPendingTabHandoff && !document.hidden) {
        tryResumePendingTabHandoff(res.wmsPendingTabHandoff);
      } else {
        checkPassiveURLTriggers(true);
      }
    });

    const onStorageChanged = (changes, namespace) => {
      if (namespace !== 'local') return;
      if (changes.box1Data && changes.box1Data.newValue !== box1.val) { box1.val = changes.box1Data.newValue || ''; b1El.value = box1.val; }
      if (changes.box2Data && changes.box2Data.newValue !== box2.val) { box2.val = changes.box2Data.newValue || ''; b2El.value = box2.val; }
      if (changes.wmsCanvasClipboard && changes.wmsCanvasClipboard.newValue) {
        canvasClipboard = changes.wmsCanvasClipboard.newValue;
        updateNodeSelectionVisuals();
      }
      if (changes.wmsGraph && editorOverlay.style.display !== 'block' && !isPickingElement && !isMacroRunning) {
        graph = changes.wmsGraph.newValue || { nodes: [], edges: [], variables: {}, dictionary: [], canvases: [{ id: 'canvas_main', name: 'Canvas 1' }], activeCanvasId: 'canvas_main' };
        if (!graph.variables) graph.variables = {};
        if (!graph.dictionary) graph.dictionary = [];
        ensureCanvases();
        migrateZoneTargetTypes();
        renderGraph();
      }
      if (changes.wmsPendingTabHandoff && changes.wmsPendingTabHandoff.newValue && !document.hidden) {
        tryResumePendingTabHandoff(changes.wmsPendingTabHandoff.newValue);
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
      renderCanvasTabs();
      requestAnimationFrame(() => drawAllWires());
    });
    document.getElementById('close-editor-btn').addEventListener('click', () => {
      editorOverlay.style.display = 'none';
      selectedPort = null;
      hideContextMenu();
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
        (n.selector && n.selector.includes(ref)) ||
        (n.customText && n.customText.includes(ref)) ||
        (n.filename && n.filename.includes(ref)) ||
        (n.val && n.val.includes(ref)) ||
        (n.viewText && n.viewText.includes(ref)) ||
        (n.tabTarget && n.tabTarget.includes(ref))
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
            const fields = ['selector', 'customText', 'filename', 'val', 'viewText', 'tabTarget'];
            const affected = (graph.nodes || []).filter(n =>
              fields.some(f => n[f] && String(n[f]).includes(`{{${oldName}}}`))
            );
            if (affected.length > 0) {
              affected.forEach(n => {
                fields.forEach(f => {
                  if (n[f]) n[f] = String(n[f]).split(`{{${oldName}}}`).join(`{{${newName}}}`);
                });
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
        if (isOwnUi(e.target)) { pickerHighlight.style.display = 'none'; return; }
        const r = e.target.getBoundingClientRect();
        pickerHighlight.style.display = 'block';
        pickerHighlight.style.left = r.left + 'px'; pickerHighlight.style.top = r.top + 'px';
        pickerHighlight.style.width = r.width + 'px'; pickerHighlight.style.height = r.height + 'px';
      }
      function swallow(e) {
        if (isOwnUi(e.target)) return;
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
        if (isOwnUi(e.target)) return;
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
        else if (node.type === 'select') target = target.closest('select, [role="combobox"], [role="listbox"]') || target.querySelector('select') || target;
        else if (node.type === 'tabs') {
          if (node.tabAction === 'page_tab_picked') {
            target = target.closest('[role="tab"], button, a, li, .ant-tabs-tab, .nav-link') || target;
          } else {
            target = target.closest('[role="tablist"], .nav-tabs, .ant-tabs-nav, .el-tabs__nav, .p-tabview-nav, .mat-tab-labels, .v-tabs, .tabs, .tab-bar, .tabbar, nav, ul') || target.closest('[role="tab"], button, a') || target;
          }
        }
        else if (node.type === 'click' || node.type === 'if' || node.type === 'while') target = target.closest('button, a, [role="button"], [role="tab"], input, select, textarea') || target;
        else if (node.type === 'variable' && node.source === 'extract') target = target.closest('input, textarea, select') || target.querySelector('input, textarea, select') || target;
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
    let activeAskRaw = null;
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
      if (entries.length === 0) menu.innerHTML = '<div style="color:#64748b;font-size:11px;padding:10px;text-align:center;">No entries. Open 📚 Dict to add one.</div>';
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
    function isSafeToInteract(el, checkOcclusion = false, allowDisabled = false) {
      if (!el) return false;
      try {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        if (!allowDisabled && (style.pointerEvents === 'none' || isElementDisabled(el))) return false;
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
            const topPageEl = stack.find((it) => !isOwnUi(it));
            if (!topPageEl || el.contains(topPageEl) || topPageEl.contains(el)) { anyHit = true; break; }
            const shared = topPageEl.closest('button, a, label, [role="button"], [role="tab"]');
            if (shared && (shared.contains(el) || el.contains(shared))) { anyHit = true; break; }
          }
          return anyHit;
        }
        return true;
      } catch (_) { return false; }
    }
    async function waitForStableElement(selector, timeoutMs = 8000, allowDisabled = false) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        if (cancelMacro) return null;
        const el = deepQuery(selector);
        if (el && isSafeToInteract(el, false, allowDisabled) && await isStable(el, 2)) return el;
        await sleep(100);
      }
      return null;
    }

    async function waitForConditionState(selector, mode, timeoutMs = 10000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        if (cancelMacro) return false;
        const el = deepQuery(selector);
        if (mode === 'disappear') {
          if (!el || !isElementVisible(el)) return true;
        } else if (mode === 'enabled') {
          if (el && isElementVisible(el) && !isElementDisabled(el) && await isStable(el, 2)) return true;
        } else if (mode === 'disabled') {
          if (el && isElementDisabled(el)) return true;
        }
        await sleep(100);
      }
      return false;
    }

    // ============ EXTRACT WAIT MODES ============
    async function waitForExtractValue(selector, mode, waitFor, attr = 'text', timeoutMs = 10000) {
      if (mode === 'wait_regex') {
        const rx = waitFor || '.+';
        try { new RegExp(rx); } catch (err) { throw new Error(`invalid regex: ${err.message}`); }
      }
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        if (cancelMacro) return null;
        const el = deepQuery(selector);
        if (el && isElementVisible(el)) {
          const content = getElementContent(el, attr);
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

    async function robustClick(el, forceDisabled = false, clickType = 'single') {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
      await sleep(140);
      for (let i = 0; i < 10; i++) { if (await isStable(el, 2)) break; await sleep(60); }
      if (!forceDisabled && isElementDisabled(el)) {
        return { ok: false, reason: 'element-is-disabled' };
      }
      if (!isSafeToInteract(el, true, forceDisabled)) {
        try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (_) {}
        await sleep(120);
        if (!isSafeToInteract(el, true, forceDisabled)) return { ok: false, reason: 'covered-or-hidden' };
      }
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;

      if (clickType === 'double') {
        const cmn = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 };
        dispatchClickAt(el, cx, cy);
        dispatchClickAt(el, cx, cy);
        try { el.dispatchEvent(new MouseEvent('dblclick', { ...cmn, detail: 2 })); } catch (_) {}
        await sleep(260);
        return { ok: true, reason: 'double-clicked' };
      }
      if (clickType === 'right') {
        const cmn = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 2, buttons: 2 };
        try { el.dispatchEvent(new PointerEvent('pointerdown', { ...cmn, pointerType: 'mouse' })); } catch (_) {}
        el.dispatchEvent(new MouseEvent('mousedown', cmn));
        try { el.dispatchEvent(new PointerEvent('pointerup', { ...cmn, pointerType: 'mouse' })); } catch (_) {}
        el.dispatchEvent(new MouseEvent('mouseup', cmn));
        el.dispatchEvent(new MouseEvent('contextmenu', cmn));
        await sleep(260);
        return { ok: true, reason: 'right-clicked' };
      }

      const preUrl = window.location.href;
      const preChildren = (el.parentElement || el).children.length;
      const wasDisabled = isElementDisabled(el);
      const wasSelected = isTabActive(el);
      try { if (typeof el.focus === 'function') el.focus(); } catch (_) {}
      dispatchClickAt(el, cx, cy);
      await sleep(300);
      if (window.location.href !== preUrl) return { ok: true, reason: 'url-changed' };
      if (!el.isConnected) return { ok: true, reason: 'element-removed' };
      if (!wasDisabled && isElementDisabled(el)) return { ok: true, reason: 'became-disabled' };
      if (!wasSelected && isTabActive(el)) return { ok: true, reason: 'tab-activated' };
      if ((el.parentElement || el).children.length !== preChildren) return { ok: true, reason: 'dom-changed' };
      logStep('warn', '⏳ No visible change — retrying click');
      await sleep(200);
      try { el.click(); } catch (_) {}
      await sleep(320);
      if (window.location.href !== preUrl) return { ok: true, reason: 'url-changed-retry' };
      if (!el.isConnected) return { ok: true, reason: 'element-removed-retry' };
      if (!wasSelected && isTabActive(el)) return { ok: true, reason: 'tab-activated-retry' };
      if ((el.parentElement || el).children.length !== preChildren) return { ok: true, reason: 'dom-changed-retry' };
      logStep('warn', '⚠️ Click had no locally-visible effect — continuing (next Wait block will gate progress)');
      return { ok: true, reason: 'no-visible-change' };
    }

    // ============ CONDITION EVALUATOR (shared by If & While) ============
    function evaluateNodeCondition(node) {
      const cond = node.cond || 'exists';
      const tv = resolveTemplate(node.val || '').value.trim();

      if (cond === 'var_equals' || cond === 'var_not_equals' || cond === 'var_contains' || cond === 'var_gt' || cond === 'var_lt' || cond === 'var_empty') {
        if (!node.varName) return { ok: false, reason: 'missing-var-name' };
        const rawVal = (graph.variables && graph.variables[node.varName] !== undefined)
          ? String(graph.variables[node.varName])
          : '';
        let isTrue = false;
        if (cond === 'var_empty') isTrue = rawVal.trim().length === 0;
        else if (cond === 'var_equals') isTrue = rawVal.trim().toLowerCase() === tv.toLowerCase();
        else if (cond === 'var_not_equals') isTrue = rawVal.trim().toLowerCase() !== tv.toLowerCase();
        else if (cond === 'var_contains') isTrue = rawVal.toLowerCase().includes(tv.toLowerCase());
        else if (cond === 'var_gt') {
          const a = parseFloat(rawVal.replace(/[^0-9.-]/g, ''));
          const b = parseFloat(tv);
          isTrue = !isNaN(a) && !isNaN(b) && a > b;
        } else if (cond === 'var_lt') {
          const a = parseFloat(rawVal.replace(/[^0-9.-]/g, ''));
          const b = parseFloat(tv);
          isTrue = !isNaN(a) && !isNaN(b) && a < b;
        }
        return { ok: true, isTrue };
      }

      const r = resolveSelectorForNode(node);
      if (!r.ok) return r;
      const el = safeQuery(r.selector);
      let isTrue = false;

      if (cond === 'exists') isTrue = Boolean(el);
      else if (cond === 'not_exists') isTrue = !el;
      else if (cond === 'is_visible') isTrue = Boolean(el) && isElementVisible(el);
      else if (cond === 'is_hidden') isTrue = !el || !isElementVisible(el);
      else if (cond === 'is_enabled') isTrue = Boolean(el) && isElementVisible(el) && !isElementDisabled(el);
      else if (cond === 'is_disabled') isTrue = !el || isElementDisabled(el);
      else if (cond === 'is_checked') isTrue = Boolean(el) && isElementChecked(el);
      else if (cond === 'is_unchecked') isTrue = Boolean(el) && !isElementChecked(el);
      else if (cond === 'is_readonly') isTrue = Boolean(el) && isElementReadonly(el);
      else if (el) {
        const content = getElementContent(el, 'text');
        if (cond === 'text_equals') isTrue = content.toLowerCase() === tv.toLowerCase();
        else if (cond === 'text_not_equals') isTrue = content.toLowerCase() !== tv.toLowerCase();
        else if (cond === 'text_contains') isTrue = content.toLowerCase().includes(tv.toLowerCase());
        else if (cond === 'text_not_contains') isTrue = !content.toLowerCase().includes(tv.toLowerCase());
        else if (cond === 'text_regex') {
          try { isTrue = new RegExp(tv, 'i').test(content); } catch (_) { isTrue = false; }
        } else if (cond === 'has_class') {
          const cls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
          isTrue = cls.split(/\s+/).includes(tv) || cls.includes(tv);
        } else if (cond === 'number_gt') {
          const a = parseFloat(content.replace(/[^0-9.-]/g, ''));
          const b = parseFloat(tv);
          isTrue = !isNaN(a) && !isNaN(b) && a > b;
        } else if (cond === 'number_lt') {
          const a = parseFloat(content.replace(/[^0-9.-]/g, ''));
          const b = parseFloat(tv);
          isTrue = !isNaN(a) && !isNaN(b) && a < b;
        }
      }
      return { ok: true, isTrue };
    }

    // ============ RUN ============
    function runFirstAvailableCircuit() {
      const activeNodes = getActiveCanvasNodes();
      const pool = activeNodes.length > 0 ? activeNodes : graph.nodes;
      if (pool.length === 0) { logStep('warn', '⚠️ Add blocks in Circuit Studio first'); return; }
      let start = pool.find((n) => (n.type === 'trigger' || n.type === 'listener') && graph.edges.some((e) => e.source === n.id));
      if (!start) start = pool.find((n) => n.type === 'trigger' || n.type === 'listener');
      if (!start) start = pool.find((n) => !graph.edges.some((e) => e.target === n.id)) || pool[0];
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
      ensureCanvases();
      renderCanvasTabs();
      Array.from(canvas.children).forEach((c) => { if (c.id !== 'wire-layer' && c.id !== 'wms-marquee-box') c.remove(); });
      wireLayer.innerHTML = '';
      const activeNodes = getActiveCanvasNodes();
      activeNodes.forEach((n) => createNodeDOM(n));
      updateNodeSelectionVisuals();
      requestAnimationFrame(() => drawAllWires());
    }

    function createNodeDOM(node) {
      const el = document.createElement('div');
      el.className = `wms-node node-${node.type}${selectedNodeIds.has(node.id) ? ' is-selected' : ''}`;
      el.id = node.id;
      el.style.left = (node.x || 100) + 'px';
      el.style.top = (node.y || 100) + 'px';

      const icons = {
        trigger: '⚡', listener: '👂', if: '🔀', for: '🔁', while: '🔄',
        click: '👆', tabs: '🗂️', type: '⌨️', select: '🔽', scroll: '📜', wait: '⏳',
        extract: '📋', enter: '⏎', variable: '📦', savefile: '💾'
      };
      const titles = {
        trigger: 'TRIGGER', listener: 'LISTENER', if: 'IF / ELSE',
        for: 'FOR LOOP', while: 'WHILE LOOP', click: 'CLICK', tabs: 'TABS SWITCH',
        type: 'TYPE', select: 'SELECT', scroll: 'SCROLL', wait: 'WAIT',
        extract: 'EXTRACT', enter: 'KEY PRESS', variable: 'VARIABLE', savefile: 'SAVE FILE'
      };
      const headerHtml = `
        <div class="wms-node-header">
          <span>⠿ ${icons[node.type] || '⚡'} ${titles[node.type] || node.type.toUpperCase()}</span>
          <div class="node-head-actions">
            <span class="copy-node" title="Copy & Duplicate Block (or Ctrl+C / Ctrl+V)">⧉</span>
            <span class="del-node" title="Delete Block">✖</span>
          </div>
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
      const selectorInput = (node, placeholderText) => `<input type="text" class="node-input n-selector" value="${escapeAttr(node.selector)}" placeholder="${escapeAttr(placeholderText || 'Click Pick or paste selector...')}">${resolvedHint(node.selector)}`;

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
        if (mode === 'view') return `<div class="n-zone-hint">Finds enabled element matching text in zone, then ${targetType === 'type' ? 'types into it' : 'clicks it'}</div>`;
        return `<div class="n-zone-hint">Finds first enabled matching element in zone, then ${targetType === 'type' ? 'types into it' : 'clicks it'}</div>`;
      };

      const conditionControls = (node) => {
        const cond = node.cond || 'exists';
        const isVarCond = cond.startsWith('var_');
        const noValueNeeded = [
          'exists', 'not_exists', 'is_visible', 'is_hidden',
          'is_enabled', 'is_disabled', 'is_checked', 'is_unchecked',
          'is_readonly', 'var_empty'
        ].includes(cond);
        return `
          ${!isVarCond ? `${pickRow('Pick Element to Check')}${selectorInput(node)}` : `<input type="text" class="node-input n-var-name" value="${escapeAttr(node.varName)}" placeholder="Variable name (e.g. count)">`}
          <select class="node-select n-if-cond">
            <optgroup label="Element State &amp; Button Check">
              <option value="is_enabled" ${cond==='is_enabled'?'selected':''}>Element is Enabled (Clickable)</option>
              <option value="is_disabled" ${cond==='is_disabled'?'selected':''}>Element is Disabled</option>
              <option value="is_visible" ${cond==='is_visible'?'selected':''}>Element is Visible</option>
              <option value="is_hidden" ${cond==='is_hidden'?'selected':''}>Element is Hidden / Gone</option>
              <option value="exists" ${cond==='exists'?'selected':''}>Element Exists in DOM</option>
              <option value="not_exists" ${cond==='not_exists'?'selected':''}>Element Does NOT Exist</option>
              <option value="is_checked" ${cond==='is_checked'?'selected':''}>Checkbox / Toggle is Checked</option>
              <option value="is_unchecked" ${cond==='is_unchecked'?'selected':''}>Checkbox / Toggle is Unchecked</option>
              <option value="is_readonly" ${cond==='is_readonly'?'selected':''}>Input is Read-Only</option>
            </optgroup>
            <optgroup label="Element Text / Class / Number">
              <option value="text_equals" ${cond==='text_equals'?'selected':''}>Element Text Equals</option>
              <option value="text_not_equals" ${cond==='text_not_equals'?'selected':''}>Element Text Does NOT Equal</option>
              <option value="text_contains" ${cond==='text_contains'?'selected':''}>Element Text Contains</option>
              <option value="text_not_contains" ${cond==='text_not_contains'?'selected':''}>Element Text Does NOT Contain</option>
              <option value="text_regex" ${cond==='text_regex'?'selected':''}>Element Text Matches Regex</option>
              <option value="has_class" ${cond==='has_class'?'selected':''}>Element Has CSS Class</option>
              <option value="number_gt" ${cond==='number_gt'?'selected':''}>Element Number &gt;</option>
              <option value="number_lt" ${cond==='number_lt'?'selected':''}>Element Number &lt;</option>
            </optgroup>
            <optgroup label="Variable Check">
              <option value="var_equals" ${cond==='var_equals'?'selected':''}>Variable Equals</option>
              <option value="var_not_equals" ${cond==='var_not_equals'?'selected':''}>Variable Does NOT Equal</option>
              <option value="var_contains" ${cond==='var_contains'?'selected':''}>Variable Contains</option>
              <option value="var_empty" ${cond==='var_empty'?'selected':''}>Variable is Empty</option>
              <option value="var_gt" ${cond==='var_gt'?'selected':''}>Variable Number &gt;</option>
              <option value="var_lt" ${cond==='var_lt'?'selected':''}>Variable Number &lt;</option>
            </optgroup>
          </select>
          ${!noValueNeeded ? `<input type="text" class="node-input n-if-val" value="${escapeAttr(node.val)}" placeholder="Compare value (supports {{var}})...">` : ''}`;
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
            <option value="becomes_enabled" ${node.mode==='becomes_enabled'?'selected':''}>Button Becomes Enabled</option>
            <option value="becomes_disabled" ${node.mode==='becomes_disabled'?'selected':''}>Button Becomes Disabled</option>
          </select>
          ${(node.mode !== 'becomes_enabled' && node.mode !== 'becomes_disabled') ? `<input type="text" class="node-input n-listen-val" value="${escapeAttr(node.val)}" placeholder="Target text or number (empty = any content)">` : ''}`;
      } else if (node.type === 'if') {
        body += conditionControls(node);
      } else if (node.type === 'for') {
        body += `
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:10px;color:#94a3b8;white-space:nowrap;">Iterations:</span>
            <input type="text" class="node-input n-for-count" value="${escapeAttr(node.count ?? 5)}" placeholder="Count or {{var}}">
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:10px;color:#94a3b8;white-space:nowrap;">Index Var:</span>
            <input type="text" class="node-input n-var-name" value="${escapeAttr(node.varName ?? 'i')}" placeholder="e.g. i" maxlength="40" spellcheck="false">
          </div>
          <div class="n-zone-hint">Runs <strong>Loop</strong> port N times (1..N) automatically, then continues to <strong>Done</strong> port.</div>`;
      } else if (node.type === 'while') {
        body += conditionControls(node) + `
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:10px;color:#94a3b8;white-space:nowrap;">Max Loops:</span>
            <input type="number" class="node-input n-while-max" min="1" max="1000" value="${escapeAttr(node.maxIter ?? 25)}" placeholder="Max safety limit">
          </div>
          <div class="n-zone-hint">Repeats <strong>Loop</strong> port while condition is TRUE, then exits via <strong>Done</strong> port.</div>`;
      } else if (node.type === 'click') {
        const ctype = node.clickType || 'single';
        body += locateToggle(node);
        if (node.locateBy === 'coord') body += coordInput(node);
        else if (node.locateBy === 'zone') body += zoneTargetSelect(node) + zoneDisplay(node) + zoneHint('zone', 'click');
        else if (node.locateBy === 'view') body += zoneTargetSelect(node) + zoneDisplay(node) + viewTextInput(node) + zoneHint('view', 'click');
        else body += pickRow('Pick Button / Element') + selectorInput(node);
        body += `
          <select class="node-select n-click-type">
            <option value="single" ${ctype==='single'?'selected':''}>Action: Single Click</option>
            <option value="double" ${ctype==='double'?'selected':''}>Action: Double Click</option>
            <option value="right" ${ctype==='right'?'selected':''}>Action: Right Click (Context Menu)</option>
          </select>
          <label class="n-submit-row"><input type="checkbox" class="n-force-disabled" ${node.forceDisabled?'checked':''}><span>Allow clicking even if disabled</span></label>`;
      } else if (node.type === 'tabs') {
        const tAct = node.tabAction || 'browser_tab_index';
        const tMatch = node.tabMatchMode || 'contains';
        const src = node.source || 'custom';
        const isBrowserTab = tAct.startsWith('browser_tab_');
        const isPageTab = tAct.startsWith('page_tab_');
        const needsTargetInput = ['browser_tab_index', 'browser_tab_title', 'page_tab_text', 'page_tab_index', 'canvas_switch', 'canvas_run'].includes(tAct);
        const targetPlaceholder = tAct === 'browser_tab_index' ? 'Browser tab # (1 = Ctrl+1, 2 = Ctrl+2...)'
          : tAct === 'browser_tab_title' ? 'Existing tab title or URL part...'
          : tAct === 'page_tab_index' ? 'In-page tab # (1, 2, 3...)'
          : (tAct === 'canvas_switch' || tAct === 'canvas_run') ? 'Canvas name or number (e.g. Canvas 2)'
          : 'Tab title text (e.g. Outbound)...';

        body += `
          <select class="node-select n-tab-action">
            <optgroup label="Switch Existing Browser Tabs (Ctrl+1..9 / Ctrl+Tab)">
              <option value="browser_tab_index" ${tAct==='browser_tab_index'?'selected':''}>🔢 Browser Tab: Switch by Number (Ctrl+1..9)</option>
              <option value="browser_tab_next" ${tAct==='browser_tab_next'?'selected':''}>➡️ Browser Tab: Next Open Tab (Ctrl+Tab)</option>
              <option value="browser_tab_prev" ${tAct==='browser_tab_prev'?'selected':''}>⬅️ Browser Tab: Previous Open Tab (Ctrl+Shift+Tab)</option>
              <option value="browser_tab_title" ${tAct==='browser_tab_title'?'selected':''}>🔍 Browser Tab: Find Open Tab by Title / URL</option>
            </optgroup>
            <optgroup label="Circuit Studio Canvas Tabs">
              <option value="canvas_run" ${tAct==='canvas_run'?'selected':''}>🧩 Canvas Tab: Switch &amp; Run Canvas</option>
              <option value="canvas_switch" ${tAct==='canvas_switch'?'selected':''}>🧩 Canvas Tab: Switch Active Canvas Only</option>
            </optgroup>
            <optgroup label="In-Page WMS Tab Bar">
              <option value="page_tab_text" ${tAct==='page_tab_text'?'selected':''}>🗂️ Page Tab: Click by Tab Name</option>
              <option value="page_tab_index" ${tAct==='page_tab_index'?'selected':''}>🔢 Page Tab: Click by Tab Number (1, 2...)</option>
              <option value="page_tab_next" ${tAct==='page_tab_next'?'selected':''}>➡️ Page Tab: Next Tab in Page Bar</option>
              <option value="page_tab_prev" ${tAct==='page_tab_prev'?'selected':''}>⬅️ Page Tab: Previous Tab in Page Bar</option>
              <option value="page_tab_picked" ${tAct==='page_tab_picked'?'selected':''}>🎯 Page Tab: Click Picked Tab Element</option>
            </optgroup>
          </select>`;

        if (tAct === 'browser_tab_index') {
          const curNum = String(node.tabTarget || '1').trim();
          let pillsHtml = `<div class="tab-num-grid" title="Quick select existing browser tab (Ctrl+1 to Ctrl+9)">`;
          for (let k = 1; k <= 9; k++) {
            pillsHtml += `<div class="tab-num-pill ${curNum === String(k) ? 'active' : ''}" data-tabnum="${k}">${k}</div>`;
          }
          pillsHtml += `</div>`;
          body += pillsHtml;
        }

        if (isPageTab) {
          body += `${pickRow(tAct === 'page_tab_picked' ? 'Pick Exact Tab' : 'Pick Tab Bar (Optional)')}${selectorInput(node, tAct === 'page_tab_picked' ? 'Pick the tab element...' : 'Optional: Pick tab bar container (blank = auto)')}`;
        }

        if (needsTargetInput) {
          body += `
            <select class="node-select n-source">
              <option value="custom" ${src==='custom'?'selected':''}>Target From: Number / Text / {{var}}</option>
              <option value="box1" ${src==='box1'?'selected':''}>Target From: Box 1</option>
              <option value="box2" ${src==='box2'?'selected':''}>Target From: Box 2</option>
              <option value="variable" ${src==='variable'?'selected':''}>Target From: Variable</option>
            </select>
            ${src==='variable' ? `<input type="text" class="node-input n-var-name" value="${escapeAttr(node.varName)}" placeholder="Variable name">` : ''}
            ${src==='custom' ? `<input type="text" class="node-input n-tab-target" value="${escapeAttr(node.tabTarget ?? (tAct === 'browser_tab_index' ? '1' : ''))}" placeholder="${escapeAttr(targetPlaceholder)}">` : ''}`;
        }

        if (tAct === 'browser_tab_title' || tAct === 'page_tab_text') {
          body += `
            <select class="node-select n-tab-match">
              <option value="contains" ${tMatch==='contains'?'selected':''}>Match: Contains Text</option>
              <option value="equals" ${tMatch==='equals'?'selected':''}>Match: Exact Text</option>
              <option value="regex" ${tMatch==='regex'?'selected':''}>Match: Regex</option>
            </select>`;
        }

        if (isBrowserTab) {
          body += `
            <label class="n-submit-row" title="When switching to another open browser tab, continue running the rest of the circuit inside that tab">
              <input type="checkbox" class="n-tab-continue" ${node.continueInTargetTab !== false ? 'checked' : ''}>
              <span>Continue circuit in switched tab</span>
            </label>
            <div class="n-zone-hint">Moves to your existing open browser tab without opening a new tab or changing its URL.</div>`;
        }
      } else if (node.type === 'type') {
        body += locateToggle(node);
        body += `<select class="node-select n-source">
            <option value="box1" ${node.source==='box1'?'selected':''}>Type From: Box 1</option>
            <option value="box2" ${node.source==='box2'?'selected':''}>Type From: Box 2</option>
            <option value="variable" ${node.source==='variable'?'selected':''}>Type From: Variable</option>
            <option value="custom" ${node.source==='custom'?'selected':''}>Type: Custom Text</option>
          </select>
          ${node.source==='variable' ? `<input type="text" class="node-input n-var-name" value="${escapeAttr(node.varName)}" placeholder="Variable name">` : ''}
          ${node.source==='custom' ? `<input type="text" class="node-input n-custom" value="${escapeAttr(node.customText)}" placeholder="Enter custom text (supports {{var}})...">` : ''}
          <label class="n-submit-row"><input type="checkbox" class="n-clear-before" ${node.clearBeforeType!==false?'checked':''}><span>Clear existing text before typing</span></label>
          <label class="n-submit-row"><input type="checkbox" class="n-submit-after" ${node.submitAfterType!==false?'checked':''}><span>Press Enter after typing</span></label>`;
        if (node.locateBy === 'coord') body += coordInput(node);
        else if (node.locateBy === 'zone') body += zoneTargetSelect(node) + zoneDisplay(node) + zoneHint('zone', 'type');
        else if (node.locateBy === 'view') body += zoneTargetSelect(node) + zoneDisplay(node) + viewTextInput(node) + zoneHint('view', 'type');
        else body += pickRow('Pick Input Box') + selectorInput(node);
      } else if (node.type === 'select') {
        const sby = node.selectBy || 'text';
        const src = node.source || 'custom';
        body += `${pickRow('Pick Dropdown (<select>)')}${selectorInput(node)}
          <select class="node-select n-select-by">
            <option value="text" ${sby==='text'?'selected':''}>Select By: Visible Text</option>
            <option value="value" ${sby==='value'?'selected':''}>Select By: Option Value</option>
            <option value="index" ${sby==='index'?'selected':''}>Select By: Index (0, 1, 2...)</option>
          </select>
          <select class="node-select n-source">
            <option value="custom" ${src==='custom'?'selected':''}>From: Custom Value / {{var}}</option>
            <option value="box1" ${src==='box1'?'selected':''}>From: Box 1</option>
            <option value="box2" ${src==='box2'?'selected':''}>From: Box 2</option>
            <option value="variable" ${src==='variable'?'selected':''}>From: Variable</option>
          </select>
          ${src==='variable' ? `<input type="text" class="node-input n-var-name" value="${escapeAttr(node.varName)}" placeholder="Variable name">` : ''}
          ${src==='custom' ? `<input type="text" class="node-input n-custom" value="${escapeAttr(node.customText)}" placeholder="Option text, value, or index...">` : ''}`;
      } else if (node.type === 'scroll') {
        const smode = node.scrollMode || 'element_center';
        body += `<select class="node-select n-scroll-mode">
            <option value="element_center" ${smode==='element_center'?'selected':''}>Scroll Element Into View</option>
            <option value="down" ${smode==='down'?'selected':''}>Scroll Page Down (px)</option>
            <option value="up" ${smode==='up'?'selected':''}>Scroll Page Up (px)</option>
            <option value="top" ${smode==='top'?'selected':''}>Scroll to Page Top</option>
            <option value="bottom" ${smode==='bottom'?'selected':''}>Scroll to Page Bottom</option>
          </select>
          ${smode==='element_center' ? `${pickRow('Pick Element to Scroll To')}${selectorInput(node)}` : ''}
          ${(smode==='down' || smode==='up') ? `<input type="number" class="node-input n-scroll-amt" value="${escapeAttr(node.amount ?? 400)}" placeholder="Pixels (e.g. 400)">` : ''}`;
      } else if (node.type === 'enter') {
        const kname = node.keyName || 'Enter';
        body += `${pickRow('Pick Element (optional)')}${selectorInput(node)}
          <select class="node-select n-key-name">
            <option value="Enter" ${kname==='Enter'?'selected':''}>Key: ⏎ Enter</option>
            <option value="Tab" ${kname==='Tab'?'selected':''}>Key: ⇥ Tab</option>
            <option value="Escape" ${kname==='Escape'?'selected':''}>Key: ⎋ Escape</option>
            <option value="Space" ${kname==='Space'?'selected':''}>Key: ␣ Space</option>
            <option value="Backspace" ${kname==='Backspace'?'selected':''}>Key: ⌫ Backspace</option>
            <option value="Delete" ${kname==='Delete'?'selected':''}>Key: ⌦ Delete</option>
            <option value="ArrowDown" ${kname==='ArrowDown'?'selected':''}>Key: ↓ Arrow Down</option>
            <option value="ArrowUp" ${kname==='ArrowUp'?'selected':''}>Key: ↑ Arrow Up</option>
            <option value="ArrowRight" ${kname==='ArrowRight'?'selected':''}>Key: → Arrow Right</option>
            <option value="ArrowLeft" ${kname==='ArrowLeft'?'selected':''}>Key: ← Arrow Left</option>
          </select>`;
      } else if (node.type === 'wait') {
        const wmode = node.mode || 'element';
        body += `<select class="node-select n-wait-mode">
            <option value="element" ${wmode==='element'?'selected':''}>Wait Until Element Appears</option>
            <option value="enabled" ${wmode==='enabled'?'selected':''}>Wait Until Button/Element is Enabled</option>
            <option value="disabled" ${wmode==='disabled'?'selected':''}>Wait Until Button/Element is Disabled</option>
            <option value="disappear" ${wmode==='disappear'?'selected':''}>Wait Until Element Disappears / Spinner Gone</option>
            <option value="delay" ${wmode==='delay'?'selected':''}>Wait Fixed Time (ms)</option>
          </select>
          ${wmode==='delay' ? `<input type="number" class="node-input n-wait-ms" value="${escapeAttr(node.ms ?? 500)}">` : `${pickRow('Pick Element to Wait For')}${selectorInput(node)}`}`;
      } else if (node.type === 'extract') {
        const mode = node.mode || 'immediate';
        const attr = node.attr || 'text';
        body += `${pickRow('Pick Element')}${selectorInput(node)}
          <select class="node-select n-extract-attr">
            <option value="text" ${attr==='text'?'selected':''}>Extract: Auto Text / Input Value</option>
            <option value="innerText" ${attr==='innerText'?'selected':''}>Extract: Visible Text Only</option>
            <option value="value" ${attr==='value'?'selected':''}>Extract: Input Value Attribute</option>
            <option value="href" ${attr==='href'?'selected':''}>Extract: Link URL (href / src)</option>
            <option value="aria" ${attr==='aria'?'selected':''}>Extract: Tooltip / Aria-Label</option>
            <option value="class" ${attr==='class'?'selected':''}>Extract: CSS Class Names</option>
            <option value="disabled_state" ${attr==='disabled_state'?'selected':''}>Extract: State ("enabled" / "disabled")</option>
            <option value="checked_state" ${attr==='checked_state'?'selected':''}>Extract: Checked ("true" / "false")</option>
          </select>
          <select class="node-select n-extract-mode">
            <option value="immediate" ${mode==='immediate'?'selected':''}>When: Extract Immediately</option>
            <option value="wait_value" ${mode==='wait_value'?'selected':''}>When: Wait Until Non-Empty</option>
            <option value="wait_text" ${mode==='wait_text'?'selected':''}>When: Wait Until Contains Text</option>
            <option value="wait_regex" ${mode==='wait_regex'?'selected':''}>When: Wait Until Regex Matches</option>
          </select>
          ${(mode==='wait_text' || mode==='wait_regex') ? `<input type="text" class="node-input n-wait-for" value="${escapeAttr(node.waitFor)}" placeholder="${mode==='wait_regex' ? 'Regex (e.g. PO-\\d+)' : 'Text to wait for...'}">` : ''}
          <select class="node-select n-dest">
            <option value="box1" ${node.dest==='box1'?'selected':''}>Save Into: Box 1</option>
            <option value="box2" ${node.dest==='box2'?'selected':''}>Save Into: Box 2</option>
            <option value="variable" ${node.dest==='variable'?'selected':''}>Save Into: Variable</option>
            <option value="file" ${node.dest==='file'?'selected':''}>Save Directly to File</option>
          </select>
          ${node.dest==='variable' ? `<input type="text" class="node-input n-var-name" value="${escapeAttr(node.varName)}" placeholder="Variable name (e.g. status)" maxlength="40" spellcheck="false">` : ''}
          ${node.dest==='file' ? `<input type="text" class="node-input n-filename" value="${escapeAttr(node.filename || 'extracted.txt')}" placeholder="Filename (e.g. data.txt)">` : ''}`;
      } else if (node.type === 'variable') {
        const rawV = (node.varName && graph.variables) ? graph.variables[node.varName] : undefined;
        const s = (rawV === undefined || rawV === null) ? '' : String(rawV);
        const preview = s.length ? s.slice(0, 30) : '(empty)';
        body += `<input type="text" class="node-input n-var-name" value="${escapeAttr(node.varName)}" placeholder="Variable name (e.g. orderId)" maxlength="40" spellcheck="false" autocomplete="off">
          <select class="node-select n-source">
            <option value="box1" ${node.source==='box1'?'selected':''}>Set From: Box 1</option>
            <option value="box2" ${node.source==='box2'?'selected':''}>Set From: Box 2</option>
            <option value="custom" ${node.source==='custom'?'selected':''}>Set: Custom Text / {{var}}</option>
            <option value="extract" ${node.source==='extract'?'selected':''}>Set: From Element</option>
            <option value="increment" ${node.source==='increment'?'selected':''}>Math: Increment (+ Step)</option>
            <option value="decrement" ${node.source==='decrement'?'selected':''}>Math: Decrement (- Step)</option>
            <option value="append" ${node.source==='append'?'selected':''}>Text: Append String</option>
            <option value="trim" ${node.source==='trim'?'selected':''}>Text: Trim Whitespace</option>
            <option value="upper" ${node.source==='upper'?'selected':''}>Text: To UPPERCASE</option>
            <option value="lower" ${node.source==='lower'?'selected':''}>Text: To lowercase</option>
            <option value="clear" ${node.source==='clear'?'selected':''}>Clear Variable (Set Empty)</option>
          </select>
          ${(node.source==='custom' || node.source==='increment' || node.source==='decrement' || node.source==='append') ? `<input type="text" class="node-input n-custom" value="${escapeAttr(node.customText ?? ((node.source==='increment'||node.source==='decrement') ? '1' : ''))}" placeholder="${(node.source==='increment'||node.source==='decrement') ? 'Step amount (default 1)' : 'Enter text (supports {{var}})...'}">` : ''}
          ${node.source==='extract' ? `${pickRow('Pick Element to Extract')}${selectorInput(node)}` : ''}
          <div class="var-current" style="font-size:10px;color:#94a3b8;padding:2px 4px;background:#13141a;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📦 Current: ${escapeAttr(preview)}</div>`;
      } else if (node.type === 'savefile') {
        const src = node.source || 'box1';
        const fmode = node.fileMode || 'overwrite';
        body += `
          <select class="node-select n-source">
            <option value="box1" ${src==='box1'?'selected':''}>Data: Box 1</option>
            <option value="box2" ${src==='box2'?'selected':''}>Data: Box 2</option>
            <option value="variable" ${src==='variable'?'selected':''}>Data: Variable</option>
            <option value="all_vars" ${src==='all_vars'?'selected':''}>Data: All Variables (JSON)</option>
            <option value="custom" ${src==='custom'?'selected':''}>Data: Custom Template</option>
            <option value="log" ${src==='log'?'selected':''}>Data: Activity Log</option>
          </select>
          ${src==='variable' ? `<input type="text" class="node-input n-var-name" value="${escapeAttr(node.varName)}" placeholder="Variable name" maxlength="40" spellcheck="false">` : ''}
          ${src==='custom' ? `<input type="text" class="node-input n-custom" value="${escapeAttr(node.customText)}" placeholder="Text (e.g. {{box1}}, {{i}})">` : ''}
          <select class="node-select n-file-mode">
            <option value="overwrite" ${fmode==='overwrite'?'selected':''}>Mode: Download Immediately</option>
            <option value="append" ${fmode==='append'?'selected':''}>Mode: Append Line &amp; Download</option>
            <option value="buffer_only" ${fmode==='buffer_only'?'selected':''}>Mode: Append to Buffer Only (No Download)</option>
            <option value="flush_buffer" ${fmode==='flush_buffer'?'selected':''}>Mode: Download Buffer &amp; Clear</option>
          </select>
          <input type="text" class="node-input n-filename" value="${escapeAttr(node.filename || 'wms_output.txt')}" placeholder="Filename (e.g. output_{{date}}.txt)">`;
      }
      body += `</div>`;

      let ports = '';
      if (node.type !== 'trigger' && node.type !== 'listener') ports += `<div class="port port-in" data-nodeid="${node.id}" data-portid="in"></div>`;
      if (node.type === 'if') {
        ports += `<div class="port port-true" data-nodeid="${node.id}" data-portid="true"></div><div class="port-tag tag-true">True</div>
                  <div class="port port-false" data-nodeid="${node.id}" data-portid="false"></div><div class="port-tag tag-false">False</div>`;
      } else if (node.type === 'for' || node.type === 'while') {
        ports += `<div class="port port-loop" data-nodeid="${node.id}" data-portid="loop"></div><div class="port-tag tag-loop">Loop</div>
                  <div class="port port-done" data-nodeid="${node.id}" data-portid="done"></div><div class="port-tag tag-done">Done</div>`;
      } else {
        ports += `<div class="port port-out" data-nodeid="${node.id}" data-portid="out"></div>`;
      }

      el.innerHTML = headerHtml + body + ports;
      canvas.appendChild(el);

      // Dragging & Group Selection Dragging
      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('input, select, textarea, button, label, .node-btn-small, .n-pick-zone, .tab-num-pill, .copy-node, .del-node, .port')) return;
        e.preventDefault(); e.stopPropagation();
        hideContextMenu();

        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          selectSingleNode(node.id, true);
        } else if (!selectedNodeIds.has(node.id)) {
          selectSingleNode(node.id, false);
        }

        // Move all selected nodes together!
        const movingIds = selectedNodeIds.has(node.id) ? Array.from(selectedNodeIds) : [node.id];
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const initialPositions = new Map();
        movingIds.forEach((id) => {
          const nObj = graph.nodes.find(x => x.id === id);
          const nEl = document.getElementById(id);
          if (nObj) {
            initialPositions.set(id, { x: nObj.x || 0, y: nObj.y || 0, el: nEl, node: nObj });
            if (nEl) nEl.classList.add('is-dragging-node');
          }
        });

        function mv(me) {
          const dx = me.clientX - startClientX;
          const dy = me.clientY - startClientY;
          initialPositions.forEach((info) => {
            info.node.x = Math.max(10, info.x + dx);
            info.node.y = Math.max(10, info.y + dy);
            if (info.el) {
              info.el.style.left = info.node.x + 'px';
              info.el.style.top = info.node.y + 'px';
            }
          });
          drawAllWires();
        }
        function up() {
          initialPositions.forEach((info) => {
            if (info.el) info.el.classList.remove('is-dragging-node');
          });
          document.removeEventListener('mousemove', mv);
          document.removeEventListener('mouseup', up);
          saveGraph();
        }
        document.addEventListener('mousemove', mv);
        document.addEventListener('mouseup', up);
      });

      el.querySelector('.copy-node').addEventListener('click', (e) => {
        e.stopPropagation();
        duplicateSelectedNodes([node.id]);
      });

      el.querySelector('.del-node').addEventListener('click', (e) => {
        e.stopPropagation();
        selectedNodeIds.delete(node.id);
        graph.nodes = graph.nodes.filter((n) => n.id !== node.id);
        graph.edges = graph.edges.filter((ed) => ed.source !== node.id && ed.target !== node.id);
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

      if (el.querySelector('.n-for-count')) {
        el.querySelector('.n-for-count').addEventListener('input', (e) => {
          const raw = e.target.value.trim();
          if (raw.includes('{{')) {
            node.count = raw;
          } else {
            const n = parseInt(raw, 10);
            node.count = Number.isFinite(n) && n >= 1 ? Math.min(1000, n) : 1;
          }
          saveGraph();
        });
      }
      if (el.querySelector('.n-while-max')) {
        el.querySelector('.n-while-max').addEventListener('input', (e) => {
          const n = parseInt(e.target.value, 10);
          node.maxIter = Number.isFinite(n) && n >= 1 ? Math.min(1000, n) : 25;
          saveGraph();
        });
      }

      if (el.querySelector('.n-click-type')) el.querySelector('.n-click-type').addEventListener('change', (e) => { node.clickType = e.target.value; saveGraph(); });
      if (el.querySelector('.n-force-disabled')) el.querySelector('.n-force-disabled').addEventListener('change', (e) => { node.forceDisabled = e.target.checked; saveGraph(); });
      if (el.querySelector('.n-tab-action')) el.querySelector('.n-tab-action').addEventListener('change', (e) => {
        node.tabAction = e.target.value;
        if (node.tabAction === 'browser_tab_index' && !node.tabTarget) node.tabTarget = '1';
        renderGraph(); saveGraph();
      });
      if (el.querySelector('.n-tab-target')) el.querySelector('.n-tab-target').addEventListener('input', (e) => {
        node.tabTarget = e.target.value;
        el.querySelectorAll('.tab-num-pill').forEach(p => {
          p.classList.toggle('active', p.getAttribute('data-tabnum') === String(node.tabTarget).trim());
        });
        saveGraph();
      });
      el.querySelectorAll('.tab-num-pill').forEach((pill) => {
        pill.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const num = pill.getAttribute('data-tabnum');
          node.source = 'custom';
          node.tabTarget = num;
          saveGraph();
          renderGraph();
        });
      });
      if (el.querySelector('.n-tab-match')) el.querySelector('.n-tab-match').addEventListener('change', (e) => { node.tabMatchMode = e.target.value; saveGraph(); });
      if (el.querySelector('.n-tab-continue')) el.querySelector('.n-tab-continue').addEventListener('change', (e) => { node.continueInTargetTab = e.target.checked; saveGraph(); });
      if (el.querySelector('.n-clear-before')) el.querySelector('.n-clear-before').addEventListener('change', (e) => { node.clearBeforeType = e.target.checked; saveGraph(); });
      if (el.querySelector('.n-select-by')) el.querySelector('.n-select-by').addEventListener('change', (e) => { node.selectBy = e.target.value; saveGraph(); });
      if (el.querySelector('.n-scroll-mode')) el.querySelector('.n-scroll-mode').addEventListener('change', (e) => { node.scrollMode = e.target.value; renderGraph(); saveGraph(); });
      if (el.querySelector('.n-scroll-amt')) el.querySelector('.n-scroll-amt').addEventListener('input', (e) => {
        const n = parseInt(e.target.value, 10);
        node.amount = Number.isFinite(n) ? n : 400;
        saveGraph();
      });
      if (el.querySelector('.n-key-name')) el.querySelector('.n-key-name').addEventListener('change', (e) => { node.keyName = e.target.value; saveGraph(); });
      if (el.querySelector('.n-extract-attr')) el.querySelector('.n-extract-attr').addEventListener('change', (e) => { node.attr = e.target.value; saveGraph(); });

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
      if (el.querySelector('.n-dest')) el.querySelector('.n-dest').addEventListener('change', (e) => {
        node.dest = e.target.value;
        renderGraph();
        saveGraph();
      });
      if (el.querySelector('.n-file-mode')) el.querySelector('.n-file-mode').addEventListener('change', (e) => {
        node.fileMode = e.target.value;
        saveGraph();
      });
      if (el.querySelector('.n-filename')) el.querySelector('.n-filename').addEventListener('input', (e) => {
        node.filename = e.target.value;
        saveGraph();
      });
      if (el.querySelector('.n-pick')) el.querySelector('.n-pick').addEventListener('click', () => startNodePicker(node.id));
    }

    // ============ ADD BUTTONS ============
    ['trigger','listener','if','for','while','click','tabs','type','select','scroll','enter','wait','extract','variable','savefile'].forEach((type) => {
      const b = document.getElementById(`add-${type}`);
      if (!b) return;
      b.addEventListener('click', () => {
        ensureCanvases();
        const sx = canvasWrapper.scrollLeft || 0, sy = canvasWrapper.scrollTop || 0;
        const activeCount = getActiveCanvasNodes().length;
        const off = (activeCount % 6) * 28;
        const n = { id: generateId(), type, x: sx + 120 + off, y: sy + 90 + off, canvasId: graph.activeCanvasId };
        if (type === 'trigger') { n.subtype = 'hotkey'; n.val = 'ALT+Q'; }
        else if (type === 'listener') { n.mode = 'text_contains'; n.val = ''; }
        else if (type === 'if') { n.cond = 'is_enabled'; n.val = ''; }
        else if (type === 'for') { n.count = 5; n.varName = 'i'; }
        else if (type === 'while') { n.cond = 'is_enabled'; n.val = ''; n.maxIter = 25; }
        else if (type === 'tabs') { n.tabAction = 'browser_tab_index'; n.tabMatchMode = 'contains'; n.source = 'custom'; n.tabTarget = '2'; n.selector = ''; n.continueInTargetTab = true; }
        else if (type === 'type') { n.source = 'box1'; n.clearBeforeType = true; n.submitAfterType = true; n.locateBy = 'selector'; n.zoneTargetType = 'input'; }
        else if (type === 'select') { n.selectBy = 'text'; n.source = 'custom'; n.customText = ''; }
        else if (type === 'scroll') { n.scrollMode = 'element_center'; n.amount = 400; }
        else if (type === 'enter') { n.selector = ''; n.keyName = 'Enter'; }
        else if (type === 'wait') { n.mode = 'element'; n.ms = 500; }
        else if (type === 'extract') { n.dest = 'box1'; n.mode = 'immediate'; n.attr = 'text'; n.waitFor = ''; n.filename = 'extracted.txt'; }
        else if (type === 'variable') { n.source = 'box1'; n.varName = ''; }
        else if (type === 'savefile') { n.source = 'box1'; n.filename = 'wms_output.txt'; n.fileMode = 'overwrite'; }
        else if (type === 'click') { n.locateBy = 'selector'; n.zoneTargetType = 'any'; n.clickType = 'single'; n.forceDisabled = false; }
        graph.nodes.push(n);
        selectSingleNode(n.id, false);
        renderGraph(); saveGraph();
        logStep('info', `➕ Added ${type} block`);
      });
    });

    function wouldCycle(src, sport, tgt) {
      const tgtNode = graph.nodes.find(n => n.id === tgt);
      if (tgtNode && (tgtNode.type === 'for' || tgtNode.type === 'while')) {
        if (src === tgt) return true;
        const loopEdge = graph.edges.find(e => e.source === tgt && e.sourcePort === 'loop');
        if (loopEdge) {
          const reachableFromLoop = new Set();
          const q = [loopEdge.target];
          while (q.length) {
            const cur = q.pop();
            if (cur === src) return false;
            if (reachableFromLoop.has(cur) || cur === tgt) continue;
            reachableFromLoop.add(cur);
            graph.edges.filter(e => e.source === cur).forEach(e => q.push(e.target));
          }
        }
      }

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
      if (wouldCycle(src, sport, tgt)) { logStep('warn', '⚠️ Refusing to create a non-loop cycle'); return; }
      graph.edges = graph.edges.filter((e) => !(e.source === src && e.sourcePort === sport));
      graph.edges.push({ id: generateId(), source: src, sourcePort: sport, target: tgt, targetPort: 'in' });
      saveGraph(); drawAllWires();
    }

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      hideContextMenu();
      const pEl = e.target.closest('.port');
      if (!pEl) {
        if (selectedPort) { document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected')); selectedPort = null; }
        if (e.target === canvas || e.target === wireLayer) {
          e.preventDefault();
          // Shift+Drag on empty canvas = Box/Marquee Selection! Normal drag = Pan Canvas
          if (e.shiftKey) {
            const cr = canvas.getBoundingClientRect();
            const startX = e.clientX - cr.left;
            const startY = e.clientY - cr.top;
            marqueeEl.style.display = 'block';
            marqueeEl.style.left = startX + 'px';
            marqueeEl.style.top = startY + 'px';
            marqueeEl.style.width = '0px';
            marqueeEl.style.height = '0px';

            function mm(me) {
              const curX = me.clientX - cr.left;
              const curY = me.clientY - cr.top;
              const x1 = Math.min(startX, curX), y1 = Math.min(startY, curY);
              const x2 = Math.max(startX, curX), y2 = Math.max(startY, curY);
              marqueeEl.style.left = x1 + 'px';
              marqueeEl.style.top = y1 + 'px';
              marqueeEl.style.width = (x2 - x1) + 'px';
              marqueeEl.style.height = (y2 - y1) + 'px';
              selectedNodeIds.clear();
              getActiveCanvasNodes().forEach((n) => {
                const nx1 = n.x || 0, ny1 = n.y || 0;
                const nx2 = nx1 + 254, ny2 = ny1 + 160;
                if (nx2 >= x1 && nx1 <= x2 && ny2 >= y1 && ny1 <= y2) {
                  selectedNodeIds.add(n.id);
                }
              });
              updateNodeSelectionVisuals();
            }
            function mu() {
              marqueeEl.style.display = 'none';
              document.removeEventListener('mousemove', mm);
              document.removeEventListener('mouseup', mu);
            }
            document.addEventListener('mousemove', mm);
            document.addEventListener('mouseup', mu);
            return;
          }

          selectedNodeIds.clear();
          updateNodeSelectionVisuals();
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
            else if (activeWire.startPort === 'in' && tp !== 'in') { connectNodes(tn, tp, selectedPort.nodeId); document.querySelectorAll('.port-selected').forEach((p) => p.classList.remove('port-selected')); selectedPort = null; }
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
      const activeEdges = getActiveCanvasEdges();
      activeEdges.forEach((edge) => {
        const s = canvas.querySelector(`.port[data-nodeid="${edge.source}"][data-portid="${edge.sourcePort}"]`);
        const t = canvas.querySelector(`.port[data-nodeid="${edge.target}"][data-portid="${edge.targetPort}"]`);
        if (s && t) {
          const sr = s.getBoundingClientRect(), tr = t.getBoundingClientRect();
          const x1 = sr.left + sr.width / 2 - cr.left, y1 = sr.top + sr.height / 2 - cr.top;
          const x2 = tr.left + tr.width / 2 - cr.left, y2 = tr.top + tr.height / 2 - cr.top;
          let cls = 'wire';
          if (edge.sourcePort === 'true' || edge.sourcePort === 'loop') cls = 'wire wire-true';
          else if (edge.sourcePort === 'false' || edge.sourcePort === 'done') cls = 'wire wire-false';
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

    // ============ KEYBOARD DISPATCH HELPER ============
    function dispatchKeyPress(target, keyName = 'Enter') {
      const keyMap = {
        Enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
        Tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
        Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
        Space: { key: ' ', code: 'Space', keyCode: 32 },
        Backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
        Delete: { key: 'Delete', code: 'Delete', keyCode: 46 },
        ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 }
      };
      const k = keyMap[keyName] || keyMap.Enter;
      const opts = { key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode, bubbles: true, cancelable: true };
      target.dispatchEvent(new KeyboardEvent('keydown', opts));
      target.dispatchEvent(new KeyboardEvent('keypress', opts));
      target.dispatchEvent(new KeyboardEvent('keyup', opts));
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

      const MAX_TOTAL_STEPS = 1000;
      let totalSteps = 0;

      async function runChain(entryNodeId, activeLoopStack = new Set()) {
        let cur = entryNodeId;
        while (cur && !cancelMacro && totalSteps < MAX_TOTAL_STEPS) {
          if (activeLoopStack.has(cur)) return;

          totalSteps++;
          const node = graph.nodes.find((n) => n.id === cur);
          if (!node) { logStep('error', `❌ Node not found: ${cur}`); cancelMacro = true; break; }
          const nd = document.getElementById(node.id);
          if (nd) nd.classList.add('is-executing');
          const label = `${node.type} #${node.id.slice(-4)}`;
          logStep('info', `▶ ${label} starting`);
          let nextPort = 'out';
          let outcome = { ok: true, reason: '' };

          try {
            if (node.type === 'for') {
              const rawCount = resolveTemplate(String(node.count ?? 5)).value.trim();
              const count = Math.max(1, Math.min(1000, parseInt(rawCount, 10) || 1));
              const varName = (node.varName !== undefined && node.varName !== null ? String(node.varName) : 'i').trim();
              const loopEdge = graph.edges.find((e) => e.source === node.id && e.sourcePort === 'loop');
              const doneEdge = graph.edges.find((e) => e.source === node.id && e.sourcePort === 'done');
              const nextStack = new Set(activeLoopStack);
              nextStack.add(node.id);

              for (let i = 1; i <= count && !cancelMacro && totalSteps < MAX_TOTAL_STEPS; i++) {
                if (varName) {
                  if (!graph.variables) graph.variables = {};
                  graph.variables[varName] = String(i);
                  saveGraph();
                }
                logStep('info', `🔁 For Loop ${i}/${count}${varName ? ` (${varName}=${i})` : ''}`);
                if (loopEdge && loopEdge.target) {
                  await runChain(loopEdge.target, nextStack);
                }
                await sleep(60);
              }
              nextPort = 'done';
              outcome = { ok: !cancelMacro, reason: cancelMacro ? 'halted' : `completed-${count}-loops` };
              if (!doneEdge && outcome.ok) {
                if (nd) { nd.classList.remove('is-executing'); nd.classList.add('is-success'); setTimeout(() => nd.classList.remove('is-success'), 800); }
                logStep('success', `✅ ${label} → ${outcome.reason}`);
                break;
              }
            } else if (node.type === 'while') {
              const maxIter = Math.max(1, Math.min(1000, parseInt(node.maxIter, 10) || 25));
              const loopEdge = graph.edges.find((e) => e.source === node.id && e.sourcePort === 'loop');
              const doneEdge = graph.edges.find((e) => e.source === node.id && e.sourcePort === 'done');
              const nextStack = new Set(activeLoopStack);
              nextStack.add(node.id);
              let iter = 0;

              while (!cancelMacro && iter < maxIter && totalSteps < MAX_TOTAL_STEPS) {
                const check = evaluateNodeCondition(node);
                if (!check.ok) { outcome = check; break; }
                if (!check.isTrue) {
                  logStep('info', `🔄 While condition (${node.cond}) FALSE after ${iter} iteration(s) → exiting to Done`);
                  break;
                }
                iter++;
                logStep('info', `🔄 While Loop iteration ${iter}/${maxIter}`);
                if (!loopEdge || !loopEdge.target) {
                  logStep('warn', '⚠️ While Loop has no Loop wire connected — breaking to avoid infinite spin');
                  break;
                }
                await runChain(loopEdge.target, nextStack);
                await sleep(80);
              }
              if (outcome.ok) {
                if (iter >= maxIter) logStep('warn', `⚠️ While Loop hit safety limit (${maxIter} iterations)`);
                nextPort = 'done';
                outcome = { ok: !cancelMacro, reason: cancelMacro ? 'halted' : `while-${iter}-iters` };
              }
              if (!doneEdge && outcome.ok) {
                if (nd) { nd.classList.remove('is-executing'); nd.classList.add('is-success'); setTimeout(() => nd.classList.remove('is-success'), 800); }
                logStep('success', `✅ ${label} → ${outcome.reason}`);
                break;
              }
            } else if (node.type === 'wait') {
              const wmode = node.mode || 'element';
              if (wmode === 'delay') {
                logStep('info', `⏳ Waiting ${node.ms || 0}ms`);
                await sleep(node.ms || 0);
                outcome = { ok: true, reason: `waited-${node.ms || 0}ms` };
              } else {
                const r = resolveSelectorForNode(node);
                if (!r.ok) outcome = r;
                else if (wmode === 'element') {
                  logStep('info', `⏳ Waiting for element ${r.selector.slice(-30)}`);
                  const el = await waitForStableElement(r.selector, 10000, true);
                  if (!el) outcome = { ok: false, reason: 'timeout-waiting-for-element' };
                  else outcome = { ok: true, reason: 'element-appeared' };
                } else {
                  logStep('info', `⏳ Waiting for ${wmode}: ${r.selector.slice(-30)}`);
                  const ok = await waitForConditionState(r.selector, wmode, 10000);
                  if (!ok) outcome = { ok: false, reason: `timeout-waiting-for-${wmode}` };
                  else outcome = { ok: true, reason: `state-${wmode}` };
                }
              }
            } else if (node.type === 'click') {
              const forceDis = Boolean(node.forceDisabled);
              const ctype = node.clickType || 'single';
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
                  const el = await waitForStableElement(r.selector, 4000, forceDis);
                  if (!el) {
                    const rawEl = safeQuery(r.selector);
                    if (rawEl && isElementDisabled(rawEl) && !forceDis) {
                      outcome = { ok: false, reason: 'button-or-element-is-disabled' };
                    } else {
                      outcome = { ok: false, reason: 'not-found' };
                    }
                  } else {
                    logStep('info', `👆 Clicking (${ctype}) ${r.selector.slice(-30)}`);
                    outcome = await robustClick(el, forceDis, ctype);
                  }
                }
              }
            } else if (node.type === 'tabs') {
              outcome = await executeTabsNode(node);
            } else if (node.type === 'type') {
              const rawTxt = node.source === 'box1' ? box1.val
                : node.source === 'box2' ? box2.val
                : node.source === 'variable' ? ((graph.variables && graph.variables[node.varName]) || '')
                : resolveTemplate(node.customText || '').value;
              const txt = String(rawTxt ?? '');
              const clearFirst = node.clearBeforeType !== false;
              const submitAfter = node.submitAfterType !== false;
              if (node.locateBy === 'coord') {
                logStep('info', `⌨️ Coord + typing ${txt.length} chars`);
                outcome = await typeAtCoordinate(node, txt, submitAfter, clearFirst);
              } else if (node.locateBy === 'zone') {
                logStep('info', `⌨️ Zone + typing ${txt.length} chars (target: ${node.zoneTargetType || 'any'})`);
                outcome = await typeInZone(node, txt, submitAfter, clearFirst);
              } else if (node.locateBy === 'view') {
                logStep('info', `⌨️ View "${(node.viewText||'').slice(0, 20)}" + typing ${txt.length} chars`);
                outcome = await typeByView(node, txt, submitAfter, clearFirst);
              } else {
                const r = resolveSelectorForNode(node);
                if (!r.ok) outcome = r;
                else {
                  const el = await waitForStableElement(r.selector, 4000, false);
                  if (!el) {
                    const rawEl = safeQuery(r.selector);
                    if (rawEl && isElementDisabled(rawEl)) outcome = { ok: false, reason: 'input-is-disabled' };
                    else outcome = { ok: false, reason: 'not-found' };
                  } else {
                    logStep('info', `⌨️ Typing ${txt.length} chars`);
                    const wrote = typeAndSubmitElement(el, txt, submitAfter, clearFirst);
                    outcome = wrote
                      ? { ok: true, reason: `typed-${txt.length}` }
                      : { ok: false, reason: 'not-a-typeable-element' };
                    await sleep(220);
                  }
                }
              }
            } else if (node.type === 'select') {
              const r = resolveSelectorForNode(node);
              if (!r.ok) outcome = r;
              else {
                const el = await waitForStableElement(r.selector, 4000, false);
                if (!el) outcome = { ok: false, reason: 'dropdown-not-found-or-disabled' };
                else {
                  const selEl = el.tagName === 'SELECT' ? el : el.querySelector('select');
                  const targetVal = String(
                    node.source === 'box1' ? box1.val
                    : node.source === 'box2' ? box2.val
                    : node.source === 'variable' ? ((graph.variables && graph.variables[node.varName]) || '')
                    : resolveTemplate(node.customText || '').value
                  ).trim();
                  const sby = node.selectBy || 'text';
                  if (selEl && selEl.tagName === 'SELECT') {
                    let matchedIndex = -1;
                    const opts = Array.from(selEl.options || []);
                    if (sby === 'index') {
                      const idx = parseInt(targetVal, 10);
                      if (Number.isFinite(idx) && idx >= 0 && idx < opts.length) matchedIndex = idx;
                    } else if (sby === 'value') {
                      matchedIndex = opts.findIndex(o => o.value === targetVal || o.value.toLowerCase() === targetVal.toLowerCase());
                    } else {
                      matchedIndex = opts.findIndex(o => o.text.trim().toLowerCase() === targetVal.toLowerCase() || o.text.trim().toLowerCase().includes(targetVal.toLowerCase()));
                    }
                    if (matchedIndex === -1) {
                      outcome = { ok: false, reason: `option-not-found: "${targetVal.slice(0, 25)}"` };
                    } else if (opts[matchedIndex].disabled) {
                      outcome = { ok: false, reason: `option-is-disabled: "${opts[matchedIndex].text}"` };
                    } else {
                      selEl.selectedIndex = matchedIndex;
                      selEl.value = opts[matchedIndex].value;
                      selEl.dispatchEvent(new Event('input', { bubbles: true }));
                      selEl.dispatchEvent(new Event('change', { bubbles: true }));
                      outcome = { ok: true, reason: `selected-"${opts[matchedIndex].text.trim().slice(0, 20)}"` };
                      await sleep(180);
                    }
                  } else {
                    outcome = { ok: false, reason: 'element-is-not-select' };
                  }
                }
              }
            } else if (node.type === 'scroll') {
              const smode = node.scrollMode || 'element_center';
              if (smode === 'element_center') {
                const r = resolveSelectorForNode(node);
                if (!r.ok) outcome = r;
                else {
                  const el = safeQuery(r.selector);
                  if (!el) outcome = { ok: false, reason: 'element-not-found' };
                  else {
                    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
                    await sleep(250);
                    outcome = { ok: true, reason: 'scrolled-to-element' };
                  }
                }
              } else {
                const amt = parseInt(node.amount, 10) || 400;
                if (smode === 'down') window.scrollBy({ top: amt, behavior: 'smooth' });
                else if (smode === 'up') window.scrollBy({ top: -amt, behavior: 'smooth' });
                else if (smode === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
                else if (smode === 'bottom') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                await sleep(250);
                outcome = { ok: true, reason: `scrolled-${smode}` };
              }
            } else if (node.type === 'enter') {
              let tgt = null;
              if (node.selector) {
                const r = resolveSelectorForNode(node);
                if (!r.ok) outcome = r;
                else {
                  tgt = await waitForStableElement(r.selector, 4000, false);
                  if (!tgt) outcome = { ok: false, reason: 'not-found-or-disabled' };
                  else { try { tgt.scrollIntoView({ block: 'nearest' }); } catch (_) {} if (typeof tgt.focus === 'function') tgt.focus(); }
                }
              } else tgt = getDeepActiveElement() || document.body;
              if (outcome.ok && tgt) {
                const kname = node.keyName || 'Enter';
                dispatchKeyPress(tgt, kname);
                logStep('success', `⏎ Key pressed: ${kname}`);
                outcome = { ok: true, reason: `key-${kname}` };
                await sleep(220);
              }
            } else if (node.type === 'extract') {
              const r = resolveSelectorForNode(node);
              if (!r.ok) outcome = r;
              else {
                const mode = node.mode || 'immediate';
                const attr = node.attr || 'text';
                let val = '';
                if (mode === 'immediate') {
                  const el = await waitForStableElement(r.selector, 4000, true);
                  if (!el) outcome = { ok: false, reason: 'not-found' };
                  else val = getElementContent(el, attr);
                } else {
                  const resolvedWaitFor = resolveTemplate(node.waitFor || '').value;
                  logStep('info', `⏳ Wait for ${mode === 'wait_value' ? 'value' : mode === 'wait_text' ? `text "${resolvedWaitFor.slice(0, 20)}"` : `regex /${resolvedWaitFor.slice(0, 20)}/`}`);
                  try {
                    const matched = await waitForExtractValue(r.selector, mode, resolvedWaitFor, attr, 10000);
                    if (matched === null) outcome = { ok: false, reason: 'timeout-waiting-for-value' };
                    else val = matched;
                  } catch (rxErr) {
                    outcome = { ok: false, reason: rxErr.message || 'invalid-regex' };
                  }
                }
                if (outcome.ok) {
                  if (node.dest === 'box2') {
                    box2.val = val; b2El.value = val; SafeStorage.set({ box2Data: val });
                    logStep('success', `📋 Extracted → Box 2: "${val.slice(0, 30)}"`);
                  } else if (node.dest === 'variable') {
                    if (!node.varName) {
                      outcome = { ok: false, reason: 'missing-var-name' };
                    } else {
                      if (!graph.variables) graph.variables = {};
                      graph.variables[node.varName] = val;
                      saveGraph();
                      logStep('success', `📋 Extracted → Var "${node.varName}": "${val.slice(0, 30)}"`);
                    }
                  } else if (node.dest === 'file') {
                    const fname = sanitizeFilename(resolveTemplate(node.filename || 'extracted.txt').value, 'extracted.txt');
                    triggerDownloadFile(fname, val, 'text/plain;charset=utf-8');
                    logStep('success', `💾 Extracted & saved to ${fname} (${val.length} chars)`);
                  } else {
                    box1.val = val; b1El.value = val; SafeStorage.set({ box1Data: val });
                    logStep('success', `📋 Extracted → Box 1: "${val.slice(0, 30)}"`);
                  }
                  if (outcome.ok) outcome = { ok: true, reason: `len-${val.length}` };
                  await sleep(120);
                }
              }
            } else if (node.type === 'variable') {
              if (!node.varName) outcome = { ok: false, reason: 'missing-name' };
              else {
                if (!graph.variables) graph.variables = {};
                const curStr = String(graph.variables[node.varName] ?? '');
                let value = '';
                if (node.source === 'box1') value = box1.val;
                else if (node.source === 'box2') value = box2.val;
                else if (node.source === 'custom') value = resolveTemplate(node.customText || '').value;
                else if (node.source === 'append') value = curStr + resolveTemplate(node.customText || '').value;
                else if (node.source === 'trim') value = curStr.trim();
                else if (node.source === 'upper') value = curStr.toUpperCase();
                else if (node.source === 'lower') value = curStr.toLowerCase();
                else if (node.source === 'clear') value = '';
                else if (node.source === 'increment' || node.source === 'decrement') {
                  const parsedCur = parseFloat(curStr || '0');
                  const curNum = Number.isFinite(parsedCur) ? parsedCur : 0;
                  const parsedStep = parseFloat(resolveTemplate(node.customText || '1').value);
                  const stepNum = Number.isFinite(parsedStep) ? parsedStep : 1;
                  value = String(node.source === 'increment' ? curNum + stepNum : curNum - stepNum);
                } else if (node.source === 'extract') {
                  const r = resolveSelectorForNode(node);
                  if (!r.ok) outcome = r;
                  else {
                    const el = await waitForStableElement(r.selector, 4000, true);
                    if (!el) outcome = { ok: false, reason: 'not-found' };
                    else value = getElementContent(el, 'text');
                  }
                }
                if (outcome.ok) {
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
            } else if (node.type === 'savefile') {
              const src = node.source || 'box1';
              const fmode = node.fileMode || 'overwrite';
              let content = '';
              if (src === 'box1') content = box1.val || '';
              else if (src === 'box2') content = box2.val || '';
              else if (src === 'variable') {
                if (!node.varName) outcome = { ok: false, reason: 'missing-var-name' };
                else content = String((graph.variables && graph.variables[node.varName]) ?? '');
              } else if (src === 'all_vars') {
                content = JSON.stringify(graph.variables || {}, null, 2);
              } else if (src === 'custom') {
                content = resolveTemplate(node.customText || '').value;
              } else if (src === 'log') {
                content = logEntries.map((e) => `[${e.ts}] ${e.level.toUpperCase()} ${e.message}${e.detail ? ' | ' + e.detail : ''}`).join('\n');
              }

              if (outcome.ok) {
                const fname = sanitizeFilename(resolveTemplate(node.filename || 'wms_output.txt').value, 'wms_output.txt');
                if (fmode === 'buffer_only') {
                  fileAppendBuffers[fname] = (fileAppendBuffers[fname] ? fileAppendBuffers[fname] + '\n' : '') + content;
                  logStep('success', `📝 Buffered line for ${fname} (${fileAppendBuffers[fname].length} chars total)`);
                  outcome = { ok: true, reason: `buffered-${fname}` };
                  await sleep(60);
                } else {
                  if (fmode === 'append') {
                    fileAppendBuffers[fname] = (fileAppendBuffers[fname] ? fileAppendBuffers[fname] + '\n' : '') + content;
                    content = fileAppendBuffers[fname];
                  } else if (fmode === 'flush_buffer') {
                    if (content) {
                      fileAppendBuffers[fname] = (fileAppendBuffers[fname] ? fileAppendBuffers[fname] + '\n' : '') + content;
                    }
                    content = fileAppendBuffers[fname] || '';
                    delete fileAppendBuffers[fname];
                  }
                  const mime = fname.endsWith('.json') ? 'application/json;charset=utf-8'
                    : fname.endsWith('.csv') ? 'text/csv;charset=utf-8'
                    : 'text/plain;charset=utf-8';
                  const ok = triggerDownloadFile(fname, content, mime);
                  if (!ok) outcome = { ok: false, reason: 'download-failed' };
                  else {
                    logStep('success', `💾 Saved to ${fname} (${content.length} chars)`);
                    outcome = { ok: true, reason: `saved-${fname}` };
                    await sleep(180);
                  }
                }
              }
            } else if (node.type === 'if') {
              const check = evaluateNodeCondition(node);
              if (!check.ok) outcome = check;
              else {
                nextPort = check.isTrue ? 'true' : 'false';
                logStep('success', `🔀 ${node.cond} → ${check.isTrue ? 'TRUE' : 'FALSE'}`);
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

          if (outcome.stopLocalChain) {
            break;
          }
          if (outcome.jumpToNodeId) {
            cur = outcome.jumpToNodeId;
          } else {
            const edge = graph.edges.find((e) => e.source === cur && e.sourcePort === nextPort);
            cur = edge ? edge.target : null;
          }
        }
      }

      try {
        await runChain(startNodeId, new Set());
        if (!cancelMacro) {
          if (totalSteps >= MAX_TOTAL_STEPS) logStep('warn', `⚠️ Reached max step limit (${MAX_TOTAL_STEPS})`);
          else logStep('success', `✅ Circuit finished (${totalSteps} step${totalSteps === 1 ? '' : 's'})`);
        }
      } catch (err) {
        logStep('error', '❌ Execution crashed: ' + (err && err.message || err));
      }

      isMacroRunning = false;
      document.body.style.outline = origOutline;
      document.querySelectorAll('.wms-node').forEach((n) => n.classList.remove('is-executing'));
      setTimeout(() => { try { evaluateListeners(); } catch (_) {} }, 100);
    }

    function typeAndSubmitElement(rawEl, textToType, doSubmit = true, clearFirst = true) {
      const el = (rawEl.tagName === 'INPUT' || rawEl.tagName === 'TEXTAREA') ? rawEl
        : (rawEl.querySelector('input, textarea, [contenteditable="true"]') || rawEl);
      if (isElementDisabled(el) || isElementReadonly(el)) return false;
      try { el.scrollIntoView({ block: 'nearest', behavior: 'instant' }); } catch (_) {}
      try { el.focus(); el.click(); } catch (_) {}
      let wrote = false;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const prev = el.value;
        const finalText = clearFirst ? textToType : (prev + textToType);
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, finalText); else el.value = finalText;
        if (el._valueTracker) el._valueTracker.setValue(prev);
        wrote = true;
      } else if (el.isContentEditable) {
        el.innerText = clearFirst ? textToType : ((el.innerText || '') + textToType);
        wrote = true;
      }
      if (!wrote) return false;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (doSubmit) {
        dispatchKeyPress(el, 'Enter');
      }
      return true;
    }

    // ============ GLOBAL HANDLERS (Including Canvas Ctrl+C / Ctrl+V / Ctrl+D / Ctrl+A / Del) ============
    function onGlobalMouseDown(e) {
      if (!isMacroRunning || !e.isTrusted) return;
      if (isOwnUi(e.target)) return;
      cancelMacro = true;
      document.body.style.outline = 'none';
      logStep('warn', '🛑 Halted by manual click');
    }
    function onGlobalKeyDown(e) {
      if (e.key === 'Escape') {
        if (ctxMenuEl.style.display === 'block') {
          hideContextMenu();
          return;
        }
        if (editorOverlay.style.display === 'block' && selectedNodeIds.size > 0 && !isMacroRunning) {
          selectedNodeIds.clear();
          updateNodeSelectionVisuals();
          return;
        }
        if (!isMacroRunning) return;
        cancelMacro = true;
        document.body.style.outline = 'none';
        document.querySelectorAll('.wms-node').forEach((n) => n.classList.remove('is-executing'));
        logStep('warn', '🛑 Halted by Escape');
        return;
      }

      // Canvas Keyboard Shortcuts (Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+A, Delete) when Circuit Studio is open
      if (editorOverlay.style.display === 'block' && dictManagerEl.style.display !== 'flex') {
        const tag = (e.target && e.target.tagName) || '';
        const isTypingInInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
        if (!isTypingInInput) {
          const isCmdOrCtrl = e.ctrlKey || e.metaKey;
          const k = (e.key || '').toLowerCase();
          if (isCmdOrCtrl && k === 'c') {
            e.preventDefault();
            copySelectedNodesToClipboard();
            return;
          }
          if (isCmdOrCtrl && k === 'v') {
            e.preventDefault();
            pasteNodesFromClipboard();
            return;
          }
          if (isCmdOrCtrl && k === 'd') {
            e.preventDefault();
            duplicateSelectedNodes();
            return;
          }
          if (isCmdOrCtrl && k === 'a') {
            e.preventDefault();
            selectAllActiveNodes();
            return;
          }
          if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedNodeIds.size > 0) {
              e.preventDefault();
              deleteSelectedNodes();
              return;
            }
          }
        }
        return;
      }

      if (isOwnUi(e.target)) return;
      if (e.altKey && (e.key === '1' || e.code === 'Digit1')) { e.preventDefault(); handleCopyPaste(b1El, 'box1Data', box1, e.target); return; }
      if (e.altKey && (e.key === '2' || e.code === 'Digit2')) { e.preventDefault(); handleCopyPaste(b2El, 'box2Data', box2, e.target); return; }
      if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) && !e.altKey && !e.ctrlKey) return;
      const c = getHotkeyCombo(e);
      if (!c) return;
      const activeNodes = getActiveCanvasNodes();
      let tn = activeNodes.find((n) => n.type === 'trigger' && n.subtype === 'hotkey' && (n.val || '').toUpperCase() === c);
      if (!tn) tn = graph.nodes.find((n) => n.type === 'trigger' && n.subtype === 'hotkey' && (n.val || '').toUpperCase() === c);
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
        const ok = typeAndSubmitElement(target, obj.val, true, true);
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
      if (mainWidget.contains(el) || editorOverlay.contains(el) || dictManagerEl.contains(el) || pickerHighlight.contains(el) || ctxMenuEl.contains(el) || importFileInput === el) return true;
      for (const id of ['wms-ask-raw-overlay', 'wms-ask-text-overlay', 'wms-dict-insert-menu', 'wms-coord-picker-overlay', 'wms-coord-picker-label', 'wms-coord-picker-hint', 'wms-canvas-context-menu']) {
        const ov = document.getElementById(id);
        if (ov && ov.contains(el)) return true;
      }
      return false;
    }

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
      const listeners = graph.nodes.filter((n) => n.type === 'listener' && n.selector);
      for (const n of listeners) {
        if (isMacroRunning) break;
        const r = resolveSelectorForNode(n);
        if (!r.ok) continue;
        const el = safeQuery(r.selector);
        if (!el) continue;
        const content = getElementContent(el, 'text');
        const disabledState = isElementDisabled(el) ? 'disabled' : 'enabled';
        let match = false;
        let stateKey = content.slice(0, 120);
        const targetVal = resolveTemplate(n.val || '').value.trim();

        if (n.mode === 'becomes_enabled') {
          match = disabledState === 'enabled' && isElementVisible(el);
          stateKey = `state:${disabledState}`;
        } else if (n.mode === 'becomes_disabled') {
          match = disabledState === 'disabled';
          stateKey = `state:${disabledState}`;
        } else if (n.mode === 'text_contains') {
          if (!targetVal) match = content.length > 0;
          else match = content.toLowerCase().includes(targetVal.toLowerCase());
        } else if (!content) continue;
        else if (n.mode === 'number_greater' && targetVal) { const x = parseFloat(content.replace(/[^0-9.-]/g, '')); match = !isNaN(x) && x > parseFloat(targetVal); }
        else if (n.mode === 'number_less' && targetVal) { const x = parseFloat(content.replace(/[^0-9.-]/g, '')); match = !isNaN(x) && x < parseFloat(targetVal); }
        else if (n.mode === 'barcode_scan' && content.length >= (parseInt(targetVal, 10) || 4)) match = true;

        if (!match) {
          const prev = processedEvents.get(el);
          if (prev) processedEvents.set(el, { fired: prev.fired, lastContent: stateKey });
          continue;
        }
        const state = processedEvents.get(el);
        const isNewContent = !state || stateKey !== state.lastContent;
        const hasCooldownElapsed = !state || now - state.fired > 500;
        if (!isNewContent || !hasCooldownElapsed) continue;
        processedEvents.set(el, { fired: now, lastContent: stateKey });
        logStep('info', `👂 Listener fired: matched ${n.mode}`);
        executeGraph(n.id);
        break;
      }
    }

    const passiveWatcher = new MutationObserver(evaluateListeners);
    passiveWatcher.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled', 'class', 'style', 'hidden', 'value', 'checked', 'aria-checked']
    });
    document.addEventListener('input', evaluateListeners, true);
    document.addEventListener('change', evaluateListeners, true);

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
      ['wms-ask-text-overlay','wms-ask-raw-overlay','wms-dict-insert-menu','wms-coord-picker-overlay','wms-import-file-input','wms-canvas-context-menu','wms-marquee-box'].forEach(id => {
        const el = document.getElementById(id); if (el) el.remove();
      });
      if (saveDebounceTimer) { clearTimeout(saveDebounceTimer); saveDebounceTimer = null; }
    };
  }

  if (document.body) initWMSCircuitStudio();
  else window.addEventListener('DOMContentLoaded', initWMSCircuitStudio, { once: true });
})();