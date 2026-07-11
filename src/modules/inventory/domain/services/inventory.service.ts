import { Injectable, Inject } from '@nestjs/common';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import {
  InventoryRepository,
  INVENTORY_REPOSITORY,
} from '../repositories/inventory.repository';
import { ProductRepository } from '../../../product/domain/repositories/product.repository';
import { NotFoundException } from '@shared/domain/exceptions';
import { StockBalance } from '../value-objects/stock-balance.vo';

export interface RegisterInventoryEntryInput {
  productId: string;
  quantity: number;
}

export interface RegisterInventoryWithdrawalInput {
  productId: string;
  quantity: number;
  reason: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepository,
    @Inject('ProductRepository')
    private readonly productRepository: ProductRepository,
  ) {}

  async registerEntry(
    input: RegisterInventoryEntryInput,
  ): Promise<InventoryMovement> {
    const product = await this.productRepository.findById(input.productId);

    if (!product) {
      throw new NotFoundException(`Product with id ${input.productId} not found`);
    }

    const movement = InventoryMovement.create({
      productId: input.productId,
      type: 'entry',
      quantity: input.quantity,
    });

    return this.inventoryRepository.save(movement);
  }

  async registerWithdrawal(
    input: RegisterInventoryWithdrawalInput,
  ): Promise<InventoryMovement> {
    const product = await this.productRepository.findById(input.productId);

    if (!product) {
      throw new NotFoundException(`Product with id ${input.productId} not found`);
    }

    const currentBalance = await this.inventoryRepository.getBalance(
      input.productId,
    );
    const balance = StockBalance.create(currentBalance);
    const newBalance = balance.subtract(input.quantity);

    const movement = InventoryMovement.create({
      productId: input.productId,
      type: 'withdrawal',
      quantity: input.quantity,
      reason: input.reason,
    });

    const saved = await this.inventoryRepository.save(movement);

    if (newBalance.isZero) {
      product.markAsUnavailable();
      await this.productRepository.save(product);
    }

    return saved;
  }
}
