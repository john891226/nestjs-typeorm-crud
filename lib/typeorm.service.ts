import {
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  NotImplementedException,
} from "@nestjs/common";
import { In, Repository, SelectQueryBuilder } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { TYPEORM_ENTITY_SERVICE_META } from "./decorators/typeorm.decorators";
import {
  DefaultInterceptor,
  EntityRelations,
  QueryInterceptor,
  TYPEORM_SERVICE_OPTIONS,
} from "./typeorm.interfaces";

export class TypeOrmService<Entity = any> {
  constructor(public readonly repository: Repository<Entity>) {}

  get alias(): string {
    return "entity";
  }

  qr(
    interceptor: QueryInterceptor = DefaultInterceptor,
    ...args
  ): SelectQueryBuilder<Entity> {
    const qr = this.repository.createQueryBuilder(this.alias);
    const { relations: rels, columns: mColumns } = this.meta.model;
    const {
      metadata: { relations: rMeta, columns },
    } = this.repository;
    if (mColumns?.length > 0) {
      qr.select(mColumns.map((c) => `${this.alias}.${c as string}`));
    }
    if (rels) {
      this.addJoins(qr, rels, this.repository, this.alias);
    }

    const q = qr.getQuery();
    if (interceptor) interceptor(qr, ...args);
    return qr;
  }

  addJoins(
    qr: SelectQueryBuilder<any>,
    rels: EntityRelations,
    {
      metadata: { relations: rMeta, columns: rColumns, connection },
    }: Repository<any>,
    alias: string
  ) {
    for (const rel in rels) {
      const { isNullable, propertyPath, type }: RelationMetadata = rMeta.find(
        ({ propertyName }) => propertyName == rel
      );
      const propertyAlias = `${Math.random()}`;
      const { columns, relations } = rels[rel];
      if (columns?.length > 0) {
        if (isNullable) {
          qr.leftJoin(`${alias}.${propertyPath}`, `${propertyAlias}`);
        } else {
          qr.innerJoin(`${alias}.${propertyPath}`, `${propertyAlias}`);
        }
        for (const col of columns) {
          qr.addSelect(
            `${propertyAlias}.${col as string}`,
            `${propertyAlias}_${col as string}`
          );
        }
      } else {
        if (isNullable) {
          qr.leftJoinAndSelect(`${alias}.${propertyPath}`, `${propertyAlias}`);
        } else {
          qr.innerJoinAndSelect(`${alias}.${propertyPath}`, `${propertyAlias}`);
        }
      }

      if (relations) {
        const relationRepository = connection.getRepository(type);
        this.addJoins(
          qr,
          relationRepository as any,
          relations as any,
          propertyAlias
        );
      }
    }
  }

  get meta(): TYPEORM_SERVICE_OPTIONS {
    return Reflect.getMetadata(
      TYPEORM_ENTITY_SERVICE_META,
      (this as any).constructor
    );
  }

  get pk() {
    return this.repository.metadata.primaryColumns[0].propertyName;
  }

  async find(
    page?: number,
    page_size?: number,
    count?: boolean,
    interceptor?: QueryInterceptor
  ) {
    const qr = this.qr(interceptor);
    if (typeof page != "undefined") {
      qr.take(page_size).skip(page_size * (page - 1));
    }

    const pagination = typeof page != "undefined";

    const [data, ct] =
      count && pagination ? await qr.getManyAndCount() : [await qr.getMany()];

    return {
      page: page ?? 1,
      page_size: pagination ? Math.min(page_size, data.length) : data.length,
      total: pagination ? ct : data.length,
      pages: pagination ? (count ? Math.ceil(ct / page_size) : undefined) : 1,
      data,
    };
  }

  async findOne(id: any, interceptor?: QueryInterceptor) {
    const pk = this.repository.metadata.primaryColumns;
    if (pk.length == 1) {
      return await this.qr(interceptor, id).andWhereInIds(id).getOne();
    } else {
      //todo implement for multiple pks
      throw new NotImplementedException();
    }
  }

  async getRecord(dto: any) {
    const record = {};
    const {
      metadata: { uniques, columns, relations, connection, ...metadata },
    } = this.repository;

    for (const { propertyName } of columns) {
      if (!(propertyName in dto)) continue;
      record[propertyName] = dto[propertyName];
    }

    await Promise.all(
      relations.map(
        async ({
          relationType,
          type,
          propertyName,
          inverseRelation,
          isManyToMany,
          ...rel
        }) => {
          if (!(propertyName in dto)) return;
          if (inverseRelation) return;
          const repo = connection.getRepository(type);
          const needle = dto[propertyName];
          if (needle === null) return (record[propertyName] = null);
          const {
            metadata: { primaryColumns },
          } = repo;
          const [{ propertyName: pk }] = primaryColumns;
          if (isManyToMany) {
            const results = await repo.find({
              select: [pk],
              where: {
                [pk]: In(needle),
              },
            });

            if (results.length == needle.length) {
              return (record[propertyName] = results);
            }

            const missing = needle.filter(
              (id) => !results.find((r) => r[pk] == id)
            );
            throw new NotFoundException(
              `No se encontraron lo(a)s "${
                repo.metadata.name
              }": (${missing.join(",")})`
            );
          } else {
            const ref = await repo.findOne({
              select: [pk],
              where: {
                [pk]: needle,
              },
            });
            if (!ref)
              throw new NotFoundException(
                `No se ha encontrado la(el) "${repo.metadata.name}": ${needle}`
              );

            return (record[propertyName] = ref);
          }
        }
      )
    );

    return record;
  }

  async createOne(createDto: any): Promise<void> {
    const record = await this.getRecord(createDto);
    try {
      const created = await this.repository.save(record);
    } catch (e) {
      throw new InternalServerErrorException(
        `Ha ocurrido un error guardando el ${this.repository.metadata.name}`
      );
    }
  }

  private async findOrFail(id: any, onlyId: boolean = false): Promise<Entity> {
    const row = await this.findOne(id, (qr: SelectQueryBuilder<any>) => {
      qr.select([`${this.alias}.${this.pk}`]);
    });
    if (!row)
      throw new NotFoundException(
        `No se encontro el(la) ${this.repository.metadata.name}: ${id}`
      );
    return row;
  }

  async replaceOne(id: any, replaceDto: any): Promise<void> {
    let row = await this.findOrFail(id);
    const record = await this.getRecord(replaceDto);
    row = { ...row, ...record };
    try {
      const updated = await this.repository.save(row);
    } catch (e) {
      throw new InternalServerErrorException();
    }
  }

  async deleteOne(id: any, soft: boolean = false) {
    let row = await this.findOrFail(id, true);
    try {
      const deleted = soft
        ? await this.repository.softDelete(row)
        : await this.repository.delete(row);
    } catch (e) {
      throw new InternalServerErrorException();
    }
  }

  async checkRelation(relation: string) {
    const {
      metadata: { relations, connection },
    } = this.repository;
    const relationMeta = relations.find((r) => r.propertyName == relation);
    if (!relationMeta)
      throw new NotFoundException(`No se encontro la relacion: ${relation}`);
    const {
      model: { relations: rels },
    } = this.meta;
    if (rels && !(relation in rels)) throw new ForbiddenException();
    return connection.getRepository(relationMeta.type);
  }

  async addRelation(id: any, relationId: any, relation: string) {
    const row = await this.findOrFail(id);
    const repository = await this.checkRelation(relation);
    const relRecord = await repository.findOne(relationId);
    if (!relRecord)
      throw new NotFoundException(
        `No se encontro el(la) ${repository.metadata.name}: ${relationId}`
      );
    try {
      const added = await this.qr().relation(relation).of(row).add(relRecord);
    } catch (e) {}
  }

  async deleteRelation(id: any, relationId: any, relation: string) {
    const row = await this.findOrFail(id);
    const repository = await this.checkRelation(relation);
    const relRecord = await repository.findOne(relationId);
    if (!relRecord)
      throw new NotFoundException(
        `No se encontro el(la) ${repository.metadata.name}: ${relationId}`
      );
    try {
      const deleted = await this.qr()
        .relation(relation)
        .of(row)
        .remove(relRecord);
    } catch (e) {}
  }
}
