import React from 'react';

import type { CollectionObject } from '../DataModel/types';
import type { SpecifyResource } from '../DataModel/legacyTypes';
import { Link } from '../Atoms/Link';
import {useAsyncState} from '../../hooks/useAsyncState';
import {fetchOtherCollectionData} from './collectionRelData';

export function CollectionOneToOnePlugin({
  resource,
  relationship,
  formatting,
}: {
  readonly resource: SpecifyResource<CollectionObject>;
  readonly relationship: string;
  readonly formatting: string | undefined;
}): JSX.Element | null {
  const [data] = useAsyncState(
    React.useCallback(
      async () =>
        fetchOtherCollectionData(resource, relationship, formatting).catch(
          (error) => {
            console.error(error);
            return undefined;
          }
        ),
      [resource, relationship]
    ),
    true
  );
  return typeof data === 'object' && data.collectionObjects.length > 0 ? (
    <Link.Default href={data.collectionObjects[0].resource.viewUrl()}>
      {data.collectionObjects[0].formatted}
    </Link.Default>
  ) : null;
}
