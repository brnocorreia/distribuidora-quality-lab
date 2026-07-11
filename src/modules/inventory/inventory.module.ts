import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryMovement } from './domain/entities/inventory-movement.entity';
import { INVENTORY_REPOSITORY } from './domain/repositories/inventory.repository';
import { TypeOrmInventoryRepository } from './infrastructure/persistence/typeorm-inventory.repository';
import { RegisterEntryUseCase } from './application/use-cases/register-entry.use-case';
import { RegisterWithdrawalUseCase } from './application/use-cases/register-withdrawal.use-case';
import { GetBalanceUseCase } from './application/use-cases/get-balance.use-case';
import { GetMovementHistoryUseCase } from './application/use-cases/get-movement-history.use-case';
import { InventoryController } from './interface/controllers/inventory.controller';
import { ProductModule } from '../product/product.module';
import { InventoryService } from './domain/services/inventory.service';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryMovement]), ProductModule],
  controllers: [InventoryController],
  providers: [
    {
      provide: INVENTORY_REPOSITORY,
      useClass: TypeOrmInventoryRepository,
    },
    InventoryService,
    RegisterEntryUseCase,
    RegisterWithdrawalUseCase,
    GetBalanceUseCase,
    GetMovementHistoryUseCase,
  ],
  exports: [INVENTORY_REPOSITORY],
})
export class InventoryModule {}
