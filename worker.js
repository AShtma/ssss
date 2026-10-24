// Cloudflare Worker: وسيط بين الموقع وGemini. المفتاح بيتخزن كـ Secret ومبيظهرش للزائرين.
const ALLOWED_ORIGINS = [
  'https://YOUR-USERNAME.github.io',   // 👈 غيّرها لدومين موقعك (من غير / في الآخر ومن غير اسم الريبو)
];
const MODELS = ['gemini-flash-latest','gemini-2.5-flash','gemini-2.5-flash-lite','gemini-flash-lite-latest','gemini-3.5-flash'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403, headers: cors });

    const text = await request.text();
    if (text.length > 20000) return new Response('Too large', { status: 413, headers: cors });
    let data;
    try { data = JSON.parse(text); } catch { return new Response('Bad JSON', { status: 400, headers: cors }); }
    if (!MODELS.includes(data.model) || typeof data.payload !== 'object') {
      return new Response('Bad request', { status: 400, headers: cors });
    }
    // سقف الرد عشان محدش يستهلك الكوتا
    data.payload.generationConfig = { ...(data.payload.generationConfig || {}), maxOutputTokens: 1000 };

    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + data.model + ':generateContent',
      { method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
        body: JSON.stringify(data.payload) }
    );
    return new Response(await r.text(), { status: r.status, headers: { ...cors, 'content-type': 'application/json' } });
  },
};
