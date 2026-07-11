import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeInventoryReasonNullable1700000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "inventory_movements" ALTER COLUMN "reason" DROP NOT NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "inventory_movements" ALTER COLUMN "reason" SET NOT NULL');
  }
}
