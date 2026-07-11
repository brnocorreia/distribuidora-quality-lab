import { Injectable, Inject } from '@nestjs/common';
import { InventoryService } from '../../domain/services/inventory.service';
import {
  InventoryRepository,
  INVENTORY_REPOSITORY,
} from '../../domain/repositories/inventory.repository';
import { ProductRepository } from '../../../product/domain/repositories/product.repository';

export interface RegisterWithdrawalInput {
  productId: string;
  quantity: number;
  reason: string;
}

export interface RegisterWithdrawalOutput {
  id: string;
  productId: string;
  type: string;
  quantity: number;
  reason: string;
  createdAt: Date;
}

@Injectable()
export class RegisterWithdrawalUseCase {
  private readonly inventoryService: InventoryService;

  constructor(
    @Inject(INVENTORY_REPOSITORY)
    inventoryRepositoryOrService?: InventoryRepository | InventoryService,
    @Inject('ProductRepository')
    productRepository?: ProductRepository,
  ) {
    this.inventoryService =
      inventoryRepositoryOrService instanceof InventoryService
        ? inventoryRepositoryOrService
        : new InventoryService(
            inventoryRepositoryOrService as InventoryRepository,
            productRepository as ProductRepository,
          );
  }

  async execute(input: RegisterWithdrawalInput): Promise<RegisterWithdrawalOutput> {
    const saved = await this.inventoryService.registerWithdrawal(input);

    return {
      id: saved.id,
      productId: saved.productId,
      type: saved.type,
      quantity: saved.quantity,
      reason: saved.reason!,
      createdAt: saved.createdAt,
    };
  }
}
