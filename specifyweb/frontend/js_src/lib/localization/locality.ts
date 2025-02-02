/**
 * Localization strings used in Leaflet, GeoLocate and LatLongUI
 *
 * @module
 */

import { createDictionary } from './utils';

// Refer to "Guidelines for Programmers" in ./README.md before editing this file

export const localityText = createDictionary({
  openMap: {
    'en-us': 'Open Map',
    'ru-ru': 'Открыть карту',
    'es-es': 'Abrir mapa',
    'fr-fr': 'Ouvrir la carte',
    'uk-ua': 'Відкрийте карту',
  },
  geoMap: {
    'en-us': 'GeoMap',
    'ru-ru': 'Карта',
    'es-es': 'Geomapa',
    'fr-fr': 'GéoCarte',
    'uk-ua': 'Геокарта',
  },
  queryMapSubset: {
    comment: 'Used in GeoMap header while records are still being fetched',
    'en-us': `
      GeoMap - Plotted {plotted:number|formatted} of {total:number|formatted}
      records
    `,
    'ru-ru': `
      Карта - Отображено {plotted:number|formatted} из {total:number|formatted}
      записей
    `,
    'es-es': `
      GeoMap - Registros trazados {plotted:number|formatted} de
      {total:number|formatted}
    `,
    'fr-fr': `
      GeoMap - Tracé {plotted:number|formatted} de {total:number|formatted}
      enregistrements
    `,
    'uk-ua': `
      GeoMap - нанесено {plotted:number|formatted} із {total:number|formatted}
      записів
    `,
  },
  queryMapAll: {
    'en-us': 'GeoMap - Plotted {plotted:number|formatted} records',
    'ru-ru': 'Карта - Отображено {plotted:number|formatted} записей',
    'es-es': 'GeoMap - Registros trazados {plotted:number|formatted}',
    'fr-fr': 'GeoMap - Enregistrements tracés {plotted:number|formatted}',
    'uk-ua': 'GeoMap - Нанесені записи {plotted:number|formatted}.',
  },
  polygonBoundaries: {
    'en-us': 'Polygon Boundaries',
    'ru-ru': 'Границы многоугольника',
    'es-es': 'Límites de polígono',
    'fr-fr': 'Limites de polygone',
    'uk-ua': 'Межі багатокутників',
  },
  errorRadius: {
    'en-us': 'Error Radius',
    'ru-ru': 'Радиус ошибки',
    'es-es': 'Radio de error',
    'fr-fr': "Rayon d'erreur",
    'uk-ua': 'Радіус помилки',
  },
  showMap: {
    'en-us': 'Show Map',
    'ru-ru': 'Показать карту',
    'es-es': 'Mostrar mapa',
    'fr-fr': 'Afficher la carte',
    'uk-ua': 'Показати карту',
  },
  noCoordinates: {
    'en-us': 'No coordinates',
    'ru-ru': 'Нет координат',
    'es-es': 'sin coordenadas',
    'fr-fr': 'Pas de coordonnées',
    'uk-ua': 'Без координат',
  },
  notEnoughInformationToMap: {
    'en-us': 'Locality must have coordinates to be mapped.',
    'ru-ru': 'Чтобы нанести на карту, необходимо указать координаты.',
    'es-es': 'La localidad debe tener coordenadas para ser mapeada.',
    'fr-fr': 'La localité doit avoir des coordonnées pour être cartographiée.',
    'uk-ua': 'Місцевість повинна мати координати для нанесення на карту.',
  },
  occurrencePoints: {
    'en-us': 'Pins',
    'ru-ru': 'Точки',
    'es-es': 'Patas',
    'fr-fr': 'Épingles',
    'uk-ua': 'Шпильки',
  },
  occurrencePolygons: {
    'en-us': 'Polygons',
    'ru-ru': 'Полигоны',
    'es-es': 'polígonos',
    'fr-fr': 'Polygones',
    'uk-ua': 'Багатокутники',
  },
  geoLocate: {
    'en-us': 'GEOLocate',
    'ru-ru': 'GEOLocate',
    'es-es': 'GEOlocalizar',
    'fr-fr': 'GEOlocaliser',
    'uk-ua': 'GEOLocate',
  },
  geographyRequired: {
    'en-us': 'Geography must be mapped',
    'ru-ru': 'География должна быть связана',
    'es-es': 'La geografía debe ser mapeada',
    'fr-fr': 'La géographie doit être cartographiée',
    'uk-ua': 'Географія повинна бути нанесена на карту',
  },
  geographyRequiredDescription: {
    'en-us':
      'The GeoLocate plugin requires the geography field to be populated.',
    'ru-ru': 'Плагин GeoLocate требует, чтобы поле географии было заполнено.',
    'es-es': `
      El complemento GeoLocate requiere que se complete el campo de geografía.
    `,
    'fr-fr': `
      Le plug-in GeoLocate nécessite que le champ géographique soit renseigné.
    `,
    'uk-ua': 'Плагін GeoLocate вимагає заповнення поля географії.',
  },
  coordinates: {
    'en-us': 'Coordinates',
    'ru-ru': 'Координаты',
    'es-es': 'Coordenadas',
    'fr-fr': 'Coordonnées',
    'uk-ua': 'Координати',
  },
  northWestCorner: {
    comment: 'Represents coordinates. Careful with translation',
    'en-us': 'NW Corner',
    'ru-ru': 'СЗ Угол',
    'es-es': 'Esquina noroeste',
    'fr-fr': 'Coin nord-ouest',
    'uk-ua': 'NW Кут',
  },
  southEastCorner: {
    comment: 'Represents coordinates. Careful with translation',
    'en-us': 'SE Corner',
    'ru-ru': 'ЮВ Угол',
    'es-es': 'Esquina SE',
    'fr-fr': 'Coin SE',
    'uk-ua': 'SE Кут',
  },
  coordinateType: {
    'en-us': 'Coordinate Type',
    'ru-ru': 'Тип координат',
    'es-es': 'Tipo de coordenadas',
    'fr-fr': 'Type de coordonnées',
    'uk-ua': 'Тип координат',
  },
  point: {
    'en-us': 'Point',
    'ru-ru': 'Точка',
    'es-es': 'Punto',
    'fr-fr': 'Point',
    'uk-ua': 'точка',
  },
  line: {
    'en-us': 'Line',
    'ru-ru': 'Линия',
    'es-es': 'Línea',
    'fr-fr': 'La ligne',
    'uk-ua': 'лінія',
  },
  rectangle: {
    'en-us': 'Rectangle',
    'ru-ru': 'Прямоугольник',
    'es-es': 'Rectángulo',
    'fr-fr': 'Rectangle',
    'uk-ua': 'Прямокутник',
  },
  parsed: {
    'en-us': 'Parsed',
    'ru-ru': 'Проверено',
    'es-es': 'analizado',
    'fr-fr': 'analysé',
    'uk-ua': 'Проаналізовано',
  },
  latitude: {
    'en-us': 'Latitude',
    'ru-ru': 'Широта',
    'es-es': 'Latitud',
    'fr-fr': 'Latitude',
    'uk-ua': 'Широта',
  },
  longitude: {
    'en-us': 'Longitude',
    'ru-ru': 'Долгота',
    'es-es': 'Longitud',
    'fr-fr': 'Longitude',
    'uk-ua': 'Довгота',
  },
  toggleFullScreen: {
    'en-us': 'Toggle Full Screen',
    'ru-ru': 'Включить полноэкранный режим',
    'es-es': 'Alternar pantalla completa',
    'fr-fr': 'Basculer en plein écran',
    'uk-ua': 'Перемкнути повний екран',
  },
} as const);
