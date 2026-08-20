# AJ’s Port

AJ Kadri's vanilla HTML/CSS/JavaScript portfolio, served by a small Express app. The server also provides the OpenRouter-backed portfolio assistant without exposing the API key to the browser.

## Run locally

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and add `OPENROUTER_API_KEY`.
4. Run `npm run dev` and open `http://localhost:3000`.

For production, set `OPENROUTER_API_KEY` in the host's private environment settings and run `npm start`. The app listens on `PORT` when the host supplies one. Do not deploy this project as a static-only site: `/api/chat` needs the Node server.

The assistant defaults to OpenRouter's `openrouter/free` router. Set `OPENROUTER_MODEL` to a paid model slug after adding credits if you need more predictable production availability.
