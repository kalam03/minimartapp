// This baseUrl is now only a FALLBACK, used if /config.json (see
// public/config.json + AppConfigService) is missing or fails to load —
// e.g. a bare `ng serve` with nothing deployed. Once deployed, the real
// API URL lives in config.json and can be changed there without a
// rebuild — see AppConfigService for details.
export const environment = {
  production: false,
  baseUrl: 'http://localhost:5187/api',
};