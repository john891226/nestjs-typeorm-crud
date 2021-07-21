import { EntityClassOrSchema } from "@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type";
import { AnySchema, ObjectSchema } from "joi";
import { Entity, SelectQueryBuilder } from "typeorm";
import { TYPEORM_CRUD_OPERATIONS } from "./operations";
import { getBodySchema } from "./swagger.helper";
import { TypeOrmService } from "./typeorm.service";
import { SWAGGER_OPTIONS } from "./typeorm.utils";

export type EntityColumns<Entity = any> = (keyof Entity)[];

export type EntityRelation = {
  columns?: EntityColumns;
  relations?: EntityRelations;
};

export type EntityRelations<Entity = any> = {
  [key in keyof Entity]?: EntityRelation;
};

export const columns = <Entity>(
  columns: EntityColumns<Entity>
): EntityColumns<Entity> => columns;

export const rel = <Entity>(
  r: EntityRelations<Entity>
): EntityRelations<Entity> => r;

export interface TYPEORM_MODEL_CONFIG<Entity> {
  type: EntityClassOrSchema;
  id: string;
  comment?: string;
  name: string;
  schema?: AnySchema;
  relations?: EntityRelations;
  columns?: EntityColumns<Entity>;
}

const schemaFactory = (schema: ObjectSchema): ObjectSchema => null;

type OPERATION_SCHEMA = ObjectSchema | typeof schemaFactory;

export interface TYPEORM_SERVICE_OPTIONS<
  Service extends TypeOrmService = any,
  Entity extends any = any
> {
  model: TYPEORM_MODEL_CONFIG<Entity>;
  operations?: {
    [key in TYPEORM_CRUD_OPERATIONS]?: {
      schema?: OPERATION_SCHEMA;
      handler?: keyof Service;
      columns?: EntityColumns<Entity>;
    };
  };
}

const interceptor = (qr: SelectQueryBuilder<any>, ...args): void => null;

export type QueryInterceptor = typeof interceptor;

export const DefaultInterceptor = (qt) => qt;

const response = (...any): MethodDecorator => null;

const responseWrapper = (any) => null;
export interface TYPEORM_CRUD_OPTIONS<Service> {
  service: any;
  name?: string;
  handler?: keyof Service;
  swagger?: SWAGGER_OPTIONS;
  plural?: boolean;
  void?: boolean;
  params?: ParameterDecorator[];
  interceptor?: QueryInterceptor;
  responses?: MethodDecorator[];
  response?: typeof response;
  body?: typeof getBodySchema;
  extraSwagger?: MethodDecorator[];
  bodySchema?: ObjectSchema;
  operation?: TYPEORM_CRUD_OPERATIONS;
  columns?: EntityColumns;
  withBody?: boolean;
  softDelete?: boolean;
  idParam?: string;
  relationParam?: string;
  responseWrapper?: typeof responseWrapper;
}
