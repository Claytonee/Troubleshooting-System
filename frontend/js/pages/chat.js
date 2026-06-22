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
        <div class="section-sub">Msaidizi wa Kiufundi &mdash; Troubleshooting</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary btn-sm" onclick="ChatPage.newChat()"><i class="ti ti-plus"></i> Chat Mpya</button>
      </div>
    </div>
    <div class="chat-layout" style="display:grid;grid-template-columns:240px 1fr;gap:0;height:calc(100vh - 56px - 24px - 60px - 48px);border-radius:var(--radius);overflow:hidden;border:1px solid var(--border)">
      ${renderSidebar()}
      ${renderMain()}
    </div>`;
  }

  function renderSidebar() {
    return `<div class="chat-sidebar" style="background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:12px;border-bottom:1px solid var(--border)">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">History</div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:8px">
        ${chats.length ? chats.map(c => `
          <div class="chat-history-item ${activeChat && activeChat.id === c.id ? 'active' : ''}" onclick="ChatPage.loadChat(${c.id})" style="display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:6px;cursor:pointer;margin-bottom:2px;font-size:12px;color:${activeChat && activeChat.id === c.id ? 'var(--accent)' : 'var(--text2)'};background:${activeChat && activeChat.id === c.id ? 'rgba(79,124,255,0.08)' : 'transparent'};transition:background .15s" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='${activeChat && activeChat.id === c.id ? 'rgba(79,124,255,0.08)' : 'transparent'}'">
            <i class="ti ti-message" style="font-size:13px;flex-shrink:0;opacity:.6"></i>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.title)}</span>
            <i class="ti ti-trash" style="font-size:12px;opacity:.4;flex-shrink:0" onclick="event.stopPropagation();ChatPage.deleteChat(${c.id})" onmouseover="this.style.opacity='1';this.style.color='var(--red)'" onmouseout="this.style.opacity='.4';this.style.color=''"></i>
          </div>
        `).join('') : `<div style="text-align:center;padding:20px 10px;font-size:11px;color:var(--text3)">Hakuna historia<br>Anza chat mpya</div>`}
      </div>
    </div>`;
  }

  function renderMain() {
    if (!activeChat && messages.length === 0) return renderWelcome();
    return `<div style="display:flex;flex-direction:column;background:var(--bg1);overflow:hidden">
      <div id="chat-messages" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px">
        ${messages.map(m => renderMessage(m)).join('')}
        ${isStreaming ? `<div class="chat-msg assistant"><div class="chat-bubble assistant-bubble"><div class="chat-streaming-indicator"><span></span><span></span><span></span></div><div id="stream-output" style="white-space:pre-wrap">${formatMarkdown(streamBuffer)}</div></div></div>` : ''}
      </div>
      ${renderInput()}
    </div>`;
  }

  function renderWelcome() {
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg1);padding:40px 20px;text-align:center">
      <div style="width:64px;height:64px;background:rgba(79,124,255,0.1);border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:16px">
        <i class="ti ti-robot" style="font-size:32px;color:var(--accent)"></i>
      </div>
      <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px">Msaidizi wa Kiufundi</div>
      <div style="font-size:13px;color:var(--text3);max-width:400px;line-height:1.7;margin-bottom:24px">
        Niulize swali lolote kuhusu matatizo ya kiufundi — mtandao, tablets, programu, umeme, au akaunti. Nitakusaidia kupata ufumbuzi wa haraka.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:400px;width:100%">
        ${renderSuggestion('ti-wifi', 'WiFi imekatika shuleni', '#4f7cff')}
        ${renderSuggestion('ti-device-tablet', 'Tablet haicharge', '#f5a623')}
        ${renderSuggestion('ti-app-window', 'App haiwork/imesimama', '#9b7dff')}
        ${renderSuggestion('ti-bolt', 'UPS inablink', '#ff5263')}
      </div>
      <div style="margin-top:24px;width:100%;max-width:500px">
        ${renderInput()}
      </div>
    </div>`;
  }

  function renderSuggestion(icon, text, color) {
    return `<div onclick="ChatPage.sendFromSuggestion('${esc(text)}')" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;transition:all .15s" onmouseover="this.style.borderColor='${color}';this.style.background='var(--bg3)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--bg2)'">
      <i class="ti ${icon}" style="font-size:16px;color:${color}"></i>
      <span style="font-size:12px;color:var(--text2)">${text}</span>
    </div>`;
  }

  function renderMessage(m) {
    const isUser = m.role === 'user';
    return `<div class="chat-msg ${m.role}" style="display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'}">
      <div style="max-width:75%;display:flex;gap:8px;align-items:flex-start;${isUser ? 'flex-direction:row-reverse' : ''}">
        ${isUser ? '' : '<div style="width:28px;height:28px;background:rgba(79,124,255,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px"><i class="ti ti-robot" style="font-size:14px;color:var(--accent)"></i></div>'}
        <div class="chat-bubble" style="padding:10px 14px;border-radius:${isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px'};background:${isUser ? 'var(--accent)' : 'var(--bg2)'};color:${isUser ? '#fff' : 'var(--text)'};font-size:13px;line-height:1.6;border:${isUser ? 'none' : '1px solid var(--border)'};white-space:pre-wrap;word-break:break-word">${isUser ? esc(m.content) : formatMarkdown(m.content)}</div>
      </div>
    </div>`;
  }

  function renderInput() {
    return `<div style="padding:12px 16px;border-top:1px solid var(--border);background:var(--bg2)">
      <div style="display:flex;gap:8px;align-items:flex-end">
        <textarea id="chat-input" placeholder="Andika swali lako hapa..." rows="1" style="flex:1;resize:none;padding:10px 14px;border-radius:10px;background:var(--bg1);border:1px solid var(--border);color:var(--text);font-size:13px;font-family:var(--font);max-height:120px;line-height:1.5" onkeydown="ChatPage.handleKey(event)" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
        <button class="btn btn-primary" onclick="ChatPage.send()" style="padding:10px 14px;border-radius:10px;flex-shrink:0" ${isStreaming ? 'disabled' : ''}>
          <i class="ti ${isStreaming ? 'ti-loader-2 spin' : 'ti-send'}" style="font-size:16px"></i>
        </button>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:6px;text-align:center">AI inaweza kukosea. Tatizo likikuwa gumu, report kupitia Report Error.</div>
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
                streamBuffer = parsed.error || 'Samahani, kuna tatizo la kiufundi. Jaribu tena.';
                updateStreamOutput();
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      streamBuffer = 'Samahani, siwezi kufikia huduma ya AI kwa sasa. Tafadhali jaribu tena baadaye.';
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
      .replace(/^### (.+)$/gm, '<div style="font-weight:600;font-size:14px;margin:8px 0 4px">$1</div>')
      .replace(/^## (.+)$/gm, '<div style="font-weight:600;font-size:15px;margin:10px 0 4px">$1</div>')
      .replace(/^# (.+)$/gm, '<div style="font-weight:700;font-size:16px;margin:12px 0 6px">$1</div>')
      .replace(/^\d+\.\s(.+)$/gm, '<div style="padding-left:16px;margin:2px 0">&#8226; $1</div>')
      .replace(/^[-*]\s(.+)$/gm, '<div style="padding-left:16px;margin:2px 0">&#8226; $1</div>')
      .replace(/\n/g, '<br>');
  }

  function afterRender() {
    scrollToBottom();
  }

  return { load, render, afterRender, newChat, loadChat, deleteChat, send, sendFromSuggestion, handleKey };
})();
