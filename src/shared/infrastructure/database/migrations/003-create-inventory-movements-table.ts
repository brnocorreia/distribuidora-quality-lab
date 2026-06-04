import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateInventoryMovementsTable1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inventory_movements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'product_id',
            type: 'uuid',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '10',
          },
          {
            name: 'quantity',
            type: 'integer',
          },
          {
            name: 'reason',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'inventory_movements',
      new TableForeignKey({
        columnNames: ['product_id'],
        referencedTableName: 'products',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('inventory_movements');
    const foreignKey = table?.foreignKeys.find((fk) => fk.columnNames.indexOf('product_id') !== -1);
    if (foreignKey) {
      await queryRunner.dropForeignKey('inventory_movements', foreignKey);
    }
    await queryRunner.dropTable('inventory_movements');
  }
}
