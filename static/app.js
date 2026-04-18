/**
 * app.js — Dev AI Assistant — Premium Frontend
 *
 * Features:
 *  - Streaming word-by-word effect
 *  - Chat history with localStorage
 *  - Memory system (name, preferences)
 *  - Voice input/output
 *  - Markdown rendering (via marked.js)
 *  - Copy to clipboard per message
 *  - Chat export (.txt)
 *  - Smart command/search detection (no slash required)
 *  - Theme switching (Glass / Dark / Neon)
 *  - Toast notifications
 *  - Fully responsive
 */

/* ─── Constants ───────────────────────────────────────────────── */
const STORAGE_KEYS = {
  THEME:    "dev_ai_theme",
  CHATS:    "dev_ai_chats",
  ACTIVE:   "dev_ai_active_chat",
  MEMORY:   "dev_ai_memory",
};

const SMART_COMMANDS = {
  youtube:    "https://youtube.com",
  github:     "https://github.com",
  gmail:      "https://mail.google.com",
  maps:       "https://maps.google.com",
  reddit:     "https://reddit.com",
  twitter:    "https://twitter.com",
  x:          "https://x.com",
  instagram:  "https://instagram.com",
  linkedin:   "https://linkedin.com",
  netflix:    "https://netflix.com",
  spotify:    "https://spotify.com",
  stackoverflow: "https://stackoverflow.com",
};

/* ─── DOM References ──────────────────────────────────────────── */
const chatWindow       = document.getElementById("chatWindow");
const msgInput         = document.getElementById("msgInput");
const sendBtn          = document.getElementById("sendBtn");
const clearBtn         = document.getElementById("clearBtn");
const tokenBadge       = document.getElementById("tokenBadge");
const menuToggle       = document.getElementById("menuToggle");
const sidebar          = document.getElementById("sidebar");
const sidebarOverlay   = document.getElementById("sidebarOverlay");
const sidebarClose     = document.getElementById("sidebarClose");
const newChatBtn       = document.getElementById("newChatBtn");
const chatHistoryList  = document.getElementById("chatHistoryList");
const exportBtn        = document.getElementById("exportBtn");
const voiceBtnInline   = document.getElementById("voiceBtnInline");
const voiceOverlay     = document.getElementById("voiceOverlay");
const voiceStop        = document.getElementById("voiceStop");
const toastContainer   = document.getElementById("toastContainer");

/* ─── State ───────────────────────────────────────────────────── */
let currentChatId  = null;
let chats          = {};        // { id: { title, messages: [] } }
let memory         = {};        // { name, facts: [] }
let messageCount   = 0;
let isGenerating   = false;
let recognition    = null;
let synth          = window.speechSynthesis;

/* ════════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════════ */
function init() {
  window._pendingContextMessages = [];
  loadTheme();
  loadMemory();
  loadChats();

  const savedActive = localStorage.getItem(STORAGE_KEYS.ACTIVE);
  if (savedActive && chats[savedActive]) {
    switchChat(savedActive, false);
  } else {
    createNewChat();
  }

  bindEvents();
  msgInput.focus();
}

/* ════════════════════════════════════════════════════════════════
   THEME SYSTEM
   ════════════════════════════════════════════════════════════════ */
function loadTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.THEME) || "glass";
  applyTheme(saved, false);
}

function applyTheme(theme, animate = true) {
  if (animate) {
    document.body.style.transition = "background 0.5s ease";
  }
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEYS.THEME, theme);

  document.querySelectorAll(".theme-pill").forEach(p => {
    p.classList.toggle("active", p.dataset.theme === theme);
  });
}

/* ════════════════════════════════════════════════════════════════
   MEMORY SYSTEM
   ════════════════════════════════════════════════════════════════ */
function loadMemory() {
  try {
    memory = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMORY)) || {};
    if (!memory.facts) memory.facts = [];
  } catch { memory = { facts: [] }; }
}

function saveMemory() {
  localStorage.setItem(STORAGE_KEYS.MEMORY, JSON.stringify(memory));
}

/** Scan message for memory cues like "my name is X" */
function extractMemory(text) {
  const nameMatch = text.match(/my name is\s+([A-Za-z]+)/i);
  if (nameMatch) {
    memory.name = nameMatch[1];
    saveMemory();
  }
  const callMatch = text.match(/call me\s+([A-Za-z]+)/i);
  if (callMatch) {
    memory.name = callMatch[1];
    saveMemory();
  }
}

/** Build a memory context string to inject */
function buildMemoryContext() {
  if (!memory.name && (!memory.facts || memory.facts.length === 0)) return "";
  let ctx = "User context: ";
  if (memory.name) ctx += `User's name is ${memory.name}. `;
  if (memory.facts?.length) ctx += memory.facts.join("; ") + ".";
  return ctx;
}

/* ════════════════════════════════════════════════════════════════
   CHAT HISTORY
   ════════════════════════════════════════════════════════════════ */
function loadChats() {
  try {
    chats = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHATS)) || {};
  } catch { chats = {}; }
  renderChatHistoryList();
}

function saveChats() {
  localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function createNewChat() {
  const id = generateId();
  chats[id] = { title: "New Chat", messages: [], createdAt: Date.now() };
  saveChats();
  // Wipe Flask session so new chat truly starts fresh
  fetch("/api/clear", { method: "POST" }).catch(() => {});
  window._pendingContextMessages = [];
  switchChat(id, false);
}

function switchChat(id, animate = true) {
  currentChatId = id;
  localStorage.setItem(STORAGE_KEYS.ACTIVE, id);

  // Reset UI
  chatWindow.innerHTML = "";
  messageCount = 0;
  updateBadge();

  // Always clear the Flask session when switching chats so the
  // previous conversation never bleeds into the new one.
  fetch("/api/clear", { method: "POST" }).catch(() => {});

  const chat = chats[id];
  if (chat?.messages?.length) {
    // Render stored messages into the UI
    chat.messages.forEach(m => {
      renderMessage(m.role, m.content, false);
      messageCount++;
    });
    updateBadge();
    scrollToBottom();
    // Store history so next askAI() can replay context to Flask
    window._pendingContextMessages = chat.messages.filter(m => m.role !== "command");
  } else {
    showWelcomeCard();
    window._pendingContextMessages = [];
  }

  renderChatHistoryList();
  closeSidebarMobile();
}

function deleteChat(id, e) {
  e.stopPropagation();
  delete chats[id];
  saveChats();
  if (currentChatId === id) {
    const remaining = Object.keys(chats);
    if (remaining.length > 0) {
      switchChat(remaining[remaining.length - 1]);
    } else {
      createNewChat();
    }
  } else {
    renderChatHistoryList();
  }
}

function renderChatHistoryList() {
  chatHistoryList.innerHTML = "";
  const ids = Object.keys(chats).sort((a, b) => (chats[b].createdAt || 0) - (chats[a].createdAt || 0));

  if (ids.length === 0) {
    chatHistoryList.innerHTML = '<p class="history-empty">No chats yet</p>';
    return;
  }

  ids.forEach(id => {
    const chat = chats[id];
    const item = document.createElement("div");
    item.className = "history-item" + (id === currentChatId ? " active" : "");
    item.innerHTML = `
      <span class="history-icon">💬</span>
      <span class="history-title" title="${escHtml(chat.title)}">${escHtml(chat.title)}</span>
      <button class="history-delete" title="Delete chat">✕</button>
    `;
    item.addEventListener("click", () => switchChat(id));
    item.querySelector(".history-delete").addEventListener("click", (e) => deleteChat(id, e));
    chatHistoryList.appendChild(item);
  });
}

/** Auto-generate title from first user message */
function maybeSetChatTitle(text) {
  if (!currentChatId || !chats[currentChatId]) return;
  if (chats[currentChatId].title !== "New Chat") return;
  const title = text.slice(0, 42) + (text.length > 42 ? "…" : "");
  chats[currentChatId].title = title;
  saveChats();
  renderChatHistoryList();
}

function addMessageToHistory(role, content) {
  if (!currentChatId || !chats[currentChatId]) return;
  chats[currentChatId].messages.push({ role, content, ts: Date.now() });
  saveChats();
}

/* ════════════════════════════════════════════════════════════════
   EVENTS
   ════════════════════════════════════════════════════════════════ */
function bindEvents() {
  // Sidebar
  menuToggle.addEventListener("click", () => {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("active");
  });
  sidebarClose.addEventListener("click", closeSidebarMobile);
  sidebarOverlay.addEventListener("click", closeSidebarMobile);
  newChatBtn.addEventListener("click", createNewChat);

  // Theme pills
  document.querySelectorAll(".theme-pill").forEach(pill => {
    pill.addEventListener("click", () => applyTheme(pill.dataset.theme));
  });

  // Quick commands in sidebar
  document.querySelectorAll(".cmd-btn[data-cmd]").forEach(btn => {
    btn.addEventListener("click", () => {
      msgInput.value = btn.dataset.cmd;
      handleSend();
    });
  });

  // Input
  msgInput.addEventListener("input", autoResizeTextarea);
  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  sendBtn.addEventListener("click", handleSend);

  // Clear & Export
  clearBtn.addEventListener("click", clearCurrentChat);
  exportBtn.addEventListener("click", exportChat);

  // Voice — both topbar button and inline mic button
  voiceBtnInline.addEventListener("click", () => startVoice());
  const voiceToggleBtn = document.getElementById("voiceToggle");
  if (voiceToggleBtn) voiceToggleBtn.addEventListener("click", () => startVoice());
  voiceStop.addEventListener("click", () => { stopVoice(); showToast("Voice stopped", "info"); });

  // Quick prompts (delegated)
  chatWindow.addEventListener("click", (e) => {
    const qp = e.target.closest(".qp");
    if (qp) { msgInput.value = qp.dataset.text; handleSend(); }
  });
}

function closeSidebarMobile() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("active");
}

function autoResizeTextarea() {
  msgInput.style.height = "auto";
  msgInput.style.height = Math.min(msgInput.scrollHeight, 150) + "px";
}

/* ════════════════════════════════════════════════════════════════
   SMART DETECTION
   ════════════════════════════════════════════════════════════════ */
function detectSmartAction(text) {
  const lower = text.toLowerCase().trim();

  // "open X" or "go to X"
  const openMatch = lower.match(/^(?:open|go to|launch|visit|take me to)\s+(.+)$/i);
  if (openMatch) {
    const target = openMatch[1].trim();
    const url = SMART_COMMANDS[target];
    if (url) return { type: "open", url, label: target };
  }

  // Direct site name
  if (SMART_COMMANDS[lower]) {
    return { type: "open", url: SMART_COMMANDS[lower], label: lower };
  }

  // Legacy slash commands
  if (lower.startsWith("/")) {
    const parts = lower.slice(1).split(/\s+/);
    const cmd = parts[0];
    if (SMART_COMMANDS[cmd]) return { type: "open", url: SMART_COMMANDS[cmd], label: cmd };
    if (cmd === "search" && parts.length > 1) {
      return { type: "search", query: parts.slice(1).join(" ") };
    }
    if (cmd === "time") return { type: "time" };
    if (cmd === "help") return { type: "help" };
  }

  // Search-like queries
  if (/^(?:search|google|find|look up)\s+.+/i.test(lower)) {
    const q = lower.replace(/^(?:search|google|find|look up)\s+/i, "");
    return { type: "search", query: q };
  }

  return null;
}

/* ════════════════════════════════════════════════════════════════
   CORE SEND
   ════════════════════════════════════════════════════════════════ */
async function handleSend() {
  const text = msgInput.value.trim();
  if (!text || isGenerating) return;

  hideWelcomeCard();
  extractMemory(text);
  maybeSetChatTitle(text);

  renderMessage("user", text, true);
  addMessageToHistory("user", text);
  messageCount++;
  updateBadge();

  msgInput.value = "";
  msgInput.style.height = "auto";
  setSending(true);

  // Smart action detection
  const action = detectSmartAction(text);
  if (action) {
    await handleSmartAction(action, text);
  } else {
    await askAI(text);
  }

  setSending(false);
}

async function handleSmartAction(action, originalText) {
  if (action.type === "open") {
    window.open(action.url, "_blank");
    const reply = `Opening **${capitalize(action.label)}**… 🚀`;
    renderMessage("command", reply, true);
    addMessageToHistory("command", reply);
    return;
  }
  if (action.type === "search") {
    const url = `https://www.google.com/search?q=${encodeURIComponent(action.query)}`;
    window.open(url, "_blank");
    const reply = `Searching for **"${action.query}"** on Google… 🔍`;
    renderMessage("command", reply, true);
    addMessageToHistory("command", reply);
    return;
  }
  if (action.type === "time") {
    const now = new Date();
    const reply = `🕒 Current time: **${now.toLocaleTimeString()}**\n📅 Date: **${now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}**`;
    renderMessage("command", reply, true);
    addMessageToHistory("command", reply);
    return;
  }
  if (action.type === "help") {
    const reply = `**Dev AI — Available Commands**\n\n` +
      `🌐 **open [site]** — Open YouTube, GitHub, Gmail, Maps, Reddit, Twitter, etc.\n` +
      `🔍 **search [query]** — Google search\n` +
      `🕒 **/time** — Current time & date\n` +
      `💬 **Just chat** — Ask me anything!\n` +
      `🎤 **Voice** — Click the mic to speak\n\n` +
      `_I also remember your name and preferences across chats._`;
    renderMessage("assistant", reply, true);
    addMessageToHistory("assistant", reply);
    return;
  }
  // Fallback: pass to AI
  await askAI(originalText);
}

/* ════════════════════════════════════════════════════════════════
   AI CHAT
   ════════════════════════════════════════════════════════════════ */
async function askAI(message) {
  // If we switched to an existing chat, silently replay its history
  // into the Flask session BEFORE showing the typing indicator.
  if (window._pendingContextMessages && window._pendingContextMessages.length > 0) {
    const pairs = window._pendingContextMessages.slice();
    window._pendingContextMessages = [];
    for (let i = 0; i < pairs.length; i += 2) {
      const uMsg = pairs[i];
      if (!uMsg || uMsg.role !== "user") continue;
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: uMsg.content }),
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 40));
    }
  }

  const typingEl = addTypingIndicator();

  // Build message with memory context
  const memCtx = buildMemoryContext();
  const fullMessage = memCtx ? `[${memCtx}]\n\n${message}` : message;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: fullMessage }),
    });

    const data = await res.json();
    typingEl.remove();

    if (!res.ok) {
      const errMsg = `⚠️ ${data.error || "Something went wrong."}`;
      renderMessage("assistant", errMsg, true);
      addMessageToHistory("assistant", errMsg);
    } else {
      const reply = data.reply;
      // Streaming word-by-word effect
      const { el: bubbleEl } = renderMessage("assistant", "", true);
      addMessageToHistory("assistant", reply);
      await streamText(bubbleEl, reply);
      updateBadge(data.history_length);
      // TTS
      if (voiceBtnInline.classList.contains("voice-on")) {
        speak(reply.replace(/[#*`_~]/g, ""));
      }
    }
  } catch (err) {
    typingEl.remove();
    const errMsg = "⚠️ Could not reach the server. Is Flask running?";
    renderMessage("assistant", errMsg, true);
    addMessageToHistory("assistant", errMsg);
  }
}

/** Word-by-word streaming effect */
async function streamText(bubbleEl, fullText) {
  const words = fullText.split(" ");
  let built = "";
  for (let i = 0; i < words.length; i++) {
    built += (i > 0 ? " " : "") + words[i];
    bubbleEl.innerHTML = renderMarkdown(built);
    addCopyButtonsToPre(bubbleEl);
    scrollToBottom();
    // Adaptive delay: faster for longer texts
    const delay = words.length > 80 ? 12 : words.length > 40 ? 18 : 22;
    await sleep(delay);
  }
  bubbleEl.innerHTML = renderMarkdown(fullText);
  addCopyButtonsToPre(bubbleEl);
  scrollToBottom();
}

/* ════════════════════════════════════════════════════════════════
   RENDER MESSAGES
   ════════════════════════════════════════════════════════════════ */
function renderMessage(role, text, animate = true) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${role}`;
  if (!animate) wrapper.style.animation = "none";

  const labelMap = { user: "YOU", assistant: "DEV", command: "SYS" };

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = labelMap[role] || "?";

  const bubbleWrap = document.createElement("div");
  bubbleWrap.className = "bubble-wrap";

  const label = document.createElement("div");
  label.className = "bubble-label";
  label.textContent = role === "user" ? (memory.name || "You") : role === "assistant" ? "Dev" : "System";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (text) {
    bubble.innerHTML = role === "command" ? renderMarkdown(text) : renderMarkdown(text);
    addCopyButtonsToPre(bubble);
  }

  const actions = document.createElement("div");
  actions.className = "bubble-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "bubble-copy-btn";
  copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(text || bubble.textContent).then(() => {
      copyBtn.textContent = "✓ Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
        copyBtn.classList.remove("copied");
      }, 1800);
    });
  });

  actions.appendChild(copyBtn);
  bubbleWrap.append(label, bubble, actions);
  wrapper.append(avatar, bubbleWrap);
  chatWindow.appendChild(wrapper);
  scrollToBottom();
  return { el: bubble, wrapper };
}

function addCopyButtonsToPre(container) {
  container.querySelectorAll("pre").forEach(pre => {
    if (pre.querySelector(".pre-copy")) return;
    const btn = document.createElement("button");
    btn.className = "pre-copy";
    btn.textContent = "Copy";
    btn.addEventListener("click", () => {
      const code = pre.querySelector("code");
      navigator.clipboard.writeText(code ? code.textContent : pre.textContent).then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy", 1800);
      });
    });
    pre.style.position = "relative";
    pre.appendChild(btn);
  });
}

function addTypingIndicator() {
  const wrapper = document.createElement("div");
  wrapper.className = "msg assistant typing";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = "DEV";

  const bubbleWrap = document.createElement("div");
  bubbleWrap.className = "bubble-wrap";

  const label = document.createElement("div");
  label.className = "bubble-label";
  label.textContent = "Dev";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  // Build dots manually so nth-child is unambiguous
  const typingInner = document.createElement("div");
  typingInner.className = "typing-dots";

  const lbl = document.createElement("span");
  lbl.className = "typing-label";
  lbl.textContent = "thinking";

  const d1 = document.createElement("div");
  const d2 = document.createElement("div");
  const d3 = document.createElement("div");
  d1.className = d2.className = d3.className = "dot";
  d2.style.animationDelay = "0.18s";
  d3.style.animationDelay = "0.36s";

  typingInner.append(lbl, d1, d2, d3);
  bubble.appendChild(typingInner);

  bubbleWrap.append(label, bubble);
  wrapper.append(avatar, bubbleWrap);
  chatWindow.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

/* ════════════════════════════════════════════════════════════════
   MARKDOWN RENDERING
   ════════════════════════════════════════════════════════════════ */
function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    // Configure marked
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
    try {
      return marked.parse(text);
    } catch { /* fallback below */ }
  }
  // Fallback basic renderer
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

/* ════════════════════════════════════════════════════════════════
   WELCOME / CLEAR
   ════════════════════════════════════════════════════════════════ */
function showWelcomeCard() {
  chatWindow.innerHTML = "";
  const card = document.createElement("div");
  card.className = "welcome-card";
  card.id = "welcomeCard";
  const name = memory.name ? `, ${memory.name}` : "";
  card.innerHTML = `
    <div class="welcome-glow"></div>
    <div class="welcome-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    </div>
    <h1>Hello${escHtml(name)}, I'm <em>Dev</em></h1>
    <p>Your intelligent AI assistant. Ask anything, open apps, search the web, or just have a conversation.</p>
    <div class="quick-prompts">
      <button class="qp" data-text="What can you do?">What can you do?</button>
      <button class="qp" data-text="Explain async/await in Python">Async/await</button>
      <button class="qp" data-text="Write a haiku about coding">Write a haiku</button>
      <button class="qp" data-text="open youtube">Open YouTube</button>
    </div>
  `;
  chatWindow.appendChild(card);
}

function hideWelcomeCard() {
  const card = document.getElementById("welcomeCard");
  if (!card) return;
  card.style.transition = "opacity 0.2s ease, transform 0.2s ease";
  card.style.opacity = "0";
  card.style.transform = "scale(0.97)";
  setTimeout(() => card.remove(), 200);
}

function clearCurrentChat() {
  if (!currentChatId) return;
  chats[currentChatId].messages = [];
  chats[currentChatId].title = "New Chat";
  saveChats();
  messageCount = 0;
  updateBadge();
  renderChatHistoryList();
  fetch("/api/clear", { method: "POST" }).catch(() => {});
  showWelcomeCard();
  showToast("Chat cleared", "success");
}

/* ════════════════════════════════════════════════════════════════
   EXPORT CHAT
   ════════════════════════════════════════════════════════════════ */
function exportChat() {
  if (!currentChatId || !chats[currentChatId]) return;
  const chat = chats[currentChatId];
  if (!chat.messages.length) { showToast("Nothing to export", "error"); return; }

  let text = `Dev AI — Chat Export\n`;
  text += `Title: ${chat.title}\n`;
  text += `Date: ${new Date().toLocaleString()}\n`;
  text += `${"─".repeat(50)}\n\n`;

  chat.messages.forEach(m => {
    const role = m.role === "user" ? (memory.name || "You") : m.role === "assistant" ? "Dev" : "System";
    text += `[${role}]\n${m.content}\n\n`;
  });

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dev-chat-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Chat exported!", "success");
}

/* ════════════════════════════════════════════════════════════════
   VOICE INPUT / OUTPUT
   ════════════════════════════════════════════════════════════════ */
let voiceResultReceived = false;   // guard: don't double-trigger on onend

async function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast("Voice not supported — use Chrome or Edge", "error");
    return;
  }

  // Ask for microphone permission explicitly first
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (permErr) {
    showToast("Microphone access denied — allow it in browser settings", "error");
    return;
  }

  // If already listening, stop
  if (recognition) { stopVoice(); return; }

  voiceResultReceived = false;
  recognition = new SR();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = () => {
    voiceOverlay.classList.add("active");
    voiceBtnInline.classList.add("recording");
  };

  recognition.onresult = (e) => {
    voiceResultReceived = true;
    const transcript = e.results[0][0].transcript.trim();
    if (transcript) {
      msgInput.value = transcript;
      autoResizeTextarea();
    }
  };

  recognition.onerror = (e) => {
    // "no-speech" is benign — user just didn't say anything
    if (e.error === "no-speech") {
      showToast("No speech detected — try again", "info");
    } else if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      showToast("Microphone blocked — allow access in browser settings", "error");
    } else if (e.error === "network") {
      showToast("Voice needs internet connection (uses Google API)", "error");
    } else if (e.error === "aborted") {
      // User or code stopped it — silent
    } else {
      showToast("Voice error: " + e.error, "error");
    }
    voiceResultReceived = true; // prevent double handling
    cleanupVoice();
  };

  recognition.onend = () => {
    cleanupVoice();
    // Only send if we got a result
    if (voiceResultReceived && msgInput.value.trim()) {
      handleSend();
    }
    voiceResultReceived = false;
  };

  try {
    recognition.start();
  } catch (startErr) {
    showToast("Could not start voice — try again", "error");
    cleanupVoice();
  }
}

function stopVoice() {
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
  }
  cleanupVoice();
}

function cleanupVoice() {
  recognition = null;
  voiceOverlay.classList.remove("active");
  voiceBtnInline.classList.remove("recording");
}

function speak(text) {
  if (!synth) return;
  synth.cancel();
  const clean = text.replace(/[#*`_~>\-]/g, "").slice(0, 500);
  if (!clean.trim()) return;
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  utterance.volume = 0.9;
  synth.speak(utterance);
}

/* ════════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ════════════════════════════════════════════════════════════════ */
function showToast(msg, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  toast.innerHTML = `<span>${icons[type] || "ℹ"}</span> ${escHtml(msg)}`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/* ════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════ */
function setSending(active) {
  isGenerating = active;
  sendBtn.disabled = active;
  msgInput.disabled = active;
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function updateBadge(count) {
  const c = count ?? messageCount;
  tokenBadge.textContent = `${c} msg${c !== 1 ? "s" : ""}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ─── Boot ────────────────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", init);