// Cloudflare Worker: vocab card lookup via Claude Haiku.
// POST {"word": "..."} -> {"definition", "context", "morphology", "synonyms"}
// Secret required: ANTHROPIC_API_KEY (set via `wrangler secret put ANTHROPIC_API_KEY`)

const ALLOWED_ORIGINS = [
  "https://wangxun2026.github.io",
  "http://localhost:8743",
  "http://127.0.0.1:8743",
];

const CARD_SCHEMA = {
  type: "object",
  properties: {
    definition: {
      type: "string",
      description: "Concise definition with part of speech, e.g. \"(noun) A ...\". For chemistry elements include symbol and atomic number.",
    },
    context: {
      type: "string",
      description: "One natural example sentence showing the word in use.",
    },
    morphology: {
      type: "string",
      description: "Roots, prefixes, suffixes with their meanings and origin language, plus related English words sharing the roots. Empty string if not meaningful (e.g. simple native words).",
    },
    synonyms: {
      type: "string",
      description: "Up to 6 synonyms, comma-separated. Empty string if none.",
    },
  },
  required: ["definition", "context", "morphology", "synonyms"],
  additionalProperties: false,
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response("POST only", { status: 405, headers: corsHeaders });
    }

    let word;
    try {
      ({ word } = await request.json());
    } catch {
      word = undefined;
    }
    if (typeof word !== "string" || !word.trim() || word.length > 60) {
      return Response.json({ error: "invalid word" }, { status: 400, headers: corsHeaders });
    }
    word = word.trim();

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 600,
        output_config: { format: { type: "json_schema", schema: CARD_SCHEMA } },
        messages: [
          {
            role: "user",
            content:
              `Generate flashcard fields for the English word or term: "${word}". ` +
              "This is for a personal vocabulary-learning app (general English plus chemistry terms). " +
              "Keep the definition tight; make the example sentence vivid and memorable; " +
              "for morphology, break down roots/prefixes/suffixes with meanings and mention 1-2 related English words sharing them.",
          },
        ],
      }),
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text();
      return Response.json(
        { error: "upstream", status: apiRes.status, detail: detail.slice(0, 300) },
        { status: 502, headers: corsHeaders },
      );
    }

    const data = await apiRes.json();
    if (data.stop_reason === "refusal") {
      return Response.json({ error: "refused" }, { status: 502, headers: corsHeaders });
    }
    const text = (data.content || []).find((b) => b.type === "text")?.text ?? "";
    return new Response(text, {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  },
};
