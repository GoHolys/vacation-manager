import type { CommonEvent } from 'commoneventframework/dist/types/commonEvent';
import type { z, ZodType } from 'zod';
import { type ErrorDetail, ValidationError } from '../core/errors';
import { readJsonBody, readQuery } from './request';

export interface InputSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

type Infer<T> = T extends ZodType ? z.output<T> : undefined;

export interface ParsedInput<S extends InputSchemas> {
  params: Infer<S['params']>;
  query: Infer<S['query']>;
  body: Infer<S['body']>;
}

export type InputParser<S extends InputSchemas = InputSchemas> = (
  event: CommonEvent,
) => ParsedInput<S>;

/**
 * Builds a Common Event Framework `x-inputParser` from zod schemas.
 * All parts are validated before failing so the client receives every problem at once.
 *
 * Input parsers validate *shape and format* only; business rules (date ordering, overlaps…)
 * belong to the domain so they hold regardless of the entry point.
 */
export function defineInputParser<S extends InputSchemas>(schemas: S): InputParser<S> {
  return (event) => {
    const issues: ErrorDetail[] = [];

    const parse = (location: keyof InputSchemas, raw: () => unknown): unknown => {
      const schema = schemas[location];
      if (!schema) return undefined;
      const result = schema.safeParse(raw());
      if (result.success) return result.data;
      for (const issue of result.error.issues) {
        issues.push({
          field: issue.path.length ? issue.path.join('.') : location,
          location,
          message: issue.message,
        });
      }
      return undefined;
    };

    const params = parse('params', () => event.pathParameters ?? {});
    const query = parse('query', () => readQuery(event));
    const body = parse('body', () => readJsonBody(event));

    if (issues.length > 0) throw new ValidationError(issues);
    return { params, query, body } as ParsedInput<S>;
  };
}
