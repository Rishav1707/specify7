import { Input } from '../../components/DataModel/saveBlockers';
import { formsText } from '../../localization/forms';
import { hasNativeErrors } from '../../components/Forms/validationHelpers';
import { mappedFind } from '../utils';
import { Parser } from './definitions';

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
  input: Input | undefined,
  value: string,
  trim: boolean = true
): InvalidParseResult | ValidParseResult {
  if (trim && value.trim() === '')
    return parser.required === true
      ? {
          value,
          isValid: false,
          reason: formsText.requiredField(),
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

  if (errorMessage === undefined) {
    formattedValue = (parser.formatters ?? []).reduce<unknown>(
      (value, formatter) => formatter(value),
      trim ? value.trim() : value
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
