import { Param, Put } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse } from '@nestjs/swagger';

import { TYPEORM_CRUD_OPERATIONS } from '../operations';
import { TYPEORM_CRUD_OPTIONS } from '../typeorm.interfaces';
import { TypeOrmService } from '../typeorm.service';
import { ID_PARAM, mergeSwagger, prepareRoute } from '../typeorm.utils';

export const UpdateOne = <Service extends TypeOrmService>(
  options: TYPEORM_CRUD_OPTIONS<Service>,
  path?: string,
) => {
  options.swagger = mergeSwagger(
    {
      summary: `Modifica un(a) :name`,
    },
    options.swagger,
  );

  const idParam = options.idParam ?? 'id';
  return prepareRoute(
    {
      ...options,
      ...{
        plural: false,
      },
      void: options.void ?? true,
      responses: [ApiConflictResponse()],
      response: ApiCreatedResponse,
      operation: TYPEORM_CRUD_OPERATIONS.UPDATE_ONE,
      withBody: true,
      params: [Param(idParam)],
    },
    Put,
    async function (id, body) {
      return await (this as Service).replaceOne(id, body);
    },
    path ?? `${ID_PARAM}/:${idParam}`,
  );
};
