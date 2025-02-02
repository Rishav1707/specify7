/**
 * Classes for a specify field
 */

import type { IR } from '../../utils/types';
import { camelToHuman } from '../../utils/utils';
import { getUiFormatters, type UiFormatter } from '../Forms/uiFormatters';
import { isTreeModel } from '../InitialContext/treeRanks';
import { getFrontEndPickLists } from '../PickLists/definitions';
import type { SpecifyResource } from './legacyTypes';
import type { SchemaLocalization } from './schema';
import { schema, strictGetModel } from './schema';
import { unescape } from './schemaBase';
import { getFieldOverwrite, getGlobalFieldOverwrite } from './schemaOverrides';
import type { SpecifyModel } from './specifyModel';
import type { PickList, Tables } from './types';
import { LocalizedString } from 'typesafe-i18n';

export type JavaType =
  // Strings
  // eslint-disable-next-line @typescript-eslint/sort-type-union-intersection-members
  | 'text'
  | 'java.lang.String'
  // Numbers
  | 'java.lang.Byte'
  | 'java.lang.Short'
  | 'java.lang.Integer'
  | 'java.lang.Float'
  | 'java.lang.Double'
  | 'java.lang.Long'
  | 'java.math.BigDecimal'
  // Bools
  | 'java.lang.Boolean'
  // Dates
  | 'java.sql.Timestamp'
  | 'java.util.Calendar'
  | 'java.util.Date';

const relationshipTypes = [
  'one-to-one',
  'one-to-many',
  'many-to-one',
  'many-to-many',
  'zero-to-one',
] as const;

export type RelationshipType = typeof relationshipTypes[number];

export type FieldDefinition = {
  readonly column?: string;
  readonly indexed: boolean;
  readonly length?: number;
  readonly name: string;
  readonly required: boolean;
  readonly type: JavaType;
  readonly unique: boolean;
  readonly readOnly?: boolean;
};

export type RelationshipDefinition = {
  readonly column?: string;
  readonly dependent: boolean;
  readonly name: string;
  readonly otherSideName?: string;
  readonly relatedModelName: keyof Tables | 'UserGroupScope';
  readonly required: boolean;
  readonly type: RelationshipType;
  readonly readOnly?: boolean;
};

abstract class FieldBase {
  public readonly model: SpecifyModel;

  public readonly isRelationship: boolean = false;

  public readonly name: string;

  // eslint-disable-next-line functional/prefer-readonly-type
  public isHidden: boolean;

  // eslint-disable-next-line functional/prefer-readonly-type
  public isReadOnly: boolean;

  // eslint-disable-next-line functional/prefer-readonly-type
  public isVirtual: boolean = false;

  public readonly isRequired: boolean;

  /**
   * Overrides are used to overwrite the default data model settings and the
   * schema config settings. Overrides mostly affect Query Builder and the
   * WorkBench mapper. They are used to force-hide unsupported fields and
   * legacy fields
   */
  public readonly overrides: {
    // eslint-disable-next-line functional/prefer-readonly-type
    isRequired: boolean;
    // If relatedModel isHidden, this is set to true
    // eslint-disable-next-line functional/prefer-readonly-type
    isHidden: boolean;
    // If relatedModel isSystem, this is set to true
    // eslint-disable-next-line functional/prefer-readonly-type
    isReadOnly: boolean;
  };

  public readonly type: JavaType | RelationshipType;

  public readonly length?: number;

  public readonly databaseColumn?: string;

  public readonly localization: SchemaLocalization['items'][string];

  // User friendly name of the field from the schema config.
  public readonly label: LocalizedString;

  protected constructor(
    model: SpecifyModel,
    fieldDefinition: Omit<FieldDefinition, 'type'> & {
      readonly type: JavaType | RelationshipType;
    }
  ) {
    this.model = model;

    this.name = fieldDefinition.name;

    const globalFieldOverride = getGlobalFieldOverwrite(model.name, this.name);

    this.isReadOnly =
      globalFieldOverride === 'readOnly' || fieldDefinition.readOnly === true;

    this.isRequired =
      globalFieldOverride === 'required'
        ? true
        : globalFieldOverride === 'optional'
        ? false
        : fieldDefinition.required;
    this.type = fieldDefinition.type;
    this.length = fieldDefinition.length;
    this.databaseColumn = fieldDefinition.column;

    this.localization =
      this.model.localization.items[this.name.toLowerCase()] ?? {};

    this.label =
      typeof this.localization.name === 'string' &&
      this.localization.name.length > 0
        ? (unescape(this.localization.name) as LocalizedString)
        : (camelToHuman(this.name) as LocalizedString);

    this.isHidden =
      globalFieldOverride === 'hidden' || (this.localization.ishidden ?? false);

    // Apply overrides
    const fieldOverwrite = getFieldOverwrite(this.model.name, this.name);

    let isRequired = fieldOverwrite !== 'optional' && this.isRequired;
    let isHidden = this.isHidden;

    const isReadOnly = this.isReadOnly || fieldOverwrite === 'readOnly';

    // Overwritten hidden fields are made not required
    if (fieldOverwrite === 'hidden') {
      isRequired = false;
      isHidden = true;
    }
    // Other required fields are unhidden
    else if (isHidden && isRequired) isHidden = false;

    this.overrides = {
      isHidden,
      isRequired: isRequired && !isReadOnly,
      isReadOnly,
    };
  }

  // Returns the description of the field from the schema config.
  public getLocalizedDesc(): LocalizedString | undefined {
    const description = this.localization.desc;
    return description === null || description === undefined
      ? undefined
      : (unescape(description) as LocalizedString);
  }

  // Returns the name of the UIFormatter for the field from the schema config.
  public getFormat(): string | undefined {
    return this.localization.format ?? undefined;
  }

  // Returns the UIFormatter for the field specified in the schema config.
  public getUiFormatter(): UiFormatter | undefined {
    return this.isRelationship
      ? undefined
      : getUiFormatters()[this.getFormat() ?? ''];
  }

  /*
   * Returns the name of the picklist definition if any is assigned to the field
   * by the schema configuration.
   */
  public getPickList(): string | undefined {
    return (
      this.localization.picklistname ??
      (getFrontEndPickLists() as IR<IR<SpecifyResource<PickList> | undefined>>)[
        this.model.name
      ]?.[this.name]?.get('name')
    );
  }

  // Returns the weblink definition name if any is assigned to the field.
  public getWebLinkName(): string | undefined {
    return this.localization.weblinkname ?? undefined;
  }

  // Returns true if the field represents a time value.
  public isTemporal(): boolean {
    return [
      'java.util.Date',
      'java.util.Calendar',
      'java.sql.Timestamp',
    ].includes(this.type);
  }

  public isDependent(): boolean {
    return false;
  }

  /**
   * Instead of serializing the entire object, return a string.
   * Serializing entire object is not advisable as it has relationships to
   * other tables resulting in entire data model getting serialized (which
   * would result in 2.3mb of wasted space)
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public toJSON(): string {
    return `[${this.isRelationship ? 'relationship' : 'literalField'} ${
      this.name
    }]`;
  }
}

/** Non-relationship field */
export class LiteralField extends FieldBase {
  public readonly type: JavaType;

  public readonly isRelationship: false = false;

  public constructor(model: SpecifyModel, fieldDefinition: FieldDefinition) {
    super(model, fieldDefinition);
    this.type = fieldDefinition.type;
  }
}

export class Relationship extends FieldBase {
  // eslint-disable-next-line functional/prefer-readonly-type
  public otherSideName?: string;

  public readonly relatedModel: SpecifyModel;

  public readonly type: RelationshipType;

  private readonly dependent: boolean;

  public readonly isRelationship: true = true;

  public constructor(
    model: SpecifyModel,
    relationshipDefinition: RelationshipDefinition
  ) {
    super(model, {
      ...relationshipDefinition,
      indexed: false,
      unique: false,
    });

    this.type = relationshipDefinition.type;
    this.otherSideName = relationshipDefinition.otherSideName;
    this.dependent = relationshipDefinition.dependent;
    const relatedModelName =
      model.name === 'SpPrincipal' &&
      relationshipDefinition.name === 'scope' &&
      relationshipDefinition.relatedModelName === 'UserGroupScope'
        ? 'Division'
        : relationshipDefinition.relatedModelName;
    this.relatedModel = strictGetModel(relatedModelName);

    if (isTreeModel(this.model.name)) this.overrides.isReadOnly = true;

    this.overrides.isRequired =
      this.overrides.isRequired &&
      !this.overrides.isReadOnly &&
      !this.relatedModel.overrides.isSystem;
    this.overrides.isHidden ||=
      !this.overrides.isRequired &&
      this.relatedModel.overrides.isHidden &&
      this.relatedModel !== this.model;
  }

  /*
   * Returns true if the field represents a dependent relationship. ie one where
   * the data in the related object(s) is automatically included by the API.
   * eg CollectionObject.determinations.
   */
  public isDependent(): boolean {
    // REFACTOR: move this into SchemaExtras.ts
    return this.model.name === 'CollectionObject' &&
      this.name === 'collectingEvent'
      ? schema.embeddedCollectingEvent
      : this.model.name.toLowerCase() === schema.paleoContextChildTable &&
        this.name === 'paleoContext'
      ? schema.embeddedPaleoContext
      : this.dependent;
  }

  // Returns the field of the related model that is the reverse of this field.
  public getReverse(): Relationship | undefined {
    return this.otherSideName
      ? this.relatedModel.getRelationship(this.otherSideName)
      : undefined;
  }
}
