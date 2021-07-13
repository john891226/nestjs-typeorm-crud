import { Delete, Param } from '@nestjs/common';
import { TYPEORM_CRUD_OPERATIONS } from '../operations';
import { TYPEORM_CRUD_OPTIONS } from '../typeorm.interfaces';
import { TypeOrmService } from '../typeorm.service';
import { ID_PARAM, mergeSwagger, prepareRoute } from '../typeorm.utils';

export const DeleteOne = <Service extends TypeOrmService>(
  options: TYPEORM_CRUD_OPTIONS<Service>,
  path?: string,
) => {
  options.swagger = mergeSwagger(
    {
      summary: `Elimina un(a) :name`,
    },
    options.swagger,
  );

  const idParam = options.idParam??'id';
  return prepareRoute(
    {
      ...options,
      ...{
        plural: false,
      },
      params: [Param(idParam)],
      operation: TYPEORM_CRUD_OPERATIONS.DELETE_ONE,
      void: true,
    },
    Delete,
    async function (id: any) {
      return await (this as Service).deleteOne(id, options.softDelete);
    },
    path ?? `${ID_PARAM}/:${idParam}`,
  );
};
