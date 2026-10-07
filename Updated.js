// 1. Core State & Visual Interface
const container = document.createElement('div');
container.id = 'wms-helper-utility-node'; 

// STEALTH MODE: Invisibility cloaks for enterprise tracking software
container.classList.add('fs-exclude'); 
container.setAttribute('data-rr-ignore', 'true'); 
container.setAttribute('data-dd-privacy', 'mask'); 
container.setAttribute('data-hj-suppress', 'true'); 
container.setAttribute('data-private', 'true'); 

let macros = [];
let cancelMacro = false; 
let isMacroRunning = false; 
let processedElements = new WeakMap(); 

function createBox(id, labelText) {
  const wrapper = document.createElement('div');
  const label = document.createElement('div');
  label.className = 'floating-clipboard-label';
  label.innerText = labelText;
  
  const textarea = document.createElement('textarea');
  textarea.className = 'floating-clipboard-box';
  textarea.id = id;
  
  wrapper.appendChild(label);
  wrapper.appendChild(textarea);
  return { wrapper, textarea };
}

const box1 = createBox('floating-box-1', 'Box 1 (Alt + 1)');
const box2 = createBox('floating-box-2', 'Box 2 (Alt + 2)');

container.innerHTML = `
  <div id="main-view" style="display:flex; flex-direction:column; gap:12px;"></div>
  <div id="settings-view" style="display:none; flex-direction:column; gap:10px; max-height: 500px; overflow-y: auto;">
    <h3 style="margin:0; font-size:14px; border-bottom:1px solid #ccc; padding-bottom:5px;">⚙️ WMS Automation Builder</h3>
    <button id="add-macro-btn" style="background:#28a745; color:white; border:none; padding:6px; cursor:pointer; font-weight:bold; border-radius:4px;">+ Create New Macro</button>
    <div id="macro-list"></div>
  </div>
  <button id="toggle-settings-btn" style="margin-top:5px; background:#6c757d; color:white; border:none; padding:5px; cursor:pointer; border-radius:4px;">⚙️ Settings</button>
`;

document.body.appendChild(container);
const mainView = document.getElementById('main-view');
const settingsView = document.getElementById('settings-view');
mainView.appendChild(box1.wrapper);
mainView.appendChild(box2.wrapper);

document.getElementById('toggle-settings-btn').addEventListener('click', () => {
  const isSettings = settingsView.style.display === 'flex';
  settingsView.style.display = isSettings ? 'none' : 'flex';
  mainView.style.display = isSettings ? 'flex' : 'none';
});

// 2. Storage & Sync (WITH MULTI-TAB REAL-TIME UPDATES)
chrome.storage.local.get(['box1Data', 'box2Data', 'savedMacros'], (result) => {
  if (result.box1Data) box1.textarea.value = result.box1Data;
  if (result.box2Data) box2.textarea.value = result.box2Data;
  if (result.savedMacros) {
    macros = result.savedMacros;
    renderMacros();
    checkPassiveURLTriggers();
  }
});

box1.textarea.addEventListener('input', () => chrome.storage.local.set({ box1Data: box1.textarea.value }));
box2.textarea.addEventListener('input', () => chrome.storage.local.set({ box2Data: box2.textarea.value }));

function saveMacros() {
  chrome.storage.local.set({ savedMacros: macros });
}

// REAL-TIME SYNC: Listen for changes from OTHER tabs to keep UI instantly updated
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.box1Data && document.activeElement !== box1.textarea) {
      box1.textarea.value = changes.box1Data.newValue || '';
    }
    if (changes.box2Data && document.activeElement !== box2.textarea) {
      box2.textarea.value = changes.box2Data.newValue || '';
    }
    if (changes.savedMacros) {
      macros = changes.savedMacros.newValue || [];
      renderMacros(); // Instantly update visual blocks if edited in another tab
    }
  }
});

// 3. Robust Element Picker & Safety
function getExactSelector(el) {
  if (!el) return '';
  if (el.id) return `#${CSS.escape(el.id)}`;
  
  let path = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector = '#' + CSS.escape(el.id);
      path.unshift(selector);
      break; 
    } else {
      let sibling = el;
      let nth = 1;
      while (sibling = sibling.previousElementSibling) {
        if (sibling.nodeName.toLowerCase() === selector) nth++;
      }
      if (nth > 1) selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(' > ');
}

function isSafeToClick(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0' || style.pointerEvents === 'none') return false;
  if (el.disabled || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.readOnly || el.classList.contains('p-disabled') || el.classList.contains('mat-button-disabled')) return false;
  if (el.offsetParent === null && style.position !== 'fixed') return false;
  if (rect.width === 0 || rect.height === 0 || rect.top >= window.innerHeight || rect.bottom <= 0) return false;
  
  // POPUP/OCCLUSION CHECK: Make sure nothing is physically covering the element
  const centerX = rect.left + (rect.width / 2);
  const centerY = rect.top + (rect.height / 2);
  const topElement = document.elementFromPoint(centerX, centerY);
  
  if (topElement && topElement !== el && !el.contains(topElement) && !topElement.contains(el)) {
    console.warn("Safety Abort: Element is covered by a popup or modal", topElement);
    return false;
  }

  return true;
}

// 4. Macro Builder UI
document.getElementById('add-macro-btn').addEventListener('click', () => {
  macros.push({ id: Date.now(), trigger: 'hotkey', triggerValue: '', blocks: [] });
  saveMacros();
});

function renderMacros() {
  const list = document.getElementById('macro-list');
  list.innerHTML = '';
  macros.forEach((macro, macroIndex) => {
    const card = document.createElement('div');
    card.style = "border:1px solid #ccc; border-radius:6px; padding:8px; margin-bottom:10px; background:#f8f9fa; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";
    
    const triggerHtml = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:4px;">
        <select class="trigger-type" style="width:35%; font-size:11px; padding:2px;">
          <option value="hotkey" ${macro.trigger === 'hotkey' ? 'selected' : ''}>⌨️ Hotkey</option>
          <option value="url" ${macro.trigger === 'url' ? 'selected' : ''}>🔗 Auto (URL)</option>
          <option value="element" ${macro.trigger === 'element' ? 'selected' : ''}>👁️ Auto (Element)</option>
        </select>
        
        ${macro.trigger === 'element' 
          ? `<button class="pick-trigger" style="flex-grow:1; background:#ffe0b2; color:#cc7000; border:1px solid #ffcc80; cursor:pointer; font-size:10px; padding:2px;">🎯 Pick Trigger</button>` 
          : `<input type="text" class="trigger-val" placeholder="${macro.trigger === 'hotkey' ? 'Press keys...' : '/wms/receive'}" value="${macro.triggerValue || ''}" style="flex-grow:1; font-size:11px; padding:2px;">`
        }
        
        <button class="del-macro" style="color:#d93025; border:none; background:none; cursor:pointer; font-size:12px;" title="Delete Macro">✖</button>
      </div>
      ${macro.trigger === 'element' && macro.triggerValue ? `<div style="font-size:9px; color:#666; margin-bottom:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Target: ${macro.triggerValue.split(' > ').pop()}</div>` : ''}
    `;

    card.innerHTML = triggerHtml + `
      <div class="blocks-container" style="display:flex; flex-direction:column; gap:5px; margin-bottom:8px; padding-top:4px; border-top:1px dashed #ccc;"></div>
      <div style="display:flex; gap:4px; flex-wrap:wrap;">
        <button class="add-click" style="font-size:10px; background:#e3f2fd; color:#0d6efd; border:1px solid #90caf9; padding:4px; border-radius:3px; flex:1; cursor:pointer;">+ Click</button>
        <button class="add-type" style="font-size:10px; background:#e8f5e9; color:#198754; border:1px solid #a5d6a7; padding:4px; border-radius:3px; flex:1; cursor:pointer;">+ Type</button>
        <button class="add-wait-el" style="font-size:10px; background:#fff3e0; color:#fd7e14; border:1px solid #ffcc80; padding:4px; border-radius:3px; flex:1; cursor:pointer;">+ Wait Element</button>
      </div>
    `;

    const triggerType = card.querySelector('.trigger-type');
    triggerType.addEventListener('change', (e) => {
      macros[macroIndex].trigger = e.target.value;
      macros[macroIndex].triggerValue = '';
      saveMacros();
    });

    if (macro.trigger === 'hotkey') {
      const triggerVal = card.querySelector('.trigger-val');
      triggerVal.addEventListener('keydown', (e) => {
        e.preventDefault();
        const keys = [];
        if (e.ctrlKey) keys.push('Ctrl');
        if (e.altKey) keys.push('Alt');
        if (e.shiftKey) keys.push('Shift');
        if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift') keys.push(e.key.toUpperCase());
        const combo = keys.join('+');
        triggerVal.value = combo;
        macros[macroIndex].triggerValue = combo;
        saveMacros();
      });
    } else if (macro.trigger === 'url') {
      const triggerVal = card.querySelector('.trigger-val');
      triggerVal.addEventListener('change', (e) => {
        macros[macroIndex].triggerValue = e.target.value;
        saveMacros();
      });
    } else if (macro.trigger === 'element') {
      const pickTriggerBtn = card.querySelector('.pick-trigger');
      pickTriggerBtn.addEventListener('click', () => startPicker(macroIndex, null, true));
    }

    card.querySelector('.del-macro').addEventListener('click', () => {
      macros.splice(macroIndex, 1);
      saveMacros();
    });

    const blocksContainer = card.querySelector('.blocks-container');
    macro.blocks.forEach((block, blockIndex) => {
      const bDiv = document.createElement('div');
      let bgColor = block.type === 'click' ? '#f1f8ff' : block.type === 'type' ? '#f0fff4' : '#fff9f0';
      let borderColor = block.type === 'click' ? '#90caf9' : block.type === 'type' ? '#a5d6a7' : '#ffcc80';
      
      bDiv.style = `border: 1px solid ${borderColor}; background: ${bgColor}; border-radius:4px; padding:4px; font-size:11px; display:flex; flex-direction:column; gap:4px;`;
      
      let headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:bold; color:#555;">${blockIndex + 1}. ${block.type.toUpperCase()}</span>
          <div style="display:flex; gap:2px;">
            <button class="pick-target" style="background:#fff; border:1px solid #ccc; cursor:pointer; padding:2px 4px; border-radius:3px;" title="Pick Target">🎯</button>
            ${blockIndex > 0 ? `<button class="move-up" style="background:none; border:none; cursor:pointer;" title="Move Up">↑</button>` : ''}
            ${blockIndex < macro.blocks.length - 1 ? `<button class="move-down" style="background:none; border:none; cursor:pointer;" title="Move Down">↓</button>` : ''}
            <button class="del-block" style="color:#d93025; background:none; border:none; cursor:pointer;" title="Delete Block">✖</button>
          </div>
        </div>
        ${block.selector ? `<div style="font-size:9px; color:#666; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${block.selector.split(' > ').pop()}</div>` : '<div style="font-size:9px; color:#d93025;">No target picked!</div>'}
      `;

      bDiv.innerHTML = headerHtml;

      if (block.type === 'type') {
         const typeControls = document.createElement('div');
         typeControls.style = "display:flex; gap:4px; margin-top:2px;";
         typeControls.innerHTML = `
            <select class="type-source" style="font-size:9px; padding:2px; flex:1;">
               <option value="box1" ${block.source === 'box1' ? 'selected' : ''}>Use Box 1</option>
               <option value="box2" ${block.source === 'box2' ? 'selected' : ''}>Use Box 2</option>
               <option value="custom" ${block.source === 'custom' ? 'selected' : ''}>Custom Text</option>
            </select>
            ${block.source === 'custom' ? `<input type="text" class="type-custom-val" value="${block.customText || ''}" placeholder="Type text..." style="font-size:9px; padding:2px; flex:1;">` : ''}
         `;
         
         typeControls.querySelector('.type-source').addEventListener('change', (e) => {
            macros[macroIndex].blocks[blockIndex].source = e.target.value;
            saveMacros();
         });
         
         const customInput = typeControls.querySelector('.type-custom-val');
         if(customInput) {
             customInput.addEventListener('change', (e) => {
                macros[macroIndex].blocks[blockIndex].customText = e.target.value;
                saveMacros();
             });
         }
         bDiv.appendChild(typeControls);
      }

      bDiv.querySelector('.pick-target').addEventListener('click', () => startPicker(macroIndex, blockIndex, false));
      bDiv.querySelector('.del-block').addEventListener('click', () => { macros[macroIndex].blocks.splice(blockIndex, 1); saveMacros(); });
      
      if(bDiv.querySelector('.move-up')) {
          bDiv.querySelector('.move-up').addEventListener('click', () => {
              [macros[macroIndex].blocks[blockIndex - 1], macros[macroIndex].blocks[blockIndex]] = [macros[macroIndex].blocks[blockIndex], macros[macroIndex].blocks[blockIndex - 1]];
              saveMacros();
          });
      }
      if(bDiv.querySelector('.move-down')) {
          bDiv.querySelector('.move-down').addEventListener('click', () => {
              [macros[macroIndex].blocks[blockIndex + 1], macros[macroIndex].blocks[blockIndex]] = [macros[macroIndex].blocks[blockIndex], macros[macroIndex].blocks[blockIndex + 1]];
              saveMacros();
          });
      }

      blocksContainer.appendChild(bDiv);
    });

    card.querySelector('.add-click').addEventListener('click', () => { macros[macroIndex].blocks.push({ type: 'click', selector: '' }); saveMacros(); });
    card.querySelector('.add-type').addEventListener('click', () => { macros[macroIndex].blocks.push({ type: 'type', selector: '', source: 'box1', customText: '' }); saveMacros(); });
    card.querySelector('.add-wait-el').addEventListener('click', () => { macros[macroIndex].blocks.push({ type: 'wait_element', selector: '' }); saveMacros(); });

    list.appendChild(card);
  });
}

// 5. Picker Logic
function startPicker(macroIndex, blockIndex, isTrigger) {
  document.body.style.cursor = 'crosshair';
  document.body.style.outline = '3px dashed #d93025';
  
  function pick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    let targetEl = e.target;
    const closestInteractive = targetEl.closest('button, a, [role="button"]');
    if (closestInteractive && !['input','textarea'].includes(targetEl.tagName.toLowerCase())) {
        targetEl = closestInteractive;
    }

    const exactSelector = getExactSelector(targetEl);
    
    if (isTrigger) {
        macros[macroIndex].triggerValue = exactSelector;
    } else {
        macros[macroIndex].blocks[blockIndex].selector = exactSelector;
    }
    
    saveMacros();
    document.body.style.cursor = 'default';
    document.body.style.outline = 'none';
    document.removeEventListener('click', pick, true);
  }
  document.addEventListener('click', pick, true);
}

// 6. Execution Engine (WITH PROACTIVE DOM VALIDATION)
async function runMacro(macro) {
  if (isMacroRunning) return; // Prevent double-execution
  isMacroRunning = true;
  cancelMacro = false;
  
  const originalBorder = document.body.style.border;
  document.body.style.border = '4px solid #fd7e14'; 
  
  for (let block of macro.blocks) {
    if (cancelMacro) { console.log('🛑 Macro Aborted.'); break; } 
    if (!block.selector) continue; 

    if (block.type === 'wait_element') {
      await waitForElement(block.selector, 10000); // Wait up to 10 seconds for explicit blocks
    } 
    else if (block.type === 'click') {
      // PROACTIVE DOM CHECK: Wait up to 3 seconds for target to exist before blindly clicking
      const isReady = await waitForElement(block.selector, 3000);
      const el = document.querySelector(block.selector);
      
      if (isReady && el) {
        el.click();
        await new Promise(r => setTimeout(r, 150)); 
      } else {
        console.warn("Safety Abort: Click target detached or missing.", block.selector);
        cancelMacro = true;
      }
    } 
    else if (block.type === 'type') {
      // PROACTIVE DOM CHECK
      const isReady = await waitForElement(block.selector, 3000);
      const el = document.querySelector(block.selector);
      
      if (isReady && el) {
        el.click(); 
        el.focus();
        
        let textToType = '';
        if (block.source === 'box1') textToType = box1.textarea.value;
        else if (block.source === 'box2') textToType = box2.textarea.value;
        else if (block.source === 'custom') textToType = block.customText;

        // ENTERPRISE REACT/ANGULAR INPUT BYPASS
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        
        if (el.tagName.toLowerCase() === 'input' && nativeInputValueSetter) {
            nativeInputValueSetter.call(el, textToType);
        } else if (el.tagName.toLowerCase() === 'textarea' && nativeTextAreaValueSetter) {
            nativeTextAreaValueSetter.call(el, textToType);
        } else {
            el.value = textToType; 
        }

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        
        await new Promise(r => setTimeout(r, 100));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        await new Promise(r => setTimeout(r, 150));
      } else {
        console.warn("Safety Abort: Type target detached or missing.", block.selector);
        cancelMacro = true;
      }
    }
  }
  
  document.body.style.border = originalBorder;
  isMacroRunning = false;
  cancelMacro = false;
}

function waitForElement(selector, timeoutMs = 10000) {
  return new Promise(resolve => {
    if (document.querySelector(selector) && isSafeToClick(document.querySelector(selector))) return resolve(true);
    
    let timeoutTimer;
    const observer = new MutationObserver(() => {
      if (cancelMacro) { 
        observer.disconnect(); 
        clearTimeout(timeoutTimer);
        resolve(false); 
      }
      const el = document.querySelector(selector);
      if (el && isSafeToClick(el)) {
        observer.disconnect();
        clearTimeout(timeoutTimer);
        resolve(true);
      }
    });

    // Flexible Timeout: Abort safely if elements never render
    timeoutTimer = setTimeout(() => {
        console.warn('🛑 Wait for element timed out:', selector);
        if (timeoutMs >= 10000) cancelMacro = true; // Only hard-abort macro on explicitly long wait blocks
        observer.disconnect();
        resolve(false);
    }, timeoutMs);

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  });
}

// 7. Event Listeners (Human Override & Hotkeys)

// THE HUMAN TOUCH OVERRIDE: Automatically abort if the user clicks the mouse manually
document.addEventListener('mousedown', (e) => {
  if (isMacroRunning && e.isTrusted) {
      console.log('🛑 Human Intervention Detected! Auto-aborting macro.');
      cancelMacro = true;
      document.body.style.border = 'none'; 
      }
  
