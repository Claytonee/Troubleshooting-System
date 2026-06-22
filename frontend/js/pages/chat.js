/**
 * AI Chat — Self-service Troubleshooting Assistant
 * Available to school and subadmin roles only
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
        <div class="section-title">AI Assistant</div>
        <div class="section-sub">Technical Support &mdash; Troubleshooting help for your school</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary btn-sm" onclick="ChatPage.newChat()"><i class="ti ti-plus"></i> New Chat</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:200px 1fr;gap:0;height:calc(100vh - 56px - 100px);border-radius:10px;overflow:hidden;border:1px solid var(--border);min-height:400px" class="chat-layout">
      ${renderSidebar()}
      ${renderMain()}
    </div>`;
  }

  function renderSidebar() {
    return `<div style="background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:12px;border-bottom:1px solid var(--border)">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text3)">Chat History</div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:6px">
        ${chats.length ? chats.map(c => {
          const isActive = activeChat && activeChat.id === c.id;
          return `<div onclick="ChatPage.loadChat(${c.id})" style="display:flex;align-items:center;gap:7px;padding:8px 9px;border-radius:6px;cursor:pointer;margin-bottom:2px;font-size:11px;color:${isActive ? 'var(--accent)' : 'var(--text2)'};background:${isActive ? 'rgba(79,124,255,0.1)' : 'transparent'};transition:all .15s;border-left:2px solid ${isActive ? 'var(--accent)' : 'transparent'}" onmouseover="if(!${isActive})this.style.background='var(--bg3)'" onmouseout="if(!${isActive})this.style.background='${isActive ? 'rgba(79,124,255,0.1)' : 'transparent'}'">
            <i class="ti ti-message" style="font-size:12px;flex-shrink:0;opacity:.5"></i>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.title)}</span>
            <i class="ti ti-x" style="font-size:10px;opacity:0;flex-shrink:0" onclick="event.stopPropagation();ChatPage.deleteChat(${c.id})" onmouseover="this.style.opacity='1';this.style.color='var(--red)'" onmouseout="this.style.opacity='0';this.style.color=''"></i>
          </div>`;
        }).join('') : `<div style="text-align:center;padding:24px 8px;font-size:11px;color:var(--text3)"><i class="ti ti-messages-off" style="font-size:18px;display:block;margin-bottom:6px;opacity:.4"></i>No history yet</div>`}
      </div>
    </div>`;
  }

  function renderMain() {
    if (!activeChat && messages.length === 0) return renderWelcome();
    return `<div style="display:flex;flex-direction:column;background:var(--bg1);height:100%;overflow:hidden">
      <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px">
        ${messages.map(m => renderMessage(m)).join('')}
        ${isStreaming ? renderStreamingBubble() : ''}
      </div>
      ${renderInput()}
    </div>`;
  }

  function renderStreamingBubble() {
    return `<div style="display:flex;gap:10px;align-items:flex-start">
      <div style="width:26px;height:26px;background:rgba(79,124,255,0.12);border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">
        <i class="ti ti-robot" style="font-size:13px;color:var(--accent)"></i>
      </div>
      <div id="stream-output" style="flex:1;max-width:75%;padding:10px 14px;border-radius:2px 10px 10px 10px;background:var(--bg2);border:1px solid var(--border);font-size:13px;line-height:1.7;color:var(--text);word-break:break-word">
        ${streamBuffer ? formatMarkdown(streamBuffer) : '<div class="chat-streaming-indicator"><span></span><span></span><span></span></div>'}
      </div>
    </div>`;
  }

  function renderWelcome() {
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg1);padding:30px 20px;height:100%">
      <div style="width:56px;height:56px;background:rgba(79,124,255,0.08);border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:16px">
        <i class="ti ti-robot" style="font-size:28px;color:var(--accent)"></i>
      </div>
      <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px">Technical Support Assistant</div>
      <div style="font-size:12px;color:var(--text3);max-width:380px;line-height:1.7;margin-bottom:24px;text-align:center">
        Ask me anything about troubleshooting your school equipment. I can help with WiFi, tablets, platform issues, power, and accounts.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:380px;width:100%;margin-bottom:24px">
        ${renderSuggestion('ti-wifi', 'WiFi is not working', '#4f7cff')}
        ${renderSuggestion('ti-device-tablet', 'Tablet won\'t charge', '#f5a623')}
        ${renderSuggestion('ti-app-window', 'App keeps crashing', '#9b7dff')}
        ${renderSuggestion('ti-bolt', 'UPS is blinking red', '#ff5263')}
      </div>
      <div style="width:100%;max-width:480px">
        ${renderInput()}
      </div>
    </div>`;
  }

  function renderSuggestion(icon, text, color) {
    return `<div onclick="ChatPage.sendFromSuggestion('${text.replace(/'/g, "\\'")}')" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .15s" onmouseover="this.style.borderColor='${color}';this.style.background='var(--bg3)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--bg2)'">
      <i class="ti ${icon}" style="font-size:15px;color:${color}"></i>
      <span style="font-size:11px;color:var(--text2)">${text}</span>
    </div>`;
  }

  function renderMessage(m) {
    const isUser = m.role === 'user';
    if (isUser) {
      return `<div style="display:flex;justify-content:flex-end">
        <div style="max-width:65%;padding:9px 14px;border-radius:10px 10px 2px 10px;background:var(--accent);color:#fff;font-size:13px;line-height:1.6;word-break:break-word">${esc(m.content)}</div>
      </div>`;
    }
    return `<div style="display:flex;gap:10px;align-items:flex-start">
      <div style="width:26px;height:26px;background:rgba(79,124,255,0.12);border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">
        <i class="ti ti-robot" style="font-size:13px;color:var(--accent)"></i>
      </div>
      <div style="flex:1;max-width:75%;padding:10px 14px;border-radius:2px 10px 10px 10px;background:var(--bg2);border:1px solid var(--border);font-size:13px;line-height:1.7;color:var(--text);word-break:break-word">${formatMarkdown(m.content)}</div>
    </div>`;
  }

  function renderInput() {
    return `<div style="padding:10px 14px;border-top:1px solid var(--border);background:var(--bg2)">
      <div style="display:flex;gap:8px;align-items:center">
        <textarea id="chat-input" placeholder="Type your question here..." rows="1" style="flex:1;resize:none;padding:9px 12px;border-radius:8px;background:var(--bg1);border:1px solid var(--border);color:var(--text);font-size:13px;font-family:var(--font);max-height:100px;line-height:1.4" onkeydown="ChatPage.handleKey(event)" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"></textarea>
        <button class="btn btn-primary" onclick="ChatPage.send()" style="padding:9px 14px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;gap:5px;font-size:12px" ${isStreaming ? 'disabled' : ''}>
          ${isStreaming ? '<i class="ti ti-loader-2 spin" style="font-size:14px"></i>' : '<i class="ti ti-send" style="font-size:14px"></i> Send'}
        </button>
      </div>
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
      if (activeChat && activeChat.id === id) {
        activeChat = null;
        messages = [];
      }
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: msg,
          chat_id: activeChat ? activeChat.id : null
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        messages.push({ role: 'assistant', content: err.error || 'Service unavailable. Please try again later.' });
        isStreaming = false;
        streamBuffer = '';
        App.render();
        scrollToBottom();
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const data = await response.json().catch(() => ({}));
        messages.push({ role: 'assistant', content: data.error || 'Unexpected response from server.' });
        isStreaming = false;
        streamBuffer = '';
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
          if (line.startsWith('data: ')) {
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
                  chats.unshift({ id: parsed.chat_id, title: msg.substring(0, 80), updated_at: new Date().toISOString() });
                }
              } else if (parsed.type === 'error') {
                streamBuffer += (parsed.error || 'An error occurred.');
                updateStreamOutput();
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      streamBuffer = 'Unable to reach AI service. Please check your connection and try again.';
    }

    if (streamBuffer) {
      messages.push({ role: 'assistant', content: streamBuffer });
    }
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
      const container = document.getElementById('chat-messages');
      if (container) container.scrollTop = container.scrollHeight;
    }, 50);
  }

  function formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:var(--bg3);padding:1px 4px;border-radius:3px;font-family:var(--mono);font-size:12px">$1</code>')
      .replace(/^### (.+)$/gm, '<div style="font-weight:600;font-size:13px;margin:8px 0 3px">$1</div>')
      .replace(/^## (.+)$/gm, '<div style="font-weight:600;font-size:14px;margin:10px 0 4px">$1</div>')
      .replace(/^# (.+)$/gm, '<div style="font-weight:700;font-size:15px;margin:12px 0 5px">$1</div>')
      .replace(/^\d+\.\s(.+)$/gm, '<div style="padding-left:16px;margin:2px 0">&#8226; $1</div>')
      .replace(/^[-*]\s(.+)$/gm, '<div style="padding-left:16px;margin:2px 0">&#8226; $1</div>')
      .replace(/\n/g, '<br>');
  }

  function afterRender() {
    scrollToBottom();
  }

  return { load, render, afterRender, newChat, loadChat, deleteChat, send, sendFromSuggestion, handleKey };
})();
