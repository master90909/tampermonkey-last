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
clickerPanel.style.height = 'auto'; 
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
let activePickerKey = null; 
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


// --- THE NEW EXACT PATH GENERATOR ---
// This guarantees we only click the EXACT button you pointed at, even if 10 others look identical.
function getExactSelector(el) {
  if (el.id) {
    // If it has a unique ID, that is the safest option. CSS.escape handles weird characters.
    return '#' + CSS.escape(el.id); 
  }
  
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


// --- THE NEW PICKER LOGIC ---
function togglePickerMode(key) {
  const buttons = document.querySelectorAll('.pick-btn');
  
  if (activePickerKey === key) {
    activePickerKey = null;
    document.body.style.border = '';
    buttons.forEach(b => { b.innerText = 'Pick'; b.style.backgroundColor = '#eee'; });
    if (hoveredElement) hoveredElement.style.outline = '';
    return;
  }

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

document.querySelectorAll('.pick-btn').forEach(btn => {
  btn.addEventListener('click', (e) => togglePickerMode(e.target.dataset.key));
});

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
  
  // WMS Safety Feature: If the user clicked an icon/span inside a button, 
  // traverse upwards to find the actual clickable button element.
  let targetEl = e.target;
  const closestInteractive = targetEl.closest('button, a, input, [role="button"]');
  if (closestInteractive) {
    targetEl = closestInteractive;
  }
  
  const selector = getExactSelector(targetEl);

  targets[activePickerKey] = selector;
  chrome.storage.local.set({ [`target_${activePickerKey}`]: selector });
  
  const display = document.getElementById(`target-${activePickerKey}-display`);
  display.innerText = selector;
  display.parentElement.title = 'Target: ' + selector;

  togglePickerMode(activePickerKey);
}, true);


// --- UPGRADED MAXIMUM SECURITY SAFETY CHECK ---
function isSafeToClick(element) {
  if (!element) return false;
  
  // 1. Core HTML & ARIA Disabled Checks
  if (element.disabled === true || element.hasAttribute('disabled')) return false; 
  if (element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('readonly')) return false;

  // 2. Enterprise Framework Disabled Classes
  const disabledClasses = ['disabled', 'is-disabled', 'p-disabled', 'mat-button-disabled', 'Mui-disabled'];
  if (disabledClasses.some(className => element.classList.contains(className))) return false;

  // 3. Physical DOM Existence
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  // 4. CSS Visibility Checks
  const style = window.getComputedStyle(element);
  if (element.offsetParent === null && style.position !== 'fixed') return false;
  if (
    style.display === 'none' || 
    style.visibility === 'hidden' || 
    style.visibility === 'collapse' || 
    parseFloat(style.opacity) < 0.1 || 
    style.pointerEvents === 'none' 
  ) {
    return false;
  }

  // 5. MAXIMUM SECURITY: Viewport Bounds Check (Must be fully on screen)
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  if (
    rect.top < 0 || 
    rect.left < 0 || 
    rect.bottom > windowHeight || 
    rect.right > windowWidth
  ) {
    console.log("Security Alert: Button is partially or fully scrolled off the screen.");
    return false;
  }

  // 6. MAXIMUM SECURITY: Overlap/Occlusion Check (Is something else covering it?)
  const centerX = rect.left + (rect.width / 2);
  const centerY = rect.top + (rect.height / 2);
  const topmostElement = document.elementFromPoint(centerX, centerY);

  if (!topmostElement) return false; 
  
  // Ensure the element we see on top is either our button, OR a child inside our button (like an icon)
  if (topmostElement !== element && !element.contains(topmostElement)) {
    console.log("Security Alert: Another element (like a popup or loading screen) is blocking this button.");
    return false; 
  }

  return true; 
}


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
      
      // RUN THE STRICT SAFETY CHECK HERE before clicking
      if (isSafeToClick(buttonToClick)) {
        buttonToClick.click();
        
        // Flash a quick green border around the screen to confirm it clicked safely
        const originalBorder = document.body.style.border;
        document.body.style.border = '4px solid #28a745';
        setTimeout(() => document.body.style.border = originalBorder, 300);
      } else {
        console.warn(`Alt+${key.toUpperCase()} aborted: Target (${selector}) is hidden, disabled, off-screen, or blocked by another element.`);
        
        // Flash red to indicate the script refused to click it for safety
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
