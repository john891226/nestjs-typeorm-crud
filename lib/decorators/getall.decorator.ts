import { Get, Logger, Param, Query } from "@nestjs/common";
import { ApiParam, ApiQuery } from "@nestjs/swagger";
import { boolean, number } from "joi";
import { JoiPipe } from "../joi.pipe";
import { TYPEORM_CRUD_OPERATIONS } from "../operations";
import { TYPEORM_CRUD_OPTIONS } from "../typeorm.interfaces";
import { TypeOrmService } from "../typeorm.service";
import { ID_PARAM, mergeSwagger, prepareRoute } from "../typeorm.utils";

export const GetAll = <Service extends TypeOrmService>(
  options: TYPEORM_CRUD_OPTIONS<Service>,
  path?: string,
  paginated: boolean = false,
  defaultPageSize?: number,
  maxPageSize?: number
) => {
  options.swagger = mergeSwagger(
    {
      summary: `Devuelve todo(a)s :name`,
    },
    options.swagger
  );

  return prepareRoute(
    {
      ...options,
      ...{
        plural: true,
      },
      operation: TYPEORM_CRUD_OPERATIONS.GET_All,
      params: [
        Query(
          "page",
          new JoiPipe(number().min(1)[paginated ? "required" : "optional"]())
        ),
        Query(
          "page_size",
          new JoiPipe(
            number()
              .min(1)
              .max(maxPageSize ?? 500)
              .default(defaultPageSize ?? 10)
              .optional()
          )
        ),
        Query("count", new JoiPipe(boolean().optional())),
      ],
      extraSwagger: [
        ApiQuery({
          name: "page",
          type: "number",
          required: paginated,
        }),
        ApiQuery({
          name: "page_size",
          type: "number",
          required: false,
        }),
        ApiQuery({
          name: "count",
          type: Boolean,
          description: `Define si se debe contar todos los registros`,
          required: false,
        }),
      ],
      responseWrapper: (sch) => {
        return {
          page: number().required(),
          page_size: number().required(),
          pages: number().optional(),
          total: number().optional(),
          data: sch,
        };
      },
    },
    Get,
    async function (page, page_size, count) {
      return await (this as Service).find(
        page,
        page_size,
        count,
        options.interceptor
      );
    },
    path ?? ID_PARAM
  );
};
