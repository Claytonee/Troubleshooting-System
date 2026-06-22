/**
 * AI Chat — Self-service Troubleshooting Assistant
 * Design inspired by Leora School Assistant
 */
const ChatPage = (() => {
  let chats = [];
  let activeChat = null;
  let messages = [];
  let isStreaming = false;
  let streamBuffer = '';

  async function load() {
    try { chats = await API.getAiChats(); } catch (e) { chats = []; }
  }

  function render() {
    return `
    <div class="section-header">
      <div>
        <div class="section-title"><span class="chat-title-shimmer">AI Assistant</span></div>
        <div class="section-sub">Technical Support &mdash; Troubleshooting help</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="ChatPage.newChat()" style="gap:6px"><i class="ti ti-plus" style="font-size:13px"></i> New Chat</button>
    </div>
    <div class="chat-container">
      <div class="chat-sidebar">
        <div class="chat-sidebar-top">
          <div class="chat-ai-badge">
            <div class="chat-ai-icon"><i class="ti ti-sparkles"></i></div>
            <div><div style="font-size:11px;font-weight:600;color:var(--text)">QFT AI</div><div style="display:flex;align-items:center;gap:4px"><span class="chat-status-dot"></span><span style="font-size:9px;color:var(--text3)">Online</span></div></div>
          </div>
        </div>
        <div class="chat-history-scroll">
          ${chats.length ? chats.map(c => {
            const act = activeChat && activeChat.id === c.id;
            return `<div class="chat-hist ${act ? 'act' : ''}" onclick="ChatPage.loadChat(${c.id})">
              <i class="ti ti-message"></i><span>${esc(c.title)}</span>
              <i class="ti ti-x chat-del" onclick="event.stopPropagation();ChatPage.deleteChat(${c.id})"></i>
            </div>`;
          }).join('') : '<div class="chat-no-hist"><i class="ti ti-messages-off"></i>No history yet</div>'}
        </div>
      </div>
      <div class="chat-body">
        ${activeChat || messages.length > 0 ? renderConversation() : renderWelcome()}
      </div>
    </div>`;
  }

  function renderConversation() {
    return `<div class="chat-msgs" id="chat-messages">
      ${messages.map(m => renderMsg(m)).join('')}
      ${isStreaming ? renderThinking() : ''}
    </div>
    <div class="chat-input-wrap">
      ${renderInput()}
    </div>`;
  }

  function renderWelcome() {
    return `<div class="chat-welcome-area">
      <div class="chat-welcome-inner">
        <div class="chat-w-icon"><i class="ti ti-sparkles"></i><div class="chat-w-glow"></div></div>
        <div class="chat-w-title">How can I help you today?</div>
        <div class="chat-w-sub">Ask about troubleshooting your school equipment — WiFi, tablets, platform, power, or accounts.</div>
        <div class="chat-w-grid">
          ${suggestion('ti-wifi', 'WiFi is not working', '#4f7cff')}
          ${suggestion('ti-device-tablet', "Tablet won't charge", '#f5a623')}
          ${suggestion('ti-app-window', 'App keeps crashing', '#9b7dff')}
          ${suggestion('ti-bolt', 'UPS is blinking red', '#ff5263')}
        </div>
      </div>
      <div class="chat-input-wrap">${renderInput()}</div>
    </div>`;
  }

  function suggestion(icon, text, color) {
    return `<div class="chat-sug" onclick="ChatPage.sendFromSuggestion('${text.replace(/'/g, "\\'")}')">
      <i class="ti ${icon}" style="color:${color}"></i><span>${text}</span>
    </div>`;
  }

  function renderMsg(m) {
    if (m.role === 'user') {
      return `<div class="chat-row user"><div class="chat-u-bubble">${esc(m.content)}</div></div>`;
    }
    return `<div class="chat-row ai">
      <div class="chat-ai-av"><i class="ti ti-sparkles"></i></div>
      <div class="chat-ai-bubble"><div class="chat-ai-bar"></div><div class="chat-ai-text">${formatMarkdown(m.content)}</div></div>
    </div>`;
  }

  function renderThinking() {
    if (streamBuffer) {
      return `<div class="chat-row ai">
        <div class="chat-ai-av"><i class="ti ti-sparkles"></i></div>
        <div class="chat-ai-bubble"><div class="chat-ai-bar"></div><div class="chat-ai-text" id="stream-output">${formatMarkdown(streamBuffer)}</div></div>
      </div>`;
    }
    return `<div class="chat-row ai">
      <div class="chat-ai-av pulse"><i class="ti ti-sparkles"></i><div class="chat-av-ring"></div></div>
      <div class="chat-think">
        <div class="chat-think-bar"></div>
        <div class="chat-think-inner">
          <div class="chat-wave"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="chat-think-label">Analyzing...</div>
          <div class="chat-steps">
            <div class="chat-st done"><i class="ti ti-check"></i>Understanding your question</div>
            <div class="chat-st active"><span class="chat-st-dot pulse"></span>Searching knowledge base</div>
            <div class="chat-st pending"><span class="chat-st-dot"></span>Generating response</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderInput() {
    return `<div class="chat-ibox ${isStreaming ? 'off' : ''}">
      <textarea id="chat-input" placeholder="Ask a troubleshooting question..." rows="1" ${isStreaming ? 'disabled' : ''} onkeydown="ChatPage.handleKey(event)" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
      <button class="chat-send ${isStreaming ? 'loading' : ''}" onclick="ChatPage.send()" ${isStreaming ? 'disabled' : ''}>
        ${isStreaming ? '<span class="chat-spinner"></span>' : '<i class="ti ti-arrow-up"></i>'}
      </button>
    </div>
    <div class="chat-hint">Enter to send &middot; Shift+Enter for new line</div>`;
  }

  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }

  async function newChat() { activeChat = null; messages = []; streamBuffer = ''; isStreaming = false; App.render(); }

  async function loadChat(id) {
    try {
      const data = await API.getAiChat(id);
      activeChat = { id: data.id, title: data.title };
      messages = data.messages || [];
      streamBuffer = ''; isStreaming = false;
      App.render(); scrollToBottom();
    } catch (e) { showToast('Failed to load chat'); }
  }

  async function deleteChat(id) {
    try {
      await API.deleteAiChat(id);
      chats = chats.filter(c => c.id !== id);
      if (activeChat && activeChat.id === id) { activeChat = null; messages = []; }
      App.render(); showToast('Chat deleted');
    } catch (e) { showToast('Failed to delete'); }
  }

  function sendFromSuggestion(text) { const i = document.getElementById('chat-input'); if (i) i.value = text; send(); }

  async function send() {
    const input = document.getElementById('chat-input');
    const msg = input ? input.value.trim() : '';
    if (!msg || isStreaming) return;

    messages.push({ role: 'user', content: msg });
    isStreaming = true; streamBuffer = '';
    App.render(); scrollToBottom();

    try {
      const token = API.getToken();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: msg, chat_id: activeChat ? activeChat.id : null })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        messages.push({ role: 'assistant', content: err.error || 'Service unavailable. Try again later.' });
        isStreaming = false; App.render(); scrollToBottom(); return;
      }

      const ct = response.headers.get('content-type') || '';
      if (!ct.includes('text/event-stream')) {
        const d = await response.json().catch(() => ({}));
        messages.push({ role: 'assistant', content: d.error || 'Unexpected response.' });
        isStreaming = false; App.render(); scrollToBottom(); return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const p = JSON.parse(data);
            if (p.type === 'delta') { streamBuffer += p.text; updateStream(); }
            else if (p.type === 'done' && !activeChat) {
              activeChat = { id: p.chat_id, title: msg.substring(0, 80) };
              chats.unshift({ id: p.chat_id, title: msg.substring(0, 80) });
            }
            else if (p.type === 'error') { streamBuffer += (p.error || 'Error occurred.'); updateStream(); }
          } catch (e) {}
        }
      }
    } catch (e) { streamBuffer = 'Unable to reach AI service. Check your connection.'; }

    if (streamBuffer) messages.push({ role: 'assistant', content: streamBuffer });
    isStreaming = false; streamBuffer = '';
    App.render(); scrollToBottom();
  }

  function updateStream() {
    const el = document.getElementById('stream-output');
    if (el) { el.innerHTML = formatMarkdown(streamBuffer); scrollToBottom(); }
  }

  function scrollToBottom() { setTimeout(() => { const c = document.getElementById('chat-messages'); if (c) c.scrollTop = c.scrollHeight; }, 50); }

  function formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<div class="chat-code"><div class="chat-code-h">$1</div><pre>$2</pre></div>')
      .replace(/`([^`]+)`/g, '<code class="chat-ic">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<div class="chat-md-h3">$1</div>')
      .replace(/^## (.+)$/gm, '<div class="chat-md-h2">$1</div>')
      .replace(/^# (.+)$/gm, '<div class="chat-md-h1">$1</div>')
      .replace(/^\d+\.\s(.+)$/gm, '<div class="chat-li"><span class="chat-dot"></span>$1</div>')
      .replace(/^[-*]\s(.+)$/gm, '<div class="chat-li"><span class="chat-dot"></span>$1</div>')
      .replace(/\n/g, '<br>');
  }

  function afterRender() { scrollToBottom(); }

  return { load, render, afterRender, newChat, loadChat, deleteChat, send, sendFromSuggestion, handleKey };
})();
