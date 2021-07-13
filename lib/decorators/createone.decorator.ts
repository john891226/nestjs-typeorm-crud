import { Post } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { TYPEORM_CRUD_OPERATIONS } from '../operations';

import {
  TYPEORM_CRUD_OPTIONS,
} from '../typeorm.interfaces';
import { TypeOrmService } from '../typeorm.service';
import { ID_PARAM, mergeSwagger, prepareRoute } from '../typeorm.utils';

export const CreateOne = <Service extends TypeOrmService>(
  options: TYPEORM_CRUD_OPTIONS<Service>,
  path?: string,
) => {
  options.swagger = mergeSwagger(
    {
      summary: `Crea un(a) :name`,
    },
    options.swagger,
  );

  return prepareRoute(
    {
      ...options,
      ...{
        plural: false,
      },
      void: options.void ?? true,
      responses: [ApiConflictResponse()],
      response: ApiCreatedResponse,
      operation: TYPEORM_CRUD_OPERATIONS.CREATE_ONE,
      withBody: true,
    },
    Post,
    async function (body) {
      return await (this as Service).createOne(body);
    },
    path ?? ID_PARAM,
  );
};
