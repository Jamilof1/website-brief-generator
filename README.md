# Blueprint — Website Brief Generator

Turn a business interview into a sitemap, page purposes, content plan, features list, and landing-page direction. Project 10 in the Jamil Darwish Automation Lab.

## Modes

- **Demo:** transparent strategy rules generate a usable brief in the browser.
- **AI:** your model expands the current interview into a tailored website brief through the local proxy.

## Quick start

Requires Node.js 22+.

```bash
git clone https://github.com/Jamilof1/website-brief-generator.git
cd website-brief-generator
npm install
npm run dev
```

For AI mode, copy `.env.example` to `.env`, add `AI_API_KEY`, and restart. PowerShell: `Copy-Item .env.example .env`.

## Provider configuration

Defaults: OpenAI Responses API and `AI_MODEL=gpt-5`. Compatible chat endpoints can set `AI_BASE_URL`, model, and `AI_API_STYLE=chat`. The browser never sees the key and `.env` stays out of Git.

## Features

- Business, offer, audience, conversion, proof, tone, and content interview.
- Generated sitemap, requirements, and production list.
- Optional AI strategy and content direction.
- Markdown copy/download and synthetic portfolio example.

## Commands

`npm run dev` starts client + API, `npm test` runs tests, `npm run build` creates `dist/`, and `npm start` serves it.

## Responsible use

Demo inputs stay local. AI mode sends the visible interview only after a click. The output is a discovery starting point—not a contract or finished technical specification—and must be validated with stakeholders, users, accessibility needs, legal requirements, and implementation constraints.

MIT — built by [Jamil Darwish](https://jamildarwish.com/).
