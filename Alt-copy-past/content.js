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
let macroSteps = []; // NEW: Array to hold unlimited Link Chain steps
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
  renderMacroSteps(); // Update dropdowns in Link Chain
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
  
  // Migrate old macro layout to new unlimited array format if needed
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
  
