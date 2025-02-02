import { deserializeResource } from '../../hooks/resource';
import { f } from '../../utils/functools';
import type { RA } from '../../utils/types';
import { DEFAULT_FETCH_LIMIT, fetchCollection } from '../DataModel/collection';
import type { SpecifyResource } from '../DataModel/legacyTypes';
import { schema } from '../DataModel/schema';
import type {
  Collection,
  CollectionObject,
  CollectionRelationship,
  CollectionRelType,
} from '../DataModel/types';
import { format } from '../Forms/dataObjFormatters';
import { LocalizedString } from 'typesafe-i18n';

export type CollectionRelData = {
  readonly relationshipType: SpecifyResource<CollectionRelType>;
  readonly collectionObjects: RA<{
    readonly formatted: LocalizedString;
    readonly resource: SpecifyResource<CollectionObject>;
    readonly relationship: SpecifyResource<CollectionRelationship>;
  }>;
  readonly otherCollection: {
    readonly id: number;
    readonly href: string;
    readonly name: string;
    readonly formatted: LocalizedString;
  };
  readonly side: 'left' | 'right';
  readonly otherSide: 'left' | 'right';
};

export const processColRelationships = async (
  relationships: RA<SpecifyResource<CollectionRelationship>>,
  otherSide: 'left' | 'right',
  formatting: string | undefined
): Promise<CollectionRelData['collectionObjects']> =>
  Promise.all(
    relationships.map(async (relationship) =>
      relationship
        .rgetPromise(`${otherSide}Side`)
        .then((collectionObject) => [relationship, collectionObject] as const)
    )
  ).then(async (resources) =>
    Promise.all(
      resources.map(async ([relationship, collectionObject]) => ({
        formatted: await format(collectionObject, formatting).then(
          (formatted) =>
            formatted ?? (collectionObject.id.toString() as LocalizedString)
        ),
        resource: collectionObject,
        relationship,
      }))
    )
  );

export async function fetchOtherCollectionData(
  resource: SpecifyResource<CollectionObject>,
  relationship: string,
  formatting: string | undefined
): Promise<CollectionRelData> {
  const { relationshipType, left, right } = await fetchCollection(
    'CollectionRelType',
    { name: relationship, limit: 1 }
  )
    // BUG: this does not handle the not found case
    .then(({ records }) => deserializeResource(records[0]))
    .then(async (relationshipType) =>
      f.all({
        relationshipType,
        left: relationshipType.rgetPromise('leftSideCollection'),
        right: relationshipType.rgetPromise('rightSideCollection'),
      })
    );
  let side: 'left' | 'right';
  let otherSide: 'left' | 'right';
  let relatedCollection: SpecifyResource<Collection> | null;
  if (schema.domainLevelIds.collection === left?.id) {
    side = 'left';
    otherSide = 'right';
    relatedCollection = right;
  } else if (schema.domainLevelIds.collection === right?.id) {
    side = 'right';
    otherSide = 'left';
    relatedCollection = left;
  } else
    throw new Error(
      "Related collection plugin used with relation that doesn't match current collection"
    );
  if (relatedCollection === null)
    throw new Error('Unable to determine collection for the other side');

  const otherCollection = relatedCollection;
  const formattedCollection = format(otherCollection);

  return {
    relationshipType,
    collectionObjects:
      typeof resource.id === 'number'
        ? await fetchCollection(
            'CollectionRelationship',
            { limit: DEFAULT_FETCH_LIMIT },
            side === 'left'
              ? {
                  leftside_id: resource.id,
                  collectionreltype_id: relationshipType.id,
                }
              : {
                  rightside_id: resource.id,
                  collectionreltype_id: relationshipType.id,
                }
          ).then(async ({ records }) =>
            processColRelationships(
              records.map(deserializeResource),
              otherSide,
              formatting
            )
          )
        : [],
    otherCollection: {
      id: otherCollection.id,
      href: otherCollection.viewUrl(),
      name: otherCollection.get('collectionName') ?? '',
      formatted: await formattedCollection.then(
        (formatted) =>
          formatted ?? (otherCollection.id.toString() as LocalizedString)
      ),
    },
    side,
    otherSide,
  };
}
