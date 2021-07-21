import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from "@nestjs/common";
import { Schema } from "joi";

function decode(value: any, { type, $_terms: { keys } }: Schema) {
  if (type != "object" && type != "array") return value;

  if (typeof value == "string") return JSON.parse(value);
  if (typeof value != "object") return value;

  if (type != "object") return value;

  for (const { key, schema } of keys) {
    if (key in value) {
      value[key] = decode(value[key], schema);
    }
  }

  return value;
}

export class JoiPipe implements PipeTransform {
  constructor(
    private schema: Schema,
    private convert: boolean = true,
    private decode: boolean | string[] = false
  ) {}
  transform(value: any, metadata: ArgumentMetadata) {
    try {
      value = decode(value, this.schema);
    } catch (e) {
      // throw e instanceof BadRequestException ? e : new BadRequestException();
    }

    const { error, value: converted } = this.schema.validate(
      typeof this.decode == "boolean" && this.decode && typeof value == "string"
        ? JSON.parse(value)
        : value,
      {
        convert: this.convert,
      }
    );

    if (error) {
      throw new BadRequestException(
        `${metadata.type}: ${
          metadata.data ? `"${metadata.data}"` : ""
        } validation failed: ${error.message}`
      );
    }
    return converted;
  }
}
