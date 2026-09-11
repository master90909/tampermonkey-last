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

container.appendChild(box1.wrapper);
container.appendChild(box2.wrapper);
document.body.appendChild(container);

// 2. Load saved text from Chrome's local storage
chrome.storage.local.get(['box1Data', 'box2Data'], (result) => {
  if (result.box1Data) box1.textarea.value = result.box1Data;
  if (result.box2Data) box2.textarea.value = result.box2Data;
});

// 3. Save manually typed text to storage automatically
box1.textarea.addEventListener('input', () => chrome.storage.local.set({ box1Data: box1.textarea.value }));
box2.textarea.addEventListener('input', () => chrome.storage.local.set({ box2Data: box2.textarea.value }));

// 4. Handle Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === '1') {
    e.preventDefault();
    handleShortcut(box1.textarea, 'box1Data');
  }
  if (e.altKey && e.key === '2') {
    e.preventDefault();
    handleShortcut(box2.textarea, 'box2Data');
  }
});

// 5. The Copy/Paste Logic
function handleShortcut(textAreaElement, storageKey) {
  const selectedText = window.getSelection().toString().trim();
  const activeEl = document.activeElement;

  if (selectedText) {
    // COPY MODE: If text is highlighted, save it to the box
    textAreaElement.value = selectedText;
    chrome.storage.local.set({ [storageKey]: selectedText });
    
    // Flash green to confirm copy
    textAreaElement.style.backgroundColor = '#d4edda';
    setTimeout(() => textAreaElement.style.backgroundColor = '#ffffff', 300);
    
  } else if (activeEl) {
    // PASTE MODE: If inside a text field, paste the box's content
    const textToInsert = textAreaElement.value;
    
    if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
      const start = activeEl.selectionStart;
      const end = activeEl.selectionEnd;
      activeEl.setRangeText(textToInsert, start, end, 'end');
      activeEl.dispatchEvent(new Event('input', { bubbles: true })); // Notify website of change
      
      // Flash blue to confirm paste
      textAreaElement.style.backgroundColor = '#cce5ff';
      setTimeout(() => textAreaElement.style.backgroundColor = '#ffffff', 300);
      
    } else if (activeEl.isContentEditable) {
      // For rich text editors (like Gmail)
      document.execCommand('insertText', false, textToInsert);
      
      textAreaElement.style.backgroundColor = '#cce5ff';
      setTimeout(() => textAreaElement.style.backgroundColor = '#ffffff', 300);
    } else {
        // Fallback: just focus the box if nothing is highlighted or clicked
        textAreaElement.focus();
    }
  }
}

