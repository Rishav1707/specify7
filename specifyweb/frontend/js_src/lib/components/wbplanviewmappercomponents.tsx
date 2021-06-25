import '../../css/theme.css';

import React from 'react';

import { getMappingLineData } from '../wbplanviewnavigator';
import type { MappingsTree } from '../wbplanviewtreehelper';
import { ModalDialog } from './modaldialog';
import type { IR, RA } from './wbplanview';
import { MappingPathComponent } from './wbplanviewcomponents';
import type { MappingPath } from './wbplanviewmapper';

export type GetMappedFieldsBind = (
  // A mapping path that would be used as a filter
  mappingPathFilter: MappingPath
) => MappingsTree;

export type PathIsMappedBind = (
  // A mapping path that would be used as a filter
  mappingPathFilter: MappingPath
) => boolean;

export const MappingsControlPanel = React.memo(function MappingsControlPanel({
  showHiddenFields,
  handleToggleHiddenFields,
  handleAddNewHeader,
  readonly,
}: /*
 * MappingIsTemplated,
 * handleToggleMappingIsTemplated,
 */
{
  readonly showHiddenFields: boolean;
  readonly handleToggleHiddenFields?: () => void;
  readonly handleAddNewHeader?: () => void;
  readonly readonly: boolean;
  /*
   * Readonly handleToggleMappingIsTemplated?: () => void;
   * readonly mappingIsTemplated: boolean;
   */
}) {
  return (
    <div>
      {!readonly && (
        <button className="magic-button" onClick={handleAddNewHeader}>
          Add New Column
        </button>
      )}
      {/* <label>
        <input
          type="checkbox"
          checked={mappingIsTemplated}
          onChange={handleToggleMappingIsTemplated}
        />
        {' '}Use this mapping as a template
      </label>*/}
      <label>
        {' '}
        <input
          type="checkbox"
          checked={showHiddenFields}
          onChange={handleToggleHiddenFields}
        />{' '}
        Reveal Hidden Form Fields
      </label>
    </div>
  );
});

export function ValidationResults(props: {
  readonly baseTableName: string;
  readonly validationResults: RA<MappingPath>;
  readonly onSave: () => void;
  readonly onDismissValidation: () => void;
  readonly getMappedFields: GetMappedFieldsBind;
  readonly onValidationResultClick: (mappingPath: MappingPath) => void;
  readonly mustMatchPreferences: IR<boolean>;
}): JSX.Element | null {
  if (props.validationResults.length === 0) return null;

  return (
    <div style={{ position: 'absolute' }}>
      <ModalDialog
        properties={{
          title: 'Upload Plan Mapping',
          modal: false,
          width: '40vw',
          height: 'auto',
          close: props.onDismissValidation,
          buttons: [
            {
              text: 'Continue Editing',
              click: props.onDismissValidation,
            },
            {
              text: 'Save Unfinished',
              click: props.onSave,
            },
          ],
        }}
      >
        <div className="validation-results">
          <span>
            This data mapping is missing one or more data fields required for
            uploading by your Specify configuration. Add the missing mappings
            shown or save this Upload Plan as unfinished.
          </span>
          {props.validationResults.map((fieldPath, index) => (
            <div
              className="v-center wbplanview-mapping-line-elements"
              key={index}
              onClick={props.onValidationResultClick.bind(undefined, fieldPath)}
            >
              <MappingPathComponent
                mappingLineData={getMappingLineData({
                  baseTableName: props.baseTableName,
                  mappingPath: fieldPath,
                  iterate: true,
                  generateLastRelationshipData: false,
                  customSelectType: 'PREVIEW_LIST',
                  getMappedFields: props.getMappedFields,
                  mustMatchPreferences: props.mustMatchPreferences,
                })}
              />
            </div>
          ))}
        </div>
      </ModalDialog>
    </div>
  );
}

export function MappingView(props: {
  readonly baseTableName: string;
  readonly focusedLineExists: boolean;
  readonly mappingPath: MappingPath;
  readonly mapButtonIsEnabled: boolean;
  readonly readonly: boolean;
  readonly mustMatchPreferences: IR<boolean>;
  readonly handleMapButtonClick?: () => void;
  readonly handleMappingViewChange?: (
    index: number,
    newValue: string,
    isRelationship: boolean,
    currentTable: string,
    newTable: string
  ) => void;
  readonly getMappedFields: GetMappedFieldsBind;
  readonly showHiddenFields?: boolean;
}): JSX.Element | null {
  const mappingLineData = getMappingLineData({
    baseTableName: props.baseTableName,
    mappingPath: props.mappingPath,
    generateLastRelationshipData: true,
    iterate: true,
    customSelectType: 'OPENED_LIST',
    handleChange: props.handleMappingViewChange,
    getMappedFields: props.getMappedFields,
    showHiddenFields: props.showHiddenFields,
    mustMatchPreferences: props.mustMatchPreferences,
  });
  const mapButtonIsEnabled =
    !props.readonly &&
    props.mapButtonIsEnabled &&
    (Object.entries(
      mappingLineData[mappingLineData.length - 1]?.fieldsData
    ).find(([, { isDefault }]) => isDefault)?.[1].isEnabled ??
      false);

  return (
    <>
      <div className="v-center mapping-view">
        <MappingPathComponent mappingLineData={mappingLineData} />
      </div>
      <button
        className="v-center magic-button wbplanview-mapping-view-map-button"
        disabled={!mapButtonIsEnabled || !props.focusedLineExists}
        onClick={
          mapButtonIsEnabled && props.focusedLineExists
            ? props.handleMapButtonClick
            : undefined
        }
      >
        Map
        <span className="wbplanview-mapping-view-map-button-arrow">
          &#8594;
        </span>
      </button>
    </>
  );
}

export const defaultMappingViewHeight = 300;
export const minMappingViewHeight = 250;
