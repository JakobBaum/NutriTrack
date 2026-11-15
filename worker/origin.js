const DEFAULT_ORIGINS = [
  'https://jakobbaum.github.io',
  'capacitor://localhost', // iOS-App
  'ionic://localhost',
  'https://localhost', // Android-App
  'http://localhost',
  'http://localhost:4200',
  'http://localhost:8100',
];

// Eigener Kennzeichen-Header der nativen App: WebKit unterdrückt einen von JS gesetzten Origin-Header.
export const CLIENT_HEADER = 'X-NutriTrack-Client';

const NATIVE_CLIENT_VALUES = ['ios'];

const PREFLIGHT_MAX_AGE_S = 86400;

function allowedOrigins(env) {
  const configured = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_ORIGINS;
}

/** Opt-in (REQUIRE_ORIGIN=true): auch Anfragen ohne Origin ablehnen, ausgenommen Preflight und GET /health. */
function isOriginRequired(env) {
  return String(env.REQUIRE_ORIGIN ?? '').trim().toLowerCase() === 'true';
}

function isOriginExempt(request) {
  return request.method === 'OPTIONS' || (request.method === 'GET' && new URL(request.url).pathname === '/health');
}

function isNativeClient(request) {
  return NATIVE_CLIENT_VALUES.includes(request.headers.get(CLIENT_HEADER) ?? '');
}

export function isOriginRejected(origin, request, env) {
  if (origin) return !allowedOrigins(env).includes(origin);
  return isOriginRequired(env) && !isOriginExempt(request) && !isNativeClient(request);
}

export function corsHeaders(origin) {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    // User-Agent zulassen: ältere App-Versionen senden ihn, Safari/Firefox fragen dafür per Preflight.
    'Access-Control-Allow-Headers': `Content-Type, User-Agent, ${CLIENT_HEADER}`,
    'Access-Control-Expose-Headers': 'X-Api-Quota-Left, Retry-After',
    'Access-Control-Max-Age': String(PREFLIGHT_MAX_AGE_S),
    Vary: 'Origin',
  };
}
