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
  let thinkingStep = 0;

  async function load() {
    try { chats = await API.getAiChats(); } catch (e) { chats = []; }
  }

  function render() {
    return `
    <div class="section-header">
      <div>
        <div class="section-title"><span class="chat-title-shimmer">AI Assistant</span></div>
        <div class="section-sub">Technical Support &mdash; Troubleshooting help for your school</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary btn-sm" onclick="ChatPage.newChat()" style="gap:6px"><i class="ti ti-plus" style="font-size:14px"></i> New Chat</button>
      </div>
    </div>
    <div class="chat-container">
      ${renderSidebar()}
      <div class="chat-main">
        ${activeChat || messages.length > 0 ? renderChatView() : renderWelcome()}
      </div>
    </div>`;
  }

  function renderSidebar() {
    return `<div class="chat-sidebar">
      <div class="chat-sidebar-header">
        <div class="chat-ai-badge">
          <div class="chat-ai-icon"><i class="ti ti-sparkles" style="font-size:14px;color:#fff"></i></div>
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text)">QFT AI</div>
            <div style="display:flex;align-items:center;gap:4px"><span class="chat-status-dot"></span><span style="font-size:10px;color:var(--text3)">Claude Opus</span></div>
          </div>
        </div>
      </div>
      <div class="chat-history-list">
        ${chats.length ? chats.map(c => {
          const isActive = activeChat && activeChat.id === c.id;
          return `<div class="chat-history-item ${isActive ? 'active' : ''}" onclick="ChatPage.loadChat(${c.id})">
            <i class="ti ti-message" style="font-size:12px;opacity:.5;flex-shrink:0"></i>
            <span class="chat-history-title">${esc(c.title)}</span>
            <i class="ti ti-trash chat-delete-btn" onclick="event.stopPropagation();ChatPage.deleteChat(${c.id})"></i>
          </div>`;
        }).join('') : `<div class="chat-empty-history"><i class="ti ti-messages-off"></i><span>No conversations yet</span></div>`}
      </div>
    </div>`;
  }

  function renderChatView() {
    return `
      <div class="chat-messages" id="chat-messages">
        ${messages.map(m => renderMessage(m)).join('')}
        ${isStreaming ? renderThinking() : ''}
      </div>
      ${renderInput()}`;
  }

  function renderThinking() {
    if (streamBuffer) {
      return `<div class="chat-msg-row ai">
        <div class="chat-avatar ai"><i class="ti ti-sparkles"></i></div>
        <div class="chat-bubble-ai">
          <div class="chat-bubble-bar"></div>
          <div class="chat-bubble-content" id="stream-output">${formatMarkdown(streamBuffer)}</div>
        </div>
      </div>`;
    }
    return `<div class="chat-msg-row ai">
      <div class="chat-avatar ai"><div class="chat-avatar-pulse"></div><i class="ti ti-sparkles"></i></div>
      <div class="chat-thinking-card">
        <div class="chat-thinking-bar"></div>
        <div class="chat-thinking-body">
          <div class="chat-wave-indicator">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="chat-thinking-label">Analyzing...</div>
          <div class="chat-thinking-steps">
            <div class="chat-step done"><i class="ti ti-check"></i> Understanding your question</div>
            <div class="chat-step active"><div class="chat-step-pulse"></div> Searching knowledge base</div>
            <div class="chat-step pending"><div class="chat-step-dot"></div> Generating response</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderWelcome() {
    return `
      <div class="chat-welcome">
        <div class="chat-welcome-icon">
          <i class="ti ti-sparkles" style="font-size:28px;color:var(--accent)"></i>
          <div class="chat-welcome-glow"></div>
        </div>
        <div class="chat-welcome-title">How can I help you today?</div>
        <div class="chat-welcome-sub">Ask me anything about troubleshooting your school equipment. I'll guide you step by step.</div>
        <div class="chat-suggestions">
          ${renderSuggestion('ti-wifi', 'WiFi is not working', 'Network connectivity issues')}
          ${renderSuggestion('ti-device-tablet', 'Tablet won\'t charge', 'Battery and charging problems')}
          ${renderSuggestion('ti-app-window', 'App keeps crashing', 'Platform and software issues')}
          ${renderSuggestion('ti-bolt', 'UPS is blinking red', 'Power and electrical faults')}
        </div>
      </div>
      ${renderInput()}`;
  }

  function renderSuggestion(icon, text, sub) {
    return `<div class="chat-suggestion" onclick="ChatPage.sendFromSuggestion('${text.replace(/'/g, "\\'")}')">
      <div class="chat-suggestion-icon"><i class="ti ${icon}"></i></div>
      <div><div class="chat-suggestion-text">${text}</div><div class="chat-suggestion-sub">${sub}</div></div>
    </div>`;
  }

  function renderMessage(m) {
    if (m.role === 'user') {
      return `<div class="chat-msg-row user">
        <div class="chat-bubble-user">${esc(m.content)}</div>
        <div class="chat-avatar user"><i class="ti ti-user"></i></div>
      </div>`;
    }
    return `<div class="chat-msg-row ai">
      <div class="chat-avatar ai"><i class="ti ti-sparkles"></i></div>
      <div class="chat-bubble-ai">
        <div class="chat-bubble-content">${formatMarkdown(m.content)}</div>
      </div>
    </div>`;
  }

  function renderInput() {
    return `<div class="chat-input-area">
      <div class="chat-input-box ${isStreaming ? 'disabled' : ''}">
        <textarea id="chat-input" placeholder="Ask a troubleshooting question..." rows="1" ${isStreaming ? 'disabled' : ''} onkeydown="ChatPage.handleKey(event)" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,140)+'px'"></textarea>
        <button class="chat-send-btn ${isStreaming ? 'streaming' : ''}" onclick="ChatPage.send()" ${isStreaming ? 'disabled' : ''}>
          ${isStreaming ? '<div class="chat-send-spinner"></div>' : '<i class="ti ti-arrow-up"></i>'}
        </button>
      </div>
      <div class="chat-input-hint">Press Enter to send &middot; AI can make mistakes</div>
    </div>`;
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  async function newChat() {
    activeChat = null;
    messages = [];
    streamBuffer = '';
    isStreaming = false;
    App.render();
  }

  async function loadChat(id) {
    try {
      const data = await API.getAiChat(id);
      activeChat = { id: data.id, title: data.title };
      messages = data.messages || [];
      streamBuffer = '';
      isStreaming = false;
      App.render();
      scrollToBottom();
    } catch (e) { showToast('Failed to load chat'); }
  }

  async function deleteChat(id) {
    try {
      await API.deleteAiChat(id);
      chats = chats.filter(c => c.id !== id);
      if (activeChat && activeChat.id === id) { activeChat = null; messages = []; }
      App.render();
      showToast('Chat deleted');
    } catch (e) { showToast('Failed to delete'); }
  }

  function sendFromSuggestion(text) {
    const input = document.getElementById('chat-input');
    if (input) input.value = text;
    send();
  }

  async function send() {
    const input = document.getElementById('chat-input');
    const msg = input ? input.value.trim() : '';
    if (!msg || isStreaming) return;

    messages.push({ role: 'user', content: msg });
    isStreaming = true;
    streamBuffer = '';
    App.render();
    scrollToBottom();

    try {
      const token = API.getToken();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: msg, chat_id: activeChat ? activeChat.id : null })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        messages.push({ role: 'assistant', content: err.error || 'Service unavailable. Please try again later.' });
        isStreaming = false;
        App.render();
        scrollToBottom();
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const data = await response.json().catch(() => ({}));
        messages.push({ role: 'assistant', content: data.error || 'Unexpected response.' });
        isStreaming = false;
        App.render();
        scrollToBottom();
        return;
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
            const parsed = JSON.parse(data);
            if (parsed.type === 'delta') {
              streamBuffer += parsed.text;
              updateStreamOutput();
            } else if (parsed.type === 'done') {
              if (!activeChat) {
                activeChat = { id: parsed.chat_id, title: msg.substring(0, 80) };
                chats.unshift({ id: parsed.chat_id, title: msg.substring(0, 80) });
              }
            } else if (parsed.type === 'error') {
              streamBuffer += (parsed.error || 'An error occurred.');
              updateStreamOutput();
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      streamBuffer = 'Unable to reach AI service. Please check your connection.';
    }

    if (streamBuffer) messages.push({ role: 'assistant', content: streamBuffer });
    isStreaming = false;
    streamBuffer = '';
    App.render();
    scrollToBottom();
  }

  function updateStreamOutput() {
    const el = document.getElementById('stream-output');
    if (el) {
      el.innerHTML = formatMarkdown(streamBuffer);
      scrollToBottom();
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      const c = document.getElementById('chat-messages');
      if (c) c.scrollTop = c.scrollHeight;
    }, 50);
  }

  function formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<div class="chat-code-block"><div class="chat-code-header"><span>$1</span></div><pre>$2</pre></div>')
      .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h4 class="chat-h">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 class="chat-h">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 class="chat-h">$1</h2>')
      .replace(/^\d+\.\s(.+)$/gm, '<div class="chat-list-item"><span class="chat-bullet"></span>$1</div>')
      .replace(/^[-*]\s(.+)$/gm, '<div class="chat-list-item"><span class="chat-bullet"></span>$1</div>')
      .replace(/\n\n/g, '</p><p class="chat-p">')
      .replace(/\n/g, '<br>');
  }

  function afterRender() { scrollToBottom(); }

  return { load, render, afterRender, newChat, loadChat, deleteChat, send, sendFromSuggestion, handleKey };
})();
