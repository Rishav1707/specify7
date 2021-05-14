/*
 * Utility functions for rendering a Leaflet map
 *
 */

'use strict';

import $ from 'jquery';
import type { IR, RA } from './components/wbplanview';
import {
  coMapTileServers,
  leafletLayersEndpoint,
  leafletTileServers,
} from './leafletconfig';
import L from './leafletextend';
import type { LocalityData } from './leafletutils';

const DEFAULT_ZOOM = 5;

// Try to fetch up-to-date tile servers. If fails, use the default tile servers
let leafletMaps: typeof leafletTileServers | undefined;
export const getLeafletLayers = async (): Promise<typeof leafletTileServers> =>
  typeof leafletMaps === 'undefined'
    ? new Promise(
        (resolve) =>
          void fetch(leafletLayersEndpoint)
            .then(async (response) => response.json())
            .then((response) =>
              resolve(
                (leafletMaps = Object.fromEntries(
                  Object.entries(response).map(([layerGroup, layers]) => [
                    layerGroup,
                    Object.fromEntries(
                      Object.entries(
                        layers as Record<
                          string,
                          {
                            readonly endpoint: string;
                            readonly serverType: 'tileServer' | 'wms';
                            readonly layerOptions: Record<string, unknown>;
                          }
                        >
                      ).map(
                        ([
                          layerName,
                          { endpoint, serverType, layerOptions },
                        ]) => [
                          layerName,
                          (serverType === 'wms'
                            ? L.tileLayer.wms
                            : L.tileLayer)(endpoint, layerOptions),
                        ]
                      )
                    ),
                  ])
                ) as typeof leafletTileServers)
              )
            )
            .catch((error) => {
              console.error(error);
              resolve(leafletTileServers);
            })
      )
    : Promise.resolve(leafletMaps);

export async function showLeafletMap({
  localityPoints = [],
  markerClickCallback,
  leafletMapContainer,
}: {
  readonly localityPoints: RA<LocalityData>;
  readonly markerClickCallback?: () => void;
  readonly leafletMapContainer: string | JQuery<HTMLDivElement> | undefined;
}): Promise<L.Map | undefined> {
  const tileLayers = await getLeafletLayers();

  if (
    typeof leafletMapContainer === 'string' &&
    document.getElementById(leafletMapContainer) !== null
  )
    return undefined;

  if (typeof leafletMapContainer !== 'object')
    leafletMapContainer = $(
      `<div ${
        typeof leafletMapContainer === 'undefined'
          ? ''
          : `id="${leafletMapContainer}"`
      }></div>`
    );

  leafletMapContainer.dialog({
    width: 900,
    height: 600,
    title: 'Leaflet map',
    close() {
      map.remove();
      $(this).remove();
    },
  });

  let defaultCenter: [number, number] = [0, 0];
  let defaultZoom = 1;
  if (localityPoints.length > 0) {
    defaultCenter = [localityPoints[0].latitude1, localityPoints[0].longitude1];
    defaultZoom = DEFAULT_ZOOM;
  }

  const map = L.map(leafletMapContainer[0], {
    layers: [Object.values(tileLayers.baseMaps)[0]],
  }).setView(defaultCenter, defaultZoom);
  const controlLayers = L.control.layers(
    tileLayers.baseMaps,
    tileLayers.overlays
  );
  controlLayers.addTo(map);

  let index = 0;
  addMarkersToMap(
    map,
    controlLayers,
    localityPoints.map((pointDataDict) =>
      getMarkersFromLocalityData({
        localityData: pointDataDict,
        markerClickCallback: markerClickCallback?.bind(undefined, index++),
      })
    )
  );

  addFullScreenButton(map);

  return map;
}

function addFullScreenButton(map: L.Map): void {
  // @ts-expect-error
  L.control.fullScreen = (options: any) => new L.Control.FullScreen(options);
  // @ts-expect-error
  L.control.fullScreen({ position: 'topleft' }).addTo(map);
}

function addDetailsButton(
  container: HTMLDivElement,
  map: L.Map,
  details: string
): Element {
  // @ts-expect-error
  L.control.details = (options) => new L.Control.Details(options);
  // @ts-expect-error
  L.control.details({ position: 'topleft' }).addTo(map);
  const detailsContainer = container.getElementsByClassName(
    'details-container'
  )[0];
  detailsContainer.getElementsByTagName('span')[0].innerHTML = details;
  return detailsContainer;
}

export function addMarkersToMap(
  map: L.Map,
  controlLayers: L.Control.Layers,
  markers: RA<MarkerGroups>,
  layerName = ''
): void {
  if (markers.length === 0) return;

  const cluster = L.markerClusterGroup();
  cluster.addTo(map);
  const markersGroup = L.featureGroup.subGroup(cluster);
  const polygonsGroup = L.featureGroup.subGroup(cluster);
  const polygonBoundaryGroup = L.featureGroup.subGroup(cluster);
  const errorRadiusGroup = L.featureGroup.subGroup(cluster);

  markers.forEach(({ markers, polygons, polygonBoundary, errorRadius }) => {
    ([
      [markers, markersGroup],
      [polygons, polygonsGroup],
      [polygonBoundary, polygonBoundaryGroup],
      [errorRadius, errorRadiusGroup],
    ] as RA<[RA<Marker>, L.FeatureGroup]>).forEach(([markers, markersGroup]) =>
      markers.forEach((marker) => markersGroup.addLayer(marker))
    );
  });

  markersGroup.addTo(map);
  polygonsGroup.addTo(map);
  polygonBoundaryGroup.addTo(map);
  errorRadiusGroup.addTo(map);

  if (layerName !== '') layerName += ' ';

  controlLayers.addOverlay(polygonsGroup, `${layerName} Polygons`);
  controlLayers.addOverlay(
    polygonBoundaryGroup,
    `${layerName} Polygon Boundaries`
  );
  controlLayers.addOverlay(errorRadiusGroup, `${layerName} Error Radius`);
}

function isValidAccuracy(
  latlongaccuracy: string | number | undefined
): boolean {
  try {
    if (
      typeof latlongaccuracy === 'undefined' ||
      (typeof latlongaccuracy === 'number' && latlongaccuracy < 1) ||
      (typeof latlongaccuracy === 'string' &&
        Number.parseFloat(latlongaccuracy) < 1)
    )
      return false;
  } catch {
    return false;
  }
  return true;
}

export type MarkerGroups = {
  readonly markers: L.Marker[];
  readonly polygons: (L.Polygon | L.Polyline)[];
  readonly polygonBoundary: L.Marker[];
  readonly errorRadius: L.Circle[];
};
type Marker = L.Marker | L.Polygon | L.Polyline | L.Circle;

const createLine = (
  coordinate1: [number, number],
  coordinate2: [number, number]
): L.Polyline =>
  new L.Polyline([coordinate1, coordinate2], {
    weight: 3,
    opacity: 0.5,
    smoothFactor: 1,
  });

export function getMarkersFromLocalityData({
  localityData: {
    latitude1,
    longitude1,
    latitude2 = undefined,
    longitude2 = undefined,
    latlongtype = undefined,
    latlongaccuracy = undefined,
    localityname = undefined,
  },
  markerClickCallback,
  iconClass,
}: {
  readonly localityData: LocalityData;
  readonly markerClickCallback?: string | (() => void);
  readonly iconClass?: string;
}): MarkerGroups {
  const markers: MarkerGroups = {
    markers: [],
    polygons: [],
    polygonBoundary: [],
    errorRadius: [],
  };

  if (typeof latitude1 === 'undefined' || typeof 'longitude1' === undefined)
    return markers;

  const icon = new L.Icon.Default();
  if (typeof iconClass !== 'undefined') icon.options.className = iconClass;

  const createPoint = (latitude1: number, longitude1: number): L.Marker =>
    L.marker([latitude1, longitude1], {
      icon,
    });

  if (typeof latitude2 === 'undefined' || typeof longitude2 === 'undefined') {
    // A circle
    if (isValidAccuracy(latlongaccuracy))
      markers.errorRadius.push(
        L.circle([latitude1, longitude1], {
          radius: latlongaccuracy,
        })
      );

    // A point
    markers.markers.push(createPoint(latitude1, longitude1));
  } else {
    markers.polygons.push(
      latlongtype?.toLowerCase() === 'line'
        ? // A line
          createLine([latitude1, longitude1], [latitude2, longitude2])
        : // A polygon
          L.polygon([
            [latitude1, longitude1],
            [latitude2, longitude1],
            [latitude2, longitude2],
            [latitude1, longitude2],
          ])
    );
    markers.polygonBoundary.push(
      createPoint(latitude1, longitude1),
      createPoint(latitude2, longitude2)
    );
  }

  Object.values(markers)
    .flat(2)
    .forEach((vector) => {
      const markerName =
        typeof markerClickCallback === 'string'
          ? markerClickCallback
          : typeof localityname === 'string' && localityname.length > 0
          ? localityname
          : undefined;

      if (typeof markerName !== 'undefined') vector.bindPopup(markerName);
      if (typeof markerClickCallback === 'function')
        vector.on('click', markerClickCallback);
    });

  return markers;
}

export type LayerConfig = {
  readonly transparent: boolean;
  readonly layerLabel: string;
  readonly tileLayer: {
    readonly mapUrl: string;
    readonly options: IR<unknown>;
  };
};

export async function showCOMap(
  mapContainer: Readonly<HTMLDivElement>,
  listOfLayersRaw: RA<LayerConfig>,
  details: string | undefined = undefined
): Promise<[L.Map, L.Control.Layers, HTMLDivElement | undefined]> {
  const tileLayers = await getLeafletLayers();

  const listOfLayers: {
    transparent: boolean;
    layerLabel: string;
    tileLayer: L.TileLayer.WMS | L.TileLayer;
  }[] = [
    ...coMapTileServers.map(({ transparent, layerLabel }) => ({
      transparent,
      layerLabel,
      tileLayer: tileLayers[transparent ? 'overlays' : 'baseMaps'][layerLabel],
    })),
    ...listOfLayersRaw.map(
      ({ transparent, layerLabel, tileLayer: { mapUrl, options } }) => ({
        transparent,
        layerLabel,
        tileLayer: L.tileLayer.wms(mapUrl, options),
      })
    ),
  ];

  const formatLayersDict = (
    listOfLayers: {
      transparent: boolean;
      layerLabel: string;
      tileLayer: L.TileLayer.WMS | L.TileLayer;
    }[]
  ) =>
    Object.fromEntries(
      listOfLayers.map(({ layerLabel, tileLayer }) => [layerLabel, tileLayer])
    );

  const allLayers = Object.values(formatLayersDict(listOfLayers));
  const overlayLayers = formatLayersDict(
    listOfLayers.filter(({ transparent }) => transparent)
  );

  const map = L.map(mapContainer, {
    layers: allLayers,
  }).setView([0, 0], 1);

  const layerGroup = L.control.layers({}, overlayLayers);
  layerGroup.addTo(map);

  addFullScreenButton(map);

  if (typeof details !== 'undefined')
    return [
      map,
      layerGroup,
      addDetailsButton(mapContainer, map, details) as HTMLDivElement,
    ];

  return [map, layerGroup, undefined];
}
