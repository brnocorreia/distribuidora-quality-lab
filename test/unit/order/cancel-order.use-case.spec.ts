import { CancelOrderUseCase } from '@modules/order/application/use-cases/cancel-order.use-case';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { NotFoundException, BusinessRuleException } from '@shared/domain/exceptions';

describe('CancelOrderUseCase', () => {
  let useCase: CancelOrderUseCase;
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

    useCase = new CancelOrderUseCase(orderRepository, inventoryRepository);
  });

  const orderId = '550e8400-e29b-41d4-a716-446655440000';
  const productId1 = '660e8400-e29b-41d4-a716-446655440001';

  describe('execute', () => {
    it('when order is in draft, then cancels without reverting stock', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      orderRepository.findById.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({ orderId });

      expect(result.currentStatus).toBe('cancelled');
      expect(result.stockReverted).toBe(false);
      expect(inventoryRepository.save).not.toHaveBeenCalled();
    });

    it('when order is confirmed, then cancels and reverts stock', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem(productId1, 5, 10.0);
      // Transition to confirmed via the public setter (intentional violation)
      order.status = 'confirmed';

      orderRepository.findById.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(order);
      inventoryRepository.save.mockImplementation((movement) => {
        Object.defineProperty(movement, '_id', { value: 'mov-uuid', writable: true });
        Object.defineProperty(movement, '_createdAt', { value: new Date(), writable: true });
        return Promise.resolve(movement);
      });

      const result = await useCase.execute({ orderId });

      expect(result.currentStatus).toBe('cancelled');
      expect(result.stockReverted).toBe(true);
      expect(inventoryRepository.save).toHaveBeenCalledTimes(1);
    });

    it('when order is in_separation, then cancels and reverts stock', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem(productId1, 3, 20.0);
      order.status = 'in_separation';

      orderRepository.findById.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(order);
      inventoryRepository.save.mockImplementation((movement) => {
        Object.defineProperty(movement, '_id', { value: 'mov-uuid', writable: true });
        Object.defineProperty(movement, '_createdAt', { value: new Date(), writable: true });
        return Promise.resolve(movement);
      });

      const result = await useCase.execute({ orderId });

      expect(result.currentStatus).toBe('cancelled');
      expect(result.stockReverted).toBe(true);
      expect(inventoryRepository.save).toHaveBeenCalledTimes(1);
    });

    it('when order does not exist, then throws NotFoundException', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ orderId })).rejects.toThrow(NotFoundException);
    });

    it('when order is in delivered state, then throws BusinessRuleException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.status = 'delivered';

      orderRepository.findById.mockResolvedValue(order);

      await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);
    });
  });
});
