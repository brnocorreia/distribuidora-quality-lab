import { UpdateOrderItemQuantityUseCase } from '@modules/order/application/use-cases/update-order-item-quantity.use-case';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { BusinessRuleException, NotFoundException, ValidationException } from '@shared/domain/exceptions';

describe('UpdateOrderItemQuantityUseCase', () => {
  let useCase: UpdateOrderItemQuantityUseCase;
  let orderRepository: {
    findById: jest.Mock;
    findByCustomerId: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const mockLogger = { logStructured: jest.fn() };
  const orderId = '550e8400-e29b-41d4-a716-446655440000';
  const itemId = '660e8400-e29b-41d4-a716-446655440001';
  const productId = '770e8400-e29b-41d4-a716-446655440002';

  beforeEach(() => {
    mockLogger.logStructured.mockClear();
    orderRepository = {
      findById: jest.fn(),
      findByCustomerId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new UpdateOrderItemQuantityUseCase(orderRepository, mockLogger as any);
  });

  function makeOrderWithItem(): OrderAggregate {
    const order = OrderAggregate.create({ customerId: '880e8400-e29b-41d4-a716-446655440003' });
    Object.defineProperty(order, '_id', { value: orderId, writable: true });
    const item = order.addItem(productId, 2, 12.5);
    Object.defineProperty(item, '_id', { value: itemId, writable: true });
    return order;
  }

  describe('execute', () => {
    it('when order item exists, then updates quantity, recalculates total, and logs correlation id', async () => {
      const order = makeOrderWithItem();

      orderRepository.findById.mockResolvedValue(order);
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({
        orderId,
        itemId,
        quantity: 4,
        correlationId: 'corr-update-item',
      });

      expect(result).toEqual({
        orderId,
        itemId,
        quantity: 4,
        subtotal: 50,
        totalAmount: 50,
        itemCount: 1,
      });
      expect(order.items).toHaveLength(1);
      expect(order.items[0]!.quantity).toBe(4);
      expect(orderRepository.save).toHaveBeenCalledWith(order);
      expect(mockLogger.logStructured).toHaveBeenCalledWith(
        'info',
        'Order item quantity updated',
        expect.objectContaining({
          correlationId: 'corr-update-item',
          orderId,
          itemId,
          quantity: 4,
          totalAmount: 50,
          itemCount: 1,
        }),
      );
    });

    it('when order does not exist, then throws NotFoundException', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ orderId, itemId, quantity: 4 })).rejects.toThrow(
        NotFoundException,
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when item does not exist, then throws BusinessRuleException', async () => {
      orderRepository.findById.mockResolvedValue(makeOrderWithItem());

      await expect(
        useCase.execute({
          orderId,
          itemId: '990e8400-e29b-41d4-a716-446655440004',
          quantity: 4,
        }),
      ).rejects.toThrow(BusinessRuleException);

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when quantity is invalid, then throws ValidationException', async () => {
      orderRepository.findById.mockResolvedValue(makeOrderWithItem());

      await expect(useCase.execute({ orderId, itemId, quantity: 0 })).rejects.toThrow(
        ValidationException,
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when order is not draft, then throws BusinessRuleException', async () => {
      const order = makeOrderWithItem();
      order.setPaymentType('aa0e8400-e29b-41d4-a716-446655440005');
      order.confirm();
      orderRepository.findById.mockResolvedValue(order);

      await expect(useCase.execute({ orderId, itemId, quantity: 4 })).rejects.toThrow(
        BusinessRuleException,
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
    });
  });
});
