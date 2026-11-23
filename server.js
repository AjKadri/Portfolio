require("dotenv").config({ quiet: true });

const express = require("express");
const path = require("node:path");
const { buildSystemPrompt } = require("./data/portfolio");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4.1-mini";
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 8;
const REQUEST_TIMEOUT_MS = 20_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 15;
const RESEND_URL = "https://api.resend.com/emails";
const CONTACT_RATE_LIMIT_MAX = 5;
const CONTACT_LIMITS = { name: 80, contact: 120, type: 40, budget: 40, message: 2000 };
const CONTACT_TYPES = ["Business website", "Landing page", "Web app / dashboard", "Redesign", "Hiring / role", "Something else"];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function cleanField(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseContact(body = {}) {
  const data = {
    name: cleanField(body.name, CONTACT_LIMITS.name),
    contact: cleanField(body.contact, CONTACT_LIMITS.contact),
    type: cleanField(body.type, CONTACT_LIMITS.type),
    budget: cleanField(body.budget, CONTACT_LIMITS.budget),
    message: cleanField(body.message, CONTACT_LIMITS.message),
  };
  if (!data.name || !data.contact || data.message.length < 10) {
    return { error: "Add your name, a way to reach you, and a few words about the project." };
  }
  if (data.type && !CONTACT_TYPES.includes(data.type)) data.type = "Something else";
  return { data };
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string",
    )
    .map(({ role, content }) => ({
      role,
      content: content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .filter(({ content }) => content.length > 0);
}

function createRateLimiter(max = RATE_LIMIT_MAX, message = "Too many questions at once. Please wait a few minutes and try again.") {
  const clients = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const record = clients.get(key);

    if (!record || now >= record.resetAt) {
      clients.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      res.set("Retry-After", Math.ceil((record.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }

    return next();
  };
}

function createApp(options = {}) {
  const app = express();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  const model = options.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const siteUrl = options.siteUrl || process.env.SITE_URL || "http://localhost:3000";
  const resendKey = options.resendKey ?? process.env.RESEND_API_KEY;
  const contactTo = options.contactTo ?? process.env.CONTACT_TO_EMAIL;
  const contactFrom = options.contactFrom || process.env.CONTACT_FROM_EMAIL || "Portfolio <onboarding@resend.dev>";

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
    });
    next();
  });
  app.use(express.json({ limit: "12kb" }));

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
  });
  app.get("/favicon.svg", (req, res) => {
    res.sendFile(path.join(__dirname, "favicon.svg"));
  });
  app.get("/apple-touch-icon.png", (req, res) => {
    res.sendFile(path.join(__dirname, "apple-touch-icon.png"));
  });
  app.get("/cv.pdf", (req, res) => {
    res.sendFile(path.join(__dirname, "cv", "AJ-Kadri-CV.pdf"), (error) => {
      if (error && !res.headersSent) res.status(404).json({ error: "CV not available." });
    });
  });
  app.use(
    "/images",
    express.static(path.join(__dirname, "images"), {
      fallthrough: false,
      maxAge: "1d",
    }),
  );
  app.use(
    "/assets",
    express.static(path.join(__dirname, "assets"), {
      fallthrough: false,
      maxAge: "1h",
    }),
  );

  app.post("/api/chat", createRateLimiter(), async (req, res) => {
    res.set("Cache-Control", "no-store");
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Ask a question between 1 and ${MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    if (!apiKey) {
      return res.status(503).json({
        error: "The portfolio assistant is not configured yet. Please try again later.",
      });
    }

    const history = cleanHistory(req.body?.history);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const openRouterResponse = await fetchImpl(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": siteUrl,
          "X-OpenRouter-Title": "The Blue Page",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            ...history,
            { role: "user", content: message },
          ],
          max_tokens: 260,
          temperature: 0.25,
        }),
        signal: controller.signal,
      });

      if (!openRouterResponse.ok) {
        return res.status(openRouterResponse.status === 429 ? 429 : 502).json({
          error:
            openRouterResponse.status === 429
              ? "The assistant is busy right now. Please wait a moment and try again."
              : "The assistant could not answer just now. Please try again.",
        });
      }

      const data = await openRouterResponse.json();
      const answer = data?.choices?.[0]?.message?.content;

      if (typeof answer !== "string" || !answer.trim()) {
        return res.status(502).json({
          error: "The assistant returned an empty answer. Please try again.",
        });
      }

      return res.json({ answer: answer.trim() });
    } catch (error) {
      return res.status(error?.name === "AbortError" ? 504 : 502).json({
        error:
          error?.name === "AbortError"
            ? "The assistant took too long to respond. Please try again."
            : "The assistant could not answer just now. Please try again.",
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  app.post(
    "/api/contact",
    createRateLimiter(CONTACT_RATE_LIMIT_MAX, "Too many messages. Please wait a few minutes and try again."),
    async (req, res) => {
      res.set("Cache-Control", "no-store");
      // Honeypot: real visitors never fill this hidden field.
      if (cleanField(req.body?.website, 200)) return res.json({ ok: true });

      const { data, error } = parseContact(req.body);
      if (error) return res.status(400).json({ error });

      if (!resendKey || !contactTo) {
        return res.status(503).json({ error: "The contact form is not set up yet. Please try again later." });
      }

      const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact);
      const rows = [
        ["Name", data.name],
        ["Contact", data.contact],
        ["Project", data.type || "Not specified"],
        ["Budget", data.budget || "Not specified"],
      ]
        .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${k}</td><td>${escapeHtml(v)}</td></tr>`)
        .join("");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetchImpl(RESEND_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: contactFrom,
            to: [contactTo],
            ...(looksLikeEmail ? { reply_to: data.contact } : {}),
            subject: `New enquiry: ${data.type || "Project"} — ${data.name}`,
            html: `<table>${rows}</table><p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>`,
            text: `Name: ${data.name}\nContact: ${data.contact}\nProject: ${data.type}\nBudget: ${data.budget}\n\n${data.message}`,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          return res.status(502).json({ error: "Your message could not be sent just now. Please try again." });
        }
        return res.json({ ok: true });
      } catch {
        return res.status(502).json({ error: "Your message could not be sent just now. Please try again." });
      } finally {
        clearTimeout(timeout);
      }
    },
  );

  app.use((error, req, res, next) => {
    if (error?.type === "entity.too.large") {
      return res.status(413).json({ error: "That request is too large." });
    }
    if (error instanceof SyntaxError && "body" in error) {
      return res.status(400).json({ error: "The request body must be valid JSON." });
    }
    return next(error);
  });

  return app;
}

const app = createApp();

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`The Blue Page is running at http://localhost:${port}`);
  });
}

// Vercel's CommonJS runtime expects the Express app itself as the default export.
module.exports = app;
module.exports.createApp = createApp;
module.exports.cleanHistory = cleanHistory;
module.exports.parseContact = parseContact;
