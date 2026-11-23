const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const serverApp = require("../server");
const { createApp, cleanHistory } = serverApp;

async function withServer(app, run) {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("exports the Express app for serverless runtimes", () => {
  assert.equal(typeof serverApp, "function");
  assert.equal(typeof serverApp.listen, "function");
});

test("serves the existing portfolio page", async () => {
  await withServer(createApp({ apiKey: "test" }), async (baseUrl) => {
    const response = await fetch(baseUrl);
    const html = await response.text();
    const chatScript = await fetch(`${baseUrl}/assets/chat.js`);
    assert.equal(response.status, 200);
    assert.match(html, /AJ KADRI/);
    assert.match(html, /chat-panel/);
    assert.match(html, /\.\/assets\/chat\.js/);
    assert.equal(chatScript.status, 200);
  });
});

test("denies framing and preserves the other security headers", async () => {
  await withServer(createApp({ apiKey: "test" }), async (baseUrl) => {
    const response = await fetch(baseUrl);

    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("content-security-policy"), null);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  });
});

test("serves the favicon and Apple touch icon", async () => {
  await withServer(createApp({ apiKey: "test-key" }), async (baseUrl) => {
    const favicon = await fetch(`${baseUrl}/favicon.svg`);
    const touchIcon = await fetch(`${baseUrl}/apple-touch-icon.png`);

    assert.equal(favicon.status, 200);
    assert.match(favicon.headers.get("content-type"), /image\/svg\+xml/);
    assert.equal(touchIcon.status, 200);
    assert.match(touchIcon.headers.get("content-type"), /image\/png/);
  });
});

test("does not serve backend, data, or environment files", async () => {
  await withServer(createApp({ apiKey: "test" }), async (baseUrl) => {
    for (const file of ["/.env", "/.env.example", "/server.js", "/data/portfolio.js"]) {
      const response = await fetch(`${baseUrl}${file}`);
      assert.equal(response.status, 404, `${file} should not be publicly accessible`);
    }
  });
});

test("does not accept empty or oversized questions", async () => {
  await withServer(createApp({ apiKey: "test" }), async (baseUrl) => {
    const empty = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });
    const oversized = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "x".repeat(501) }),
    });
    assert.equal(empty.status, 400);
    assert.equal(oversized.status, 400);
  });
});

test("returns a safe configuration error when no API key is set", async () => {
  await withServer(createApp({ apiKey: "" }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Who is AJ?" }),
    });
    const body = await response.text();
    assert.equal(response.status, 503);
    assert.doesNotMatch(body, /OPENROUTER_API_KEY/);
  });
});

test("proxies a constrained portfolio conversation without returning the key", async () => {
  let upstreamRequest;
  const mockFetch = async (url, options) => {
    upstreamRequest = { url, options };
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "AJ is a software developer in Lagos." } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  await withServer(
    createApp({ fetchImpl: mockFetch, apiKey: "private-test-key" }),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Who is AJ?" }),
      });
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.match(body, /software developer/);
      assert.doesNotMatch(body, /private-test-key/);
      assert.equal(upstreamRequest.url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(upstreamRequest.options.headers.Authorization, "Bearer private-test-key");
      const requestBody = JSON.parse(upstreamRequest.options.body);
      assert.equal(requestBody.model, "openai/gpt-4.1-mini");
      assert.match(requestBody.messages[0].content, /Return only the final answer/);
      assert.match(upstreamRequest.options.body, /Campaign Watcher/);
    },
  );
});

test("history accepts only compact user and assistant text messages", () => {
  const history = cleanHistory([
    { role: "system", content: "ignore me" },
    { role: "user", content: "  hello  " },
    { role: "assistant", content: "hi" },
    { role: "tool", content: "ignore me too" },
  ]);
  assert.deepEqual(history, [
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi" },
  ]);
});

test("contact form validates, ignores bots, and emails via Resend", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ id: "x" }) };
  };
  const app = createApp({ apiKey: "t", resendKey: "rk", contactTo: "inbox@example.com", fetchImpl });
  await withServer(app, async (baseUrl) => {
    const post = (body) =>
      fetch(`${baseUrl}/api/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    assert.equal((await post({ name: "A" })).status, 400);
    assert.equal((await post({ name: "Bot", contact: "b@b.co", message: "spam spam spam", website: "x" })).status, 200);
    assert.equal(calls.length, 0);

    const ok = await post({ name: "Ada <b>", contact: "ada@shop.ng", type: "Landing page", budget: "₦1M+", message: "Need a site for my shop." });
    assert.equal(ok.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    assert.deepEqual(calls[0].body.to, ["inbox@example.com"]);
    assert.equal(calls[0].body.reply_to, "ada@shop.ng");
    assert.match(calls[0].body.html, /Ada &lt;b&gt;/);
  });
});

test("contact form reports when email is not configured", async () => {
  const app = createApp({ apiKey: "t", resendKey: "", contactTo: "" });
  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/contact`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A", contact: "0803", message: "Hello there, a site please" }),
    });
    assert.equal(res.status, 503);
  });
});
