import { SetOrderPaymentTypeUseCase } from '@modules/order/application/use-cases/set-order-payment-type.use-case';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { PaymentTypeEntity } from '@modules/payment-type/domain/entities/payment-type.entity';
import { BusinessRuleException, NotFoundException } from '@shared/domain/exceptions';

describe('SetOrderPaymentTypeUseCase', () => {
  let useCase: SetOrderPaymentTypeUseCase;
  let orderRepository: {
    findById: jest.Mock;
    findByCustomerId: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let paymentTypeRepository: {
    findById: jest.Mock;
    findByName: jest.Mock;
    findAll: jest.Mock;
    findAllActive: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const mockLogger = { logStructured: jest.fn() };
  const orderId = '550e8400-e29b-41d4-a716-446655440000';
  const paymentTypeId = '660e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    mockLogger.logStructured.mockClear();
    orderRepository = {
      findById: jest.fn(),
      findByCustomerId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    paymentTypeRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      findAllActive: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new SetOrderPaymentTypeUseCase(
      orderRepository,
      paymentTypeRepository,
      mockLogger as any,
    );
  });

  function makeOrder(): OrderAggregate {
    const order = OrderAggregate.create({ customerId: '770e8400-e29b-41d4-a716-446655440002' });
    Object.defineProperty(order, '_id', { value: orderId, writable: true });
    return order;
  }

  function makePaymentType(): PaymentTypeEntity {
    const paymentType = PaymentTypeEntity.create({ name: 'Pix' });
    Object.defineProperty(paymentType, '_id', { value: paymentTypeId, writable: true });
    return paymentType;
  }

  describe('execute', () => {
    it('when order and active payment type exist, then sets payment type and logs correlation id', async () => {
      const order = makeOrder();
      const paymentType = makePaymentType();

      orderRepository.findById.mockResolvedValue(order);
      paymentTypeRepository.findById.mockResolvedValue(paymentType);
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({
        orderId,
        paymentTypeId,
        correlationId: 'corr-payment-type',
      });

      expect(result.id).toBe(orderId);
      expect(result.paymentTypeId).toBe(paymentTypeId);
      expect(result.status).toBe('draft');
      expect(order.paymentTypeId).toBe(paymentTypeId);
      expect(orderRepository.save).toHaveBeenCalledWith(order);
      expect(mockLogger.logStructured).toHaveBeenCalledWith(
        'info',
        'Order payment type set',
        expect.objectContaining({
          correlationId: 'corr-payment-type',
          orderId,
          paymentTypeId,
        }),
      );
    });

    it('when order does not exist, then throws NotFoundException', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ orderId, paymentTypeId })).rejects.toThrow(NotFoundException);

      expect(paymentTypeRepository.findById).not.toHaveBeenCalled();
      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when payment type does not exist, then throws NotFoundException', async () => {
      orderRepository.findById.mockResolvedValue(makeOrder());
      paymentTypeRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ orderId, paymentTypeId })).rejects.toThrow(NotFoundException);

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when payment type is inactive, then throws BusinessRuleException', async () => {
      const paymentType = makePaymentType();
      paymentType.deactivate();

      orderRepository.findById.mockResolvedValue(makeOrder());
      paymentTypeRepository.findById.mockResolvedValue(paymentType);

      await expect(useCase.execute({ orderId, paymentTypeId })).rejects.toThrow(
        BusinessRuleException,
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when order is not draft, then throws BusinessRuleException', async () => {
      const order = makeOrder();
      order.addItem('880e8400-e29b-41d4-a716-446655440003', 1, 10);
      order.setPaymentType('990e8400-e29b-41d4-a716-446655440004');
      order.confirm();

      orderRepository.findById.mockResolvedValue(order);
      paymentTypeRepository.findById.mockResolvedValue(makePaymentType());

      await expect(useCase.execute({ orderId, paymentTypeId })).rejects.toThrow(
        BusinessRuleException,
      );

      expect(orderRepository.save).not.toHaveBeenCalled();
    });
  });
});
