/**
 * AI Assistant — conversation surface for the troubleshooting assistant.
 *
 * Renders once, then patches the DOM as tokens arrive. Calling App.render()
 * mid-stream would rebuild the page, drop the caret and lose the scroll
 * position, so nothing in the streaming path touches it.
 */
const ChatPage = (() => {
  let chats = [];
  let activeChat = null;
  let messages = [];
  let isStreaming = false;
  let streamBuffer = '';
  let controller = null;      // aborts the in-flight request when the user stops
  let railOpen = false;
  let service = null;         // { configured, hint } — asked of the server on load
  let pinnedToBottom = true;  // false once the user scrolls up to read

  const NEAR_BOTTOM_PX = 80;
  let ownerId = null;         // whose transcript the state above belongs to

  /** Drops the in-memory transcript. Called on logout and on a user change. */
  function reset() {
    if (isStreaming) stop();
    chats = []; activeChat = null; messages = [];
    streamBuffer = ''; railOpen = false; pinnedToBottom = true; ownerId = null;
  }

  async function load() {
    // The transcript lives in module state, so a second sign-in on the same
    // device would otherwise open on the previous user conversation.
    const me = (API.getUser() || {}).id || null;
    if (me !== ownerId) { reset(); ownerId = me; }
    // Asked before rendering: on a deployment where the model credentials were
    // never set, a composer that swallows every message and answers "AI service
    // not configured" is worse than saying so up front, next to the two things
    // that DO work offline of the assistant — the guides and Report Error.
    const [chatList, status] = await Promise.all([
      API.getAiChats().catch(() => []),
      API.getAiStatus().catch(() => ({ configured: true, unknown: true }))
    ]);
    chats = Array.isArray(chatList) ? chatList : [];
    service = status;
  }

  const serviceOff = () => service && service.configured === false;

  /* ----------------------------------------------------------------- icons */

  const aiIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2-2a2 2 0 0 1-2-2a2 2 0 0 1-2 2zm0-12a2 2 0 0 1 2 2a2 2 0 0 1 2-2a2 2 0 0 1-2-2a2 2 0 0 1-2 2zM8 12a6 6 0 0 1 6 6a6 6 0 0 1 6-6a6 6 0 0 1-6-6a6 6 0 0 1-6 6z"/></svg>';
  const sendIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5l0 14"/><path d="M18 11l-6-6"/><path d="M6 11l6-6"/></svg>';
  const stopIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>';

  /* ----------------------------------------------------------- suggestions */

  // Field engineers and admins troubleshoot across schools; a teacher only ever
  // asks about the room in front of them. Offer each the openers they would type.
  function suggestions() {
    const role = (API.getUser() || {}).role;
    if (role === 'admin' || role === 'subadmin') {
      return [
        ['ti-router', 'A school LRS is unreachable', 'var(--accent)'],
        ['ti-device-tablet', 'Tablets not charging after repair', 'var(--amber)'],
        ['ti-alert-triangle', 'What is still open at my schools?', 'var(--red)'],
        ['ti-clipboard-check', 'What should I check on a school visit?', 'var(--teal)']
      ];
    }
    return [
      ['ti-wifi-off', 'The WiFi is not working', 'var(--accent)'],
      ['ti-device-tablet', 'A tablet will not charge', 'var(--amber)'],
      ['ti-app-window', 'Quest keeps crashing', 'var(--purple)'],
      ['ti-bolt', 'The UPS is blinking red', 'var(--red)']
    ];
  }

  /* ---------------------------------------------------------------- render */

  function render() {
    return `
    <div class="chat-page-wrap">
      <div class="section-header">
        <div>
          <div class="section-title"><span class="chat-title-shimmer">AI Assistant</span></div>
          <div class="section-sub">Technical Support &mdash; ask in English or Kiswahili</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-secondary btn-sm chat-rail-toggle" onclick="ChatPage.toggleRail()"><i class="ti ti-history"></i> History</button>
          <button class="btn btn-primary btn-sm" data-tip="${TIP.NEW_CHAT}" onclick="ChatPage.newChat()"><i class="ti ti-plus"></i> New Chat</button>
        </div>
      </div>
      <div class="chat-container">
        <div class="chat-rail-backdrop ${railOpen ? 'show' : ''}" id="chat-rail-backdrop" onclick="ChatPage.toggleRail()"></div>
        <nav class="chat-sidebar ${railOpen ? 'open' : ''}" id="chat-sidebar">
          <div class="chat-sidebar-top">
            <button class="chat-new-btn" onclick="ChatPage.newChat()"><i class="ti ti-plus"></i> New chat</button>
          </div>
          <div class="chat-rail-label">Recent</div>
          <div class="chat-history-scroll" id="chat-history">${renderHistory()}</div>
        </nav>
        <div class="chat-body" id="chat-body">${renderBody()}</div>
      </div>
    </div>`;
  }

  function renderHistory() {
    if (!chats.length) return '<div class="chat-no-hist"><i class="ti ti-messages-off"></i>No conversations yet</div>';
    return chats.map(c => {
      const act = activeChat && activeChat.id === c.id;
      return `<div class="chat-hist ${act ? 'act' : ''}" onclick="ChatPage.loadChat(${c.id})" title="${esc(c.title)}">
        <i class="ti ti-message"></i><span>${esc(c.title)}</span>
        <i class="ti ti-x chat-del" title="Delete" onclick="event.stopPropagation();ChatPage.deleteChat(${c.id})"></i>
      </div>`;
    }).join('');
  }

  function renderBody() {
    if (serviceOff()) return renderUnavailable();
    return (activeChat || messages.length) ? renderConversation() : renderWelcome();
  }

  /**
   * The assistant is not switched on for this deployment.
   *
   * Says who can switch it on, and offers the two routes that still work — the
   * guides, and a fault report that reaches a human. No composer: a text box
   * that cannot send anything is a trap.
   */
  function renderUnavailable() {
    const role = (API.getUser() || {}).role;
    const hint = (service && service.hint) || 'The AI assistant has not been switched on yet.';
    return `
      <div class="chat-welcome-area">
        <div class="chat-welcome-scroll">
          <div class="chat-welcome-inner">
            <div class="chat-w-icon" style="opacity:.5">${aiIcon}</div>
            <div class="chat-w-title">The assistant is not available yet</div>
            <div class="chat-w-sub">${esc(hint)}</div>
            <div class="chat-w-grid">
              <button class="chat-sug" onclick="Router.navigate('troubleshoot');App.loadAndRender()">
                <i class="ti ti-list-check" style="color:var(--teal)"></i><span>Open the troubleshooting guides</span>
              </button>
              <button class="chat-sug" onclick="Router.navigate('report');App.loadAndRender()">
                <i class="ti ti-alert-triangle" style="color:var(--amber)"></i><span>Report the problem to an engineer</span>
              </button>
              ${role === 'admin' ? `<button class="chat-sug" onclick="ChatPage.recheck()">
                <i class="ti ti-refresh" style="color:var(--accent)"></i><span>I have set the key — check again</span>
              </button>` : ''}
            </div>
          </div>
        </div>
      </div>`;
  }

  /** For an admin who has just set the variable: re-ask without a full reload. */
  async function recheck() {
    try { service = await API.getAiStatus(); } catch (e) { /* keep the last answer */ }
    App.render();
    if (serviceOff()) showToast('Still not configured — the app has to be restarted after setting the key');
  }

  function renderConversation() {
    return `
      <div class="chat-msgs" id="chat-messages" onscroll="ChatPage.onScroll()">
        <div class="chat-thread" id="chat-thread">${messages.map(renderMsg).join('')}</div>
      </div>
      ${renderComposer()}`;
  }

  function renderWelcome() {
    const user = API.getUser() || {};
    const first = (user.full_name || '').trim().split(/\s+/)[0];
    const greet = first ? `How can I help, ${esc(first)}?` : 'How can I help you today?';
    return `
      <div class="chat-welcome-area">
        <div class="chat-welcome-scroll">
          <div class="chat-welcome-inner">
            <div class="chat-w-icon">${aiIcon}</div>
            <div class="chat-w-title">${greet}</div>
            <div class="chat-w-sub">Ask about tablets, WiFi, the Quest platform, power or accounts. Answers follow your school&rsquo;s own troubleshooting guides &mdash; uliza kwa Kiswahili au Kiingereza.</div>
            <div class="chat-w-grid">
              ${suggestions().map(([ic, text, color]) =>
                `<button class="chat-sug" onclick="ChatPage.sendText(${attr(text)})"><i class="ti ${ic}" style="color:${color}"></i><span>${esc(text)}</span></button>`
              ).join('')}
            </div>
          </div>
        </div>
        ${renderComposer()}
      </div>`;
  }

  function renderComposer() {
    return `
      <div class="chat-input-wrap">
        <div class="chat-input-inner">
          <div class="chat-ibox">
            <textarea id="chat-input" rows="1" placeholder="Ask a troubleshooting question&hellip;"
              onkeydown="ChatPage.handleKey(event)" oninput="ChatPage.grow(this)"></textarea>
            <button class="chat-send" id="chat-send" onclick="ChatPage.onSendClick()">${sendIcon}</button>
          </div>
          <div class="chat-hint">Enter to send &middot; Shift+Enter for a new line</div>
        </div>
      </div>`;
  }

  function renderMsg(m, i) {
    if (m.role === 'user') {
      return `<div class="chat-row user"><div class="chat-u-bubble">${esc(m.content)}</div></div>`;
    }
    return `<div class="chat-row ai${m.error ? ' err' : ''}">
      <div class="chat-ai-head"><div class="chat-ai-av">${aiIcon}</div><div class="chat-ai-name">OE Assistant</div></div>
      <div class="chat-ai-text">${renderMarkdown(m.content)}</div>
      ${m.error ? '' : renderActions(i)}
    </div>`;
  }

  function renderActions(i) {
    const isLast = i === messages.length - 1;
    return `<div class="chat-acts">
      <button class="chat-act" onclick="ChatPage.copyMsg(${i},this)"><i class="ti ti-copy"></i>Copy</button>
      ${isLast ? '<button class="chat-act" onclick="ChatPage.regenerate()"><i class="ti ti-refresh"></i>Regenerate</button>' : ''}
    </div>`;
  }

  // The answer being streamed. Appended once, then patched token by token.
  function streamingRowHtml() {
    return `<div class="chat-row ai" id="chat-streaming">
      <div class="chat-ai-head"><div class="chat-ai-av">${aiIcon}</div><div class="chat-ai-name">OE Assistant</div></div>
      <div class="chat-typing" id="chat-typing"><span></span><span></span><span></span></div>
      <div class="chat-ai-text" id="chat-stream-text" hidden></div>
    </div>`;
  }

  /* -------------------------------------------------------------- markdown */

  function attr(s) { return `&quot;${String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}&quot;`; }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, (_, c) => `<code class="chat-ic">${c}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  /**
   * Block-level markdown. Hand-rolled rather than pulled from a CDN because the
   * CSP only allows a short allowlist and the assistant emits a narrow subset:
   * headings, ordered and unordered lists, tables, quotes, rules, fenced code.
   * Ordered lists render as real <ol> so numbered troubleshooting steps keep
   * their numbers — the previous renderer turned every step into the same dot.
   */
  function renderMarkdown(text) {
    if (!text) return '';
    const lines = escHtml(text).split('\n');
    const out = [];
    let para = [];
    let list = null;         // 'ul' | 'ol'
    let quote = [];

    const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
    const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    const flushQuote = () => {
      if (quote.length) { out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`); quote = []; }
    };
    const flushAll = () => { flushPara(); flushList(); flushQuote(); };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();

      // fenced code
      const fence = /^```(\w*)\s*$/.exec(line);
      if (fence) {
        flushAll();
        const lang = fence[1] || 'code';
        const body = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) body.push(lines[i]), i++;
        out.push(`<div class="chat-code"><div class="chat-code-h"><span>${lang}</span><button class="chat-act" onclick="ChatPage.copyCode(this)"><i class="ti ti-copy"></i>Copy</button></div><pre>${body.join('\n')}</pre></div>`);
        continue;
      }

      if (!line) { flushAll(); continue; }

      if (/^(---|\*\*\*|___)$/.test(line)) { flushAll(); out.push('<hr>'); continue; }

      const heading = /^(#{1,3})\s+(.*)$/.exec(line);
      if (heading) {
        flushAll();
        const lvl = heading[1].length;
        out.push(`<h${lvl}>${inline(heading[2])}</h${lvl}>`);
        continue;
      }

      const bq = /^&gt;\s?(.*)$/.exec(line);
      if (bq) { flushPara(); flushList(); quote.push(bq[1]); continue; }
      flushQuote();

      // table: a header row followed by a |---|---| separator
      if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
        flushAll();
        const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const head = cells(line);
        i += 2;
        const body = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) body.push(cells(lines[i])), i++;
        i--;
        out.push(`<div class="chat-tbl-wrap"><table><thead><tr>${head.map(h => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${
          body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')
        }</tbody></table></div>`);
        continue;
      }

      const ol = /^(\d+)[.)]\s+(.*)$/.exec(line);
      const ul = /^[-*+]\s+(.*)$/.exec(line);
      if (ol || ul) {
        const want = ol ? 'ol' : 'ul';
        flushPara();
        if (list !== want) { flushList(); out.push(want === 'ol' ? `<ol start="${ol[1]}">` : '<ul>'); list = want; }
        out.push(`<li>${inline(ol ? ol[2] : ul[1])}</li>`);
        continue;
      }

      // A plain line right after a list item continues that item.
      if (list && /^\s{2,}/.test(raw)) {
        const last = out.length - 1;
        if (out[last].startsWith('<li>')) {
          out[last] = out[last].replace(/<\/li>$/, ` ${inline(line)}</li>`);
          continue;
        }
      }

      flushList();
      para.push(line);
    }
    flushAll();
    return out.join('');
  }

  /* ------------------------------------------------------------ interaction */

  function grow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 168) + 'px';
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function toggleRail() {
    railOpen = !railOpen;
    const rail = document.getElementById('chat-sidebar');
    const back = document.getElementById('chat-rail-backdrop');
    if (rail) rail.classList.toggle('open', railOpen);
    if (back) back.classList.toggle('show', railOpen);
  }

  function closeRail() {
    if (!railOpen) return;
    railOpen = false;
    const rail = document.getElementById('chat-sidebar');
    const back = document.getElementById('chat-rail-backdrop');
    if (rail) rail.classList.remove('open');
    if (back) back.classList.remove('show');
  }

  function onScroll() {
    const c = document.getElementById('chat-messages');
    if (!c) return;
    pinnedToBottom = c.scrollHeight - c.scrollTop - c.clientHeight < NEAR_BOTTOM_PX;
  }

  // Only follow the answer down while the reader is already at the bottom —
  // yanking the view mid-sentence is the classic streaming-chat annoyance.
  function stickToBottom(force) {
    const c = document.getElementById('chat-messages');
    if (!c || (!pinnedToBottom && !force)) return;
    c.scrollTop = c.scrollHeight;
  }

  function focusInput() {
    const i = document.getElementById('chat-input');
    if (i && window.innerWidth > 920) i.focus();
  }

  async function newChat() {
    if (isStreaming) stop();
    activeChat = null; messages = []; streamBuffer = '';
    closeRail();
    App.render();
    focusInput();
  }

  async function loadChat(id) {
    if (isStreaming) stop();
    try {
      const data = await API.getAiChat(id);
      activeChat = { id: data.id, title: data.title };
      messages = (data.messages || []).map(m => ({ role: m.role, content: m.content }));
      streamBuffer = '';
      pinnedToBottom = true;
      closeRail();
      App.render();
      stickToBottom(true);
    } catch (e) { showToast('Could not open that conversation'); }
  }

  async function deleteChat(id) {
    try {
      await API.deleteAiChat(id);
      chats = chats.filter(c => c.id !== id);
      if (activeChat && activeChat.id === id) { activeChat = null; messages = []; }
      App.render();
      showToast('Conversation deleted');
    } catch (e) { showToast('Could not delete that conversation'); }
  }

  function sendText(text) {
    const i = document.getElementById('chat-input');
    if (i) { i.value = text; grow(i); }
    send();
  }

  function onSendClick() { isStreaming ? stop() : send(); }

  function copyMsg(i, btn) {
    const m = messages[i];
    if (!m) return;
    copyToClipboard(m.content, btn);
  }

  function copyCode(btn) {
    const pre = btn.closest('.chat-code').querySelector('pre');
    copyToClipboard(pre.innerText, btn);
  }

  function copyToClipboard(text, btn) {
    const done = () => {
      if (!btn) return showToast('Copied');
      const html = btn.innerHTML;
      btn.innerHTML = '<i class="ti ti-check"></i>Copied';
      setTimeout(() => { btn.innerHTML = html; }, 1400);
    };
    // Older WebViews on the school tablets have no async clipboard, and even
    // where it exists the permission can be denied — fall through to the
    // selection-based copy rather than giving up.
    const legacy = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      ok ? done() : showToast('Could not copy — select the text and copy manually');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, legacy);
    } else {
      legacy();
    }
  }

  /** Drops the last answer and asks the same question again. */
  function regenerate() {
    if (isStreaming) return;
    if (!messages.length || messages[messages.length - 1].role !== 'assistant') return;
    messages.pop();
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) { App.render(); return; }
    messages.pop();
    App.render();
    stream(lastUser.content);
  }

  function stop() {
    if (controller) { try { controller.abort(); } catch (e) {} }
  }

  function send() {
    const input = document.getElementById('chat-input');
    const msg = input ? input.value.trim() : '';
    if (!msg || isStreaming) return;
    if (input) { input.value = ''; input.style.height = 'auto'; }
    stream(msg);
  }

  /* --------------------------------------------------------------- streaming */

  function setSendButton(streaming) {
    const btn = document.getElementById('chat-send');
    if (!btn) return;
    btn.classList.toggle('stop', streaming);
    btn.innerHTML = streaming ? stopIcon : sendIcon;
    btn.setAttribute('aria-label', streaming ? 'Stop generating' : 'Send');
  }

  function paintStream() {
    const txt = document.getElementById('chat-stream-text');
    const typing = document.getElementById('chat-typing');
    if (!txt) return;
    if (typing) typing.remove();
    txt.hidden = false;
    txt.innerHTML = renderMarkdown(streamBuffer) + '<span class="chat-caret"></span>';
    stickToBottom();
  }

  async function stream(msg) {
    const firstMessage = !activeChat && !messages.length;
    messages.push({ role: 'user', content: msg });
    isStreaming = true;
    streamBuffer = '';
    pinnedToBottom = true;

    // The welcome screen has no thread, so build one on the first question.
    if (firstMessage) {
      const body = document.getElementById('chat-body');
      if (body) body.innerHTML = renderConversation();
    } else {
      const thread = document.getElementById('chat-thread');
      if (thread) thread.insertAdjacentHTML('beforeend', renderMsg(messages[messages.length - 1], messages.length - 1));
    }
    const thread = document.getElementById('chat-thread');
    if (thread) thread.insertAdjacentHTML('beforeend', streamingRowHtml());
    setSendButton(true);
    stickToBottom(true);

    let failed = null;
    controller = new AbortController();

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API.getToken()}` },
        body: JSON.stringify({ message: msg, chat_id: activeChat ? activeChat.id : null })
      });

      if (!response.ok || !(response.headers.get('content-type') || '').includes('text/event-stream')) {
        const d = await response.json().catch(() => ({}));
        failed = d.error || (response.status === 403
          ? 'Your account is not allowed to use the assistant.'
          : 'The assistant is unavailable right now. Try again shortly.');
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6);
            if (payload === '[DONE]') continue;
            let p;
            try { p = JSON.parse(payload); } catch (e) { continue; }
            if (p.type === 'delta') { streamBuffer += p.text; paintStream(); }
            else if (p.type === 'error') failed = p.error || 'Something went wrong generating that answer.';
            else if (p.type === 'done' && p.chat_id && !activeChat) {
              activeChat = { id: p.chat_id, title: msg.slice(0, 80) };
              chats.unshift({ id: p.chat_id, title: msg.slice(0, 80) });
            }
          }
        }
      }
    } catch (e) {
      // An abort is the user pressing stop, not a failure.
      if (!(e && e.name === 'AbortError')) failed = 'Could not reach the assistant. Check your connection.';
    }

    controller = null;
    isStreaming = false;

    const row = document.getElementById('chat-streaming');
    if (row) row.remove();

    if (streamBuffer) messages.push({ role: 'assistant', content: streamBuffer });
    if (failed) messages.push({ role: 'assistant', content: failed, error: true });
    streamBuffer = '';

    // Re-render the thread so Copy/Regenerate attach to the settled messages,
    // and refresh the rail so a brand-new conversation appears in it.
    const threadEl = document.getElementById('chat-thread');
    if (threadEl) threadEl.innerHTML = messages.map(renderMsg).join('');
    const histEl = document.getElementById('chat-history');
    if (histEl) histEl.innerHTML = renderHistory();
    setSendButton(false);
    stickToBottom(true);
    focusInput();
  }

  function afterRender() {
    setSendButton(isStreaming);
    stickToBottom(true);
    const i = document.getElementById('chat-input');
    if (i) grow(i);
    focusInput();
  }

  return {
    load, render, afterRender, reset,
    newChat, loadChat, deleteChat,
    send, sendText, onSendClick, handleKey, grow,
    toggleRail, onScroll, regenerate, copyMsg, copyCode, recheck
  };
})();
