// Project cards. To add a clip or screenshot, drop images/<slug>.mp4 and/or images/<slug>.jpg —
// they're picked up automatically; until then a styled poster shows.
const PROJECTS = [
	{
		slug: "callwindow", name: "CallWindow", year: 2026, kind: "TRADING / SOLANA",
		headline: "Patient markets, one fair price.",
		desc: "Scheduled settlement for thin markets. Buyers and sellers submit funded orders before a cutoff, then everything clears at one disclosed price, with a verifiable record for every order.",
		event: "SOLANA STOCKLANA HACKATHON",
		tags: ["SOLANA", "SMART CONTRACTS", "TYPESCRIPT", "REAL-TIME DATA"],
		live: "https://callwindow.ajkadri.dev", source: "https://github.com/AjKadri/CallWindow",
		poster: "linear-gradient(135deg,#0f172a 0%,#4c1d95 55%,#14b8a6 100%)",
	},
	{
		slug: "watchtower", name: "Watchtower", year: 2026, kind: "MONITORING / BASE",
		headline: "Watch the contract. Verify the change.",
		desc: "Detects upgrades to major DeFi contracts on Base (Aave, Compound, ether.fi), investigates the change block by block, and issues receipts anyone can verify in their browser.",
		tags: ["BASE", "AI AGENT", "NODE.JS", "CRYPTOGRAPHIC RECEIPTS"],
		event: "ORION AGENT HACKATHON",
		live: "https://watchtower.ajkadri.dev", source: "https://github.com/AjKadri/watchtower-agent",
		poster: "linear-gradient(135deg,#020617 0%,#1e3a8a 60%,#0ea5e9 100%)",
	},
	{
		slug: "aftermrkt", name: "AfterMrkt", year: 2026, kind: "MARKETS / AI",
		headline: "Know the move. Know your way out.",
		desc: "Explains after-hours price moves in tokenized U.S. stocks: compares against the market close, shows the verified SEC filings behind the move, and models what an exit would cost.",
		tags: ["AI ANALYSIS", "MARKET DATA", "SEC FILINGS", "NODE.JS"],
		event: "BITGET AI HACKATHON",
		live: "https://aftermrkt.ajkadri.dev", source: "https://github.com/AjKadri/AfterMrkt",
		poster: "linear-gradient(135deg,#052e16 0%,#065f46 50%,#facc15 130%)",
	},
	{
		slug: "flatstock", name: "Flatstock", year: 2026, kind: "INVESTING / ROBINHOOD CHAIN",
		headline: "Buy what the community picked.",
		desc: "Holders vote each week on a basket of US stocks, then buy the whole basket, or a custom mix, in one signature. The stock tokens go straight to their own wallet, and they can sell back anytime.",
		event: "WORLD IS FLAT HACKATHON",
		tags: ["ROBINHOOD CHAIN", "SMART CONTRACTS", "CHAINLINK", "UNISWAP"],
		live: "https://flatstock.ajkadri.dev",
		poster: "linear-gradient(135deg,#052e16 0%,#15803d 55%,#bef264 100%)",
	},
	{
		slug: "cryptex", name: "Cryptex", year: 2026, kind: "DASHBOARD",
		headline: "Market, made readable.",
		desc: "A crypto dashboard built around live market data, search, watchlists and clear market information.",
		tags: ["JAVASCRIPT", "NODE.JS", "EXPRESS", "COINGECKO API"],
		live: "https://cryptex.ajkadri.dev", source: "https://github.com/AjKadri/Cryptex",
		image: "./images/cryptex.jpg",
	},
	{
		slug: "campaign-watcher", name: "Campaign Watcher", year: 2026, kind: "AUTOMATION",
		headline: "Watching the work.",
		desc: "An automation tool that monitors a website for new campaigns and sends a notification the moment one appears, so nobody has to keep checking by hand.",
		tags: ["NODE.JS", "PLAYWRIGHT", "AUTOMATION"],
		source: "https://github.com/AjKadri/Campaign-Watcher",
		image: "./images/campaign-watcher.jpg",
	},
];

(function renderWork() {
	const list = document.getElementById("work-list");
	if (!list) return;
	const total = String(PROJECTS.length).padStart(2, "0");
	const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

	PROJECTS.forEach((p, i) => {
		const n = String(i + 1).padStart(2, "0");
		const links = [
			p.live && `<a href="${p.live}" target="_blank" rel="noreferrer">LIVE ↗</a>`,
			p.source && `<a href="${p.source}" target="_blank" rel="noreferrer">SOURCE ↗</a>`,
		].filter(Boolean).join("");
		const tags = (p.event ? `<span class="tag event">BUILT FOR ${esc(p.event)}</span>` : "") +
			p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");

		const el = document.createElement("article");
		el.className = "work";
		el.innerHTML = `
			<div class="work-head">
				<div class="number">${n}</div>
				<div><h3 class="work-title">${esc(p.name)}</h3><p class="work-desc">${esc(p.desc)}</p></div>
				<div class="year">${p.year}</div>
			</div>
			<div class="screenshot"><div class="project-visual">
				<div class="poster" style="--poster:${p.poster || "linear-gradient(135deg,#1e3a8a,#2563eb)"}"><b>${esc(p.name)}</b></div>
				<span class="project-number">${n} / ${total}</span>
				<span class="project-window">${esc(p.name.toUpperCase())} / ${esc(p.kind)}</span>
				<div class="project-overlay"><span>${esc(p.name.toUpperCase())} / ${p.year}</span><h3>${esc(p.headline)}</h3></div>
			</div></div>
			<div class="work-bottom"><div class="tags">${tags}</div><div class="links">${links}</div></div>`;
		list.appendChild(el);

		const visual = el.querySelector(".project-visual");
		const overlay = el.querySelector(".project-overlay");
		const img = new Image();
		img.alt = `${p.name} screenshot`;
		img.onload = () => { visual.insertBefore(img, overlay); visual.classList.add("has-media"); };
		img.src = p.image || `./images/${p.slug}.jpg`;

		if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
			const v = document.createElement("video");
			Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, preload: "metadata" });
			v.setAttribute("aria-hidden", "true");
			v.addEventListener("loadeddata", () => { visual.insertBefore(v, overlay); visual.classList.add("has-media"); v.play().catch(() => {}); }, { once: true });
			v.src = `./images/${p.slug}.mp4`;
		}
	});
})();

(function contactForm() {
	const form = document.getElementById("contact-form");
	if (!form) return;
	const status = document.getElementById("contact-status");
	const button = document.getElementById("contact-submit");
	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		const data = Object.fromEntries(new FormData(form));
		if (!data.name.trim() || !data.contact.trim() || data.message.trim().length < 10) {
			status.className = "cstatus err";
			status.textContent = "Add your name, a way to reach you, and a few words about the project.";
			return;
		}
		button.disabled = true;
		status.className = "cstatus";
		status.textContent = "Sending…";
		try {
			const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
			form.reset();
			status.className = "cstatus ok";
			status.textContent = "Sent. I'll get back to you within a day.";
		} catch (err) {
			status.className = "cstatus err";
			status.textContent = err.message;
		} finally {
			button.disabled = false;
		}
	});
})();

// Show the CV button only once cv/AJ-Kadri-CV.pdf exists.
fetch("/cv.pdf", { method: "HEAD" }).then((r) => { if (r.ok) document.getElementById("cv-link").hidden = false; }).catch(() => {});
