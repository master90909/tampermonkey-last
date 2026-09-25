// 1. Create the visual interface
const container = document.createElement('div');
container.id = 'floating-clipboard-container';

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

// Add a 3rd panel to show the Auto-Clicker status
const clickerPanel = document.createElement('div');
clickerPanel.className = 'floating-clipboard-box';
clickerPanel.style.height = 'auto'; // Auto adjust height
clickerPanel.style.paddingBottom = '10px';
clickerPanel.innerHTML = `
  <div class="floating-clipboard-label" style="margin-bottom: 8px;">Auto-Clickers</div>
  <div id="target-list" style="font-size: 11px; display: flex; flex-direction: column; gap: 6px;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 4px;">
      <strong style="color:#d93025; cursor:help;" title="No target">Alt+Z: <span id="target-z-display" style="font-weight:normal; color:#555; display:inline-block; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:bottom;">None</span></strong>
      <button class="pick-btn" data-key="z" style="padding: 2px 6px; cursor: pointer; border: 1px solid #ccc; border-radius: 3px; background: #eee;">Pick</button>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 4px;">
      <strong style="color:#d93025; cursor:help;" title="No target">Alt+X: <span id="target-x-display" style="font-weight:normal; color:#555; display:inline-block; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:bottom;">None</span></strong>
      <button class="pick-btn" data-key="x" style="padding: 2px 6px; cursor: pointer; border: 1px solid #ccc; border-radius: 3px; background: #eee;">Pick</button>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 4px;">
      <strong style="color:#d93025; cursor:help;" title="No target">Alt+C: <span id="target-c-display" style="font-weight:normal; color:#555; display:inline-block; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:bottom;">None</span></strong>
      <button class="pick-btn" data-key="c" style="padding: 2px 6px; cursor: pointer; border: 1px solid #ccc; border-radius: 3px; background: #eee;">Pick</button>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <strong style="color:#d93025; cursor:help;" title="No target">Alt+V: <span id="target-v-display" style="font-weight:normal; color:#555; display:inline-block; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:bottom;">None</span></strong>
      <button class="pick-btn" data-key="v" style="padding: 2px 6px; cursor: pointer; border: 1px solid #ccc; border-radius: 3px; background: #eee;">Pick</button>
    </div>
  </div>
`;

container.appendChild(box1.wrapper);
container.appendChild(box2.wrapper);
container.appendChild(clickerPanel);
document.body.appendChild(container);


// --- STATE VARIABLES ---
let targets = { z: '', x: '', c: '', v: '' };
let activePickerKey = null; // 'z', 'x', 'c', or 'v'
let hoveredElement = null;


// 2. Load saved data from Chrome's local storage on page load
chrome.storage.local.get(['box1Data', 'box2Data', 'target_z', 'target_x', 'target_c', 'target_v'], (result) => {
  if (result.box1Data) box1.textarea.value = result.box1Data;
  if (result.box2Data) box2.textarea.value = result.box2Data;
  
  ['z', 'x', 'c', 'v'].forEach(k => {
    if (result[`target_${k}`]) {
      targets[k] = result[`target_${k}`];
      const display = document.getElementById(`target-${k}-display`);
      display.innerText = targets[k];
      display.parentElement.title = 'Target: ' + targets[k];
    }
  });
});

// 3. Save manually typed text to storage automatically
box1.textarea.addEventListener('input', () => chrome.storage.local.set({ box1Data: box1.textarea.value }));
box2.textarea.addEventListener('input', () => chrome.storage.local.set({ box2Data: box2.textarea.value }));


// --- THE NEW PICKER LOGIC ---

function togglePickerMode(key) {
  const buttons = document.querySelectorAll('.pick-btn');
  
  // If clicking the same button to cancel
  if (activePickerKey === key) {
    activePickerKey = null;
    document.body.style.border = '';
    buttons.forEach(b => { b.innerText = 'Pick'; b.style.backgroundColor = '#eee'; });
    if (hoveredElement) hoveredElement.style.outline = '';
    return;
  }

  // Activate picking for a new key
  activePickerKey = key;
  document.body.style.border = '3px dashed #d93025';
  
  buttons.forEach(b => {
    if (b.dataset.key === key) {
      b.innerText = 'Stop';
      b.style.backgroundColor = '#ffe5e5';
    } else {
      b.innerText = 'Pick';
      b.style.backgroundColor = '#eee';
    }
  });
}

// Attach listeners to individual pick buttons
document.querySelectorAll('.pick-btn').forEach(btn => {
  btn.addEventListener('click', (e) => togglePickerMode(e.target.dataset.key));
});

// Highlight elements on hover when in picker mode
document.addEventListener('mouseover', (e) => {
  if (!activePickerKey) return;
  e.stopPropagation();
  
  // Don't highlight our own extension boxes
  if (container.contains(e.target)) return;

  hoveredElement = e.target;
  hoveredElement.style.outline = '3px solid #d93025';
  hoveredElement.style.cursor = 'crosshair';
}, true); // Use capturing phase to catch it early

// Remove highlight when mouse leaves
document.addEventListener('mouseout', (e) => {
  if (!activePickerKey) return;
  e.stopPropagation();
  if (hoveredElement) {
    hoveredElement.style.outline = '';
    hoveredElement.style.cursor = '';
  }
}, true);

// Handle the actual click to save the target
document.addEventListener('click', (e) => {
  if (!activePickerKey) return;
  
  // Ignore clicks inside our own extension box so we don't break it
  if (container.contains(e.target)) return;

  e.preventDefault(); // Stop the button from actually clicking/redirecting
  e.stopPropagation();
  
  let selector = '';
  
  // 1. Try to get ID first (most reliable)
  if (e.target.id) {
    selector = '#' + e.target.id;
  } 
  // 2. Try to get Classes next
  else if (typeof e.target.className === 'string' && e.target.className.trim() !== '') {
    // Convert class "btn btn-primary" to ".btn.btn-primary"
    const classes = e.target.className.trim().split(/\s+/).join('.');
    selector = e.target.tagName.toLowerCase() + '.' + classes;
  } 
  // 3. Fallback to just the Tag Name (like 'button' or 'a')
  else {
    selector = e.target.tagName.toLowerCase();
  }

  // Save the selector for this specific hotkey
  targets[activePickerKey] = selector;
  chrome.storage.local.set({ [`target_${activePickerKey}`]: selector });
  
  // Update UI
  const display = document.getElementById(`target-${activePickerKey}-display`);
  display.innerText = selector;
  display.parentElement.title = 'Target: ' + selector;

  // Turn off picker mode
  togglePickerMode(activePickerKey);
}, true); // True = capturing phase, intercepts click BEFORE the website sees it


// --- 4. HANDLE ALL KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', (e) => {
  
  // Shortcut 1: Alt + 1
  if (e.altKey && e.key === '1') {
    e.preventDefault();
    handleShortcut(box1.textarea, 'box1Data');
  }
  
  // Shortcut 2: Alt + 2
  if (e.altKey && e.key === '2') {
    e.preventDefault();
    handleShortcut(box2.textarea, 'box2Data');
  }

  // Shortcuts Z, X, C, V (Execute Click on Saved Targets)
  const key = e.key.toLowerCase();
  if (e.altKey && ['z', 'x', 'c', 'v'].includes(key)) {
    e.preventDefault();
    
    const selector = targets[key];
    if (selector) {
      const buttonToClick = document.querySelector(selector);
      
      if (buttonToClick) {
        buttonToClick.click();
        
        // Flash a quick green border around the screen to confirm it clicked
        const originalBorder = document.body.style.border;
        document.body.style.border = '4px solid #28a745';
        setTimeout(() => document.body.style.border = originalBorder, 300);
      } else {
        console.log(`Alt+${key.toUpperCase()} pressed: The target (${selector}) was not found on this page.`);
        // Flash red to indicate failure
        const originalBorder = document.body.style.border;
        document.body.style.border = '4px solid #d93025';
        setTimeout(() => document.body.style.border = originalBorder, 300);
      }
    }
  }
});


// 5. The Copy/Paste Logic
function handleShortcut(textAreaElement, storageKey) {
  const selectedText = window.getSelection().toString().trim();
  const activeEl = document.activeElement;

  if (selectedText) {
    textAreaElement.value = selectedText;
    chrome.storage.local.set({ [storageKey]: selectedText });
    textAreaElement.style.backgroundColor = '#d4edda';
    setTimeout(() => textAreaElement.style.backgroundColor = '#ffffff', 300);
  } else if (activeEl) {
    const textToInsert = textAreaElement.value;
    if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
      const start = activeEl.selectionStart;
      const end = activeEl.selectionEnd;
      activeEl.setRangeText(textToInsert, start, end, 'end');
      activeEl.dispatchEvent(new Event('input', { bubbles: true }));
      textAreaElement.style.backgroundColor = '#cce5ff';
      setTimeout(() => textAreaElement.style.backgroundColor = '#ffffff', 300);
    } else if (activeEl.isContentEditable) {
      document.execCommand('insertText', false, textToInsert);
      textAreaElement.style.backgroundColor = '#cce5ff';
      setTimeout(() => textAreaElement.style.backgroundColor = '#ffffff', 300);
    } else {
        textAreaElement.focus();
    }
  }
}


// 6. Listen for changes from OTHER tabs to keep textboxes in real-time sync
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.box1Data) {
      box1.textarea.value = changes.box1Data.newValue || '';
    }
    if (changes.box2Data) {
      box2.textarea.value = changes.box2Data.newValue || '';
    }
    
    // Keep all 4 targets synchronized across different tabs!
    ['z', 'x', 'c', 'v'].forEach(k => {
      if (changes[`target_${k}`]) {
        targets[k] = changes[`target_${k}`].newValue || '';
        const display = document.getElementById(`target-${k}-display`);
        display.innerText = targets[k] || 'None';
        display.parentElement.title = 'Target: ' + (targets[k] || 'None');
      }
    });
  }
});
