import { Delete, Param, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { TYPEORM_CRUD_OPERATIONS } from '../operations';

import { TYPEORM_CRUD_OPTIONS } from '../typeorm.interfaces';
import { TypeOrmService } from '../typeorm.service';
import { ID_PARAM, mergeSwagger, prepareRoute } from '../typeorm.utils';

export const DeleteRelation = <Service extends TypeOrmService, Entity = any>(
  options: TYPEORM_CRUD_OPTIONS<Service>,
  relation: keyof Entity,
  path?: string,
) => {
  options.swagger = mergeSwagger(
    {
      summary: `Quitar la asociacion a :name una relacion con: ${relation}`,
    },
    options.swagger,
  );

  const idParam = options.idParam ?? 'id';
  const relationParam = options.relationParam ?? 'relation';
  return prepareRoute(
    {
      ...options,
      ...{
        plural: false,
      },
      void: options.void ?? true,
      responses: [ApiConflictResponse()],
      response: ApiCreatedResponse,
      params: [Param(idParam), Param(relationParam)],
      operation: TYPEORM_CRUD_OPERATIONS.DELETE_RELATION,
      withBody: false,
      extraSwagger: [
        ApiParam({
          name: relationParam,
          description: `Identificador del ${relation}`,
        }),
      ],
    },
    Delete,
    async function (id: any, relationId: any) {
      return await (this as Service).deleteRelation(
        id,
        relationId,
        relation as string,
      );
    },
    path ?? `${ID_PARAM}/:${idParam}/${relation}/:${relationParam}`,
  );
};
