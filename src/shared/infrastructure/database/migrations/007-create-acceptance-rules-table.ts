import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateAcceptanceRulesTable1700000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'acceptance_rules',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'payment_type_id',
            type: 'uuid',
          },
          {
            name: 'min_value',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'max_value',
            type: 'decimal',
            precision: 12,
            scale: 2,
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
      'acceptance_rules',
      new TableForeignKey({
        columnNames: ['payment_type_id'],
        referencedTableName: 'payment_types',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['payment_type_id'],
        referencedTableName: 'payment_types',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ordersTable = await queryRunner.getTable('orders');
    const ordersFk = ordersTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('payment_type_id') !== -1,
    );
    if (ordersFk) {
      await queryRunner.dropForeignKey('orders', ordersFk);
    }

    const table = await queryRunner.getTable('acceptance_rules');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('payment_type_id') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('acceptance_rules', foreignKey);
    }
    await queryRunner.dropTable('acceptance_rules');
  }
}
