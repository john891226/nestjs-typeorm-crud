import { Get } from '@nestjs/common';
import { TYPEORM_CRUD_OPERATIONS } from '../operations';
import { TYPEORM_CRUD_OPTIONS } from '../typeorm.interfaces';
import { TypeOrmService } from '../typeorm.service';
import { ID_PARAM, mergeSwagger, prepareRoute } from '../typeorm.utils';

export const GetAll = <Service extends TypeOrmService>(
  options: TYPEORM_CRUD_OPTIONS<Service>,
  path?: string,
) => {
  options.swagger = mergeSwagger(
    {
      summary: `Devuelve todo(a)s :name`,
    },
    options.swagger,
  );

  return prepareRoute(
    {
      ...options,
      ...{
        plural: true,
      },
      operation: TYPEORM_CRUD_OPERATIONS.GET_All,
    },
    Get,
    async function () {
      return await (this as Service).find();
    },
    path ?? ID_PARAM,
  );
};
