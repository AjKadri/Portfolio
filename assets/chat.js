(() => {
  const launcher = document.getElementById("chat-launcher");
  const panel = document.getElementById("chat-panel");
  const closeButton = document.getElementById("chat-close");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const submit = document.getElementById("chat-submit");
  const messages = document.getElementById("chat-messages");
  const suggestions = document.querySelectorAll("[data-chat-question]");
  const history = [];
  let busy = false;

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    launcher.textContent = open ? "CLOSE / AJ AI ×" : "ASK ABOUT AJ ↗";
    if (open) window.setTimeout(() => input.focus(), 0);
  }

  function appendLinkedText(container, text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    let lastIndex = 0;

    for (const match of text.matchAll(urlPattern)) {
      container.append(document.createTextNode(text.slice(lastIndex, match.index)));
      const link = document.createElement("a");
      link.href = match[0].replace(/[.,!?;:]+$/, "");
      link.textContent = link.href;
      link.target = "_blank";
      link.rel = "noreferrer";
      container.append(link);
      const trailing = match[0].slice(link.href.length);
      if (trailing) container.append(document.createTextNode(trailing));
      lastIndex = match.index + match[0].length;
    }

    container.append(document.createTextNode(text.slice(lastIndex)));
  }

  function addMessage(role, text, options = {}) {
    const item = document.createElement("div");
    item.className = `chat-message ${role === "user" ? "is-user" : "is-assistant"}`;
    if (options.status) item.dataset.status = options.status;

    const label = document.createElement("span");
    label.className = "chat-message-label";
    label.textContent = role === "user" ? "YOU" : "AJ / AI";

    const copy = document.createElement("p");
    appendLinkedText(copy, text);
    item.append(label, copy);
    messages.append(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    input.disabled = nextBusy;
    submit.disabled = nextBusy;
    submit.textContent = nextBusy ? "WAIT" : "SEND ↗";
  }

  async function ask(question) {
    const message = question.trim();
    if (!message || busy) return;

    addMessage("user", message);
    input.value = "";
    setBusy(true);
    const pending = addMessage("assistant", "Thinking…", { status: "pending" });

    try {
      if (window.location.protocol === "file:") {
        throw new Error("The assistant needs the local server. Run npm start, then open http://localhost:3000.");
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: history.slice(-8) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          throw new Error(
            "The assistant server is not running. Start the site with npm start, then open http://localhost:3000.",
          );
        }
        throw new Error(data.error || "The assistant could not answer.");
      }

      pending.remove();
      addMessage("assistant", data.answer);
      history.push(
        { role: "user", content: message },
        { role: "assistant", content: data.answer },
      );
      if (history.length > 8) history.splice(0, history.length - 8);
    } catch (error) {
      pending.remove();
      addMessage("assistant", error.message || "The assistant could not answer. Please try again.", {
        status: "error",
      });
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  launcher.addEventListener("click", () => setOpen(panel.hidden));
  closeButton.addEventListener("click", () => setOpen(false));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
  });
  suggestions.forEach((button) => {
    button.addEventListener("click", () => ask(button.dataset.chatQuestion));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      launcher.focus();
    }
  });
})();
