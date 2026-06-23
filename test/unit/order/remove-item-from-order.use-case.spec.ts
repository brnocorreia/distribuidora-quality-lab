import { RemoveItemFromOrderUseCase } from '@modules/order/application/use-cases/remove-item-from-order.use-case';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { BusinessRuleException, NotFoundException } from '@shared/domain/exceptions';

describe('RemoveItemFromOrderUseCase', () => {
  let useCase: RemoveItemFromOrderUseCase;
  let orderRepository: {
    findById: jest.Mock;
    findByCustomerId: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const mockLogger = { logStructured: jest.fn() };

  beforeEach(() => {
    orderRepository = {
      findById: jest.fn(),
      findByCustomerId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new RemoveItemFromOrderUseCase(orderRepository, mockLogger as any);
  });

  const orderId = '550e8400-e29b-41d4-a716-446655440000';
  const productId = '660e8400-e29b-41d4-a716-446655440001';

  describe('execute', () => {
    it('when order and item exist in draft, then removes item and returns updated totals', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      const item = order.addItem(productId, 2, 10.0);
      Object.defineProperty(item, '_id', { value: 'item-uuid', writable: true });

      orderRepository.findById.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({ orderId, itemId: 'item-uuid' });

      expect(result.orderId).toBe(orderId);
      expect(result.removedItemId).toBe('item-uuid');
      expect(result.itemCount).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(orderRepository.save).toHaveBeenCalledWith(order);
    });

    it('when order has multiple items, then removes only the specified item and recalculates total', async () => {
      const productId2 = '660e8400-e29b-41d4-a716-446655440002';
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      const item1 = order.addItem(productId, 2, 10.0);
      Object.defineProperty(item1, '_id', { value: 'item-uuid-1', writable: true });
      const item2 = order.addItem(productId2, 3, 5.0);
      Object.defineProperty(item2, '_id', { value: 'item-uuid-2', writable: true });

      orderRepository.findById.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({ orderId, itemId: 'item-uuid-1' });

      expect(result.removedItemId).toBe('item-uuid-1');
      expect(result.itemCount).toBe(1);
      expect(result.totalAmount).toBe(15.0);
    });

    it('when order does not exist, then throws NotFoundException', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ orderId, itemId: 'item-uuid' })).rejects.toThrow(
        NotFoundException,
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when item does not exist in order, then throws BusinessRuleException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem(productId, 1, 10.0);

      orderRepository.findById.mockResolvedValue(order);

      await expect(useCase.execute({ orderId, itemId: 'non-existent-item' })).rejects.toThrow(
        BusinessRuleException,
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when order is not in draft state, then throws BusinessRuleException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      const item = order.addItem(productId, 1, 10.0);
      Object.defineProperty(item, '_id', { value: 'item-uuid', writable: true });
      order.setPaymentType('payment-uuid');
      order.confirm();

      orderRepository.findById.mockResolvedValue(order);

      await expect(useCase.execute({ orderId, itemId: 'item-uuid' })).rejects.toThrow(
        BusinessRuleException,
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
    });
  });
});
