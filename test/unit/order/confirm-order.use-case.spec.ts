import { ConfirmOrderUseCase } from '@modules/order/application/use-cases/confirm-order.use-case';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { NotFoundException, BusinessRuleException } from '@shared/domain/exceptions';

describe('ConfirmOrderUseCase', () => {
  let useCase: ConfirmOrderUseCase;
  let orderRepository: {
    findById: jest.Mock;
    findByCustomerId: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let inventoryRepository: {
    findMovementsByProductId: jest.Mock;
    save: jest.Mock;
    getBalance: jest.Mock;
  };

  beforeEach(() => {
    orderRepository = {
      findById: jest.fn(),
      findByCustomerId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    inventoryRepository = {
      findMovementsByProductId: jest.fn(),
      save: jest.fn(),
      getBalance: jest.fn(),
    };

    useCase = new ConfirmOrderUseCase(orderRepository, inventoryRepository);
  });

  const orderId = '550e8400-e29b-41d4-a716-446655440000';
  const productId1 = '660e8400-e29b-41d4-a716-446655440001';
  const productId2 = '770e8400-e29b-41d4-a716-446655440002';

  function createDraftOrderWithItems(): OrderAggregate {
    const order = OrderAggregate.create({ customerId: 'customer-uuid' });
    Object.defineProperty(order, '_id', { value: orderId, writable: true });
    order.addItem(productId1, 3, 10.0);
    order.addItem(productId2, 2, 25.5);
    return order;
  }

  describe('execute', () => {
    it('when order has items and stock is sufficient, then confirms and decrements stock', async () => {
      const order = createDraftOrderWithItems();
      orderRepository.findById.mockResolvedValue(order);
      inventoryRepository.getBalance
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);
      inventoryRepository.save.mockImplementation((movement) => {
        Object.defineProperty(movement, '_id', { value: 'mov-uuid', writable: true });
        Object.defineProperty(movement, '_createdAt', { value: new Date(), writable: true });
        return Promise.resolve(movement);
      });
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({ orderId });

      expect(result.status).toBe('confirmed');
      expect(inventoryRepository.save).toHaveBeenCalledTimes(2);
      expect(orderRepository.save).toHaveBeenCalled();
    });

    it('when order does not exist, then throws NotFoundException', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ orderId })).rejects.toThrow(NotFoundException);
    });

    it('when order has no items, then throws BusinessRuleException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      orderRepository.findById.mockResolvedValue(order);

      await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);
    });

    it('when stock is insufficient for one item, then rejects and reports which items failed', async () => {
      const order = createDraftOrderWithItems();
      orderRepository.findById.mockResolvedValue(order);
      inventoryRepository.getBalance
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(1);
      orderRepository.save.mockResolvedValue(order);

      await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);

      expect(order.status).toBe('draft');
    });

    it('when stock is insufficient, then does not decrement any inventory', async () => {
      const order = createDraftOrderWithItems();
      orderRepository.findById.mockResolvedValue(order);
      inventoryRepository.getBalance
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      orderRepository.save.mockResolvedValue(order);

      await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);

      expect(inventoryRepository.save).not.toHaveBeenCalled();
    });

    it('when stock is insufficient, then does not persist the order at all', async () => {
      const order = createDraftOrderWithItems();
      orderRepository.findById.mockResolvedValue(order);
      inventoryRepository.getBalance
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when the sum of duplicate items exceeds stock, then throws BusinessRuleException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      
      (order as any)._items = [
        { productId: productId1, quantity: 7, subtotal: 70 },
        { productId: productId1, quantity: 5, subtotal: 50 },
      ];
      
      orderRepository.findById.mockResolvedValue(order);
      inventoryRepository.getBalance.mockResolvedValue(10); 

      await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);
    });

    it('when items are consolidated, then saves inventory only once per product', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      (order as any)._items = [
        { productId: productId1, quantity: 2, subtotal: 20 },
        { productId: productId1, quantity: 3, subtotal: 30 },
      ];
      
      orderRepository.findById.mockResolvedValue(order);
      inventoryRepository.getBalance.mockResolvedValue(100);

      await useCase.execute({ orderId });

      expect(inventoryRepository.save).toHaveBeenCalledTimes(1);
    });
  });
});
