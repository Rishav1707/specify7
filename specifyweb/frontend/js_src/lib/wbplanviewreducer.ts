import type {
  PartialWBPlanViewProps,
  PublicWBPlanViewProps,
  WBPlanViewWrapperProps,
} from './components/wbplanview';
import type {
  AutomapperSuggestion,
  MappingLine,
  MappingPath,
  SelectElementPosition,
} from './components/wbplanviewmapper';
import type {
  MappingState,
  WBPlanViewStates,
} from './components/wbplanviewstatereducer';
import {
  getDefaultMappingState,
  mappingState,
} from './components/wbplanviewstatereducer';
import schema from './schema';
import type { Action } from './statemanagement';
import { generateReducer } from './statemanagement';
import type { MatchBehaviors, UploadPlan } from './uploadplantomappingstree';
import * as cache from './wbplanviewcache';
import {
  defaultLineOptions,
  getLinesFromHeaders,
  getLinesFromUploadPlan,
} from './wbplanviewlinesgetter';
import dataModelStorage from './wbplanviewmodel';
import { getMappingLineData } from './wbplanviewnavigator';
import {
  deduplicateMappings,
  getAutomapperSuggestions,
  goBack,
  mappingPathIsComplete,
  mutateMappingPath,
  savePlan,
  validate,
} from './wbplanviewutils';

const modifyLine = (
  state: MappingState,
  line: number,
  mappingLine: Partial<MappingLine>
): MappingLine[] => [
  ...state.lines.slice(0, line),
  {
    ...state.lines[line],
    ...mappingLine,
  },
  ...state.lines.slice(line + 1),
];

// Actions
interface OpenBaseTableSelectionAction
  extends Action<'OpenBaseTableSelectionAction'> {
  referrer?: WBPlanViewStates['type'];
}

interface SelectTableAction extends Action<'SelectTableAction'> {
  readonly tableName: string;
  readonly mappingIsTemplated: boolean;
  readonly headers: string[];
}

type ToggleHiddenTablesAction = Action<'ToggleHiddenTablesAction'>;

interface UseTemplateAction extends Action<'UseTemplateAction'> {
  readonly dispatch: (action: WBPlanViewActions) => void;
}

type BaseTableSelectionActions =
  | OpenBaseTableSelectionAction
  | SelectTableAction
  | ToggleHiddenTablesAction
  | UseTemplateAction;

type CancelTemplateSelectionAction = Action<'CancelTemplateSelectionAction'>;

interface TemplatesLoadedAction extends Action<'TemplatesLoadedAction'> {
  readonly templates: {
    datasetName: string;
    uploadPlan: UploadPlan;
  }[];
}

type TemplateSelectionActions =
  | TemplatesLoadedAction
  | CancelTemplateSelectionAction;

type CancelMappingAction = Action<'CancelMappingAction'> &
  PublicWBPlanViewProps &
  PartialWBPlanViewProps;

type CommonActions = CancelMappingAction;

export interface OpenMappingScreenAction
  extends Action<'OpenMappingScreenAction'> {
  readonly mappingIsTemplated: boolean;
  readonly headers: string[];
  readonly uploadPlan: UploadPlan | null;
}

interface SavePlanAction
  extends Action<'SavePlanAction'>,
    WBPlanViewWrapperProps,
    PublicWBPlanViewProps {
  readonly ignoreValidation?: boolean;
}

interface ToggleMappingViewAction extends Action<'ToggleMappingViewAction'> {
  readonly isVisible: boolean;
}

type ToggleMappingIsTemplatedAction = Action<'ToggleMappingIsTemplatedAction'>;

type ToggleHiddenFieldsAction = Action<'ToggleHiddenFieldsAction'>;

type ResetMappingsAction = Action<'ResetMappingsAction'>;

type ValidationAction = Action<'ValidationAction'>;

interface ClearMappingLineAction extends Action<'ClearMappingLineAction'> {
  readonly line: number;
}

interface FocusLineAction extends Action<'FocusLineAction'> {
  readonly line: number;
}

type MappingViewMapAction = Action<'MappingViewMapAction'>;

type AddNewHeaderAction = Action<'AddNewHeaderAction'>;

type OpenSelectElementAction = Action<'OpenSelectElementAction'> &
  SelectElementPosition;

type CloseSelectElementAction = Action<'CloseSelectElementAction'>;

export interface ChangeSelectElementValueAction
  extends Action<'ChangeSelectElementValueAction'> {
  readonly value: string;
  readonly isRelationship: boolean;
  readonly line: number | 'mappingView';
  readonly index: number;
  readonly currentTableName: string;
  readonly newTableName: string;
}

interface AutomapperSuggestionsLoadedAction
  extends Action<'AutomapperSuggestionsLoadedAction'> {
  readonly automapperSuggestions: AutomapperSuggestion[];
}

interface AutomapperSuggestionSelectedAction
  extends Action<'AutomapperSuggestionSelectedAction'> {
  readonly suggestion: string;
}

interface ValidationResultClickAction
  extends Action<'ValidationResultClickAction'> {
  readonly mappingPath: MappingPath;
}

type OpenMatchingLogicDialogAction = Action<'OpenMatchingLogicDialogAction'>;

type CloseMatchingLogicDialogAction = Action<'CloseMatchingLogicDialogAction'>;

interface MustMatchPrefChangeAction
  extends Action<'MustMatchPrefChangeAction'> {
  readonly tableName: string;
  readonly mustMatch: boolean;
}

interface ChangeMatchBehaviorAction
  extends Action<'ChangeMatchBehaviorAction'> {
  readonly line: number;
  readonly matchBehavior: MatchBehaviors;
}

interface ToggleAllowNullsAction extends Action<'ToggleAllowNullsAction'> {
  readonly line: number;
  readonly allowNull: boolean;
}

interface ChangeDefaultValue extends Action<'ChangeDefaultValue'> {
  readonly line: number;
  readonly defaultValue: string | null;
}

export type MappingActions =
  | OpenMappingScreenAction
  | SavePlanAction
  | ToggleMappingViewAction
  | ToggleMappingIsTemplatedAction
  | ToggleHiddenFieldsAction
  | ResetMappingsAction
  | ValidationAction
  | ClearMappingLineAction
  | FocusLineAction
  | MappingViewMapAction
  | AddNewHeaderAction
  | OpenSelectElementAction
  | CloseSelectElementAction
  | ChangeSelectElementValueAction
  | AutomapperSuggestionsLoadedAction
  | AutomapperSuggestionSelectedAction
  | ValidationResultClickAction
  | OpenMatchingLogicDialogAction
  | MustMatchPrefChangeAction
  | CloseMatchingLogicDialogAction
  | ChangeMatchBehaviorAction
  | ToggleAllowNullsAction
  | ChangeDefaultValue;

export type WBPlanViewActions =
  | BaseTableSelectionActions
  | TemplateSelectionActions
  | CommonActions
  | MappingActions;

export const reducer = generateReducer<WBPlanViewStates, WBPlanViewActions>({
  // BaseTableSelectionState
  OpenBaseTableSelectionAction: ({ state, action }) =>
    !action.referrer || action.referrer === state.type
      ? {
          type: 'BaseTableSelectionState',
          showHiddenTables: cache.get<boolean>('ui', 'showHiddenTables'),
        }
      : state,
  SelectTableAction: ({ action }) => ({
    ...getDefaultMappingState(),
    mappingIsTemplated: action.mappingIsTemplated,
    baseTableName: action.tableName,
    lines: getLinesFromHeaders({
      headers: action.headers,
      runAutomapper: true,
      baseTableName: action.tableName,
    }),
  }),
  ToggleHiddenTablesAction: ({ state }) => ({
    ...state,
    showHiddenTables: cache.set(
      'ui',
      'showHiddenTables',
      'showHiddenTables' in state ? !state.showHiddenTables : false,
      {
        overwrite: true,
        priorityCommit: true,
      }
    ),
  }),
  UseTemplateAction: ({ action }) => ({
    type: 'LoadingState',
    loadingState: {
      type: 'LoadTemplateSelectionState',
      dispatchAction: action.dispatch,
    },
  }),

  // TemplateSelectionState
  TemplatesLoadedAction: ({ action }) => ({
    type: 'TemplateSelectionState',
    templates: action.templates,
  }),
  CancelTemplateSelectionAction: () => ({
    type: 'BaseTableSelectionState',
    showHiddenTables: cache.get<boolean>('ui', 'showHiddenTables'),
  }),

  // Common
  CancelMappingAction: ({ state, action }) => {
    goBack(action);
    return state;
  },

  // MappingState
  OpenMappingScreenAction: ({ action }) => {
    if (!action.uploadPlan) throw new Error('Upload plan is not defined');

    const {
      baseTableName,
      lines,
      mustMatchPreferences,
    } = getLinesFromUploadPlan(action.headers, action.uploadPlan);
    const newState: MappingState = {
      ...getDefaultMappingState(),
      mappingIsTemplated: action.mappingIsTemplated,
      mustMatchPreferences,
      baseTableName,
      lines,
    };

    if (newState.lines.some(({ mappingPath }) => mappingPath.length === 0))
      throw new Error('Mapping Path is invalid');

    return newState;
  },
  SavePlanAction: ({ state, action }) =>
    savePlan(action, mappingState(state), action.ignoreValidation),
  ToggleMappingViewAction: ({ state, action }) => ({
    ...mappingState(state),
    showMappingView: cache.set('ui', 'showMappingView', action.isVisible, {
      overwrite: true,
      priorityCommit: true,
    }),
  }),
  ToggleMappingIsTemplatedAction: ({ state }) => ({
    ...mappingState(state),
    // TODO: test this in read-only mode
    mappingIsTemplated: !mappingState(state).mappingIsTemplated,
  }),
  ValidationAction: ({ state }) => validate(mappingState(state)),
  ResetMappingsAction: ({ state }) => ({
    ...mappingState(state),
    lines: mappingState(state).lines.map((line) => ({
      ...line,
      mappingPath: ['0'],
      options: defaultLineOptions,
    })),
    changesMade: true,
    mappingsAreValidated: false,
    validationResults: [],
  }),
  ClearMappingLineAction: ({ state, action }) => ({
    ...mappingState(state),
    lines: modifyLine(mappingState(state), action.line, {
      mappingPath: ['0'],
      options: defaultLineOptions,
    }),
    changesMade: true,
    mappingsAreValidated: false,
  }),
  FocusLineAction: ({ state, action }) => {
    if (action.line >= mappingState(state).lines.length)
      throw new Error(`Tried to focus a line that doesn't exist`);

    const focusedLineMappingPath = mappingState(state).lines[action.line]
      .mappingPath;
    return {
      ...mappingState(state),
      focusedLine: action.line,
      mappingView: mappingPathIsComplete(focusedLineMappingPath)
        ? focusedLineMappingPath
        : mappingState(state).mappingView,
    };
  },
  MappingViewMapAction: ({ state }) => {
    const mappingViewMappingPath = mappingState(state).mappingView;
    const focusedLine = mappingState(state).focusedLine;
    if (
      !mappingPathIsComplete(mappingViewMappingPath) ||
      typeof focusedLine === 'undefined' ||
      focusedLine >= mappingState(state).lines.length
    )
      return state;

    return {
      ...mappingState(state),
      lines: [
        ...mappingState(state).lines.slice(0, focusedLine),
        {
          ...mappingState(state).lines[focusedLine],
          mappingPath: mappingViewMappingPath,
        },
        ...mappingState(state).lines.slice(focusedLine + 1),
      ],
      changesMade: true,
      mappingsAreValidated: false,
    };
  },
  AddNewHeaderAction: ({ state }) => ({
    ...mappingState(state),
    newHeaderId: mappingState(state).newHeaderId + 1,
    lines: [
      ...mappingState(state).lines,
      {
        name: `New Header ${mappingState(state).newHeaderId}`,
        type: 'existingHeader',
        mappingPath: ['0'],
        options: defaultLineOptions,
      },
    ],
    changesMade: true,
    mappingsAreValidated: false,
  }),
  ToggleHiddenFieldsAction: ({ state }) => ({
    ...mappingState(state),
    showHiddenFields: cache.set(
      'ui',
      'showHiddenFields',
      !mappingState(state).showHiddenFields,
      {
        overwrite: true,
        priorityCommit: true,
      }
    ),
    revealHiddenFieldsClicked: true,
  }),
  OpenSelectElementAction: ({ state, action }) => ({
    ...mappingState(state),
    openSelectElement: {
      line: action.line,
      index: action.index,
    },
    automapperSuggestionsPromise:
      typeof mappingState(state).lines[action.line].mappingPath[
        action.index
      ] === 'undefined'
        ? undefined
        : getAutomapperSuggestions({
            lines: mappingState(state).lines,
            line: action.line,
            index: action.index,
            baseTableName: mappingState(state).baseTableName,
          }),
  }),
  CloseSelectElementAction: ({ state }) =>
    state.type === 'MappingState'
      ? {
          ...mappingState(state),
          openSelectElement: undefined,
          automapperSuggestionsPromise: undefined,
          automapperSuggestions: undefined,
        }
      : state,
  ChangeSelectElementValueAction: ({ state, action }) => {
    const newMappingPath = mutateMappingPath({
      lines: mappingState(state).lines,
      mappingView: mappingState(state).mappingView,
      line: action.line,
      index: action.index,
      value: action.value,
      isRelationship: action.isRelationship,
      currentTableName: action.currentTableName,
      newTableName: action.newTableName,
    });

    if (action.line === 'mappingView')
      return {
        ...mappingState(state),
        mappingView: newMappingPath,
      };

    return {
      ...mappingState(state),
      lines: deduplicateMappings(
        modifyLine(mappingState(state), action.line, {
          mappingPath: newMappingPath,
        }),
        mappingState(state).openSelectElement?.line ?? false
      ),
      openSelectElement: undefined,
      automapperSuggestionsPromise: undefined,
      automapperSuggestions: undefined,
      changesMade: true,
      mappingsAreValidated: false,
    };
  },
  AutomapperSuggestionsLoadedAction: ({ state, action }) => ({
    ...mappingState(state),
    automapperSuggestions: action.automapperSuggestions,
    automapperSuggestionsPromise: undefined,
  }),
  AutomapperSuggestionSelectedAction: ({ state, action: { suggestion } }) => ({
    ...mappingState(state),
    lines: modifyLine(
      mappingState(state),
      mappingState(state).openSelectElement!.line,
      {
        mappingPath: mappingState(state).automapperSuggestions![
          Number(suggestion) - 1
        ].mappingPath,
      }
    ),
    openSelectElement: undefined,
    automapperSuggestionsPromise: undefined,
    automapperSuggestions: undefined,
    changesMade: true,
    mappingsAreValidated: false,
  }),
  ValidationResultClickAction: ({ state, action: { mappingPath } }) => ({
    ...mappingState(state),
    mappingView: mappingPath,
  }),
  OpenMatchingLogicDialogAction: ({ state: originalState }) => {
    const state = mappingState(originalState);

    const arrayOfMappingPaths = state.lines.map((line) => line.mappingPath);
    const arrayOfMappingLineData = arrayOfMappingPaths.flatMap((mappingPath) =>
      getMappingLineData({
        mappingPath,
        baseTableName: state.baseTableName,
        customSelectType: 'OPENED_LIST',
      }).filter((mappingElementData, index, list) => {
        if (
          // Exclude base table
          index === 0 ||
          // Exclude -to-many
          mappingElementData.customSelectSubtype === 'toMany'
        )
          return false;

        if (typeof list[index - 1] === 'undefined') {
          if (
            state.baseTableName === 'collectionobject' &&
            list[index].tableName === 'collectingevent'
          )
            return false;
        } else {
          // Exclude direct child of -to-many
          if (list[index - 1].customSelectSubtype === 'toMany') return false;

          // Exclude embedded collecting event
          if (
            schema.embeddedCollectingEvent === true &&
            list[index - 1].tableName === 'collectionobject' &&
            list[index].tableName === 'collectingevent'
          )
            return false;
        }

        return true;
      })
    );

    const arrayOfTables = arrayOfMappingLineData
      .map((mappingElementData) => mappingElementData.tableName ?? '')
      .filter(
        (tableName) =>
          tableName &&
          typeof dataModelStorage.tables[tableName] !== 'undefined' &&
          !tableName.endsWith('attribute') &&
          // Exclude embedded paleo context
          (schema.embeddedPaleoContext === false ||
            tableName !== 'paleocontext')
      );
    const distinctListOfTables = [...new Set(arrayOfTables)];
    const mustMatchPreferences = {
      ...Object.fromEntries(
        distinctListOfTables.map((tableName) => [tableName, false])
      ),
      ...state.mustMatchPreferences,
    };

    return {
      ...state,
      displayMatchingOptionsDialog: true,
      mustMatchPreferences,
    };
  },
  CloseMatchingLogicDialogAction: ({ state }) => ({
    ...mappingState(state),
    displayMatchingOptionsDialog: false,
  }),
  MustMatchPrefChangeAction: ({ state, action }) => ({
    ...mappingState(state),
    mustMatchPreferences: {
      ...mappingState(state).mustMatchPreferences,
      [action.tableName]: action.mustMatch,
    },
  }),
  ChangeMatchBehaviorAction: ({ state, action }) => ({
    ...mappingState(state),
    lines: modifyLine(mappingState(state), action.line, {
      ...mappingState(state).lines[action.line],
      options: {
        ...mappingState(state).lines[action.line].options,
        matchBehavior: action.matchBehavior,
      },
    }),
  }),
  ToggleAllowNullsAction: ({ state, action }) => ({
    ...mappingState(state),
    lines: modifyLine(mappingState(state), action.line, {
      ...mappingState(state).lines[action.line],
      options: {
        ...mappingState(state).lines[action.line].options,
        nullAllowed: action.allowNull,
      },
    }),
  }),
  ChangeDefaultValue: ({ state, action }) => ({
    ...mappingState(state),
    lines: modifyLine(mappingState(state), action.line, {
      ...mappingState(state).lines[action.line],
      options: {
        ...mappingState(state).lines[action.line].options,
        default: action.defaultValue,
      },
    }),
  }),
});
