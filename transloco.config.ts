// transloco.config.ts — read by the Transloco CLI tooling (keys manager /
// extraction), NOT by the running app (see app.config.ts + transloco-loader.ts
// for the runtime setup). Keeps the tooling in sync with the actual
// "one folder per feature" layout under src/assets/i18n/.
import { TranslocoGlobalConfig } from '@jsverse/transloco-utils';

const config: TranslocoGlobalConfig = {
  rootTranslationsPath: 'src/assets/i18n/',
  langs: ['en', 'bn'],
  keysManager: {},
};

export default config;
