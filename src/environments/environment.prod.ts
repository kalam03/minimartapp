// Fallback only — see environment.ts and AppConfigService. The real,
// changeable-without-a-rebuild production API URL lives in
// public/config.json (deployed as config.json next to index.html).
// This value is only ever used if that file is missing/unreachable.
export const environment = {
  production: true,
  baseUrl: 'http://luckyshop/api',
};