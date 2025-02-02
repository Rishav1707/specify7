/**
 * Change current UI language
 */

import React from 'react';

import { useAsyncState } from '../../hooks/useAsyncState';
import { commonText } from '../../localization/common';
import { headerText } from '../../localization/header';
import { StringToJsx } from '../../localization/utils';
import { ajax } from '../../utils/ajax';
import { csrfToken } from '../../utils/ajax/csrfToken';
import { ping } from '../../utils/ajax/ping';
import { f } from '../../utils/functools';
import type { IR, RA } from '../../utils/types';
import { sortFunction } from '../../utils/utils';
import { Select } from '../Atoms/Form';
import { fail } from '../Errors/Crash';
import { supportLink } from '../Errors/ErrorDialog';
import { cachableUrl } from '../InitialContext';
import { Dialog, dialogClassNames } from '../Molecules/Dialog';
import type {
  PreferenceItem,
  PreferenceItemComponent,
} from '../UserPreferences/Definitions';
import { PreferencesContext, prefEvents } from '../UserPreferences/Hooks';
import { LocalizedString } from 'typesafe-i18n';
import {
  devLanguage,
  devLanguages,
  disabledLanguages,
  Language,
  LANGUAGE,
  languages,
} from '../../localization/utils/config';
import { formatUrl } from '../Router/queryString';
import { Http } from '../../utils/ajax/definitions';
import { languageSeparator } from '../SchemaConfig/Languages';

export const handleLanguageChange = async (language: Language): Promise<void> =>
  ping(
    '/context/language/',
    {
      method: 'POST',
      body: {
        language,
        csrfmiddlewaretoken: csrfToken,
      },
    },
    {
      expectedResponseCodes: [Http.NO_CONTENT],
    }
  ).then(f.void);

export function LanguageSelection<LANGUAGES extends string>({
  value,
  languages,
  onChange: handleChange,
  isReadOnly = false,
  showDevLanguages = process.env.NODE_ENV === 'development',
}: {
  readonly value: LANGUAGES;
  readonly languages: IR<string> | undefined;
  readonly onChange: (language: LANGUAGES) => void;
  readonly isReadOnly?: boolean;
  readonly showDevLanguages?: boolean;
}): JSX.Element {
  const [showSupportDialog, setShowSupportDialog] = React.useState(false);

  return (
    <>
      {showSupportDialog && (
        <Dialog
          buttons={commonText.close()}
          className={{
            container: dialogClassNames.narrowContainer,
          }}
          header={headerText.helpLocalizeSpecify()}
          onClose={(): void => setShowSupportDialog(false)}
        >
          <p>
            <StringToJsx
              components={{
                emailLink: supportLink,
              }}
              string={headerText.helpLocalizeSpecifyDescription()}
            />
          </p>
        </Dialog>
      )}
      {typeof languages === 'object' ? (
        <Select
          aria-label={commonText.language()}
          disabled={isReadOnly}
          value={value}
          onChange={({ target }): void =>
            target.value === 'supportLocalization'
              ? setShowSupportDialog(true)
              : handleChange(target.value as LANGUAGES)
          }
        >
          {Object.entries(languages).map(([code, nameLocal]) => (
            <option key={code} value={code}>
              {nameLocal} ({code})
            </option>
          ))}
          <option value="supportLocalization">
            {headerText.helpLocalizeSpecify()}
          </option>
          {showDevLanguages && (
            <optgroup label="Development languages">
              {Object.entries(devLanguages).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      ) : undefined}
    </>
  );
}

const url = cachableUrl(
  formatUrl('/context/language/', {
    languages: languages.join(','),
  })
);
export const LanguagePreferencesItem: PreferenceItemComponent<Language> =
  function LanguagePreferencesItem({
    isReadOnly,
    definition,
    category,
    subcategory,
    item,
  }) {
    const [languages] = useAsyncState<IR<string>>(
      React.useCallback(
        async () =>
          ajax<
            RA<{
              // eslint-disable-next-line @typescript-eslint/naming-convention
              readonly name_local: string;
              readonly code: string;
            }>
          >(url, {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            headers: { Accept: 'application/json' },
          }).then(({ data }) =>
            Object.fromEntries(
              Object.entries(data)
                .filter(
                  ([code]) =>
                    !f.has(disabledLanguages, code) || code === language
                )
                // eslint-disable-next-line @typescript-eslint/naming-convention
                .map(([code, { name_local }]) => [code, name_local])
            )
          ),
        []
      ),
      false
    );
    const [language, setLanguage] = React.useState(
      (devLanguage as Language) ?? LANGUAGE
    );

    /**
     * When editing someone else's user preferences, disable the language
     * selector, since language preference is stored in session storage.
     */
    const isRedirecting = React.useContext(PreferencesContext) !== undefined;
    return (
      <LanguageSelection<Language>
        isReadOnly={isReadOnly || isRedirecting || languages === undefined}
        languages={languages ?? { loading: commonText.loading() }}
        value={language}
        onChange={(language): void => {
          /*
           * This component does not actually save the current language into
           * preferences but immediately sends it to the back-end.
           * This is why it has an independent state and manually triggers
           * save button
           */
          handleLanguageChange(language).catch(fail);
          setLanguage(language);
          prefEvents.trigger('update', {
            category,
            subcategory,
            item,
            definition: definition as PreferenceItem<unknown>,
          });
        }}
      />
    );
  };

export function useSchemaLanguages(
  loadingScreen: boolean
): IR<LocalizedString> | undefined {
  const [languages] = useAsyncState<IR<LocalizedString>>(
    React.useCallback(
      async () =>
        ajax<
          RA<{
            readonly country: string | null;
            readonly language: string;
          }>
        >('/context/schema/language/', {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          headers: { Accept: 'application/json' },
          cache: 'no-cache',
        })
          .then(({ data }) =>
            // Sometimes languages are duplicated. Need to make the list unique
            f.unique(
              data.map(
                ({ country, language }) =>
                  `${language}${
                    country === null || country === '' ? '' : `${languageSeparator}${country}`
                  }`
              )
            )
          )
          .then((languages) =>
            // Get translated language names
            Object.fromEntries(
              languages
                .map(
                  (language) =>
                    [
                      language,
                      (new Intl.DisplayNames(LANGUAGE, { type: 'language' }).of(
                        language
                      ) ?? language) as LocalizedString,
                    ] as const
                )
                .sort(sortFunction(([_code, localized]) => localized))
            )
          ),
      []
    ),
    loadingScreen
  );
  return languages;
}

export const SchemaLanguagePreferenceItem: PreferenceItemComponent<string> =
  function SchemaLanguagePreferenceItem({
    value,
    onChange: handleChange,
    isReadOnly,
  }) {
    const languages = useSchemaLanguages(false);
    return (
      <LanguageSelection<string>
        isReadOnly={isReadOnly || languages === undefined}
        languages={languages ?? { loading: commonText.loading() }}
        value={value}
        onChange={handleChange}
        showDevLanguages={false}
      />
    );
  };
