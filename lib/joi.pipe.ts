import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { json } from 'express';
import { Schema } from 'joi';

export class JoiPipe implements PipeTransform {
  constructor(
    private schema: Schema,
    private convert: boolean = true,
    private decode: boolean | string[] = false,
  ) {}
  transform(value: any, metadata: ArgumentMetadata) {
    try {
      if (
        value != null &&
        typeof value == 'object' &&
        this.decode &&
        typeof this.decode == 'object' &&
        this.decode instanceof Array
      ) {
        for (const prop of this.decode) {
          if (
            !(prop in value) ||
            value[prop] == null ||
            typeof value[prop] != 'string'
          )
            continue;
          try {
            value[prop] = JSON.parse(value[prop]);
          } catch (e) {}
        }
      }
      const { error, value: converted } = this.schema.validate(
        typeof this.decode == 'boolean' &&
          this.decode &&
          typeof value == 'string'
          ? JSON.parse(value)
          : value,
        {
          convert: this.convert,
        },
      );

      if (error) {
        throw new BadRequestException(
          `${metadata.type}: ${
            metadata.data ? `"${metadata.data}"` : ''
          } validation failed: ${error.message}`,
        );
      }
      return converted;
    } catch (e) {
      throw e instanceof BadRequestException ? e : new BadRequestException();
    }
  }
}
