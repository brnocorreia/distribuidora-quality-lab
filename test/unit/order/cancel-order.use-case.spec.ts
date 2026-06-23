import { CancelOrderUseCase } from '@modules/order/application/use-cases/cancel-order.use-case';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { InventoryMovement } from '@modules/inventory/domain/entities/inventory-movement.entity';
import { NotFoundException, BusinessRuleException } from '@shared/domain/exceptions';

describe('CancelOrderUseCase', () => {
  let useCase: CancelOrderUseCase;
  let orderRepository: {
    findById: jest.Mock;
    findByCustomerId: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let mockManager: {
    save: jest.Mock;
  };
  let mockDataSource: {
    transaction: jest.Mock;
  };

  beforeEach(() => {
    orderRepository = {
      findById: jest.fn(),
      findByCustomerId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    mockManager = {
      save: jest.fn().mockImplementation((...args) => Promise.resolve(args[1] ?? args[0])),
    };
    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
    };

    const mockLogger = { logStructured: jest.fn() };

    useCase = new CancelOrderUseCase(
      orderRepository as any,
      mockDataSource as any,
      mockLogger as any,
    );
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
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockManager.save).toHaveBeenCalledTimes(1);
      expect(mockManager.save).toHaveBeenCalledWith(OrderAggregate, order);
    });

    it('when order is confirmed, then cancels and reverts stock', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem(productId1, 5, 10.0);
      order.setPaymentType('payment-uuid');
      order.confirm();

      orderRepository.findById.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({ orderId });

      expect(result.currentStatus).toBe('cancelled');
      expect(result.stockReverted).toBe(true);
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockManager.save).toHaveBeenCalledTimes(2);
      expect(mockManager.save).toHaveBeenNthCalledWith(
        1,
        InventoryMovement,
        expect.any(InventoryMovement),
      );
      expect(mockManager.save).toHaveBeenNthCalledWith(2, OrderAggregate, order);

      const stockReturn = mockManager.save.mock.calls[0][1] as InventoryMovement;
      expect(stockReturn.type).toBe('entry');
      expect(stockReturn.productId).toBe(productId1);
      expect(stockReturn.quantity).toBe(5);
    });

    it('when order is in_separation, then cancels and reverts stock', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem(productId1, 3, 20.0);
      order.setPaymentType('payment-uuid');
      order.confirm();
      order.transitionTo('in_separation');

      orderRepository.findById.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({ orderId });

      expect(result.currentStatus).toBe('cancelled');
      expect(result.stockReverted).toBe(true);
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockManager.save).toHaveBeenCalledTimes(2);
      expect(mockManager.save).toHaveBeenNthCalledWith(
        1,
        InventoryMovement,
        expect.any(InventoryMovement),
      );
      expect(mockManager.save).toHaveBeenNthCalledWith(2, OrderAggregate, order);

      const stockReturn = mockManager.save.mock.calls[0][1] as InventoryMovement;
      expect(stockReturn.type).toBe('entry');
      expect(stockReturn.productId).toBe(productId1);
      expect(stockReturn.quantity).toBe(3);
    });

    it('when order does not exist, then throws NotFoundException', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ orderId })).rejects.toThrow(NotFoundException);
    });

    it('when order is in delivered state, then throws BusinessRuleException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      Object.defineProperty(order, '_status', { value: 'delivered', writable: true, configurable: true });

      orderRepository.findById.mockResolvedValue(order);

      await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);
    });
  });
});
