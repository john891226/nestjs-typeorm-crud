import {
  any,
  AnySchema,
  array,
  boolean,
  date,
  number,
  object,
  ObjectSchema,
  string,
} from "joi";
import { getMetadataArgsStorage } from "typeorm";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";
import { TYPEORM_CRUD_OPERATIONS } from "./operations";
import {
  EntityColumns,
  EntityRelation,
  TYPEORM_MODEL_CONFIG,
  TYPEORM_SERVICE_OPTIONS,
} from "./typeorm.interfaces";

export const getEntitySchema = (
  model: TYPEORM_MODEL_CONFIG<any>
): ObjectSchema => {
  return getSchemaFromEntity(model);
};

export const entityColumn2JoiSchema = (
  {
    propertyName,
    options: { type, nullable, select, default: defaultValue, ...options },
  }: ColumnMetadataArgs,
  generated: boolean = false,
  deep: boolean = true,
  forceOptional: boolean = false
): AnySchema | void => {
  if (select === false) return;

  let propSchema =
    type == Number
      ? number()
      : type == String
      ? string()
      : type == Boolean
      ? boolean()
      : type == Date
      ? date()
      : any();

  const required = forceOptional
    ? true
    : typeof defaultValue != "undefined" || nullable;

  if (typeof defaultValue != "undefined")
    propSchema = propSchema.default(defaultValue);
  propSchema = propSchema[required ? "optional" : "required"]();
  if (required) propSchema = propSchema.allow(null);

  return propSchema;
};

export const entityRelation2JoiSchema = (
  {
    propertyName,
    relationType,
    target,
    inverseSideProperty,
    type,
    options: { nullable },
  }: RelationMetadataArgs,
  parser: typeof entityColumn2JoiSchema = entityColumn2JoiSchema,
  { columns, relations }: EntityRelation,
  onlyPrimary: boolean = false,
  forceOptional: boolean = false
): any | void => {
  if (!!inverseSideProperty) return;

  let sch = onlyPrimary
    ? getEntityPrimarySchema((type as any)())
    : getSchemaFromEntity({
        columns,
        // relations,
        type: (type as any)(),
      } as any);

  if (!sch) return;

  sch = relationType == "many-to-many" ? array().items(sch) : sch;
  if (nullable || forceOptional) {
    sch = sch.optional().allow(null);
  } else {
    sch = sch.required();
  }

  return sch;
};

export const getEntityPrimarySchema = (entity) => {
  const metadata = getMetadataArgsStorage();
  const entityMeta = metadata.filterColumns(entity);
  const pk = entityMeta.find((col) => col.options.primary);
  if (pk) return entityColumn2JoiSchema(pk);
};

export const getSchemaFromEntity = (
  { type: entity, columns, relations: relationship }: TYPEORM_MODEL_CONFIG<any>,
  columnParser: typeof entityColumn2JoiSchema = entityColumn2JoiSchema,
  relationsParser: typeof entityRelation2JoiSchema = entityRelation2JoiSchema
) => {
  const metadata = getMetadataArgsStorage();
  const entityMeta = metadata.filterColumns(entity as Function);
  const relations = metadata.filterRelations(entity as Function);

  let schema = {};
  for (const colMeta of entityMeta) {
    if (
      !colMeta.options.primary &&
      columns &&
      columns.indexOf(colMeta.propertyName) == -1
    )
      continue;

    const generated = metadata.findGenerated(
      colMeta.target,
      colMeta.propertyName
    );
    const sch = columnParser(colMeta, !!generated);
    if (!sch) continue;
    schema[colMeta.propertyName] = sch;
  }

  if (relationship && Object.keys(relationship).length > 0) {
    for (const colMeta of relations) {
      if (!(colMeta.propertyName in relationship)) continue;
      const sch = relationsParser(
        colMeta,
        null,
        relationship[colMeta.propertyName]
      );

      if (!sch) continue;
      schema[colMeta.propertyName] = sch;
    }
  }

  return object(schema);
};

export const getBodySchema = (
  { model, operations, ...options }: TYPEORM_SERVICE_OPTIONS<any, any>,
  columns?: EntityColumns,
  operation?: TYPEORM_CRUD_OPERATIONS,
  strict: boolean = true
) => {
  return getSchemaFromEntity(
    model,
    (def: ColumnMetadataArgs, generated: boolean) => {
      if (generated) return;

      if (
        operation &&
        !!operations?.[operation]?.columns &&
        operations?.[operation]?.columns.indexOf(def.propertyName) == -1
      )
        return;
      if (
        !!columns &&
        columns.indexOf("*") == -1 &&
        columns.indexOf(def.propertyName) == -1
      )
        return;
      return entityColumn2JoiSchema(def, generated, true, !strict);
    },
    (def: RelationMetadataArgs) => {
      if (def.inverseSideProperty) return;
      if (
        operation &&
        !!operations?.[operation]?.columns &&
        operations?.[operation]?.columns.indexOf(def.propertyName) == -1
      )
        return;
      if (!!columns && columns.indexOf(def.propertyName) == -1) return;
      return entityRelation2JoiSchema(def, null, {}, true, !strict);
    }
  );
};
