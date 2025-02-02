import React from 'react';
import { omit } from 'underscore';

import { deserializeResource } from '../../hooks/resource';
import { useAsyncState } from '../../hooks/useAsyncState';
import { f } from '../../utils/functools';
import { jsonStringify } from '../../utils/utils';
import { serializeResource } from '../DataModel/helpers';
import type { SerializedModel } from '../DataModel/helperTypes';
import { schema } from '../DataModel/schema';
import type { SpecifyUser } from '../DataModel/types';
import { format } from '../Forms/dataObjFormatters';
import { userInformation } from '../InitialContext/userInformation';
import { actionToLabel, resourceNameToLongLabel } from '../Security/utils';
import { institutionPermissions } from './definitions';
import type { PermissionErrorSchema } from './PermissionDenied';
import { userText } from '../../localization/user';
import { StringToJsx } from '../../localization/utils';
import { commonText } from '../../localization/common';

export function formatPermissionsError(
  response: string,
  url: string
):
  | readonly [errorObject: JSX.Element | undefined, errorMessage: string]
  | undefined {
  /*
   * If this is a permission error, back-end would provide a JSON object
   * In cases of session time out, back-end returns empty response
   */
  if (response.length === 0) return [undefined, userText.sessionTimeOut()];

  let parsed: PermissionErrorSchema | undefined = undefined;
  try {
    parsed = JSON.parse(response) as PermissionErrorSchema;
  } catch {}

  const error = parsed?.NoMatchingRuleException;

  return typeof error === 'object'
    ? ([
        <FormatPermissionError error={error} url={url} />,
        [
          `Permission denied when fetching from ${url}`,
          `Response: ${jsonStringify(error, '\t')}`,
        ].join('\n'),
      ] as const)
    : undefined;
}

export function FormatPermissionError({
  error,
  url,
}: {
  readonly error: PermissionErrorSchema['NoMatchingRuleException'];
  readonly url: string | undefined;
}): JSX.Element {
  return (
    <div className="flex h-full flex-col gap-2">
      <p>{userText.permissionDeniedDescription()}</p>
      <table className="grid-table grid-cols-4 rounded border border-gray-500">
        <thead>
          <tr>
            {[
              userText.action(),
              userText.resource(),
              schema.models.Collection.label,
              schema.models.SpecifyUser.label,
            ].map((label, index, { length }) => (
              <th
                className={`
                  bg-gray-350 p-2 dark:bg-neutral-600
                  ${
                    index === 0
                      ? 'rounded-l'
                      : index + 1 === length
                      ? 'rounded-r'
                      : ''
                  }
                `}
                key={index}
                scope="column"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {error.map(({ collectionid, userid, resource, action }, index) => (
            <tr key={index}>
              {[
                actionToLabel(action),
                resourceNameToLongLabel(resource),
                <CollectionName
                  collectionId={
                    institutionPermissions.has(resource)
                      ? undefined
                      : collectionid ?? undefined
                  }
                />,
                <UserName userId={userid} />,
              ].map((value, index) => (
                <td className="p-2" key={index}>
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {typeof url === 'string' && (
        <p>
          <StringToJsx
            string={userText.permissionDeniedForUrl()}
            components={{
              url: <code>{url}</code>,
            }}
          />
        </p>
      )}
    </div>
  );
}

function CollectionName({
  collectionId,
}: {
  readonly collectionId: number | undefined;
}): JSX.Element {
  const [formatted] = useAsyncState(
    React.useCallback(
      () =>
        typeof collectionId === 'number'
          ? format(
              f.maybe(
                userInformation.availableCollections.find(
                  ({ id }) => id === collectionId
                ),
                deserializeResource
              ) ?? new schema.models.Collection.Resource({ id: collectionId }),
              undefined,
              true
            )
          : schema.models.Institution.label,
      [collectionId]
    ),
    false
  );
  return <>{formatted ?? commonText.loading()}</>;
}

function UserName({ userId }: { readonly userId: number }): JSX.Element {
  const [formatted] = useAsyncState(
    React.useCallback(
      async () =>
        format(
          userInformation.id === userId
            ? deserializeResource(
                serializeResource(
                  omit(
                    userInformation,
                    'availableCollections',
                    'isauthenticated',
                    'agent'
                  ) as SerializedModel<SpecifyUser>
                )
              )
            : new schema.models.SpecifyUser.Resource({ id: userId }),
          undefined,
          true
        ),
      [userId]
    ),
    false
  );
  return <>{formatted ?? commonText.loading()}</>;
}
