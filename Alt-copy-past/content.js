// --- 1. CORE VISUAL INTERFACE & DYNAMIC STATE ---
const container = document.createElement('div');
container.id = 'wms-extension-container';
container.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 290px;
  background-color: #ffffff;
  border: 1px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.2);
  z-index: 2147483647;
  font-family: Arial, sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 90vh;
`;
document.body.appendChild(container);

// State Variables
let customTextboxes = []; 
let customClickers = []; 
let macroSteps = []; 
let activePickerKey = null; 
let recordingKeyFor = null; 
let hoveredElement = null;

// --- 2. MAIN VIEW (Textboxes Only) ---
const mainView = document.createElement('div');
mainView.style.cssText = 'display: flex; flex-direction: column; padding: 10px; overflow-y: auto;';

const header = document.createElement('div');
header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;';
header.innerHTML = '<strong style="color: #333; font-size: 13px;">WMS Assistant</strong>';

const settingsBtn = document.createElement('button');
settingsBtn.innerHTML = '⚙️ Set';
settingsBtn.style.cssText = 'background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; padding: 2px 8px; font-size: 12px; font-weight: bold;';
settingsBtn.onclick = () => toggleMenu(true);
header.appendChild(settingsBtn);

const boxesSection = document.createElement('div');
boxesSection.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

mainView.appendChild(header);
mainView.appendChild(boxesSection);
container.appendChild(mainView);


// --- 3. SETTINGS MENU VIEW (Centralized Control) ---
const settingsView = document.createElement('div');
settingsView.style.cssText = 'display: none; flex-direction: column; padding: 10px; overflow-y: auto; background-color: #fafafa; max-height: 450px;';

const settingsHeader = document.createElement('div');
settingsHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 5px;';
settingsHeader.innerHTML = '<strong style="color: #333; font-size: 13px;">Control Center</strong>';

const backBtn = document.createElement('button');
backBtn.innerHTML = '◀ Back';
backBtn.style.cssText = 'background: #d93025; color: white; border: none; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 11px; font-weight: bold;';
backBtn.onclick = () => toggleMenu(false);
settingsHeader.appendChild(backBtn);
settingsView.appendChild(settingsHeader);

// Settings - Section 1: Textboxes
const textConfigSection = createSettingsSection('Custom Textboxes');
const tbList = document.createElement('div');
tbList.id = 'custom-textbox-list';
tbList.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;';
textConfigSection.appendChild(tbList);

const addBoxBtn = document.createElement('button');
addBoxBtn.innerText = '+ Add New Textbox';
addBoxBtn.style.cssText = 'width: 100%; padding: 6px; margin-bottom: 8px; cursor: pointer; border: 1px dashed #aaa; border-radius: 4px; background: #fff; font-size: 11px; font-weight: bold; color: #333;';
addBoxBtn.onclick = () => {
  const newId = 'tb_' + Date.now();
  customTextboxes.push({ id: newId, keyCombo: '', displayKey: 'Click to Bind Key', value: '' });
  saveCustomTextboxes();
  renderTextboxSettings();
  renderBoxes();
  renderMacroSteps(); 
};
textConfigSection.appendChild(addBoxBtn);
settingsView.appendChild(textConfigSection);

// Settings - Section 2: Link Chain (Macro)
const macroSection = createSettingsSection('Link Chain Sequence (Alt + Q)');
const macroList = document.createElement('div');
macroList.id = 'macro-step-list';
macroList.style.cssText = 'display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;';
macroSection.appendChild(macroList);

const macroButtonsRow = document.createElement('div');
macroButtonsRow.style.cssText = 'display: flex; gap: 4px;';

const addMacroClickBtn = document.createElement('button');
addMacroClickBtn.innerText = '+ Add Click';
addMacroClickBtn.style.cssText = 'flex: 1; padding: 6px; cursor: pointer; border: 1px solid #17a2b8; border-radius: 4px; background: #e0f7fa; font-size: 10px; font-weight: bold; color: #00838f;';
addMacroClickBtn.onclick = () => {
  macroSteps.push({ id: 'm_' + Date.now(), type: 'click', selector: '' });
  saveMacroSteps();
  renderMacroSteps();
};

const addMacroInputBtn = document.createElement('button');
addMacroInputBtn.innerText = '+ Add Type Text';
addMacroInputBtn.style.cssText = 'flex: 1; padding: 6px; cursor: pointer; border: 1px solid #6c757d; border-radius: 4px; background: #f8f9fa; font-size: 10px; font-weight: bold; color: #495057;';
addMacroInputBtn.onclick = () => {
  macroSteps.push({ id: 'm_' + Date.now(), type: 'input', selector: '', sourceBoxId: '' });
  saveMacroSteps();
  renderMacroSteps();
};

macroButtonsRow.appendChild(addMacroClickBtn);
macroButtonsRow.appendChild(addMacroInputBtn);
macroSection.appendChild(macroButtonsRow);
settingsView.appendChild(macroSection);

// Settings - Section 3: CUSTOM HOTKEYS
const clickerSection = createSettingsSection('Custom Multi-Clickers');
const clickerList = document.createElement('div');
clickerList.id = 'custom-clicker-list';
clickerList.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;';
clickerSection.appendChild(clickerList);

const addClickerBtn = document.createElement('button');
addClickerBtn.innerText = '+ Add New Sequence';
addClickerBtn.style.cssText = 'width: 100%; padding: 6px; cursor: pointer; border: 1px dashed #aaa; border-radius: 4px; background: #fff; font-size: 11px; font-weight: bold; color: #007bff;';
addClickerBtn.onclick = () => {
  const newId = Date.now().toString();
  customClickers.push({ id: newId, keyCombo: '', displayKey: 'Click to Bind Key', selectors: [] });
  saveCustomClickers();
  renderCustomClickers();
};
clickerSection.appendChild(addClickerBtn);
settingsView.appendChild(clickerSection);
container.appendChild(settingsView);


// --- HELPER FUNCTIONS FOR UI ---
function createSettingsSection(title) {
  const div = document.createElement('div');
  div.style.cssText = 'border: 1px solid #e0e0e0; border-radius: 4px; padding: 8px; margin-bottom: 10px; background: white;';
  div.innerHTML = `<div style="font-size: 11px; font-weight: bold; color: #555; margin-bottom: 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">${title}</div>`;
  return div;
}

// --- RENDERING DYNAMIC LINK CHAIN STEPS ---
function renderMacroSteps() {
  const list = document.getElementById('macro-step-list');
  if (!list) return;
  list.innerHTML = '';
  
  if (macroSteps.length === 0) {
     list.innerHTML = '<div style="font-size:10px; color:#999; font-style:italic;">No steps added yet. Add steps below to build your Alt+Q sequence.</div>';
     return;
  }

  macroSteps.forEach((step, index) => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; flex-direction: column; gap: 4px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; background: #fff; font-size: 10px;';
    
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    
    const title = document.createElement('strong');
    title.innerText = `Step ${index + 1}: ${step.type === 'click' ? 'Mouse Click' : 'Type Text'}`;
    title.style.color = step.type === 'click' ? '#00838f' : '#495057';
    
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '❌';
    delBtn.style.cssText = 'padding: 2px; cursor: pointer; border: none; background: transparent; font-size: 9px;';
    delBtn.onclick = () => {
      macroSteps = macroSteps.filter(s => s.id !== step.id);
      saveMacroSteps();
      renderMacroSteps();
    };
    
    topRow.appendChild(title);
    topRow.appendChild(delBtn);
    row.appendChild(topRow);

    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'display: flex; gap: 4px; align-items: center; justify-content: space-between;';

    if (step.type === 'input') {
      const select = document.createElement('select');
      select.style.cssText = 'font-size: 9px; padding: 2px; max-width: 80px;';
      select.innerHTML = '<option value="">- Select Box -</option>';
      customTextboxes.forEach((tb, i) => {
        const opt = document.createElement('option');
        opt.value = tb.id;
        opt.innerText = `Box ${i + 1}`;
        if (tb.id === step.sourceBoxId) opt.selected = true;
        select.appendChild(opt);
      });
      select.onchange = (e) => {
        step.sourceBoxId = e.target.value;
        saveMacroSteps();
      };
      actionRow.appendChild(select);
    }

    const pickBtn = document.createElement('button');
    pickBtn.innerText = '🎯 Pick Target';
    pickBtn.className = 'pick-btn';
    pickBtn.dataset.key = `macro_${step.id}`;
    pickBtn.style.cssText = 'padding: 2px 6px; font-size: 9px; cursor: pointer; border: 1px solid #28a745; border-radius: 3px; background: #e8f5e9; color: #28a745; font-weight: bold; flex: 1;';
    pickBtn.onclick = () => togglePickerMode(`macro_${step.id}`, pickBtn);
    actionRow.appendChild(pickBtn);
    row.appendChild(actionRow);

    if (step.selector) {
      const targetLabel = document.createElement('div');
      targetLabel.innerText = `Target: ${step.selector.split(' > ').pop()}`;
      targetLabel.style.cssText = 'font-size: 9px; color: #d93025; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-top: 2px; border-top: 1px dashed #eee; margin-top: 2px;';
      row.appendChild(targetLabel);
    }

    list.appendChild(row);
  });
}

function saveMacroSteps() {
  chrome.storage.local.set({ macroSteps });
}

// --- DYNAMIC CUSTOM CLICKER RENDERER ---
function renderCustomClickers() {
  const list = document.getElementById('custom-clicker-list');
  if (!list) return;
  list.innerHTML = '';
  
  customClickers.forEach(clicker => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; flex-direction: column; gap: 4px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa;';
    
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 4px;';
    
    // Keybind Button
    const bindBtn = document.createElement('button');
    bindBtn.innerText = recordingKeyFor === clicker.id ? 'Press keys...' : clicker.displayKey;
    bindBtn.style.cssText = `flex: 1; padding: 4px; font-size: 10px; font-weight: bold; cursor: pointer; border: 1px solid #aaa; border-radius: 3px; background: ${recordingKeyFor === clicker.id ? '#ffc107' : '#fff'};`;
    bindBtn.onclick = () => {
      recordingKeyFor = clicker.id;
      renderCustomClickers();
    };
    
    // Target Picker
    const pickBtn = document.createElement('button');
    pickBtn.innerText = '+ 🎯 Pick';
    pickBtn.className = 'pick-btn';
    pickBtn.style.cssText = 'padding: 4px 6px; font-size: 10px; cursor: pointer; border: 1px solid #28a745; border-radius: 3px; background: #e8f5e9; color: #28a745; font-weight: bold;';
    pickBtn.onclick = () => togglePickerMode(`clicker_${clicker.id}`, pickBtn);
    
    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '❌';
    delBtn.style.cssText = 'padding: 4px; cursor: pointer; border: none; background: transparent; font-size: 10px;';
    delBtn.onclick = () => {
      customClickers = customClickers.filter(c => c.id !== clicker.id);
      saveCustomClickers();
      renderCustomClickers();
    };
    
    topRow.appendChild(bindBtn);
    topRow.appendChild(pickBtn);
    topRow.appendChild(delBtn);
    
    // Target Label Indicator
    const targetContainer = document.createElement('div');
    targetContainer.style.cssText = 'display: flex; flex-direction: column; gap: 2px; margin-top: 4px;';
    
    if (!clicker.selectors || clicker.selectors.length === 0) {
       const emptyLbl = document.createElement('div');
       emptyLbl.innerText = 'No targets added yet.';
       emptyLbl.style.cssText = 'font-size: 9px; color: #d93025;';
       targetContainer.appendChild(emptyLbl);
    } else {
       clicker.selectors.forEach((sel, idx) => {
         const tRow = document.createElement('div');
         tRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #eef; padding: 2px 4px; border-radius: 3px; font-size: 9px; border: 1px solid #ccd;';
         
         const selText = document.createElement('span');
         selText.innerText = `${idx + 1}. ` + (sel.split(' > ').pop() || sel);
         selText.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; color: #333;';
         
         const remBtn = document.createElement('button');
         remBtn.innerText = 'x';
         remBtn.style.cssText = 'border: none; background: transparent; color: #d93025; font-weight: bold; cursor: pointer; padding: 0 4px; font-size: 10px;';
         remBtn.onclick = () => {
           clicker.selectors.splice(idx, 1);
           saveCustomClickers();
           renderCustomClickers();
         };
         
         tRow.appendChild(selText);
         tRow.appendChild(remBtn);
         targetContainer.appendChild(tRow);
       });
    }
    
    row.appendChild(topRow);
    row.appendChild(targetContainer);
    list.appendChild(row);
  });
}

function saveCustomClickers() {
  chrome.storage.local.set({ customClickers });
}

function toggleMenu(showSettings) {
  if (showSettings) {
    mainView.style.display = 'none';
    settingsView.style.display = 'flex';
  } else {
    settingsView.style.display = 'none';
    mainView.style.display = 'flex';
    if (activePickerKey) cancelPickerMode();
    recordingKeyFor = null; 
    renderCustomClickers();
    renderTextboxSettings();
    renderMacroSteps();
  }
}

function renderTextboxSettings() {
  const list = document.getElementById('custom-textbox-list');
  if (!list) return;
  list.innerHTML = '';
  
  customTextboxes.forEach((tb, index) => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 4px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa;';
    
    const label = document.createElement('span');
    label.innerText = `Box ${index + 1}:`;
    label.style.cssText = 'font-size: 11px; font-weight: bold; width: 35px;';

    const bindBtn = document.createElement('button');
    bindBtn.innerText = recordingKeyFor === tb.id ? 'Press keys...' : tb.displayKey;
    bindBtn.style.cssText = `flex: 1; padding: 4px; font-size: 10px; font-weight: bold; cursor: pointer; border: 1px solid #aaa; border-radius: 3px; background: ${recordingKeyFor === tb.id ? '#ffc107' : '#fff'};`;
    bindBtn.onclick = () => {
      recordingKeyFor = tb.id;
      renderTextboxSettings();
      renderCustomClickers();
    };
    
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '❌';
    delBtn.style.cssText = 'padding: 4px; cursor: pointer; border: none; background: transparent; font-size: 10px;';
    delBtn.onclick = () => {
      customTextboxes = customTextboxes.filter(c => c.id !== tb.id);
      saveCustomTextboxes();
      renderTextboxSettings();
      renderBoxes();
      renderMacroSteps();
    };
    
    row.appendChild(label);
    row.appendChild(bindBtn);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

function saveCustomTextboxes() {
  chrome.storage.local.set({ customTextboxes });
}

function createBox(id, labelText) {
  const wrapper = document.createElement('div');
  const label = document.createElement('div');
  label.innerText = labelText;
  label.style.cssText = 'font-size: 11px; color: #555; font-weight: bold; margin-bottom: 2px;';
  
  const textarea = document.createElement('textarea');
  textarea.id = `textarea-${id}`;
  textarea.style.cssText = 'width: 100%; height: 50px; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; resize: vertical; box-sizing: border-box;';
  
  wrapper.appendChild(label);
  wrapper.appendChild(textarea);
  return { wrapper, textarea };
}

function renderBoxes() {
  boxesSection.innerHTML = '';
  customTextboxes.forEach((tb, index) => {
    const box = createBox(tb.id, `Box ${index + 1} (${tb.displayKey})`);
    box.textarea.value = tb.value || '';
    box.textarea.addEventListener('input', () => {
      tb.value = box.textarea.value;
      saveCustomTextboxes();
    });
    boxesSection.appendChild(box.wrapper);
  });
}

// --- INITIALIZATION ---
chrome.storage.local.get(null, (result) => {
  if (result.customTextboxes && result.customTextboxes.length > 0) {
    customTextboxes = result.customTextboxes;
  } else {
    customTextboxes = [
      { id: 'tb_1', keyCombo: 'alt+1', displayKey: 'Alt + 1', value: result.box1Data || '' },
      { id: 'tb_2', keyCombo: 'alt+2', displayKey: 'Alt + 2', value: result.box2Data || '' }
    ];
    chrome.storage.local.set({ customTextboxes });
  }
  
  if (result.macroSteps) {
    macroSteps = result.macroSteps;
  } else if (result.target_macroInput || result.target_macroBtn) {
    if (result.target_macroInput) macroSteps.push({ id: 'm_' + Date.now(), type: 'input', selector: result.target_macroInput, sourceBoxId: result.macroSourceBoxId || '' });
    if (result.target_macroBtn) macroSteps.push({ id: 'm_' + Date.now()+1, type: 'click', selector: result.target_macroBtn });
    saveMacroSteps();
  }

  if (result.customClickers) {
    customClickers = result.customClickers.map(c => {
       if (c.selector && !c.selectors) { c.selectors = [c.selector]; delete c.selector; }
       if (!c.selectors) c.selectors = [];
       return c;
    });
  }
  
  renderBoxes();
  renderTextboxSettings();
  renderCustomClickers();
  renderMacroSteps();
});

function getExactSelector(el) {
  if (el.id) return '#' + CSS.escape(el.id); 
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


// --- PICKER LOGIC ---
function togglePickerMode(key, btnElement) {
  if (activePickerKey === key) {
    cancelPickerMode();
    return;
  }
  cancelPickerMode(); 
  activePickerKey = key;
  document.body.style.border = '3px dashed #d93025';
  
  if (btnElement) {
    btnElement.innerText = 'Stop';
    btnElement.style.backgroundColor = '#ffe5e5';
    btnElement.style.borderColor = '#d93025';
  }
}

function cancelPickerMode() {
  activePickerKey = null;
  document.body.style.border = '';
  document.querySelectorAll('.pick-btn').forEach(b => {
    b.innerText = b.innerText === 'Stop' ? (b.dataset.key ? '🎯 Pick Target' : '+ 🎯 Pick') : b.innerText;
    b.style.backgroundColor = '#e8f5e9';
    b.style.borderColor = '#28a745';
  });
  if (hoveredElement) {
    hoveredElement.style.outline = '';
    hoveredElement = null;
  }
}

document.addEventListener('mouseover', (e) => {
  if (!activePickerKey) return;
  e.stopPropagation();
  if (container.contains(e.target)) return;
  hoveredElement = e.target;
  hoveredElement.style.outline = '3px solid #d93025';
  hoveredElement.style.cursor = 'crosshair';
}, true);

document.addEventListener('mouseout', (e) => {
  if (!activePickerKey) return;
  e.stopPropagation();
  if (hoveredElement) {
    hoveredElement.style.outline = '';
    hoveredElement.style.cursor = '';
  }
}, true);

document.addEventListener('click', (e) => {
  if (!activePickerKey) return;
  if (container.contains(e.target)) return;

  e.preventDefault(); 
  e.stopPropagation();
  
  let targetEl = e.target;
  
  if (!activePickerKey.includes('input')) {
    const closestInteractive = targetEl.closest('button, a, [role="button"]');
    if (closestInteractive) targetEl = closestInteractive;
  }
  
  const selector = getExactSelector(targetEl);

  if (activePickerKey.startsWith('clicker_')) {
    const id = activePickerKey.split('_')[1];
    const clicker = customClickers.find(c => c.id === id);
    if (clicker) {
      if (!clicker.selectors) clicker.selectors = [];
      clicker.selectors.push(selector);
      saveCustomClickers();
      renderCustomClickers();
    }
  } else if (activePickerKey.startsWith('macro_')) {
    const id = activePickerKey.replace('macro_', '');
    const step = macroSteps.find(s => s.id === id);
    if (step) {
      step.selector = selector;
      saveMacroSteps();
      renderMacroSteps();
    }
  }
  
  cancelPickerMode();
}, true);


// --- WMS SAFETY CHECKS ---
function isSafeToInteract(element) {
  if (!element) return false;
  if (element.disabled === true || element.hasAttribute('disabled')) return false; 
  if (element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('readonly')) return false;

  const disabledClasses = ['disabled', 'is-disabled', 'p-disabled', 'mat-button-disabled', 'Mui-disabled'];
  if (disabledClasses.some(className => element.classList.contains(className))) return false;

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  const style = window.getComputedStyle(element);
  if (element.offsetParent === null && style.position !== 'fixed') return false;
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || parseFloat(style.opacity) < 0.1 || style.pointerEvents === 'none') return false;

  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;
  if (rect.top < 0 || rect.left < 0 || rect.bottom > windowHeight || rect.right > windowWidth) return false;

  const centerX = rect.left + (rect.width / 2);
  const centerY = rect.top + (rect.height / 2);
  const topmostElement = document.elementFromPoint(centerX, centerY);

  if (!topmostElement) return false; 
  if (topmostElement !== element && !element.contains(topmostElement)) return false; 

  return true; 
}


function showRedWarning(message) {
  const existingWarning = document.getElementById('wms-red-warning');
  if (existingWarning) existingWarning.remove();
  const warning = document.createElement('div');
  warning.id = 'wms-red-warning';
  warning.innerText = '⚠️ ' + message;
  warning.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: #d93025; color: white; padding: 15px 30px; font-weight: bold; font-size: 16px; border-radius: 8px; z-index: 2147483647; box-shadow: 0 6px 16px rgba(217,48,37,0.4); pointer-events: none; border: 2px solid white;`;
  document.body.appendChild(warning);
  const originalBorder = document.body.style.border;
  document.body.style.border = '6px solid #d93025';
  setTimeout(() => {
    warning.remove();
    document.body.style.border = originalBorder;
  }, 2500);
}


// --- AUTOMATED "ENTER" DISPATCHER ---
function simulateEnterPress(element) {
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
}


// --- 4. HANDLE ALL KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', (e) => {
  
  if (recordingKeyFor) {
    e.preventDefault();
    e.stopPropagation();
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    
    let comboArr = [];
    if (e.ctrlKey) comboArr.push('ctrl');
    if (e.altKey) comboArr.push('alt');
    if (e.shiftKey) comboArr.push('shift');
    comboArr.push(e.key.toLowerCase());
    
    const comboStr = comboArr.join('+');
    const displayStr = comboArr.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(' + ');

    const clicker = customClickers.find(c => c.id === recordingKeyFor);
    if (clicker) {
      clicker.keyCombo = comboStr;
      clicker.displayKey = displayStr;
      saveCustomClickers();
    }
    const tb = customTextboxes.find(t => t.id === recordingKeyFor);
    if (tb) {
      tb.keyCombo = comboStr;
      tb.displayKey = displayStr;
      saveCustomTextboxes();
      renderBoxes();
    }
    
    recordingKeyFor = null;
    renderCustomClickers();
    renderTextboxSettings();
    return;
  }

  let currentComboArr = [];
  if (e.ctrlKey) currentComboArr.push('ctrl');
  if (e.altKey) currentComboArr.push('alt');
  if (e.shiftKey) currentComboArr.push('shift');
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
     currentComboArr.push(e.key.toLowerCase());
  }
  const pressedComboStr = currentComboArr.join('+');

  // CUSTOM CLICKERS
  const triggeredClicker = customClickers.find(c => c.keyCombo === pressedComboStr);
  if (triggeredClicker) {
     e.preventDefault();
     if (!triggeredClicker.selectors || triggeredClicker.selectors.length === 0) {
       return showRedWarning(`No targets for ${triggeredClicker.displayKey}!`);
     }
     
     let i = 0;
     function clickNextTarget() {
       if (i >= triggeredClicker.selectors.length) return;
       const buttonToClick = document.querySelector(triggeredClicker.selectors[i]);
       if (!isSafeToInteract(buttonToClick)) return showRedWarning(`Target ${i + 1} blocked or hidden!`);
       
       buttonToClick.click();
       const ob = document.body.style.border;
       document.body.style.border = '5px solid #28a745'; 
       setTimeout(() => document.body.style.border = ob, 200);
       
       i++;
       if (i < triggeredClicker.selectors.length) setTimeout(clickNextTarget, 400); 
     }
     clickNextTarget();
     return;
  }

  // CUSTOM TEXTBOXES
  const triggeredTb = customTextboxes.find(t => t.keyCombo === pressedComboStr);
  if (triggeredTb) {
    e.preventDefault();
    const textareaEl = document.getElementById(`textarea-${triggeredTb.id}`);
    if (textareaEl) handleShortcut(textareaEl, triggeredTb);
    return;
  }

  // UNLIMITED LINK CHAIN MACRO (Alt + Q)
  if (e.altKey && e.key.toLowerCase() === 'q') {
    e.preventDefault();
    if (macroSteps.length === 0) return showRedWarning("Your Link Chain is empty!");
    
    let i = 0;
    function runNextMacroStep() {
      if (i >= macroSteps.length) return;
      const step = macroSteps[i];
      const targetEl = document.querySelector(step.selector);
      
      if (!isSafeToInteract(targetEl)) return showRedWarning(`Sequence stopped at Step ${i+1}: Element hidden!`);
      
      if (step.type === 'click') {
         targetEl.click();
         const ob = document.body.style.border;
         document.body.style.border = '5px solid #00838f'; 
         setTimeout(() => document.body.style.border = ob, 200);
      } else if (step.type === 'input') {
         if (!step.sourceBoxId) return showRedWarning(`Step ${i+1} has no Source Box selected!`);
         const sourceTb = customTextboxes.find(t => t.id === step.sourceBoxId);
         if (!sourceTb) return showRedWarning(`Source Box for Step ${i+1} was deleted!`);
         
         // NEW: Physically click the field first to wake it up
         targetEl.click();
         targetEl.focus();
         targetEl.select(); 
         
         const textToInsert = sourceTb.value;
         
         if (!document.execCommand('insertText', false, textToInsert)) {
           targetEl.value = textToInsert;
           targetEl.dispatchEvent(new Event('input', { bubbles: true }));
           targetEl.dispatchEvent(new Event('change', { bubbles: true }));
         }
         
         // NEW: Automatically trigger an "Enter" press after pasting
         simulateEnterPress(targetEl);
      }
      
      i++;
      setTimeout(runNextMacroStep, 450); 
    }
    
    runNextMacroStep();
  }
});

// --- 5. THE COPY/PASTE LOGIC ---
function handleShortcut(textAreaElement, tbData) {
  const selectedText = window.getSelection().toString().trim();
  const activeEl = document.activeElement;

  if (selectedText) {
    textAreaElement.value = selectedText;
    tbData.value = selectedText;
    saveCustomTextboxes();
    textAreaElement.style.backgroundColor = '#d4edda';
    setTimeout(() => textAreaElement.style.backgroundColor = '#ffffff', 300);
  } else if (activeEl) {
    const textToInsert = tbData.value;
    if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
      const start = activeEl.selectionStart;
      const end = activeEl.selectionEnd;
      activeEl.setRangeText(textToInsert, start, end, 'end');
      activeEl.dispatchEvent(new Event('input', { bubbles: true }));
      
      // NEW: Automatically trigger an "Enter" press after manual paste
      simulateEnterPress(activeEl);
      
      textAreaElement.style.backgroundColor = '#cce5ff';
      setTimeout(() => textAreaElement.style.backgroundColor = '#ffffff', 300);
    } else if (activeEl.isContentEditable) {
      document.execCommand('insertText', false, textToInsert);
      
      // NEW: Automatically trigger an "Enter" press after manual paste in rich editors
      simulateEnterPress(activeEl);
      
      textAreaElement.style.backgroundColor = '#cce5ff';
      setTimeout(() => textAreaElement.style.backgroundColor = '#ffffff', 300);
    } else {
        textAreaElement.focus();
    }
  }
}

// --- 6. REAL-TIME MULTI-TAB SYNC ---
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.customTextboxes) {
       customTextboxes = changes.customTextboxes.newValue || [];
       renderBoxes();
       if (settingsView.style.display === 'flex') {
         renderTextboxSettings();
         renderMacroSteps();
       }
    }
    if (changes.macroSteps) {
       macroSteps = changes.macroSteps.newValue || [];
       if (settingsView.style.display === 'flex') renderMacroSteps();
    }
    if (changes.customClickers) {
       let newClickers = changes.customClickers.newValue || [];
       customClickers = newClickers.map(c => {
         if (c.selector && !c.selectors) { c.selectors = [c.selector]; delete c.selector; }
         if (!c.selectors) c.selectors = [];
         return c;
       });
       if (settingsView.style.display === 'flex') renderCustomClickers();
    }
  }
});
