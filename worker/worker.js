// Cloudflare Worker: writes vocabulary flashcards with Claude.
// POST {"word":"..."}  or  {"words":["...","..."]}
//   -> [{word, definition, context, morphology, synonyms}, ...]
//
// Secret required: ANTHROPIC_API_KEY  (wrangler secret put ANTHROPIC_API_KEY)

// Swap this line and redeploy to compare quality yourself.
//   claude-opus-4-8   $5 / $25 per Mtok  -> ~$0.008 a card  (~600 cards for $5)
//   claude-sonnet-5   $3 / $15 per Mtok  -> ~$0.005 a card  (~1000 cards for $5)
//   claude-haiku-4-5  $1 /  $5 per Mtok  -> ~$0.0017 a card (~3000 cards for $5)
const MODEL = "claude-opus-4-8";

const ALLOWED_ORIGINS = [
  "https://wangxun2026.github.io",
  "http://localhost:8743",
  "http://127.0.0.1:8743",
];

// Mirrors the guidance that produced the hand-written seed deck.
const SYSTEM = `You write vocabulary flashcards for one learner. He is a native Chinese speaker with strong English, studying chemistry terms (especially the lanthanides) alongside general English vocabulary he meets in daily life.

Write each card to be remembered, not merely to be correct:
- definition: open with the part of speech in parentheses, then a tight definition. For a chemical element, give the symbol and atomic number.
- context: ONE example sentence that anchors the word to something concrete and real — how the thing is actually used, where the word actually shows up. Avoid filler sentences that would fit any word.
- morphology: split the word into roots/prefixes/suffixes, gloss each part and name its source language, then point to 2-4 COMMON English words sharing that root. This section matters most to him — the shared-root words are the payoff, so pick ones he plausibly already knows rather than obscure technical relatives.
- synonyms: up to 6, comma-separated, closest first. Empty string when the word has none (most element names do not).

Leave a field as an empty string rather than padding it with something weak.`;

const CARD_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          definition: { type: "string" },
          context: { type: "string" },
          morphology: { type: "string" },
          synonyms: { type: "string" },
        },
        required: ["word", "definition", "context", "morphology", "synonyms"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return new Response("POST only", { status: 405, headers: cors });

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "bad json" }, { status: 400, headers: cors });
    }

    const words = (Array.isArray(body.words) ? body.words : [body.word])
      .filter((w) => typeof w === "string" && w.trim())
      .map((w) => w.trim())
      .slice(0, 25);
    if (!words.length || words.some((w) => w.length > 60)) {
      return Response.json({ error: "invalid words" }, { status: 400, headers: cors });
    }

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        output_config: { format: { type: "json_schema", schema: CARD_SCHEMA } },
        messages: [
          { role: "user", content: `Write one card for each of these words:\n${words.map((w) => `- ${w}`).join("\n")}` },
        ],
      }),
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text();
      return Response.json(
        { error: "upstream", status: apiRes.status, detail: detail.slice(0, 300) },
        { status: 502, headers: cors },
      );
    }

    const data = await apiRes.json();
    if (data.stop_reason === "refusal") {
      return Response.json({ error: "refused" }, { status: 502, headers: cors });
    }
    const text = (data.content || []).find((b) => b.type === "text")?.text || "";
    let cards;
    try {
      cards = JSON.parse(text).cards;
    } catch {
      return Response.json({ error: "unparseable" }, { status: 502, headers: cors });
    }
    return Response.json({ cards }, { headers: cors });
  },
};
