import { AddItemToOrderUseCase } from '@modules/order/application/use-cases/add-item-to-order.use-case';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { BusinessRuleException, NotFoundException } from '@shared/domain/exceptions';

describe('AddItemToOrderUseCase', () => {
  let useCase: AddItemToOrderUseCase;
  let orderRepository: {
    findById: jest.Mock;
    findByCustomerId: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let productRepository: {
    findById: jest.Mock;
    findAll: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    orderRepository = {
      findById: jest.fn(),
      findByCustomerId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    productRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new AddItemToOrderUseCase(orderRepository, productRepository);
  });

  const orderId = '550e8400-e29b-41d4-a716-446655440000';
  const productId = '660e8400-e29b-41d4-a716-446655440001';

  describe('execute', () => {
    it('when order and product exist, then adds item and returns subtotal', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });

      orderRepository.findById.mockResolvedValue(order);
      productRepository.findById.mockResolvedValue({
        id: productId,
        name: 'Widget',
        unitPrice: 25.0,
      });
      orderRepository.save.mockResolvedValue(order);

      const result = await useCase.execute({
        orderId,
        productId,
        quantity: 3,
        unitPrice: 25.0,
      });

      expect(result.productId).toBe(productId);
      expect(result.quantity).toBe(3);
      expect(result.unitPrice).toBe(25.0);
      expect(result.subtotal).toBe(75.0);
    });

    it('when unit price does not match product price, then throws BusinessRuleException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });

      orderRepository.findById.mockResolvedValue(order);
      productRepository.findById.mockResolvedValue({
        id: productId,
        name: 'Widget',
        unitPrice: 25.0,
      });

      await expect(
        useCase.execute({ orderId, productId, quantity: 1, unitPrice: 1.0 }),
      ).rejects.toThrow(BusinessRuleException);

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when order does not exist, then throws NotFoundException', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ orderId, productId, quantity: 1, unitPrice: 10.0 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('when product does not exist, then throws NotFoundException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      orderRepository.findById.mockResolvedValue(order);
      productRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ orderId, productId, quantity: 1, unitPrice: 10.0 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('when order is not in draft state, then throws BusinessRuleException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem('other-product', 1, 10.0);
      order.confirm();

      orderRepository.findById.mockResolvedValue(order);
      productRepository.findById.mockResolvedValue({
        id: productId,
        name: 'Widget',
        unitPrice: 10.0,
      });

      await expect(
        useCase.execute({ orderId, productId, quantity: 1, unitPrice: 10.0 }),
      ).rejects.toThrow();
    });
  });
});
