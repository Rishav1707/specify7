import { f } from '../../utils/functools';
import { readCookie } from '../../utils/ajax/cookies';
import { setDevelopmentGlobal } from '../../utils/types';

/**
 * A mapping between Django language code and Weblate language code
 * (weblate uses unconventional codes)
 *
 * To add new language, define it in this list
 */
export const languageCodeMapper = {
  'en-us': 'en_US',
  'ru-ru': 'ru',
  'uk-ua': 'uk',
  'fr-fr': 'fr',
  'es-es': 'es',
} as const;

export const languages = Object.keys(languageCodeMapper);

/** This allows to hide unfinished localizations in production */
export const disabledLanguages = new Set(
  process.env.NODE_ENV === 'development' ? [] : ['uk-ua', 'fr-fr', 'es-es']
);

/**
 * These languages are available in development only. Used for testing
 */
export const devLanguages = {
  /**
   * Like 'en-us', but every value is prepended with an underscore. Useful for
   * detecting localized strings
   */
  underscore: 'Underscore',
  /**
   * Print the string key rather than localized string
   */
  raw: 'Raw',
  /**
   * Like 'en-us', but every value is printed twice. Useful for testing
   * UI overflow and ensuring against languages with long words
   */
  double: 'Double',
};

export type Language = typeof languages[number];

export const DEFAULT_LANGUAGE = 'en-us';

// Django does not allow invalid language codes, so can't read them from
// <html lang="..."> tag. Instead, we read them from cookies directly
const cookieLanguage = readCookie('language');
export const devLanguage = f.includes(Object.keys(devLanguages), cookieLanguage)
  ? cookieLanguage
  : undefined;

export const LANGUAGE: Language =
  (typeof document === 'object' &&
  f.includes(languages, document.documentElement.lang)
    ? document.documentElement.lang
    : undefined) ?? DEFAULT_LANGUAGE;

setDevelopmentGlobal('_devLanguage', devLanguage);
setDevelopmentGlobal('_language', LANGUAGE);

/**
 * Which branch the strings are coming from.
 * If modifying this, also update the trigger in the GitHub Action on
 * this branch and on the weblate-localization branch
 */
export const syncBranch = 'production';

export const weblateBranch = 'weblate-localization';
