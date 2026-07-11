import { Injectable, Inject } from '@nestjs/common';
import { InventoryService } from '../../domain/services/inventory.service';
import {
  InventoryRepository,
  INVENTORY_REPOSITORY,
} from '../../domain/repositories/inventory.repository';
import { ProductRepository } from '../../../product/domain/repositories/product.repository';

export interface RegisterEntryInput {
  productId: string;
  quantity: number;
}

export interface RegisterEntryOutput {
  id: string;
  productId: string;
  type: string;
  quantity: number;
  createdAt: Date;
}

@Injectable()
export class RegisterEntryUseCase {
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

  async execute(input: RegisterEntryInput): Promise<RegisterEntryOutput> {
    const saved = await this.inventoryService.registerEntry(input);

    return {
      id: saved.id,
      productId: saved.productId,
      type: saved.type,
      quantity: saved.quantity,
      createdAt: saved.createdAt,
    };
  }
}
