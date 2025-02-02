/**
 * Various icons
 *
 * Icons are stored in https://github.com/specify/specify6/tree/master/src/edu/ku/brc/specify/images
 */

import { load } from './index';
import type { RA } from '../../utils/types';

const iconGroups = {} as Record<IconGroup, Document>;

export const fetchContext = Promise.all(
  Object.entries({
    /**
     * These files are defined in Specify 6 code here:
     * https://github.com/specify/specify6/blob/master/config/
     */
    datamodel: 'icons_datamodel.xml',
    discipline: 'icons_disciplines.xml',
    imgproc: 'icons_imgproc.xml',
    plugin: 'icons_plugins.xml',
    default: 'icons.xml',
  }).map(async ([iconGroup, fileName]) =>
    load<Document>(`/static/config/${fileName}`, 'text/xml').then((xml) => {
      iconGroups[iconGroup] = xml;
    })
  )
);

type IconGroup = keyof typeof iconDirectories;

const iconDirectories = {
  datamodel: '/images/datamodel/',
  discipline: '/images/discipline/',
  imgproc: '/images/imgproc/',
  plugin: '/images/',
  default: '/images/',
};

export const unknownIcon = '/images/unknown.png';

export function getIcon(icon: string): string | undefined {
  for (const [group, xml] of Object.entries(iconGroups)) {
    const iconFile = findIconInXml(icon, xml)?.getAttribute('file');
    if (typeof iconFile === 'string')
      return `${iconDirectories[group]}${iconFile}`;
  }
  return undefined;
}

function findIconInXml(
  icon: string,
  xml: Document,
  cycleDetect: RA<string> = []
): Element | undefined {
  if (cycleDetect.includes(icon))
    throw new Error('Circular reference in icon definitions');
  const iconNode = xml.querySelector(`icon[name="${icon}"]`);
  const alias = iconNode?.getAttribute('alias');
  return typeof alias === 'string'
    ? findIconInXml(alias, xml, [...cycleDetect, icon])
    : iconNode ?? undefined;
}
