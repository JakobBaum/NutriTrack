export const environment = {
  // Globaler KI-Server (Cloudflare-Worker, Secret GEMINI_API_KEY): POST auf '/'.
  aiProxyUrl: 'https://nutritrack.baumgartner-jakob12.workers.dev',
  production: true,
  // search.openfoodfacts.org sendet keine CORS-Header → Browser/PWA brauchen den
  // NutriTrack-Worker als Proxy (setzt auch den von OFF gewünschten User-Agent).
  offSearchUrl: 'https://nutritrack.baumgartner-jakob12.workers.dev/off-search',
};
