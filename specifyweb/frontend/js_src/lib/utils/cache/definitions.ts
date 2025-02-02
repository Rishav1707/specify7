/**
 * Typings for the cache categories
 *
 * @module
 */

import type hot from 'handsontable';
import type { State } from 'typesafe-reducer';

import type { AppResourceFilters } from '../../components/AppResources/filtersHelpers';
import type { AppResourcesConformation } from '../../components/AppResources/Aside';
import type { SearchPreferences } from '../../components/WorkBench/AdvancedSearch';
import type {
  Attachment,
  SpQuery,
  Tables,
} from '../../components/DataModel/types';
import type { UserPreferences } from '../../components/UserPreferences/helpers';
import type { Conformations } from '../../components/TreeView/helpers';
import type { IR, RA } from '../types';
import { ensure } from '../types';
import { AnyTree } from '../../components/DataModel/helperTypes';
import {
  LeafletCacheSalt,
  MarkerLayerName,
} from '../../components/Leaflet/addOns';
import { SortConfig } from '../../components/Molecules/Sorting';

/** The types of cached values are defined here */
export type CacheDefinitions = {
  readonly general: {
    readonly clearCacheOnException: boolean;
  };
  readonly forms: {
    readonly readOnlyMode: boolean;
    readonly useFieldLabels: boolean;
  };
  readonly wbPlanViewUi: {
    /** Whether to show less commonly used tables when selected base table */
    readonly showHiddenTables: boolean;
    /** Whether to show fields hidden in schema in the mapper */
    readonly showHiddenFields: boolean;
    /** Whether to show Mapping Editor in the mapper */
    readonly showMappingView: boolean;
    readonly mappingViewHeight: number;
  };
  readonly wbImport: {
    readonly hasHeader: boolean;
  };
  readonly queryBuilder: {
    /** Whether to show fields hidden in schema in the query builder */
    readonly showHiddenFields: boolean;
    readonly showMappingView: boolean;
    readonly mappingViewHeight: number;
  };
  readonly schemaConfig: {
    readonly showHiddenTables: boolean;
  };
  readonly leaflet: {
    readonly /** Remembers the chosen overlays (markers/polygons/boundaries/...) */
    [Property in `show${Capitalize<MarkerLayerName>}`]: boolean;
  } & {
    readonly /** Remembers the selected base layer */
    [Property in `currentLayer${LeafletCacheSalt}`]: string;
  };
  readonly workbench: {
    readonly searchProperties: SearchPreferences;
  };
  readonly tree: {
    readonly /** Open nodes in a given tree */
    [key in `conformations${AnyTree['tableName']}`]: Conformations;
  } & {
    readonly [key in `focusPath${AnyTree['tableName']}`]: RA<number>;
  } & {
    readonly /** Collapsed ranks in a given tree */
    [key in `collapsedRanks${AnyTree['tableName']}`]: RA<number>;
  };
  readonly workBenchSortConfig: {
    readonly /**
     * WorkBench column sort setting in a given dataset
     * {Collection ID}_{Dataset ID}
     */
    [key in `${number}_${number}`]: RA<hot.columnSorting.Config>;
  };
  readonly sortConfig: {
    readonly [KEY in keyof SortConfigs]: SortConfig<SortConfigs[KEY]>;
  };
  readonly attachments: {
    readonly sortOrder:
      | `-${string & keyof Attachment['fields']}`
      | (string & keyof Attachment['fields']);
    readonly filter:
      | State<'all'>
      | State<'byTable', { readonly tableName: keyof Tables }>
      | State<'unused'>;
    /** Attachments grid scale */
    readonly scale: number;
  };
  readonly geoLocate: {
    /** Remember dialog window dimentions from the last session */
    readonly width: number;
    readonly height: number;
  };
  readonly userPreferences: {
    /**
     * User preferences are cached here, because, unlike most other initial
     * context resources, preferences are not cached by the browser, since they
     * are fetched using the standard resource API.
     * Additionally, since preferences contain the schema language to load,
     * schema can not be fetched until preferences are fetched.
     * Finally, a splash screen may be rendered before preferences are fetched,
     * causing Specify to flash user its white mode, or font size to change
     * on the fly.
     */
    readonly cached: UserPreferences;
    /**
     * Admins may change default preferences. These defaults override original
     * defaults for items for which these are provided
     */
    readonly defaultCached: UserPreferences;
  };
  readonly securityTool: {
    readonly policiesLayout: 'horizontal' | 'vertical';
    readonly previewCollapsed: boolean;
    readonly advancedPreviewCollapsed: boolean;
    readonly institutionPoliciesExpanded: boolean;
  };
  readonly appResources: {
    readonly conformation: RA<AppResourcesConformation>;
    readonly filters: AppResourceFilters;
  };
};

export type SortConfigs = {
  readonly listOfQueries: keyof SpQuery['fields'] &
    ('name' | 'timestampCreated' | 'timestampModified');
  readonly listOfRecordSets: 'name' | 'timestampCreated';
  readonly listOfDataSets: 'dateCreated' | 'dateUploaded' | 'name';
  readonly listOfReports: 'name' | 'timestampCreated';
  readonly listOfLabels: 'name' | 'timestampCreated';
  readonly dataModelFields:
    | 'databaseColumn'
    | 'description'
    | 'isHidden'
    | 'isReadOnly'
    | 'isRequired'
    | 'label'
    | 'length'
    | 'name'
    | 'type';
  readonly dataModelRelationships:
    | 'databaseColumn'
    | 'description'
    | 'isDependent'
    | 'isHidden'
    | 'isReadOnly'
    | 'isRequired'
    | 'label'
    | 'name'
    | 'otherSideName'
    | 'relatedModel'
    | 'type';
  readonly dataModelTables:
    | 'fieldCount'
    | 'isHidden'
    | 'isSystem'
    | 'label'
    | 'name'
    | 'relationshipCount'
    | 'tableId';
};

const cacheDefinitions = {} as unknown as CacheDefinitions;

// Some circular types can't be expressed without interfaces
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface CacheValueDict extends IR<CacheValue> {}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface CacheValues extends RA<CacheValue> {}

type CacheValue =
  | CacheValueDict
  | CacheValues
  | boolean
  | number
  | string
  | null
  | undefined;
/**
 * This will trigger a TypeScript type error if any cache definition
 * contains a value that is not JSON-Serializable.
 */
ensure<IR<IR<CacheValue>>>()(cacheDefinitions);
