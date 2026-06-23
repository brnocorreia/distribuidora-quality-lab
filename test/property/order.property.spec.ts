import * as fc from 'fast-check';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { OrderStatus, OrderStatusValue } from '@modules/order/domain/value-objects/order-status.vo';
import { ConfirmOrderUseCase } from '@modules/order/application/use-cases/confirm-order.use-case';
import { CancelOrderUseCase } from '@modules/order/application/use-cases/cancel-order.use-case';
import { OrderRepository } from '@modules/order/domain/repositories/order.repository';
import { InventoryRepository } from '@modules/inventory/domain/repositories/inventory.repository';
import { InventoryMovement } from '@modules/inventory/domain/entities/inventory-movement.entity';
import { BusinessRuleException } from '@shared/domain/exceptions';
import { v4 as uuidv4 } from 'uuid';

// --- In-Memory Fakes ---

class InMemoryOrderRepository implements OrderRepository {
  private store = new Map<string, OrderAggregate>();

  async findById(id: string): Promise<OrderAggregate | null> {
    return this.store.get(id) ?? null;
  }

  async findByCustomerId(customerId: string): Promise<OrderAggregate[]> {
    return Array.from(this.store.values()).filter((o) => o.customerId === customerId);
  }

  async save(order: OrderAggregate): Promise<OrderAggregate> {
    this.store.set(order.id, order);
    return order;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  addOrder(order: OrderAggregate): void {
    this.store.set(order.id, order);
  }
}

class InMemoryInventoryRepository implements InventoryRepository {
  private movements: InventoryMovement[] = [];

  async findMovementsByProductId(productId: string): Promise<InventoryMovement[]> {
    return this.movements.filter((m) => m.productId === productId);
  }

  async save(movement: InventoryMovement): Promise<InventoryMovement> {
    if (!movement.id) {
      Object.defineProperty(movement, '_id', { value: uuidv4(), writable: true });
      Object.defineProperty(movement, '_createdAt', { value: new Date(), writable: true });
    }
    this.movements.push(movement);
    return movement;
  }

  async getBalance(productId: string): Promise<number> {
    const productMovements = this.movements.filter((m) => m.productId === productId);
    let balance = 0;
    for (const m of productMovements) {
      if (m.type === 'entry') {
        balance += m.quantity;
      } else {
        balance -= m.quantity;
      }
    }
    return balance;
  }

  getMovements(): InventoryMovement[] {
    return [...this.movements];
  }

  clear(): void {
    this.movements = [];
  }

  /** Seed initial stock for a product */
  async seedStock(productId: string, quantity: number): Promise<void> {
    const movement = InventoryMovement.create({
      productId,
      type: 'entry',
      quantity,
    });
    await this.save(movement);
  }
}

function createInMemoryDataSource(
  orderRepo: InMemoryOrderRepository,
  inventoryRepo: InMemoryInventoryRepository,
) {
  return {
    transaction: jest.fn().mockImplementation(async (cb) => {
      const manager = {
        save: jest.fn().mockImplementation(async (entityClass, entity) => {
          if (entityClass === InventoryMovement) {
            return inventoryRepo.save(entity);
          }

          if (entityClass === OrderAggregate) {
            return orderRepo.save(entity);
          }

          return entity;
        }),
      };

      return cb(manager);
    }),
  };
}

// --- Helpers ---

function createOrderWithItems(
  items: Array<{ quantity: number; unitPrice: number }>,
): OrderAggregate {
  const order = OrderAggregate.create({ customerId: uuidv4() });
  Object.defineProperty(order, '_id', { value: uuidv4(), writable: true });

  for (const item of items) {
    order.addItem(uuidv4(), item.quantity, item.unitPrice);
  }

  return order;
}

function createOrderInState(state: OrderStatusValue): OrderAggregate {
  const order = OrderAggregate.create({ customerId: uuidv4() });
  Object.defineProperty(order, '_id', { value: uuidv4(), writable: true });

  // Add an item so transitions work
  order.addItem(uuidv4(), 1, 10.0);

  // Walk through the state machine to reach the desired state
  if (state === 'draft') return order;

  order.transitionTo('confirmed');
  if (state === 'confirmed') return order;

  if (state === 'cancelled') {
    // Reset to draft and cancel from draft
    const freshOrder = OrderAggregate.create({ customerId: uuidv4() });
    Object.defineProperty(freshOrder, '_id', { value: uuidv4(), writable: true });
    freshOrder.addItem(uuidv4(), 1, 10.0);
    freshOrder.cancel();
    return freshOrder;
  }

  order.transitionTo('in_separation');
  if (state === 'in_separation') return order;

  order.transitionTo('shipped');
  if (state === 'shipped') return order;

  order.transitionTo('delivered');
  if (state === 'delivered') return order;

  return order;
}

// --- Generators ---

const itemArb = fc
  .record({
    quantity: fc.integer({ min: 1, max: 100 }),
    unitPrice: fc.integer({ min: 1, max: 999999 }),
  })
  .map(({ quantity, unitPrice }) => ({
    quantity,
    unitPrice: Number((unitPrice / 100).toFixed(2)),
  }))
  .filter(({ unitPrice }) => unitPrice > 0);

const itemsArb = fc.array(itemArb, { minLength: 1, maxLength: 20 });

const allStatuses: OrderStatusValue[] = [
  'draft',
  'confirmed',
  'in_separation',
  'shipped',
  'delivered',
  'cancelled',
];

const statusArb = fc.constantFrom(...allStatuses);
const nonDraftStatusArb = fc.constantFrom(
  'confirmed' as OrderStatusValue,
  'in_separation' as OrderStatusValue,
  'shipped' as OrderStatusValue,
  'delivered' as OrderStatusValue,
  'cancelled' as OrderStatusValue,
);

// --- Property Tests ---

describe('Property Tests — Order Module', () => {
  describe('Property 9: Cálculo do valor total do pedido', () => {
    /**
     * **Validates: Requirements 4.2**
     *
     * For any set of items with quantities q_i and prices p_i,
     * total = ∑(q_i × p_i)
     */
    it('for any set of items, totalAmount equals sum of (quantity * unitPrice) for each item', () => {
      fc.assert(
        fc.property(itemsArb, (items) => {
          // Arrange & Act
          const order = createOrderWithItems(items);

          // Assert — calculate expected total
          const expectedTotal = items.reduce(
            (sum, item) => sum + Number((item.quantity * item.unitPrice).toFixed(2)),
            0,
          );

          expect(order.totalAmount).toBeCloseTo(Number(expectedTotal.toFixed(2)), 2);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 10: Máquina de estados do pedido', () => {
    /**
     * **Validates: Requirements 4.5, 4.9**
     *
     * For any pair (current, target), transition is accepted iff in allowed set:
     * {(draft, confirmed), (confirmed, in_separation), (in_separation, shipped),
     *  (shipped, delivered), (draft, cancelled), (confirmed, cancelled), (in_separation, cancelled)}
     */
    const VALID_TRANSITIONS: Array<[OrderStatusValue, OrderStatusValue]> = [
      ['draft', 'confirmed'],
      ['draft', 'cancelled'],
      ['confirmed', 'in_separation'],
      ['confirmed', 'cancelled'],
      ['in_separation', 'shipped'],
      ['in_separation', 'cancelled'],
      ['shipped', 'delivered'],
    ];

    function isValidTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
      return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
    }

    it('for any pair of states, transition succeeds iff in the allowed set', () => {
      fc.assert(
        fc.property(statusArb, statusArb, (current, target) => {
          // Arrange
          const orderStatus = OrderStatus.create(current);
          const shouldSucceed = isValidTransition(current, target);

          // Act & Assert
          if (shouldSucceed) {
            const result = orderStatus.transitionTo(target);
            expect(result.value).toBe(target);
          } else {
            expect(() => orderStatus.transitionTo(target)).toThrow(BusinessRuleException);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 11: Confirmação e cancelamento são round-trip no estoque', () => {
    /**
     * **Validates: Requirements 4.6, 4.7, 4.8**
     *
     * Confirm decrements stock; cancel restores it.
     * For any order with items that have sufficient stock,
     * confirm decrements balance by item quantities,
     * and cancel restores balance to original.
     */
    it('confirming an order decrements stock, cancelling restores it to original', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc
              .record({
                quantity: fc.integer({ min: 1, max: 50 }),
                unitPrice: fc.integer({ min: 1, max: 99999 }),
              })
              .map(({ quantity, unitPrice }) => ({
                quantity,
                unitPrice: Number((unitPrice / 100).toFixed(2)),
                productId: uuidv4(),
              }))
              .filter(({ unitPrice }) => unitPrice > 0),
            { minLength: 1, maxLength: 5 },
          ),
          async (items) => {
            // Arrange
            const orderRepo = new InMemoryOrderRepository();
            const inventoryRepo = new InMemoryInventoryRepository();

            // Create order in draft with items
            const order = OrderAggregate.create({ customerId: uuidv4() });
            Object.defineProperty(order, '_id', { value: uuidv4(), writable: true });

            for (const item of items) {
              order.addItem(item.productId, item.quantity, item.unitPrice);
            }
            order.setPaymentType(uuidv4());
            orderRepo.addOrder(order);

            // Seed sufficient stock (2x quantity to ensure enough)
            const initialStockPerProduct = new Map<string, number>();
            for (const item of items) {
              const stock = item.quantity * 2;
              await inventoryRepo.seedStock(item.productId, stock);
              initialStockPerProduct.set(item.productId, stock);
            }

            const mockValidatePaymentUseCase = {
              execute: jest.fn().mockResolvedValue({ valid: true })
            };

            const mockLogger = { logStructured: jest.fn() };
            const dataSource = createInMemoryDataSource(orderRepo, inventoryRepo);
            const confirmUseCase = new ConfirmOrderUseCase(
              orderRepo,
              inventoryRepo,
              mockValidatePaymentUseCase as any,
              dataSource as any,
              mockLogger as any,
            );
            const cancelUseCase = new CancelOrderUseCase(
              orderRepo,
              dataSource as any,
              mockLogger as any,
            );

            // Act — confirm order
            await confirmUseCase.execute({ orderId: order.id });

            // Assert — stock decremented by item quantities
            for (const item of items) {
              const balance = await inventoryRepo.getBalance(item.productId);
              const initial = initialStockPerProduct.get(item.productId)!;
              expect(balance).toBe(initial - item.quantity);
            }

            // Act — cancel order
            await cancelUseCase.execute({ orderId: order.id });

            // Assert — stock restored to original
            for (const item of items) {
              const balance = await inventoryRepo.getBalance(item.productId);
              const initial = initialStockPerProduct.get(item.productId)!;
              expect(balance).toBe(initial);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 12: Modificação de itens apenas no estado rascunho', () => {
    /**
     * **Validates: Requirements 4.2, 4.3, 4.11**
     *
     * For any order not in draft state, add/remove items is rejected.
     */
    it('for any order in non-draft state, addItem throws BusinessRuleException', () => {
      fc.assert(
        fc.property(nonDraftStatusArb, (targetState) => {
          // Arrange — create order in the non-draft state
          const order = createOrderInState(targetState);

          // Act & Assert — attempting to add item throws
          expect(() => order.addItem(uuidv4(), 1, 10.0)).toThrow(BusinessRuleException);
        }),
        { numRuns: 100 },
      );
    });

    it('for any order in non-draft state, removeItem throws BusinessRuleException', () => {
      fc.assert(
        fc.property(nonDraftStatusArb, (targetState) => {
          // Arrange — create order in the non-draft state
          const order = createOrderInState(targetState);
          const existingItemId = order.items[0]?.id ?? uuidv4();

          // Act & Assert — attempting to remove item throws
          expect(() => order.removeItem(existingItemId)).toThrow(BusinessRuleException);
        }),
        { numRuns: 100 },
      );
    });
  });
});
