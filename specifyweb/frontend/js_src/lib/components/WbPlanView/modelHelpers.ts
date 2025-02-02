/**
 * Helper methods for working with Specify data model as parsed by WbPlanView
 * model fetcher
 *
 * @module
 */

import type { MappingPath } from './Mapper';
import type { Tables } from '../DataModel/types';
import { group } from '../../utils/utils';
import { strictGetModel } from '../DataModel/schema';
import type { Relationship } from '../DataModel/specifyField';
import {
  getTreeDefinitionItems,
  isTreeModel,
} from '../InitialContext/treeRanks';
import type { IR, RA } from '../../utils/types';
import { filterArray } from '../../utils/types';
import {
  formatTreeRank,
  getNumberFromToManyIndex,
  relationshipIsToMany,
  valueIsToManyIndex,
  valueIsTreeRank,
} from './mappingHelpers';

/** Returns the max index in the list of -to-many items */
export const getMaxToManyIndex = (
  // List of -to-many indexes
  values: RA<string>
): number =>
  values.reduce((max, value) => {
    // Skip `add` values and other possible NaN cases
    if (!valueIsToManyIndex(value)) return max;

    const number = getNumberFromToManyIndex(value);

    if (number > max) return number;

    return max;
  }, 0);

/** Iterates over the mappings to find required fields that are not mapped */
export function findRequiredMissingFields(
  // Name of the current base table
  tableName: keyof Tables,
  mappings: RA<MappingPath>,
  // If a table is set as must match, all of its fields are optional
  mustMatchPreferences: IR<boolean>,
  // Used internally in a recursion. Previous table name
  parentRelationship: Relationship | undefined = undefined,
  // Used internally in a recursion. Current mapping path
  path: MappingPath = []
): RA<MappingPath> {
  const model = strictGetModel(tableName);

  if (mappings === undefined) return [];

  const mappingEntries = group(
    mappings.map((line) => [line[0], line.slice(1)] as const)
  );
  const indexedMappings = Object.fromEntries(mappingEntries);

  // Handle -to-many references
  if (mappings.length > 0 && valueIsToManyIndex(mappings[0][0]))
    return mappingEntries.flatMap(([index, mappings]) =>
      findRequiredMissingFields(
        tableName,
        mappings,
        mustMatchPreferences,
        parentRelationship,
        [...path, index]
      )
    );
  // Handle trees
  else if (isTreeModel(tableName) && !valueIsTreeRank(path.at(-1)!))
    return (
      getTreeDefinitionItems(tableName as 'Geography', false)?.flatMap(
        ({ name: rankName }) => {
          const formattedRankName = formatTreeRank(rankName);
          const localPath = [...path, formattedRankName];

          return formattedRankName in indexedMappings
            ? findRequiredMissingFields(
                tableName,
                indexedMappings[formattedRankName],
                mustMatchPreferences,
                parentRelationship,
                localPath
              )
            : [];
        }
      ) ?? []
    );

  return [
    // WB does not allow mapping to relationships in tree tables
    ...(isTreeModel(tableName) ? [] : model.relationships).flatMap(
      (relationship) => {
        const localPath = [...path, relationship.name];

        if (
          typeof parentRelationship === 'object' &&
          // Disable circular relationships
          (isCircularRelationship(parentRelationship, relationship) ||
            // Skip -to-many inside -to-many
            (relationshipIsToMany(parentRelationship) &&
              relationshipIsToMany(relationship)))
        )
          return [];

        if (relationship.name in indexedMappings)
          return findRequiredMissingFields(
            relationship.relatedModel.name,
            indexedMappings[relationship.name],
            mustMatchPreferences,
            relationship,
            localPath
          );
        else if (
          relationship.overrides.isRequired &&
          !relationship.relatedModel.overrides.isSystem &&
          !mustMatchPreferences[tableName]
        )
          return [localPath];
        else return [];
      }
    ),
    ...filterArray(
      model.literalFields.map((field) =>
        !(field.name in indexedMappings) &&
        field.overrides.isRequired &&
        !mustMatchPreferences[tableName]
          ? [...path, field.name]
          : undefined
      )
    ),
  ];
}

export const isCircularRelationship = (
  parentRelationship: Relationship,
  relationship: Relationship
): boolean =>
  (parentRelationship.relatedModel === relationship.model &&
    parentRelationship.otherSideName === relationship.name) ||
  (relationship.relatedModel === parentRelationship.model &&
    relationship.otherSideName === parentRelationship.name);
