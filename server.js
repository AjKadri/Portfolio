require("dotenv").config({ quiet: true });

const express = require("express");
const path = require("node:path");
const { buildSystemPrompt } = require("./data/portfolio");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 8;
const REQUEST_TIMEOUT_MS = 20_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 15;

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

function createRateLimiter() {
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
    if (record.count > RATE_LIMIT_MAX) {
      res.set("Retry-After", Math.ceil((record.resetAt - now) / 1000));
      return res.status(429).json({
        error: "Too many questions at once. Please wait a few minutes and try again.",
      });
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

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => {
    console.log(`The Blue Page is running at http://localhost:${port}`);
  });
}

module.exports = { createApp, cleanHistory };
