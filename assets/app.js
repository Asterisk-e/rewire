'use strict';

const CAPABILITIES = {
  html: { name: 'HTML Coding', instruction: 'Help with HTML development. Produce semantic, valid HTML5; explain document structure; and consider maintainability. Do not assume CSS or JavaScript capabilities are enabled unless those cards are also active.' },
  css: { name: 'CSS Coding', instruction: 'Help with CSS development. Produce maintainable stylesheets, responsive layouts, and accessible visual states. Do not assume HTML or JavaScript capabilities are enabled unless those cards are also active.' },
  javascript: { name: 'JavaScript', instruction: 'Help with JavaScript development for browser applications. Prefer clear, modular code, explain important behaviour, and consider error handling and accessibility.' },
  python: { name: 'Python', instruction: 'Help with Python development. Prefer readable, documented code, handle errors, and explain how code should be run. Do not claim to have executed code.' },
  review: { name: 'Code Review', instruction: 'Review supplied code for correctness, security, readability, performance, and maintainability. Prioritise concrete findings and explain their impact.' },
  accessibility: { name: 'Accessibility', instruction: 'Consider accessibility throughout the response: semantic structure, keyboard navigation, visible focus, contrast, labels, reduced motion, and screen-reader behaviour where relevant.' }
};

const state = {
  activeCapabilities: new Set(),
  messages: [],
  sending: false,
  backendUrl: localStorage.getItem('localStudio.backendUrl') || 'http://127.0.0.1:8000',
  accessToken: sessionStorage.getItem('localStudio.accessToken') || '',
  modelName: 'Local model',
  backendOnline: false
};

const el = (id) => document.getElementById(id);
const messagesNode = el('messages');
const chatScroll = el('chatScroll');
const input = el('messageInput');
const composer = el('composerDropZone');

function normaliseBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}
function apiUrl(path) {
  return `${normaliseBaseUrl(state.backendUrl)}${path}`;
}
function apiHeaders(extra = {}) {
  const headers = { ...extra };
  if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;
  return headers;
}
function toast(message) {
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = message;
  el('toastRegion').appendChild(item);
  window.setTimeout(() => item.remove(), 3600);
}
function setStatus(online, detail = '') {
  state.backendOnline = online;
  for (const node of [el('sidebarStatusDot'), el('topStatusDot'), el('modalStatusDot')]) {
    node.classList.toggle('online', online);
    node.classList.toggle('offline', !online && detail.length > 0);
  }
  el('sidebarStatusText').textContent = online ? 'Backend connected' : (detail ? 'Backend unavailable' : 'Backend not checked');
  el('sidebarModelText').textContent = detail || 'Configure a connection';
  el('modalStatusTitle').textContent = online ? 'Backend reachable' : (detail ? 'Connection unavailable' : 'Not connected');
  el('modalStatusDetail').textContent = detail || 'The backend has not been checked.';
  el('topModelName').textContent = state.modelName;
}
function renderActiveCapabilities() {
  const wrap = el('activeCapabilities');
  wrap.replaceChildren();
  if (state.activeCapabilities.size === 0) {
    const placeholder = document.createElement('span');
    placeholder.className = 'active-placeholder';
    placeholder.textContent = 'Drop capability cards here, or select them from the sidebar.';
    wrap.appendChild(placeholder);
  }
  for (const id of state.activeCapabilities) {
    const chip = document.createElement('span');
    chip.className = 'active-chip';
    chip.append(document.createTextNode(CAPABILITIES[id].name));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${CAPABILITIES[id].name}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => toggleCapability(id, false));
    chip.appendChild(remove);
    wrap.appendChild(chip);
  }
  document.querySelectorAll('.capability-card').forEach((card) => {
    const active = state.activeCapabilities.has(card.dataset.capability);
    card.classList.toggle('active', active);
    card.setAttribute('aria-pressed', String(active));
    card.querySelector('.card-add').textContent = active ? '✓' : '＋';
  });
}
function toggleCapability(id, force) {
  if (!CAPABILITIES[id]) return;
  const shouldAdd = typeof force === 'boolean' ? force : !state.activeCapabilities.has(id);
  if (shouldAdd) state.activeCapabilities.add(id);
  else state.activeCapabilities.delete(id);
  renderActiveCapabilities();
}
function saveHistory() {
  try {
    localStorage.setItem('localStudio.messages', JSON.stringify(state.messages.slice(-40)));
    localStorage.setItem('localStudio.capabilities', JSON.stringify([...state.activeCapabilities]));
  } catch (error) {
    console.warn('Could not persist conversation:', error);
  }
}
function scrollToBottom() {
  requestAnimationFrame(() => { chatScroll.scrollTop = chatScroll.scrollHeight; });
}
function addMessage(role, content) {
  const record = { role, content: String(content), timestamp: Date.now() };
  state.messages.push(record);
  renderMessage(record);
  el('welcomeView').classList.add('hidden');
  el('chatTitle').textContent = 'Conversation';
  saveHistory();
  scrollToBottom();
}
function makeTextParagraph(text) {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  return paragraph;
}
function languageExtension(language) {
  const value = (language || '').toLowerCase();
  const mapping = { html: 'html', xml: 'html', css: 'css', javascript: 'js', js: 'js', python: 'py', py: 'py', json: 'json', markdown: 'md', md: 'md', text: 'txt', txt: 'txt' };
  return mapping[value] || 'txt';
}
function defaultFileName(language, index) {
  const ext = languageExtension(language);
  const names = { html: 'index.html', css: 'styles.css', js: 'app.js', py: 'main.py', json: 'data.json', md: 'notes.md', txt: 'notes.txt' };
  const defaultName = names[ext] || `snippet-${index + 1}.txt`;
  return index > 0 && ['index.html', 'styles.css', 'app.js', 'main.py'].includes(defaultName)
    ? `snippet-${index + 1}.${ext}` : defaultName;
}
async function saveCodeBlock(code, language, index) {
  let path = window.prompt('Save this code as a workspace file:', defaultFileName(language, index));
  if (!path) return;
  path = path.trim();
  if (!path) return;
  try {
    let response = await fetch(apiUrl('/api/files'), {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ path, content: code, overwrite: false })
    });
    if (response.status === 409) {
      if (!window.confirm(`${path} already exists. Replace it?`)) return;
      response = await fetch(apiUrl('/api/files'), {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ path, content: code, overwrite: true })
      });
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || `Save failed (${response.status})`);
    toast(`Saved ${result.path || path} to the workspace.`);
  } catch (error) {
    toast(`Could not save file: ${error.message}`);
  }
}
function renderAssistantContent(container, content) {
  const fence = /```([\w+-]*)\s*\n([\s\S]*?)```/g;
  let cursor = 0;
  let match;
  let codeIndex = 0;
  while ((match = fence.exec(content)) !== null) {
    const before = content.slice(cursor, match.index).trim();
    if (before) before.split(/\n\s*\n/).forEach((part) => container.appendChild(makeTextParagraph(part)));
    const language = match[1] || 'text';
    const code = match[2].replace(/\n$/, '');
    const block = document.createElement('div');
    block.className = 'code-block';
    const toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';
    const label = document.createElement('span');
    label.className = 'code-language';
    label.textContent = language;
    const save = document.createElement('button');
    save.className = 'save-code-button';
    save.type = 'button';
    save.textContent = 'Save to workspace';
    save.addEventListener('click', () => saveCodeBlock(code, language, codeIndex));
    toolbar.append(label, save);
    const pre = document.createElement('pre');
    const codeNode = document.createElement('code');
    codeNode.textContent = code;
    pre.appendChild(codeNode);
    block.append(toolbar, pre);
    container.appendChild(block);
    codeIndex += 1;
    cursor = fence.lastIndex;
  }
  const after = content.slice(cursor).trim();
  if (after) after.split(/\n\s*\n/).forEach((part) => container.appendChild(makeTextParagraph(part)));
  if (!container.childNodes.length) container.appendChild(makeTextParagraph(content));
}
function renderMessage(record) {
  const row = document.createElement('article');
  row.className = `message ${record.role}`;
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = record.role === 'user' ? 'YOU' : 'AI';
  const body = document.createElement('div');
  body.className = 'message-body';
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.textContent = record.role === 'user' ? 'YOU' : 'LOCAL MODEL';
  const content = document.createElement('div');
  content.className = 'message-content';
  if (record.role === 'assistant') renderAssistantContent(content, record.content);
  else content.appendChild(makeTextParagraph(record.content));
  body.append(meta, content);
  row.append(avatar, body);
  messagesNode.appendChild(row);
}
function restoreHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem('localStudio.messages') || '[]');
    if (Array.isArray(saved)) {
      state.messages = saved.filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string').slice(-40);
      state.messages.forEach(renderMessage);
      if (state.messages.length) {
        el('welcomeView').classList.add('hidden');
        el('chatTitle').textContent = 'Conversation';
      }
    }
    const savedCapabilities = JSON.parse(localStorage.getItem('localStudio.capabilities') || '[]');
    if (Array.isArray(savedCapabilities)) savedCapabilities.filter((id) => CAPABILITIES[id]).forEach((id) => state.activeCapabilities.add(id));
  } catch (error) {
    console.warn('Could not restore conversation:', error);
  }
  renderActiveCapabilities();
}
function updateSendButton() {
  el('sendButton').disabled = state.sending || !input.value.trim();
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 190)}px`;
}
async function sendMessage() {
  const message = input.value.trim();
  if (!message || state.sending) return;
  if (!state.backendUrl) {
    toast('Set your Studio backend URL in Connection settings first.');
    openSettings();
    return;
  }
  input.value = '';
  updateSendButton();
  addMessage('user', message);
  state.sending = true;
  updateSendButton();
  el('typingRow').classList.remove('hidden');
  scrollToBottom();
  try {
    const response = await fetch(apiUrl('/api/chat'), {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        messages: state.messages.slice(-21).map(({ role, content }) => ({ role, content })),
        capabilities: [...state.activeCapabilities]
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || `Request failed (${response.status})`);
    if (result.model) {
      state.modelName = result.model;
      el('topModelName').textContent = result.model;
      el('sidebarModelText').textContent = result.model;
    }
    addMessage('assistant', result.reply || 'The model returned an empty response.');
  } catch (error) {
    addMessage('assistant', `I could not reach the configured model.\n\n${error.message}\n\nCheck the backend connection and the model endpoint in backend/.env.`);
  } finally {
    state.sending = false;
    el('typingRow').classList.add('hidden');
    updateSendButton();
    scrollToBottom();
  }
}
async function testConnection() {
  state.backendUrl = normaliseBaseUrl(el('backendUrlInput').value);
  if (!state.backendUrl) {
    setStatus(false, 'Enter a backend URL first.');
    return;
  }
  el('testConnectionButton').disabled = true;
  el('testConnectionButton').textContent = 'Testing…';
  try {
    const response = await fetch(apiUrl('/api/health'), { method: 'GET', cache: 'no-store', headers: apiHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    state.modelName = data.model_name || 'Local model';
    if (data.model_configured) setStatus(true, `${state.modelName} · endpoint configured`);
    else setStatus(true, 'Backend reachable · model endpoint not configured');
    el('topModelName').textContent = state.modelName;
    toast(data.model_configured ? 'Backend connection successful.' : 'Backend is online. Configure the model endpoint in backend/.env.');
  } catch (error) {
    setStatus(false, error.message || 'Could not reach the backend.');
    toast(`Connection test failed: ${error.message}`);
  } finally {
    el('testConnectionButton').disabled = false;
    el('testConnectionButton').textContent = 'Test';
  }
}
function openSettings() {
  el('backendUrlInput').value = state.backendUrl;
  el('accessTokenInput').value = state.accessToken;
  el('settingsModal').classList.remove('hidden');
  el('backendUrlInput').focus();
}
function closeSettings() { el('settingsModal').classList.add('hidden'); }
function saveSettings() {
  const value = normaliseBaseUrl(el('backendUrlInput').value);
  if (!value) { toast('Enter a backend URL.'); return; }
  try { new URL(value); } catch { toast('Enter a valid URL, including http:// or https://.'); return; }
  state.backendUrl = value;
  state.accessToken = el('accessTokenInput').value.trim();
  localStorage.setItem('localStudio.backendUrl', value);
  if (state.accessToken) sessionStorage.setItem('localStudio.accessToken', state.accessToken);
  else sessionStorage.removeItem('localStudio.accessToken');
  closeSettings();
  setStatus(false, 'Connection not tested');
  toast('Backend URL saved. Test the connection to verify it.');
  testConnectionAfterSave();
}
async function testConnectionAfterSave() {
  try {
    const response = await fetch(apiUrl('/api/health'), { cache: 'no-store', headers: apiHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    state.modelName = data.model_name || 'Local model';
    setStatus(true, data.model_configured ? `${state.modelName} · endpoint configured` : 'Backend reachable · model endpoint not configured');
    el('topModelName').textContent = state.modelName;
  } catch (error) { setStatus(false, error.message); }
}
function clearChat() {
  if (state.sending) { toast('Wait for the current response to finish.'); return; }
  if (state.messages.length && !window.confirm('Clear this conversation from this browser?')) return;
  state.messages = [];
  messagesNode.replaceChildren();
  el('welcomeView').classList.remove('hidden');
  el('chatTitle').textContent = 'New conversation';
  saveHistory();
  toast('Conversation cleared.');
}

// Click or drag a capability card into the composer.
document.querySelectorAll('.capability-card').forEach((card) => {
  card.addEventListener('click', () => toggleCapability(card.dataset.capability));
  card.addEventListener('dragstart', (event) => {
    card.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', card.dataset.capability);
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
});
composer.addEventListener('dragover', (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  composer.classList.add('drag-over');
  el('dropHint').classList.remove('hidden');
});
composer.addEventListener('dragleave', (event) => {
  if (!composer.contains(event.relatedTarget)) {
    composer.classList.remove('drag-over');
    el('dropHint').classList.add('hidden');
  }
});
composer.addEventListener('drop', (event) => {
  event.preventDefault();
  composer.classList.remove('drag-over');
  el('dropHint').classList.add('hidden');
  const id = event.dataTransfer.getData('text/plain');
  if (CAPABILITIES[id]) {
    toggleCapability(id, true);
    toast(`${CAPABILITIES[id].name} added to this chat.`);
  }
});

input.addEventListener('input', updateSendButton);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
el('sendButton').addEventListener('click', sendMessage);
el('newChatButton').addEventListener('click', clearChat);
el('clearChatButton').addEventListener('click', clearChat);
el('openSettingsButton').addEventListener('click', openSettings);
el('openSettingsFromStatus').addEventListener('click', openSettings);
el('closeSettings').addEventListener('click', closeSettings);
el('cancelSettings').addEventListener('click', closeSettings);
el('saveSettingsButton').addEventListener('click', saveSettings);
el('testConnectionButton').addEventListener('click', testConnection);
el('settingsModal').addEventListener('click', (event) => { if (event.target === el('settingsModal')) closeSettings(); });
document.querySelectorAll('.prompt-card').forEach((card) => card.addEventListener('click', () => {
  input.value = card.dataset.prompt || '';
  updateSendButton();
  input.focus();
}));
el('openSidebar').addEventListener('click', () => el('sidebar').classList.add('open'));
el('closeSidebar').addEventListener('click', () => el('sidebar').classList.remove('open'));

restoreHistory();
updateSendButton();
setStatus(false, 'Connection not tested');
testConnectionAfterSave();
