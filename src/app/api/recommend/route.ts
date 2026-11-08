import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { normalizeSuggestions } from '@/lib/recommendations';
import { buildRecommendationPrompt } from '@/lib/recommendPrompt';
import { parseRecommendRequest } from '@/lib/recommendRequest';

export const runtime = 'nodejs';

// 2.x models are retired for keys created after the 3.x rollout (the API
// answers 404 "no longer available to new users"), so the default must track
// a current generation. Override per-deployment with GEMINI_MODEL.
const DEFAULT_MODEL = 'gemini-3.5-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 30_000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 10;

/**
 * Best-effort abuse guard (spec R6): in-memory, per session, resets with the
 * instance. It exists to stop a stuck retry loop burning the free tier, not to
 * be a security boundary — Auth.js already gates the route.
 */
const hits = new Map<string, number[]>();

function overLimit(key: string, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

/** Gemini's responseSchema: JSON mode with no room for prose or extra keys. */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    suggestions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          reason: { type: 'STRING' },
          suggestedTime: { type: 'STRING' },
          firstStep: { type: 'STRING' },
        },
        required: ['name', 'reason', 'suggestedTime', 'firstStep'],
      },
    },
  },
  required: ['suggestions'],
} as const;

interface GeminiReply {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return fail(401, 'Sign in to generate suggestions.');

  const now = Date.now();
  if (overLimit(email, now)) {
    return fail(429, 'That is a lot of suggestions. Try again in an hour.');
  }

  const body = await request.json().catch(() => null);
  const parsed = parseRecommendRequest(body);
  if (!parsed.ok) return fail(400, parsed.error);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fail(503, 'AI suggestions are not configured on this server. Add GEMINI_API_KEY.');
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const prompt = buildRecommendationPrompt(parsed.value);

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.system }] },
        contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
  } catch {
    return fail(502, 'The suggestion service did not answer. Try again.');
  }

  if (response.status === 429) {
    return fail(429, 'The suggestion service is busy. Try again in a minute.');
  }
  if (!response.ok) {
    return fail(502, 'The suggestion service could not generate habits.');
  }

  const reply = await response.json().catch(() => null) as GeminiReply | null;
  const text = reply?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* handled below */ }

  const list = Array.isArray(json)
    ? json
    : (json && typeof json === 'object' && 'suggestions' in json)
      ? (json as { suggestions?: unknown }).suggestions
      : null;
  const suggestions = normalizeSuggestions(list);
  if (suggestions.length === 0) {
    return fail(502, 'The suggestion service returned nothing usable.');
  }

  return NextResponse.json({ suggestions });
}
