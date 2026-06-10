/*
  chatbot.js — Zoe Medical support chatbot
  =========================================
  This file does three things:
    1. Injects the chat widget HTML into every page
    2. Handles open/close, suggested questions, typing indicator
    3. Sends messages to the Cloudflare Worker and displays responses

  HOW TO ADD TO A PAGE:
    Add these two lines before </body> on every page:
      <link rel="stylesheet" href="css/chatbot.css">   (in <head>)
      <script src="js/chatbot.js"></script>             (before </body>)

    For pages inside /products/, use ../ prefix:
      <link rel="stylesheet" href="../css/chatbot.css">
      <script src="../js/chatbot.js"></script>
*/

const WORKER_URL = "https://zoe-support-worker.rhiltz.workers.dev";

/* ----------------------------------------------------------
   1. INJECT WIDGET HTML
   built the widget in JS rather than pasting it into every
   HTML file — one place to update, changes everywhere.
   ---------------------------------------------------------- */
const widgetHTML = `
<div id="zoe-chat" aria-live="polite">

  <!-- Chat panel -->
  <div class="zoe-panel" id="zoePanel" role="dialog" aria-label="Zoe Medical support chat" aria-hidden="true">

    <!-- Header -->
    <div class="zoe-panel-header">
      <img src="/zoe-medical/assets/images/zoe-logo.svg" alt="Zoe Medical" width="30" height="30" class="zoe-header-logo">
      <div class="zoe-header-name">Zoe Support</div>
      <button class="zoe-header-close" aria-label="Close chat" onclick="zoeChatToggle()">&#10005;</button>
    </div>

    <!-- Messages -->
    <div class="zoe-messages" id="zoeMessages" aria-live="polite" aria-label="Chat messages">
      <div class="zoe-msg zoe-msg--bot">
        <div class="zoe-bubble">
          Hi, I'm Zoe's support assistant. I can help with device setup, alarm settings,
          SpO&#x2082; monitoring, battery questions, and service requests. How can I help you today?
        </div>
      </div>
    </div>

    <!-- Input row -->
    <div class="zoe-input-row">
      <input
        class="zoe-input"
        id="zoeInput"
        type="text"
        placeholder="Ask anything…"
        aria-label="Type your support question"
        maxlength="500"
        onkeydown="if(event.key==='Enter')zoeSendMessage()"
      >
      <button class="zoe-send-btn" aria-label="Send message" onclick="zoeSendMessage()">
        &#10148;
      </button>
    </div>

    <!-- Disclaimer -->
    <div class="zoe-disclaimer">
      AI assistant — for urgent clinical questions,
      <a href="/zoe-medical/contact.html">contact our team</a> directly.
    </div>

  </div>

  <!-- Floating action button (FAB) + label -->
  <div class="zoe-fab-row" id="zoeFabRow">
    <span class="zoe-fab-label" id="zoeFabLabel">Ask Zoe support</span>
    <button class="zoe-fab" id="zoeFab" aria-label="Open support chat" onclick="zoeChatToggle()">
      <img src="/zoe-medical/assets/images/zoe-logo.svg" alt="" width="44" height="44">
    </button>
  </div>

</div>
`;

/* Inject widget into page */
document.addEventListener("DOMContentLoaded", function () {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = widgetHTML;
  document.body.appendChild(wrapper);
});


/* ----------------------------------------------------------
   2. OPEN / CLOSE TOGGLE
   ---------------------------------------------------------- */
function zoeChatToggle() {
  const panel = document.getElementById("zoePanel");
  const label = document.getElementById("zoeFabLabel");
  const fab   = document.getElementById("zoeFab");
  const isOpen = panel.classList.contains("zoe-panel--open");

  if (isOpen) {
    panel.classList.remove("zoe-panel--open");
    panel.setAttribute("aria-hidden", "true");
    label.style.display = "";
    fab.setAttribute("aria-label", "Open support chat");
  } else {
    panel.classList.add("zoe-panel--open");
    panel.setAttribute("aria-hidden", "false");
    label.style.display = "none";
    fab.setAttribute("aria-label", "Close support chat");
    /* Focus the input when opening for keyboard users */
    setTimeout(function () {
      document.getElementById("zoeInput").focus();
    }, 100);
    /* Scroll messages to bottom in case there's history */
    zoeScrollToBottom();
  }
}


/* ----------------------------------------------------------
   3. SEND MESSAGE + CALL WORKER
   ---------------------------------------------------------- */
async function zoeSendMessage() {
  const input = document.getElementById("zoeInput");
  const text  = input.value.trim();
  if (!text) return;

  /* Append user message */
  zoeAppendMessage(text, "user");
  input.value = "";

  /* Show typing indicator */
  const typing = zoeShowTyping();

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await response.json();
    typing.remove();

    if (data.reply) {
      zoeAppendMessage(data.reply, "bot");
    } else {
      zoeAppendMessage(
        "Sorry, something went wrong. Please try again or call us at (978) 887-1410.",
        "bot"
      );
    }

  } catch (err) {
    typing.remove();
    zoeAppendMessage(
      "I'm having trouble connecting right now. Please call us at (978) 887-1410 or email customersupport@zoemedical.com.",
      "bot"
    );
  }
}


/* ----------------------------------------------------------
   4. HELPER FUNCTIONS
   ---------------------------------------------------------- */

/* Convert basic markdown from the bot API into HTML.
   Only used for bot messages — never for user input. */
function zoeFormatBotText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\n/g, '<br>');
}

/* Add a message bubble to the thread */
function zoeAppendMessage(text, sender) {
  const messages = document.getElementById("zoeMessages");
  const div = document.createElement("div");
  div.className = "zoe-msg zoe-msg--" + sender;
  const bubble = document.createElement("div");
  bubble.className = "zoe-bubble";
  if (sender === "bot") {
    bubble.innerHTML = zoeFormatBotText(text);
  } else {
    bubble.textContent = text; /* textContent prevents XSS on user input */
  }
  div.appendChild(bubble);
  messages.appendChild(div);
  zoeScrollToBottom();
}

/* Show the three-dot typing indicator */
function zoeShowTyping() {
  const messages = document.getElementById("zoeMessages");
  const div = document.createElement("div");
  div.className = "zoe-msg zoe-msg--bot zoe-typing";
  div.innerHTML = '<div class="zoe-bubble"><span></span><span></span><span></span></div>';
  messages.appendChild(div);
  zoeScrollToBottom();
  return div;
}

/* Scroll the messages container to the latest message */
function zoeScrollToBottom() {
  const messages = document.getElementById("zoeMessages");
  messages.scrollTop = messages.scrollHeight;
}
