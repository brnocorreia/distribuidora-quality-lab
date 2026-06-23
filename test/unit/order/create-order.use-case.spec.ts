import { CreateOrderUseCase } from '@modules/order/application/use-cases/create-order.use-case';
import { NotFoundException } from '@shared/domain/exceptions';

describe('CreateOrderUseCase', () => {
  let useCase: CreateOrderUseCase;
  let orderRepository: {
    findById: jest.Mock;
    findByCustomerId: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let customerRepository: {
    findById: jest.Mock;
    findByEmail: jest.Mock;
    findAll: jest.Mock;
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
    customerRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new CreateOrderUseCase(orderRepository, customerRepository, mockLogger as any);
  });

  const customerId = '550e8400-e29b-41d4-a716-446655440000';

  describe('execute', () => {
    it('when customer exists, then creates order in draft state with no items', async () => {
      customerRepository.findById.mockResolvedValue({ id: customerId, name: 'John' });
      orderRepository.save.mockImplementation((order) => {
        Object.defineProperty(order, '_id', { value: 'order-uuid', writable: true });
        Object.defineProperty(order, '_createdAt', {
          value: new Date('2024-01-15'),
          writable: true,
        });
        return Promise.resolve(order);
      });

      const result = await useCase.execute({ customerId });

      expect(result.customerId).toBe(customerId);
      expect(result.status).toBe('draft');
      expect(result.totalAmount).toBe(0);
      expect(result.items).toEqual([]);
      expect(result.paymentTypeId).toBeNull();
    });

    it('when customer does not exist, then throws NotFoundException', async () => {
      customerRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ customerId })).rejects.toThrow(NotFoundException);
    });

    it('when paymentTypeId is provided, then order is created with it', async () => {
      const paymentTypeId = '660e8400-e29b-41d4-a716-446655440001';
      customerRepository.findById.mockResolvedValue({ id: customerId, name: 'John' });
      orderRepository.save.mockImplementation((order) => {
        Object.defineProperty(order, '_id', { value: 'order-uuid', writable: true });
        Object.defineProperty(order, '_createdAt', {
          value: new Date('2024-01-15'),
          writable: true,
        });
        return Promise.resolve(order);
      });

      const result = await useCase.execute({ customerId, paymentTypeId });

      expect(result.paymentTypeId).toBe(paymentTypeId);
    });
  });
});
