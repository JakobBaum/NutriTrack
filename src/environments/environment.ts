// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  // Globaler KI-Server (Cloudflare-Worker, Secret GEMINI_API_KEY): POST auf '/'.
  aiProxyUrl: 'https://nutritrack.baumgartner-jakob12.workers.dev',
  production: false,
  // Angular dev proxy forwards /off-search → https://search.openfoodfacts.org/search
  offSearchUrl: '/off-search',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
