const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createApp, cleanHistory } = require("../server");

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
