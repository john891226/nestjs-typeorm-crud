import {
  assignMetadata,
  Body,
  createParamDecorator,
  Logger,
  NotImplementedException,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { TYPEORM_ENTITY_SERVICE_META } from "./decorators/typeorm.decorators";
import {
  DefaultInterceptor,
  TYPEORM_CRUD_OPTIONS,
  TYPEORM_SERVICE_OPTIONS,
} from "./typeorm.interfaces";
import { TypeOrmService } from "./typeorm.service";
import { singular as singularize, plural as pluralize } from "pluralize";
import j2s from "joi-to-swagger";
import { array, object } from "joi";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { getBodySchema } from "./swagger.helper";
import { JoiPipe } from "./joi.pipe";

const routeHandlerMethod = (path?: string): MethodDecorator => null;

export interface SWAGGER_OPTIONS {
  summary?: string;
}

export const ID_PARAM = ":__id__";

export const prepareRoute = <Service>(
  {
    service,
    handler: customHandler,
    swagger: { summary } = {},
    plural = false,
    void: isVoid = false,
    params = [],
    responses,
    response = ApiOkResponse,
    interceptor = DefaultInterceptor,
    body: bodyFactory = getBodySchema,
    bodySchema,
    operation,
    withBody = false,
    extraSwagger,
    responseWrapper,
    strict = true,
  }: TYPEORM_CRUD_OPTIONS<Service>,
  routeHandler: typeof routeHandlerMethod,
  handler: Function,
  path: string
): MethodDecorator => {
  const meta: TYPEORM_SERVICE_OPTIONS<any, any> = Reflect.getMetadata(
    TYPEORM_ENTITY_SERVICE_META,
    service
  );
  if (!meta) {
    throw new Error(
      `Missing "TypeOrmEntityService" metadata for class: ${service.name}`
    );
  }

  const id = meta.model.id ?? service.name;
  const resolver = routeHandler(path.replace(ID_PARAM, id));

  const sw_operation = summary
    ? ApiOperation({
        summary: summary.replace(
          ":name",
          (plural ? pluralize : singularize)(meta.model.name)
        ),
      })
    : null;

  let okRespSchema =
    isVoid || (!meta.model.schema && !meta.operations?.[operation]?.columns)
      ? null
      : operation && meta.operations?.[operation]?.columns
      ? getBodySchema(meta, meta.operations?.[operation]?.columns)
      : meta.model.schema;

  if (okRespSchema) {
    okRespSchema = plural ? array().items(okRespSchema) : okRespSchema;
  }

  const sw_okresponse = response({
    schema: okRespSchema
      ? j2s(responseWrapper ? responseWrapper(okRespSchema) : okRespSchema)
          .swagger
      : undefined,
  });

  const columns =
    meta.operations?.[operation]?.columns ??
    (meta.model.columns || meta.model.relations
      ? [
          ...(meta.model.columns ?? ["*"]),
          ...Object.keys(meta.model.relations ?? {}),
        ]
      : null);

  const body = withBody
    ? operation && meta.operations?.[operation]?.schema
      ? typeof meta.operations?.[operation]?.schema == "function"
        ? (meta.operations?.[operation]?.schema as any)(
            bodySchema ?? bodyFactory(meta, columns, operation)
          )
        : meta.operations?.[operation]?.schema
      : bodySchema ?? bodyFactory
      ? bodyFactory(meta, columns, operation, strict)
      : null
    : null;

  const bodyParam = body ? Body(new JoiPipe(body)) : null;

  const sw_body = body
    ? ApiBody({
        schema: j2s(body).swagger,
      })
    : null;

  return (target: any, property: string, descriptor: PropertyDescriptor) => {
    const old = descriptor.value;

    const method = {
      [property]: async function () {
        if (!(this as object).hasOwnProperty(id))
          throw new NotImplementedException();

        return customHandler
          ? await this[id][customHandler](...arguments)
          : operation && meta.operations?.[operation].handler
          ? await this[id][meta.operations?.[operation].handler](...arguments)
          : await handler.call(this[id], ...arguments);
      },
    };
    descriptor.value = method[property];

    resolver(target, property, descriptor);

    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      target.constructor,
      property
    );
    let index = metadata ? Object.keys(metadata).length : 0;
    if (params?.length > 0) {
      for (const paramDec of params) {
        paramDec(target, property, index);
        index++;
      }
    }

    if (bodyParam) bodyParam(target, property, index);
    index++;

    if (extraSwagger?.length > 0) {
      for (const m of extraSwagger) {
        m(target, property, descriptor);
      }
    }

    if (sw_body) sw_body(target, property, descriptor);
    if (sw_operation) sw_operation(target, property, descriptor);
    if (sw_okresponse) sw_okresponse(target, property, descriptor);

    if (responses)
      responses.forEach((rp) => {
        rp(target, property, descriptor);
      });

    return descriptor;
  };
};

export const mergeSwagger = (
  merge: SWAGGER_OPTIONS,
  swagger?: SWAGGER_OPTIONS
) => ({ ...merge, ...(swagger ?? {}) });
