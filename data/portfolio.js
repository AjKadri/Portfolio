const portfolio = {
  person: {
    name: "AJ Kadri",
    location: "Lagos, Nigeria",
    title: "Software developer",
    summary:
      "A Computer Science graduate focused on building useful software, clean interfaces, and solutions to problems that make life harder than it needs to be.",
    approach: [
      "Turns ideas into working interfaces and applications.",
      "Cares about how products feel to use and wants to understand the systems underneath them.",
      "Is building toward a career in software development, one real project at a time.",
    ],
  },
  education: {
    degree: "B.Sc. in Computer Science",
    note: "The portfolio does not list a school or graduation year.",
  },
  skills: {
    frontend: ["HTML", "CSS", "Tailwind CSS", "JavaScript", "React"],
    backend: ["Node.js", "Express", "EJS", "REST APIs"],
    toolsAndInterests: ["Git", "GitHub", "Playwright", "automation"],
    currentFocus:
      "Building more complete software products and deepening both frontend and backend development skills.",
  },
  experience: {
    summary:
      "AJ's published experience is project-based. His portfolio demonstrates frontend work, Node.js and Express backend work, API integration, and browser automation. It does not claim a specific employer or number of years of professional experience.",
  },
  projects: [
    {
      name: "Cryptex",
      year: 2026,
      summary:
        "A cryptocurrency dashboard built around live market data, search, watchlists, and readable market information.",
      details: "Uses the CoinGecko API to make market data easier to explore.",
      technologies: ["JavaScript", "Node.js", "Express", "EJS", "REST API"],
      liveUrl: "https://cryptex-app.vercel.app/",
      sourceUrl: "https://github.com/AjKadri/Cryptex",
    },
    {
      name: "Campaign Watcher",
      year: 2026,
      summary:
        "An automation tool that monitors campaigns on a website and sends notifications when it detects new ones, reducing repetitive manual checks.",
      technologies: ["Node.js", "JavaScript", "Playwright", "automation", "REST API"],
      sourceUrl: "https://github.com/AjKadri/Campaign-Watcher",
    },
    {
      name: "Be My Val",
      year: 2026,
      summary:
        "A playful Valentine's website AJ built to ask his crush to be his valentine; it became a small exercise in web development and creativity.",
      technologies: ["HTML", "CSS", "JavaScript"],
      liveUrl: "https://bemyval.pxxl.click/",
      sourceUrl: "https://github.com/AjKadri/Valentine-2026",
    },
    {
      name: "My First Portfolio",
      year: 2025,
      summary:
        "AJ's first proper personal website and an early step in his software development and web design journey.",
      technologies: ["HTML", "CSS", "JavaScript"],
      sourceUrl: "https://github.com/AjKadri/HTML-Portfolio",
    },
  ],
  contact: {
    email: "cryptoaj0007@gmail.com",
    github: "https://github.com/AjKadri",
    x: "https://x.com/web3aj_",
    availability:
      "Open to software and web development roles, interesting products, and conversations about building on the web.",
  },
};

function buildSystemPrompt() {
  return [
    "You are the portfolio assistant on AJ Kadri's website, The Blue Page.",
    "Answer questions about AJ in a warm, direct voice using only the portfolio facts below.",
    "Keep most answers to 2-4 short sentences. Use plain text, not Markdown formatting.",
    "Refer to AJ in the third person. Never pretend to be AJ.",
    "Do not invent employers, dates, metrics, clients, credentials, personal details, or project features.",
    "If the facts do not answer a question, say you do not have that information and suggest emailing AJ when appropriate.",
    "For unrelated questions, briefly explain that you can only help with AJ's work, skills, background, and contact details.",
    "When useful, include the exact contact or project URL from the facts.",
    "PORTFOLIO FACTS:",
    JSON.stringify(portfolio),
  ].join("\n");
}

module.exports = { portfolio, buildSystemPrompt };
