/**
 * Converts XML form and formTable definitions to JSON, while also
 * adding type safety and strictness to help resolve ambiguities
 */

import { ajax } from '../../utils/ajax';
import { f } from '../../utils/functools';
import type { IR, R, RA } from '../../utils/types';
import { defined, filterArray } from '../../utils/types';
import { getParsedAttribute } from '../../utils/utils';
import { parseXml } from '../AppResources/codeMirrorLinters';
import { parseJavaClassName } from '../DataModel/resource';
import { strictGetModel } from '../DataModel/schema';
import type { SpecifyModel } from '../DataModel/specifyModel';
import { error } from '../Errors/assert';
import { cachableUrl } from '../InitialContext';
import { getPref } from '../InitialContext/remotePrefs';
import { formatUrl } from '../Router/queryString';
import type { FormCellDefinition } from './cells';
import { parseFormCell, processColumnDefinition } from './cells';
import { postProcessFormDef } from './postProcessFormDef';
import { Http } from '../../utils/ajax/definitions';
import { webOnlyViews } from './webOnlyViews';
import { LocalizedString } from 'typesafe-i18n';

export type ViewDescription = ParsedFormDefinition & {
  readonly formType: FormType;
  readonly mode: FormMode;
  readonly model: SpecifyModel | undefined;
  readonly viewSetId?: number;
};

type AltView = {
  readonly default?: 'false' | 'true';
  readonly mode: FormMode;
  readonly name: string;
  readonly viewdef: string;
};

export type ViewDefinition = {
  readonly altviews: IR<AltView>;
  readonly busrules: string;
  readonly class: string;
  readonly name: string;
  readonly resourcelabels: 'false' | 'true';
  readonly viewdefs: IR<string>;
  readonly viewsetLevel: string;
  readonly viewsetName: string;
  readonly viewsetSource: string;
  readonly viewsetId: number | null;
};

export const formTypes = ['form', 'formTable'] as const;
export type FormType = typeof formTypes[number];
export type FormMode = 'edit' | 'search' | 'view';

const views: R<ViewDefinition | undefined> = {};
export const fetchView = async (
  name: string
): Promise<ViewDefinition | undefined> =>
  name in views
    ? Promise.resolve(views[name])
    : ajax<string>(
        /*
         * NOTE: If getView hasn't yet been invoked, the view URLs won't be
         * marked as cachable
         */
        cachableUrl(
          formatUrl('/context/view.json', {
            name,
            // Don't spam the console with errors needlessly
            ...(name in webOnlyViews() ? { quiet: '' } : {}),
          })
        ),
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          headers: { Accept: 'text/plain' },
        },
        {
          expectedResponseCodes: [Http.OK, Http.NOT_FOUND, Http.NO_CONTENT],
        }
      ).then(({ data, status }) => {
        views[name] =
          status === Http.NOT_FOUND || status === Http.NO_CONTENT
            ? undefined
            : (JSON.parse(data) as ViewDefinition);
        return views[name];
      });

export function parseViewDefinition(
  view: ViewDefinition,
  defaultType: FormType,
  originalMode: FormMode
): ViewDescription | undefined {
  const resolved = resolveViewDefinition(view, defaultType, originalMode);
  if (resolved === undefined) return undefined;
  const { mode, formType, viewDefinition, model } = resolved;
  const parser =
    formType === 'formTable' ? parseFormTableDefinition : parseFormDefinition;
  return {
    mode,
    formType,
    model,
    viewSetId: view.viewsetId ?? undefined,
    ...parser(viewDefinition, model),
  };
}

export function resolveViewDefinition(
  view: ViewDefinition,
  formType: FormType,
  mode: FormMode
):
  | {
      readonly viewDefinition: Element;
      readonly formType: FormType;
      readonly mode: FormMode;
      readonly model: SpecifyModel;
    }
  | undefined {
  const viewDefinitions = parseViewDefinitions(view.viewdefs);
  if (Object.keys(viewDefinitions).length === 0) {
    console.error(`No view definitions found for the ${view.name} view`);
    return undefined;
  }

  const { altView, viewDefinition } = resolveAltView(
    view.altviews,
    viewDefinitions,
    formType,
    mode
  );

  const definition =
    viewDefinition?.getElementsByTagName('definition')[0]?.textContent;
  const actualViewDefinition =
    typeof definition === 'string'
      ? viewDefinitions[definition]
      : viewDefinition;

  if (actualViewDefinition === undefined) return undefined;

  const newFormType = getParsedAttribute(viewDefinition, 'type');
  const modelName = parseJavaClassName(
    defined(
      getParsedAttribute(actualViewDefinition, 'class'),
      'Form definition does not contain a class attribute'
    )
  );
  return {
    viewDefinition: actualViewDefinition,
    formType:
      formType === 'formTable'
        ? 'formTable'
        : formTypes.find(
            (type) => type.toLowerCase() === newFormType?.toLowerCase()
          ) ?? 'form',
    mode: mode === 'search' ? mode : altView.mode,
    model: strictGetModel(
      modelName === 'ObjectAttachmentIFace' ? 'Attachment' : modelName
    ),
  };
}

const parseViewDefinitions = (
  viewDefinitions: ViewDefinition['viewdefs']
): IR<Element> =>
  Object.fromEntries(
    Object.entries(viewDefinitions).map(([name, xml]) => {
      const parsed = parseXml(xml);
      if (typeof parsed === 'string')
        error(`Failed parsing XML for view definition`, {
          error: parsed,
          xml,
        });
      return [
        name,
        defined(
          parsed.querySelector('viewdef') ?? undefined,
          `Unable to find a <viewdef> tag for a ${name} view definition`
        ),
      ];
    })
  );

function resolveAltView(
  rawAltViews: ViewDefinition['altviews'],
  viewDefinitions: IR<Element>,
  formType: FormType,
  mode: FormMode
): {
  readonly altView: ViewDefinition['altviews'][number];
  readonly viewDefinition: Element;
} {
  let altViews: RA<AltView> = Object.values(rawAltViews).filter(
    (altView) => altView.mode === mode
  );
  if (altViews.length === 0) altViews = Object.values(rawAltViews);

  let viewDefinition: Element | undefined = undefined;
  let altView = altViews.find((altView) => {
    viewDefinition = viewDefinitions[altView.viewdef];
    return (
      typeof viewDefinition === 'object' &&
      getParsedAttribute(viewDefinition, 'type')?.toLowerCase() ===
        formType.toLowerCase()
    );
  });
  if (altView === undefined || viewDefinition === undefined) {
    console.error('No altView for defaultType:', formType);
    altView = altViews[0];
    viewDefinition = viewDefinitions[altView.viewdef];
  }
  return { altView, viewDefinition };
}

export type ParsedFormDefinition = {
  // Define column sizes: either a number of pixels, or undefined for auto sizing
  readonly columns: RA<number | undefined>;
  // A two-dimensional grid of cells
  readonly rows: RA<RA<FormCellDefinition>>;
};

function parseFormTableDefinition(
  viewDefinition: Element,
  model: SpecifyModel | undefined
): ParsedFormDefinition {
  const { rows } = parseFormDefinition(viewDefinition, model);
  const labelsForCells = Object.fromEntries(
    filterArray(
      rows
        .flat()
        .map((cell) =>
          cell.type === 'Label' && typeof cell.labelForCellId === 'string'
            ? [cell.labelForCellId, cell]
            : undefined
        )
    )
  );
  const row = rows
    .flat()
    // FormTable consists of Fields and SubViews only
    .filter(({ type }) => type === 'Field' || type === 'SubView')
    .map<FormCellDefinition>((cell) => ({
      ...cell,
      // Center all fields in each column
      align: 'center' as const,
      // Make sure SubViews are rendered as buttons
      ...(cell.type === 'SubView' ? { isButton: true } : {}),
      // Set ariaLabel for all cells (would be used in formTable headers)
      ariaLabel:
        cell.ariaLabel ??
        (cell.type === 'Field' && cell.fieldDefinition.type === 'Checkbox'
          ? cell.fieldDefinition.label
          : undefined) ??
        labelsForCells[cell.id ?? '']?.text ??
        (cell.type === 'Field' || cell.type === 'SubView'
          ? model?.getField(cell.fieldName ?? '')?.label ??
            (cell.fieldName as LocalizedString)
          : undefined),
      // Remove labels from checkboxes (as labels would be in the table header)
      ...(cell.type === 'Field' && cell.fieldDefinition.type === 'Checkbox'
        ? { fieldDefinition: { ...cell.fieldDefinition, label: undefined } }
        : {}),
    }));

  return {
    columns: parseFormTableColumns(viewDefinition, row),
    rows: [row],
  };
}

function parseFormTableColumns(
  viewDefinition: Element,
  row: RA<FormCellDefinition>
): RA<number | undefined> {
  const columnCount = f.sum(row.map(({ colSpan }) => colSpan));
  const rawColumnDefinition = f.maybe(
    getColumnDefinition(viewDefinition, 'table'),
    processColumnDefinition
  );
  return [
    ...(rawColumnDefinition ?? []),
    ...Array.from({
      length: columnCount - (rawColumnDefinition ?? []).length,
    }).fill(undefined),
  ];
}

/**
 * Can't use querySelectorAll here because it is not supported in JSDom
 * See https://github.com/jsdom/jsdom/issues/2998
 */
export const parseFormDefinition = (
  viewDefinition: Element,
  model: SpecifyModel | undefined
): ParsedFormDefinition =>
  postProcessFormDef(
    processColumnDefinition(getColumnDefinitions(viewDefinition)),
    Array.from(
      Array.from(viewDefinition.children).find(
        ({ tagName }) => tagName === 'rows'
      )?.children ?? []
    )
      .filter(({ tagName }) => tagName === 'row')
      .map((row) =>
        Array.from(row.children)
          .filter(({ tagName }) => tagName === 'cell')
          .map((cell) => parseFormCell(model, cell))
      ),
    model
  );

function getColumnDefinitions(viewDefinition: Element): string {
  const definition =
    getColumnDefinition(
      viewDefinition,
      getPref('form.definition.columnSource')
    ) ?? getColumnDefinition(viewDefinition, undefined);
  return defined(
    definition ?? getParsedAttribute(viewDefinition, 'colDef'),
    'Form definition does not contain column definition'
  );
}

const getColumnDefinition = (
  viewDefinition: Element,
  os: string | undefined
): string | undefined =>
  viewDefinition.querySelector(
    `columnDef${typeof os === 'string' ? `[os="${os}"]` : ''}`
  )?.textContent ?? undefined;

export const exportsForTests = {
  views,
  fetchView,
  parseViewDefinitions,
  resolveAltView,
  parseFormTableDefinition,
  parseFormTableColumns,
  getColumnDefinitions,
  getColumnDefinition,
};
