import { error } from './assert';
import { databaseDateFormat, fullDateFormat } from './dateformat';
import { dayjs } from './dayjs';
import formsText from './localization/forms';
import type {
  JavaType,
  LiteralField,
  Relationship,
  RelationshipType,
} from './specifyfield';
import type { IR, RA, RR } from './types';
import { filterArray } from './types';
import type { UiFormatter } from './uiformatters';
import { hasNativeErrors } from './validationmessages';
import { mappedFind } from './wbplanviewhelper';

const stringGuard =
  (formatter: (value: string) => unknown) => (value: unknown) =>
    typeof value === 'string'
      ? formatter(value)
      : error('Value is not a string');

const formatter: IR<(value: unknown) => unknown> = {
  trim: stringGuard((value) => value.trim()),
  toLowerCase: stringGuard((value) => value.toLowerCase()),
  int: stringGuard(Number.parseInt),
  float: stringGuard(Number.parseFloat),
} as const;

const validators: IR<(value: unknown) => undefined | string> = {
  number: (value) =>
    typeof value === 'number' &&
    !Number.isNaN(value) &&
    (!Number.isInteger(value) || Number.isSafeInteger(value))
      ? undefined
      : formsText('inputTypeNumber'),
} as const;

export type Parser = Partial<{
  readonly type: 'text' | 'number' | 'date' | 'checkbox';
  readonly minLength: number;
  readonly maxLength: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly placeholder: string;
  readonly pattern: RegExp;
  // Browsers use this as an error message when value does not match the pattern
  readonly title: string;
  // Format a value before validating it
  readonly formatters: RA<typeof formatter[string]>;
  // Validate the value
  readonly validators: RA<typeof validators[string]>;
  // Format the value after validating it
  readonly parser: (value: unknown) => unknown;
  readonly required: boolean;
  // Default value
  readonly value: string;
}>;

type ExtendedJavaType = JavaType | 'year' | 'month' | 'day';

export const parsers: RR<
  ExtendedJavaType,
  ExtendedJavaType | Parser | (() => Parser)
> = {
  // TODO: test validation of boolean fields
  'java.lang.Boolean': {
    type: 'checkbox',
    pattern: /\s+(?:true|false|yes|no)\s+/i,
    title: formsText('illegalBool'),
    formatters: [formatter.toLowerCase],
    parser: stringGuard((value) => ['yes', 'true'].includes(value)),
  },

  'java.lang.Byte': {
    type: 'number',
    min: 0,
    max: 255,
    step: 1,
    formatters: [formatter.int],
    validators: [validators.number],
  },

  'java.lang.Double': {
    type: 'number',
    formatters: [formatter.float],
    validators: [validators.number],
  },

  'java.lang.Float': 'java.lang.Double',

  'java.lang.Long': {
    type: 'number',
    min: Number.MIN_SAFE_INTEGER,
    max: Number.MAX_SAFE_INTEGER,
    step: 1,
    formatters: [formatter.int],
    validators: [validators.number],
  },

  'java.lang.Integer': {
    type: 'number',
    min: -(2 ** 31),
    max: 2 ** 31,
    step: 1,
    formatters: [formatter.int],
    validators: [validators.number],
  },

  'java.lang.Short': {
    type: 'number',
    min: -1 << 15,
    max: 1 << 15,
    step: 1,
    formatters: [formatter.int],
    validators: [validators.number],
  },

  'java.lang.String': {
    type: 'text',
    maxLength: 2 ** 31 - 1,
  },

  'java.math.BigDecimal': 'java.lang.Double',

  'java.sql.Timestamp': () => ({
    type: 'date',
    minLength: fullDateFormat().length,
    maxLength: fullDateFormat().length,
    formatters: [
      formatter.toLowerCase,
      stringGuard((value) =>
        value === 'today' ? dayjs() : dayjs(value, fullDateFormat(), true)
      ),
    ],
    validators: [
      (value) =>
        (value as any).isValid()
          ? undefined
          : formsText('requiredFormat')(fullDateFormat()),
    ],
    title: formsText('requiredFormat')(fullDateFormat()),
    parser: (value) => (value as any).format(databaseDateFormat),
    value: dayjs().format(databaseDateFormat),
  }),

  'java.util.Calendar': 'java.sql.Timestamp',

  'java.util.Date': 'java.sql.Timestamp',

  year: {
    type: 'number',
    min: 1,
    max: 9999,
    step: 1,
    formatters: [formatter.int],
    validators: [validators.number],
    value: new Date().getFullYear().toString(),
  },

  month: {
    type: 'number',
    min: 1,
    max: 12,
    step: 1,
    formatters: [formatter.int],
    validators: [validators.number],
    value: new Date().getMonth().toString(),
  },

  day: {
    type: 'number',
    min: 1,
    max: 31,
    step: 1,
    formatters: [formatter.int],
    validators: [validators.number],
    value: new Date().getDate().toString(),
  },

  text: {
    type: 'text',
  },
};

type ExtendedField = Partial<Omit<LiteralField | Relationship, 'type'>> & {
  readonly type: ExtendedJavaType | RelationshipType;
  readonly datePart?: 'fullDate' | 'year' | 'month' | 'day';
};

export function resolveParser(
  field: Partial<LiteralField | Relationship>,
  extras?: Partial<ExtendedField>
): Parser | undefined {
  const fullField = { ...field, ...extras };
  const fieldType = fullField.type as ExtendedJavaType;
  let parser = parsers[fieldType];
  if (typeof parser === 'string') parser = parsers[parser];
  if (typeof parser === 'function') parser = parser();
  if (typeof parser !== 'object') parser = {};

  if (
    parser.type === 'date' &&
    typeof fullField.datePart === 'string' &&
    fullField.datePart !== 'fullDate'
  )
    parser = parsers[fullField.datePart] as Parser;

  const formatter = field.getUiFormatter?.();
  return mergeParsers(parser, {
    required: fullField.isRequired,
    maxLength: fullField.length,
    ...(typeof formatter === 'object' ? formatterToParser(formatter) : {}),
  });
}

function mergeParsers(base: Parser, extra: Parser): Parser | undefined {
  const concat = ['formatters', 'validators'] as const;
  const takeMin = ['max', 'step', 'maxLength'] as const;
  const takeMax = ['min', 'minLength'] as const;

  const merged = Object.fromEntries(
    [
      ...Object.entries(base),
      ...Object.entries(extra),
      ...concat.map((key) => [
        key,
        [...(base[key] ?? []), ...(extra[key] ?? [])],
      ]),
      ...[
        ...takeMin.map((key) => [
          key,
          Math.min(...filterArray([base[key], extra[key]])),
        ]),
        ...takeMax.map((key) => [
          key,
          Math.max(...filterArray([base[key], extra[key]])),
        ]),
      ].filter(([_key, value]) => Number.isFinite(value)),
    ].filter(([_key, value]) => typeof value !== 'undefined')
  );

  return Object.keys(merged).length === 0 ? undefined : merged;
}

function formatterToParser(formatter: UiFormatter): Parser {
  const regExpString = formatter.parseRegexp();
  const title = formsText('requiredFormat')(
    formatter.pattern() ?? formatter.value()
  );

  return {
    pattern: regExpString === null ? undefined : new RegExp(regExpString),
    title,
    formatters: [stringGuard(formatter.parse.bind(formatter))],
    validators: [(value) => (value === null ? title : undefined)],
    placeholder: formatter.pattern() ?? undefined,
    parser: (value: unknown): string =>
      formatter.canonicalize(value as RA<string>),
  };
}

export const getValidationAttributes = (parser: Parser): IR<string> =>
  typeof parser === 'object'
    ? {
        ...(parser.required === true
          ? // A hack to make these attributes work both in JSX and native
            { required: true as unknown as string }
          : {}),
        ...(typeof parser.pattern === 'object'
          ? {
              pattern: parser.pattern
                .toString()
                .replaceAll(/^\/\^?|\$?\/$/g, ''),
            }
          : {}),
        ...Object.fromEntries(
          [
            'minLength',
            'maxLength',
            'min',
            'max',
            'step',
            'title',
            'placeholder',
            'type',
          ]
            .filter(
              (attribute) =>
                typeof parser[attribute as keyof Parser] !== 'undefined'
            )
            .map((attribute) => [
              attribute,
              `${parser[attribute as keyof Parser] as string}`,
            ])
        ),
      }
    : {};

export const addValidationAttributes = (
  input: HTMLInputElement,
  parser: Parser
): void =>
  Object.entries(getValidationAttributes(parser)).forEach(([key, value]) =>
    input.setAttribute(key, value)
  );

export type ValidParseResult = {
  readonly value: string;
  readonly parsed: unknown;
  readonly isValid: true;
};
export type InvalidParseResult = {
  readonly value: string;
  readonly isValid: false;
  readonly reason: string;
};

export function parseValue(
  parser: Parser,
  input: HTMLInputElement | undefined,
  value: string
): ValidParseResult | InvalidParseResult {
  if (value.trim() === '')
    return parser.required === true
      ? {
          value,
          isValid: false,
          reason: formsText('requiredField'),
        }
      : {
          value,
          isValid: true,
          parsed: null,
        };

  let errorMessage =
    typeof input === 'object' && hasNativeErrors(input)
      ? input.validationMessage
      : undefined;
  let formattedValue: unknown;

  if (typeof errorMessage === 'undefined') {
    formattedValue = (parser.formatters ?? []).reduce<unknown>(
      (value, formatter) => formatter(value),
      value.trim()
    );

    errorMessage = mappedFind(parser.validators ?? [], (validator) =>
      validator(formattedValue)
    );
  }

  return typeof errorMessage === 'string'
    ? {
        value,
        isValid: false,
        reason: errorMessage,
      }
    : {
        value,
        isValid: true,
        parsed: parser.parser?.(formattedValue) ?? formattedValue,
      };
}
