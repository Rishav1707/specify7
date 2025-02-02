import type L from 'leaflet';
import React from 'react';

import { useBooleanState } from '../../hooks/useBooleanState';
import { eventListener } from '../../utils/events';
import { f } from '../../utils/functools';
import type { RA, WritableArray } from '../../utils/types';
import { filterArray } from '../../utils/types';
import { Progress } from '../Atoms';
import { Button } from '../Atoms/Button';
import { schema } from '../DataModel/schema';
import type { SpecifyModel } from '../DataModel/specifyModel';
import type { Tables } from '../DataModel/types';
import { softFail } from '../Errors/Crash';
import { formatLocalityData, getMarkersFromLocalityData } from '../Leaflet';
import type { LeafletInstance } from '../Leaflet/addOns';
import { queryMappingLocalityColumns } from '../Leaflet/config';
import type { LocalityData } from '../Leaflet/helpers';
import {
  fetchLocalityDataFromResource,
  formatLocalityDataObject,
} from '../Leaflet/localityRecordDataExtractor';
import { findLocalityColumnsInDataSet } from '../Leaflet/wbLocalityDataExtractor';
import { LoadingScreen } from '../Molecules/Dialog';
import { LeafletMap } from '../Leaflet/Map';
import { defaultColumnOptions } from '../WbPlanView/linesGetter';
import type { SplitMappingPath } from '../WbPlanView/mappingHelpers';
import {
  mappingPathToString,
  splitJoinedMappingPath,
} from '../WbPlanView/mappingHelpers';
import type { QueryFieldSpec } from './fieldSpec';
import type { QueryResultRow } from './Results';
import { queryIdField } from './Results';
import { getResourceViewUrl } from '../DataModel/resource';
import { localityText } from '../../localization/locality';

export function QueryToMap({
  results,
  totalCount,
  selectedRows,
  model,
  fieldSpecs,
  onFetchMore: handleFetchMore,
}: {
  readonly results: RA<QueryResultRow>;
  readonly totalCount: number | undefined;
  readonly selectedRows: ReadonlySet<number>;
  readonly model: SpecifyModel;
  readonly fieldSpecs: RA<QueryFieldSpec>;
  readonly onFetchMore: (() => Promise<RA<QueryResultRow> | void>) | undefined;
}): JSX.Element | null {
  const [isOpen, handleOpen, handleClose] = useBooleanState();
  const ids = useSelectedResults(results, selectedRows);
  const localityMappings = useLocalityMappings(model.name, fieldSpecs);
  return localityMappings.length === 0 ? null : (
    <>
      <Button.Small disabled={results.length === 0} onClick={handleOpen}>
        {localityText.geoMap()}
      </Button.Small>
      {isOpen && ids.length > 0 ? (
        <Dialog
          localityMappings={localityMappings}
          results={results}
          totalCount={totalCount}
          tableName={model.name}
          onClose={handleClose}
          onFetchMore={selectedRows.size > 0 ? undefined : handleFetchMore}
        />
      ) : undefined}
    </>
  );
}

function useSelectedResults(
  results: RA<QueryResultRow | undefined>,
  selectedRows: ReadonlySet<number>
): RA<QueryResultRow | undefined> {
  return React.useMemo(
    () =>
      selectedRows.size === 0
        ? results
        : results.filter((result) =>
            f.has(selectedRows, result?.[queryIdField])
          ),
    [results, selectedRows]
  );
}

type LocalityColumn = {
  readonly localityColumn: string;
  readonly columnIndex: number;
};

function useLocalityMappings(
  tableName: keyof Tables,
  fieldSpecs: RA<QueryFieldSpec>
): RA<RA<LocalityColumn>> {
  return React.useMemo(() => {
    const splitPaths = fieldSpecsToMappingPaths(fieldSpecs);
    const mappingPaths = splitPaths.map(({ mappingPath }) =>
      mappingPathToString(mappingPath)
    );
    return findLocalityColumnsInDataSet(tableName, splitPaths).map(
      (localityColumns) => {
        const mapped = Object.entries(localityColumns)
          .filter(([key]) => queryMappingLocalityColumns.includes(key))
          .map(([localityColumn, mapping]) => {
            const pathToLocalityField = splitJoinedMappingPath(localityColumn);
            if (pathToLocalityField.length !== 2)
              throw new Error('Only direct locality fields are supported');
            const fieldName = pathToLocalityField.at(-1)!;
            return {
              localityColumn: fieldName,
              columnIndex: mappingPaths.indexOf(mapping),
            };
          });

        const basePath = splitJoinedMappingPath(
          localityColumns['locality.longitude1']
        ).slice(0, -1);
        const idPath = mappingPathToString([...basePath, 'localityId']);
        return [
          ...mapped,
          {
            localityColumn: 'localityId',
            columnIndex: mappingPaths.indexOf(idPath),
          },
        ];
      }
    );
  }, [tableName, fieldSpecs]);
}

const fieldSpecsToMappingPaths = (
  fieldSpecs: RA<QueryFieldSpec>
): RA<SplitMappingPath> =>
  fieldSpecs
    .map((fieldSpec) => fieldSpec.toMappingPath())
    .map((mappingPath) => ({
      headerName: mappingPathToString(mappingPath),
      mappingPath,
      columnOptions: defaultColumnOptions,
    }));

type LocalityDataWithId = {
  readonly recordId: number;
  readonly localityId: number;
  readonly localityData: LocalityData;
};

function Dialog({
  results,
  totalCount,
  localityMappings,
  tableName,
  onClose: handleClose,
  onFetchMore: handleFetchMore,
}: {
  readonly results: RA<QueryResultRow>;
  readonly totalCount: number | undefined;
  readonly localityMappings: RA<RA<LocalityColumn>>;
  readonly tableName: keyof Tables;
  readonly onClose: () => void;
  readonly onFetchMore: (() => Promise<RA<QueryResultRow> | void>) | undefined;
}): JSX.Element {
  const [map, setMap] = React.useState<LeafletInstance | null>(null);
  const localityData = React.useRef<RA<LocalityDataWithId>>([]);
  const [initialData, setInitialData] = React.useState<
    | {
        readonly localityData: RA<LocalityData>;
        readonly onClick: ReturnType<typeof createClickCallback>;
      }
    | undefined
  >(undefined);

  const markerEvents = React.useMemo(
    () => eventListener<{ readonly updated: undefined }>(),
    []
  );

  const handleAddPoints = React.useCallback(
    (results: RA<QueryResultRow>) => {
      /*
       * Need to add markers into queue rather than directly to the map because
       * the map might not be initialized yet (the map is only initialized after
       * some markers are fetched, so that it can open to correct position)
       */
      localityData.current = [
        ...localityData.current,
        ...extractLocalities(results, localityMappings),
      ];
      setInitialData((initialData) =>
        typeof initialData === 'object'
          ? initialData
          : {
              localityData: localityData.current.map(
                ({ localityData }) => localityData
              ),
              onClick: createClickCallback(tableName, localityData.current),
            }
      );
      markerEvents.trigger('updated');
    },
    [tableName, localityMappings, markerEvents]
  );

  // Add initial results
  React.useEffect(() => handleAddPoints(results), [handleAddPoints]);
  useFetchLoop(handleFetchMore, handleAddPoints);

  React.useEffect(() => {
    if (map === null) return undefined;

    function emptyQueue(): void {
      if (map === null) return;
      addLeafletMarkers(tableName, map, localityData.current);
      localityData.current = [];
    }

    return markerEvents.on('updated', emptyQueue, true);
  }, [tableName, map, markerEvents]);

  return typeof initialData === 'object' ? (
    <LeafletMap
      /*
       * This will only add initial locality data
       * That is needed so that the map can zoom in to correct place
       */
      forwardRef={setMap}
      header={
        typeof totalCount === 'number'
          ? results.length === totalCount
            ? localityText.queryMapAll({
                plotted: results.length,
              })
            : localityText.queryMapSubset({
                plotted: results.length,
                total: totalCount,
              })
          : localityText.geoMap()
      }
      headerButtons={
        typeof totalCount === 'number' && totalCount !== results.length ? (
          <Progress
            className="flex-1"
            aria-hidden
            max={totalCount}
            value={results.length}
          />
        ) : undefined
      }
      localityPoints={initialData.localityData}
      onClose={handleClose}
      onMarkerClick={initialData.onClick}
    />
  ) : (
    <LoadingScreen />
  );
}

const extractLocalities = (
  results: RA<QueryResultRow>,
  localityMappings: RA<RA<LocalityColumn>>
): RA<LocalityDataWithId> =>
  filterArray(
    results.flatMap((row) =>
      localityMappings.map((mappings) => {
        const fields = mappings.map(
          ({ localityColumn, columnIndex }) =>
            [
              [localityColumn],
              // "+1" is to compensate for queryIdField
              row[columnIndex + 1]?.toString() ?? null,
            ] as const
        );
        const localityData = formatLocalityDataObject(fields);
        const localityId = f.parseInt(
          fields.find(
            ([localityColumn]) => localityColumn[0] === 'localityId'
          )?.[1] ?? undefined
        );
        return localityData === false || typeof localityId !== 'number'
          ? undefined
          : { recordId: row[queryIdField] as number, localityId, localityData };
      })
    )
  );

function createClickCallback(
  tableName: keyof Tables,
  points: RA<LocalityDataWithId>
): (index: number, event: L.LeafletEvent) => Promise<void> {
  const fullLocalityData: WritableArray<LocalityData | false | undefined> = [];

  return async (index, { target: marker }): Promise<void> => {
    const resource = new schema.models.Locality.Resource({
      id: points[index].localityId,
    });
    fullLocalityData[index] ??= await fetchLocalityDataFromResource(resource);
    const localityData = fullLocalityData[index];
    if (localityData !== false)
      (marker as L.Marker)
        .getPopup()
        ?.setContent(
          formatLocalityData(
            localityData!,
            getResourceViewUrl(tableName, points[index].recordId),
            true
          )
        );
  };
}

function addLeafletMarkers(
  tableName: keyof Tables,
  map: LeafletInstance,
  points: RA<LocalityDataWithId>
): void {
  if (points.length === 0) return;

  const handleMarkerClick = createClickCallback(tableName, points);

  const markers = points.map(({ localityData }, index) =>
    getMarkersFromLocalityData({
      localityData,
      onMarkerClick: handleMarkerClick.bind(undefined, index),
    })
  );

  map.addMarkers(markers);
}

/**
 * Fetch query results until all are fetched
 */
function useFetchLoop(
  handleFetchMore: (() => Promise<RA<QueryResultRow> | void>) | undefined,
  handleAdd: (results: RA<QueryResultRow>) => void
): void {
  const [lastResults, setLastResults] =
    React.useState<RA<QueryResultRow> | void>(undefined);
  React.useEffect(
    () =>
      void handleFetchMore?.()
        .then((results) => {
          setLastResults(results);
          f.maybe(results, handleAdd);
        })
        .catch(softFail),
    [handleFetchMore, handleAdd, lastResults]
  );
}
