/**
 * Generate a short human-friendly column header name out of mapping path
 *
 * @remarks
 * Used by WbPlanView to assign names to newly added headers
 *
 * @module
 */

import type { RA } from '../../utils/types';
import { filterArray } from '../../utils/types';
import { camelToHuman } from '../../utils/utils';
import { strictGetModel } from '../DataModel/schema';
import type { Tables } from '../DataModel/types';
import type { MappingPath } from './Mapper';
import {
  anyTreeRank,
  formattedEntry,
  formatTreeRank,
  getNameFromTreeRankName,
  getNumberFromToManyIndex,
  valueIsToManyIndex,
  valueIsTreeRank,
} from './mappingHelpers';
import { getMappingLineData } from './navigator';

/** Use table name instead of field name for the following fields: */
const fieldsToHide = new Set<string>([
  'name',
  'fullName',
  'localityName',
  formattedEntry,
]);

/**
 * Use table name alongside field label (if field label consists of a single
 * word) for the following fields:
 */
const genericFields = new Set<string>([]);

/**
 * If field label consists of a single word, it would be treated as generic
 * (the table name would be used alongside field label). The following
 * fields are exempt from such behaviour:
 */
const nonGenericFields = new Set<string>([
  'latitude1',
  'longitude1',
  'latitude2',
  'longitude2',
  'action',
  'fields',
]);

/** Use parent table label instead of this table label (if possible) */
const tablesToHide = new Set<string>(['agent', 'addresses']);

/** Use both parent table label and this table label (if possible) */
const genericTables = new Set<string>(['referenceWork']);

/**
 * NOTE: subset is reversed so that array destructuring works right for mapping
 * paths shorter than 3 elements
 */
const mappingPathSubset = <T extends string | undefined>(
  mappingPath: RA<T | string>
): RA<T | string> => [
  ...mappingPath
    .filter((mappingPathPart) => !valueIsToManyIndex(mappingPathPart))
    .reverse(),
  ...Array.from<string>({ length: 3 }).fill(''),
];

/**
 * Generate a short and human friendly label from a potentially long
 * mapping path
 */
export function generateMappingPathPreview(
  baseTableName: keyof Tables,
  mappingPath: MappingPath
): string {
  if (mappingPath.length === 0) return strictGetModel(baseTableName).label;

  const mappingLineData = getMappingLineData({
    baseTableName,
    mappingPath,
    generateFieldData: 'selectedOnly',
    scope: 'queryBuilder',
  });

  const fieldLabels = [
    mappingLineData[0].selectLabel ?? '',
    ...mappingLineData.map((mappingElementData) => {
      const entry = Object.entries(mappingElementData.fieldsData)[0];
      if (entry === undefined) return undefined;
      const [fieldName, { optionLabel }] = entry;
      return fieldName === formatTreeRank(anyTreeRank)
        ? strictGetModel(mappingElementData.tableName!).label
        : (optionLabel as string);
    }),
  ];

  const toManyLocation = Array.from(mappingPath)
    .reverse()
    .findIndex(valueIsToManyIndex);

  const toManyIndex = mappingPath[mappingPath.length - 1 - toManyLocation];
  const toManyIndexNumber = toManyIndex
    ? getNumberFromToManyIndex(toManyIndex)
    : 1;
  const toManyIndexFormatted = toManyIndexNumber > 1 ? toManyIndex : undefined;

  const [databaseFieldName, databaseTableOrRankName, databaseParentTableName] =
    mappingPathSubset([baseTableName, ...mappingPath]);
  const [
    fieldName = camelToHuman(databaseFieldName),
    tableOrRankName = camelToHuman(
      getNameFromTreeRankName(databaseTableOrRankName)
    ),
    parentTableName = camelToHuman(databaseParentTableName),
  ] = mappingPathSubset(fieldLabels);

  const fieldNameFormatted = fieldsToHide.has(databaseFieldName)
    ? undefined
    : fieldName;
  // Treat fields whose label is single word as generic
  const fieldIsGeneric =
    (genericFields.has(databaseFieldName) &&
      fieldNameFormatted?.split(' ').length === 1) ||
    (fieldNameFormatted?.split(' ').length === 1 &&
      !nonGenericFields.has(databaseFieldName));
  const tableNameNonEmpty =
    fieldNameFormatted === undefined
      ? tableOrRankName || fieldName
      : fieldIsGeneric
      ? tableOrRankName
      : undefined;
  const tableNameFormatted = tablesToHide.has(databaseTableOrRankName)
    ? [parentTableName || tableNameNonEmpty]
    : genericTables.has(databaseTableOrRankName)
    ? [parentTableName, tableNameNonEmpty]
    : [tableNameNonEmpty];

  return filterArray([
    ...(valueIsTreeRank(databaseTableOrRankName)
      ? [
          databaseTableOrRankName === formatTreeRank(anyTreeRank)
            ? parentTableName
            : tableOrRankName,
        ]
      : tableNameFormatted),
    fieldNameFormatted,
    toManyIndexFormatted,
  ])
    .filter(Boolean)
    .join(' ');
}
