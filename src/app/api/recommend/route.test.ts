import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { POST } from './route';

const validBody = () => ({
  profile: {
    lifestyle: {
      wakeTime: '06:30', sleepTime: '22:00', schedule: 'Office',
      activityLevel: 'moderate', currentHabits: 'coffee', timeSinks: 'phone',
    },
    goals: { items: ['Move daily'], timeframe: '3 months', why: 'Energy' },
    challenges: 'No time',
    preferences: { reminderTime: '08:00', tone: 'gentle' },
  },
  history: { activeDays: 4, completions: 9, ratePct: 40, habitNames: ['Walk'] },
});

const request = (payload: unknown) => new Request('http://localhost/api/recommend', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});

const gemini = (text: string, status = 200) => new Response(
  JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
  { status, headers: { 'content-type': 'application/json' } },
);

let emailCounter = 0;
const signedIn = () => {
  emailCounter += 1;
  authMock.mockResolvedValue({ user: { email: `user${emailCounter}@example.com` } });
};

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.GEMINI_MODEL;
  emailCounter += 1;
  authMock.mockReset();
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  vi.unstubAllGlobals();
});

describe('POST /api/recommend (spec R6)', () => {
  it('returns 401 without a session', async () => {
    authMock.mockResolvedValue(null);
    const response = await POST(request(validBody()));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toMatch(/sign in/i);
  });

  it('returns 400 for an invalid body', async () => {
    signedIn();
    const response = await POST(request({ profile: 'nope' }));
    expect(response.status).toBe(400);
  });

  it('returns 503 when the key is missing', async () => {
    signedIn();
    delete process.env.GEMINI_API_KEY;
    const response = await POST(request(validBody()));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain('GEMINI_API_KEY');
  });

  it('asks Gemini for schema-bound JSON and returns normalised suggestions', async () => {
    signedIn();
    const fetchMock = vi.fn(async () => gemini(JSON.stringify({
      suggestions: [
        { name: ' Walk ', reason: 'Cheap movement', suggestedTime: '13:00', firstStep: '5 min' },
        { name: 'walk', reason: 'duplicate' },
      ],
    })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request(validBody()));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.suggestions).toHaveLength(1);
    expect(data.suggestions[0]).toMatchObject({ name: 'Walk', suggestedTime: '13:00' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('gemini-2.5-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const sent = JSON.parse(init.body as string);
    expect(sent.generationConfig.responseMimeType).toBe('application/json');
    expect(sent.generationConfig.responseSchema.required).toEqual(['suggestions']);
    expect(sent.systemInstruction.parts[0].text).toContain('suggest');
    // Only the answer surface crosses the wire.
    expect(init.body).not.toContain('@example.com');
  });

  it('honours GEMINI_MODEL', async () => {
    signedIn();
    process.env.GEMINI_MODEL = 'gemini-test';
    const fetchMock = vi.fn(async () => gemini(JSON.stringify({
      suggestions: [{ name: 'Read', reason: '', suggestedTime: '', firstStep: '' }],
    })));
    vi.stubGlobal('fetch', fetchMock);
    await POST(request(validBody()));
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('gemini-test:generateContent');
  });

  it('maps an upstream 429 to 429', async () => {
    signedIn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    const response = await POST(request(validBody()));
    expect(response.status).toBe(429);
  });

  it('returns 502 for an unparseable or empty reply', async () => {
    signedIn();
    vi.stubGlobal('fetch', vi.fn(async () => gemini('not json')));
    expect((await POST(request(validBody()))).status).toBe(502);
  });

  it('returns 502 when the network call fails', async () => {
    signedIn();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await POST(request(validBody()))).status).toBe(502);
  });

  it('rate-limits one account after ten generations in an hour', async () => {
    emailCounter += 1;
    const email = `limit${emailCounter}@example.com`;
    authMock.mockResolvedValue({ user: { email } });
    vi.stubGlobal('fetch', vi.fn(async () => gemini(JSON.stringify({
      suggestions: [{ name: 'Read', reason: '', suggestedTime: '', firstStep: '' }],
    }))));

    for (let i = 0; i < 10; i += 1) {
      expect((await POST(request(validBody()))).status).toBe(200);
    }
    expect((await POST(request(validBody()))).status).toBe(429);
  });
});
