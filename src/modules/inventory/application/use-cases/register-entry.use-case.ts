import { Injectable, Inject } from '@nestjs/common';
import { InventoryMovement } from '../../domain/entities/inventory-movement.entity';
import {
  InventoryRepository,
  INVENTORY_REPOSITORY,
} from '../../domain/repositories/inventory.repository';
import { ProductRepository } from '../../../product/domain/repositories/product.repository';
import { NotFoundException } from '@shared/domain/exceptions';

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
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepository,
    @Inject('ProductRepository')
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(input: RegisterEntryInput): Promise<RegisterEntryOutput> {
    const product = await this.productRepository.findById(input.productId);

    if (!product) {
      throw new NotFoundException(`Product with id ${input.productId} not found`);
    }

    const movement = InventoryMovement.create({
      productId: input.productId,
      type: 'entry',
      quantity: input.quantity,
    });

    const saved = await this.inventoryRepository.save(movement);

    return {
      id: saved.id,
      productId: saved.productId,
      type: saved.type,
      quantity: saved.quantity,
      createdAt: saved.createdAt,
    };
  }
}
