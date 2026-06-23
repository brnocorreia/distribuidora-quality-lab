import { TransitionOrderStatusUseCase } from '@modules/order/application/use-cases/transition-order-status.use-case';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { BusinessRuleException, NotFoundException } from '@shared/domain/exceptions';

describe('TransitionOrderStatusUseCase', () => {
  let useCase: TransitionOrderStatusUseCase;
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

    useCase = new TransitionOrderStatusUseCase(orderRepository, mockLogger as any);
  });

  const orderId = '550e8400-e29b-41d4-a716-446655440000';
  const productId = '660e8400-e29b-41d4-a716-446655440001';

  describe('execute', () => {
    it('when order is confirmed, then transitions to in_separation and returns status info', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem(productId, 1, 10.0);
      order.setPaymentType('payment-uuid');
      order.confirm();

      orderRepository.findById.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({ orderId, targetStatus: 'in_separation' });

      expect(result.id).toBe(orderId);
      expect(result.previousStatus).toBe('confirmed');
      expect(result.currentStatus).toBe('in_separation');
      expect(orderRepository.save).toHaveBeenCalledWith(order);
    });

    it('when order is in_separation, then transitions to shipped', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem(productId, 1, 10.0);
      order.setPaymentType('payment-uuid');
      order.confirm();
      order.transitionTo('in_separation');

      orderRepository.findById.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({ orderId, targetStatus: 'shipped' });

      expect(result.previousStatus).toBe('in_separation');
      expect(result.currentStatus).toBe('shipped');
    });

    it('when order is shipped, then transitions to delivered', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem(productId, 1, 10.0);
      order.setPaymentType('payment-uuid');
      order.confirm();
      order.transitionTo('in_separation');
      order.transitionTo('shipped');

      orderRepository.findById.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({ orderId, targetStatus: 'delivered' });

      expect(result.previousStatus).toBe('shipped');
      expect(result.currentStatus).toBe('delivered');
    });

    it('when order does not exist, then throws NotFoundException', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ orderId, targetStatus: 'in_separation' })).rejects.toThrow(
        NotFoundException,
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when transition is invalid, then throws BusinessRuleException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem(productId, 1, 10.0);
      order.setPaymentType('payment-uuid');
      order.confirm();
      order.transitionTo('in_separation');
      order.transitionTo('shipped');
      order.transitionTo('delivered');

      orderRepository.findById.mockResolvedValue(order);

      await expect(useCase.execute({ orderId, targetStatus: 'in_separation' })).rejects.toThrow(
        BusinessRuleException,
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when order is draft, then transition to shipped throws BusinessRuleException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.setPaymentType('payment-uuid');

      orderRepository.findById.mockResolvedValue(order);

      await expect(useCase.execute({ orderId, targetStatus: 'shipped' })).rejects.toThrow(
        BusinessRuleException,
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
    });
  });
});
