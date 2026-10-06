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
let lookupRules = []; // NEW: URL & ID Lookup rules
let customScripts = []; // NEW: Custom JS scripts
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
};
textConfigSection.appendChild(addBoxBtn);
settingsView.appendChild(textConfigSection);

// --- Settings - Section 4: URL & ID Smart Lookup ---
const lookupSection = createSettingsSection('URL & ID Smart Lookup (Auto-Runs)');
const lookupList = document.createElement('div');
lookupList.id = 'smart-lookup-list';
lookupList.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;';
lookupSection.appendChild(lookupList);

const addLookupBtn = document.createElement('button');
addLookupBtn.innerText = '+ Add Lookup Rule';
addLookupBtn.style.cssText = 'width: 100%; padding: 6px; cursor: pointer; border: 1px dashed #ff8c00; border-radius: 4px; background: #fff; font-size: 11px; font-weight: bold; color: #cc7000;';
addLookupBtn.onclick = () => {
  lookupRules.push({ id: 'lu_' + Date.now(), urlKeyword: '', targetSelector: '', action: 'click', sourceBox: '' });
  saveLookupRules();
  renderLookupRules();
};
lookupSection.appendChild(addLookupBtn);
settingsView.appendChild(lookupSection);

// --- Settings - Section 5: CUSTOM CODE BASE ---
const scriptSection = createSettingsSection('Code Base (Custom JS Scripts)');
const scriptList = document.createElement('div');
scriptList.id = 'custom-script-list';
scriptList.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px;';
scriptSection.appendChild(scriptList);

const addScriptBtn = document.createElement('button');
addScriptBtn.innerText = '+ Add Custom Script';
addScriptBtn.style.cssText = 'width: 100%; padding: 6px; cursor: pointer; border: 1px dashed #6f42c1; border-radius: 4px; background: #fff; font-size: 11px; font-weight: bold; color: #6f42c1;';
addScriptBtn.onclick = () => {
  customScripts.push({ id: 'sc_' + Date.now(), name: 'New Script', code: '', keyCombo: '', displayKey: 'Click to Bind Key' });
  saveCustomScripts();
  renderCustomScripts();
};
scriptSection.appendChild(addScriptBtn);
settingsView.appendChild(scriptSection);

container.appendChild(settingsView);


// --- HELPER FUNCTIONS FOR UI ---
function createSettingsSection(title) {
  const div = document.createElement('div');
  div.style.cssText = 'border: 1px solid #e0e0e0; border-radius: 4px; padding: 8px; margin-bottom: 10px; background: white;';
  div.innerHTML = `<div style="font-size: 11px; font-weight: bold; color: #555; margin-bottom: 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">${title}</div>`;
  return div;
}

// --- SMART LOOKUP RENDERER ---
function renderLookupRules() {
  const list = document.getElementById('smart-lookup-list');
  if (!list) return;
  list.innerHTML = '';
  
  lookupRules.forEach((rule) => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; flex-direction: column; gap: 4px; padding: 6px; border: 1px solid #ffcc80; border-radius: 4px; background: #fffaf0;';
    
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; gap: 4px; align-items: center;';
    
    const urlInput = document.createElement('input');
    urlInput.placeholder = 'If URL has... (e.g. /inbound)';
    urlInput.value = rule.urlKeyword;
    urlInput.style.cssText = 'flex: 2; font-size: 10px; padding: 4px; border: 1px solid #ccc; border-radius: 3px;';
    urlInput.onchange = (e) => { rule.urlKeyword = e.target.value; saveLookupRules(); };
    
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '❌';
    delBtn.style.cssText = 'padding: 4px; cursor: pointer; border: none; background: transparent; font-size: 10px;';
    delBtn.onclick = () => {
      lookupRules = lookupRules.filter(r => r.id !== rule.id);
      saveLookupRules();
      renderLookupRules();
    };
    
    topRow.appendChild(urlInput);
    topRow.appendChild(delBtn);
    row.appendChild(topRow);

    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'display: flex; gap: 4px; align-items: center;';
    
    const actionSelect = document.createElement('select');
    actionSelect.style.cssText = 'font-size: 9px; padding: 2px; flex: 1; border-color: #ccc;';
    actionSelect.innerHTML = `<option value="click" ${rule.action === 'click' ? 'selected' : ''}>Auto-Click Target</option>
                              <option value="type" ${rule.action === 'type' ? 'selected' : ''}>Auto-Type Box</option>`;
    actionSelect.onchange = (e) => { rule.action = e.target.value; saveLookupRules(); renderLookupRules(); };
    
    actionRow.appendChild(actionSelect);

    if (rule.action === 'type') {
       const boxSelect = document.createElement('select');
       boxSelect.style.cssText = 'font-size: 9px; padding: 2px; flex: 1; border-color: #ccc;';
       boxSelect.innerHTML = '<option value="">- Box -</option>';
       customTextboxes.forEach((tb, i) => {
         const opt = document.createElement('option');
         opt.value = tb.id;
         opt.innerText = `Box ${i + 1}`;
         if (tb.id === rule.sourceBox) opt.selected = true;
         boxSelect.appendChild(opt);
       });
       boxSelect.onchange = (e) => { rule.sourceBox = e.target.value; saveLookupRules(); };
       actionRow.appendChild(boxSelect);
    }

    const pickBtn = document.createElement('button');
    pickBtn.innerText = '🎯 Pick Target ID';
    pickBtn.className = 'pick-btn';
    pickBtn.dataset.key = `lookup_${rule.id}`;
    pickBtn.style.cssText = 'padding: 2px 6px; font-size: 9px; cursor: pointer; border: 1px solid #ff8c00; border-radius: 3px; background: #ffe0b2; color: #cc7000; font-weight: bold; flex: 1;';
    pickBtn.onclick = () => togglePickerMode(`lookup_${rule.id}`, pickBtn);
    actionRow.appendChild(pickBtn);

    row.appendChild(actionRow);

    if (rule.targetSelector) {
       const tgtLbl = document.createElement('div');
       tgtLbl.innerText = `ID: ${rule.targetSelector.split(' > ').pop()}`;
       tgtLbl.style.cssText = 'font-size: 9px; color: #d93025; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-top: 1px dashed #ffcc80; margin-top: 2px; padding-top: 2px;';
       row.appendChild(tgtLbl);
    }

    list.appendChild(row);
  });
}

function saveLookupRules() {
  chrome.storage.local.set({ lookupRules });
}

// --- CUSTOM SCRIPT (CODE BASE) RENDERER ---
function renderCustomScripts() {
  const list = document.getElementById('custom-script-list');
  if (!list) return;
  list.innerHTML = '';
  
  customScripts.forEach((script) => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid #d8b4e2; border-radius: 4px; background: #fdfaf6;';
    
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; gap: 4px; align-items: center; justify-content: space-between;';
    
    const nameInput = document.createElement('input');
    nameInput.value = script.name;
    nameInput.placeholder = 'Script Name';
    nameInput.style.cssText = 'font-size: 11px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-weight: bold; width: 90px;';
    nameInput.onchange = (e) => { script.name = e.target.value; saveCustomScripts(); };
    
    const bindBtn = document.createElement('button');
    bindBtn.innerText = recordingKeyFor === script.id ? 'Press keys...' : script.displayKey;
    bindBtn.style.cssText = `flex: 1; padding: 4px; font-size: 10px; font-weight: bold; cursor: pointer; border: 1px solid #aaa; border-radius: 3px; background: ${recordingKeyFor === script.id ? '#ffc107' : '#fff'};`;
    bindBtn.onclick = () => {
      recordingKeyFor = script.id;
      renderCustomScripts();
    };

    const runBtn = document.createElement('button');
    runBtn.innerText = '▶ Run';
    runBtn.style.cssText = 'padding: 4px 8px; cursor: pointer; border: 1px solid #28a745; border-radius: 3px; background: #e8f5e9; font-size: 10px; font-weight: bold; color: #28a745;';
    runBtn.onclick = () => executeUserScript(script.code);
    
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '❌';
    delBtn.style.cssText = 'padding: 4px; cursor: pointer; border: none; background: transparent; font-size: 10px;';
    delBtn.onclick = () => {
      customScripts = customScripts.filter(s => s.id !== script.id);
      saveCustomScripts();
      renderCustomScripts();
    };
    
    topRow.appendChild(nameInput);
    topRow.appendChild(bindBtn);
    topRow.appendChild(runBtn);
    topRow.appendChild(delBtn);
    row.appendChild(topRow);

    // --- NEW: SNIPPET TOOLBAR (Shortcuts for quick coding) ---
    const snippetBar = document.createElement('div');
    snippetBar.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px;';
    
    const createSnippetBtn = (label, snippetText) => {
      const btn = document.createElement('button');
      btn.innerText = label;
      btn.style.cssText = 'padding: 2px 6px; font-size: 9px; cursor: pointer; border: 1px solid #17a2b8; border-radius: 3px; background: #e0f7fa; color: #00838f; font-weight: bold;';
      btn.onclick = () => {
         const start = codeArea.selectionStart;
         const end = codeArea.selectionEnd;
         codeArea.value = codeArea.value.substring(0, start) + snippetText + codeArea.value.substring(end);
         script.code = codeArea.value;
         saveCustomScripts();
         codeArea.focus();
         codeArea.selectionStart = codeArea.selectionEnd = start + snippetText.length;
      };
      return btn;
    };

    const pickTargetBtn = document.createElement('button');
    pickTargetBtn.innerText = '🎯 Pick Target (Insert to Code)';
    pickTargetBtn.className = 'pick-btn';
    pickTargetBtn.style.cssText = 'padding: 2px 6px; font-size: 9px; cursor: pointer; border: 1px solid #d93025; border-radius: 3px; background: #fce8e6; color: #d93025; font-weight: bold; width: 100%; margin-bottom: 4px;';
    pickTargetBtn.onclick = () => togglePickerMode(`script_${script.id}`, pickTargetBtn);
    
    snippetBar.appendChild(pickTargetBtn);
    snippetBar.appendChild(createSnippetBtn('+ Click (Button)', `document.querySelector('SELECTOR').click();\n`));
    snippetBar.appendChild(createSnippetBtn('+ Type (Input)', `document.querySelector('SELECTOR').value = 'TEXT';\n`));
    snippetBar.appendChild(createSnippetBtn('+ Read to Box 1', `document.getElementById('textarea-tb_1').value = document.querySelector('SELECTOR').value || document.querySelector('SELECTOR').innerText;\ncustomTextboxes[0].value = document.getElementById('textarea-tb_1').value;\nsaveCustomTextboxes();\n`));
    snippetBar.appendChild(createSnippetBtn('+ Wait', `await wait(1000); // Waits 1 second\n`));
    snippetBar.appendChild(createSnippetBtn('+ If/Else', `if (document.querySelector('SELECTOR')) {\n  // Do this if found\n} else {\n  // Do this if not found\n}\n`));
    snippetBar.appendChild(createSnippetBtn('+ While', `while (document.querySelector('SELECTOR')) {\n  await wait(500);\n  // Loops until condition changes\n}\n`));
    
    row.appendChild(snippetBar);

    const codeArea = document.createElement('textarea');
    codeArea.id = `script-editor-${script.id}`;
    codeArea.value = script.code;
    codeArea.placeholder = '// Write Javascript here...\n// e.g., document.querySelector(".submit").click();';
    codeArea.style.cssText = 'width: 100%; height: 70px; font-family: Consolas, monospace; font-size: 10px; padding: 6px; border: 1px solid #ccc; border-radius: 3px; resize: vertical; box-sizing: border-box; background: #282c34; color: #abb2bf;';
    codeArea.oninput = (e) => { script.code = e.target.value; saveCustomScripts(); };
    
    // Enable "Tab" key indentation inside the editor
    codeArea.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 2;
      }
    });

    row.appendChild(codeArea);
    list.appendChild(row);
  });
}

function saveCustomScripts() {
  chrome.storage.local.set({ customScripts });
}

function executeUserScript(code) {
  if (!code || !code.trim()) return showRedWarning("Script is empty!");
  try {
    // We inject the script as a tag so it runs securely in the website's native context
    const scriptTag = document.createElement('script');
    scriptTag.textContent = `
      (async function() {
        // Built-in helper functions for your custom scripts
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        
        try {
          ${code}
        } catch(e) {
          console.error("WMS Custom Script Error:", e);
        }
      })();
    `;
    (document.head || document.documentElement).appendChild(scriptTag);
    scriptTag.remove();
    
    // Flash purple to indicate your custom code just executed
    const ob = document.body.style.border;
    document.body.style.border = '5px solid #6f42c1'; 
    setTimeout(() => document.body.style.border = ob, 400);
  } catch (err) {
    showRedWarning("Script execution failed!");
  }
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
    renderTextboxSettings();
    renderLookupRules();
    renderCustomScripts();
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
  if (result.customTextboxes && result.customTex
