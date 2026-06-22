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
  let mockManager: {
    save: jest.Mock;
    create: jest.Mock;
  };
  let mockDataSource: {
    transaction: jest.Mock;
  };
  let validatePaymentUseCase: {
    execute: jest.Mock;
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
    mockManager = {
      save: jest.fn().mockImplementation((...args) => {
        const entityToSave = args.length === 2 ? args[1] : args[0];
        return Promise.resolve(entityToSave);
      }),
      create: jest.fn().mockImplementation((entityName, obj) => obj),
    };
    validatePaymentUseCase = {
      execute: jest.fn().mockResolvedValue({ valid: true }),
    };
    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        return await cb(mockManager);
      }),
    };

    useCase = new ConfirmOrderUseCase(
      orderRepository as any,
      inventoryRepository as any,
      validatePaymentUseCase as any,
      mockDataSource as any,
    );
  });

  const orderId = '550e8400-e29b-41d4-a716-446655440000';
  const productId1 = '660e8400-e29b-41d4-a716-446655440001';
  const productId2 = '770e8400-e29b-41d4-a716-446655440002';

  function createDraftOrderWithItems(): OrderAggregate {
    const order = OrderAggregate.create({ customerId: 'customer-uuid' });
    Object.defineProperty(order, '_id', { value: orderId, writable: true });
    order.addItem(productId1, 3, 10.0);
    order.addItem(productId2, 2, 25.5);
      order.setPaymentType('payment-uuid');
    return order;
  }

  describe('execute', () => {
    it('when order has items and stock is sufficient, then confirms and decrements stock', async () => {
      const order = createDraftOrderWithItems();
      orderRepository.findById.mockResolvedValue(order);
      inventoryRepository.getBalance.mockResolvedValueOnce(10).mockResolvedValueOnce(5);
      
      const result = await useCase.execute({ orderId });

      expect(result.status).toBe('confirmed');
      expect(mockDataSource.transaction).toHaveBeenCalled();
      
      const savedMovements = mockManager.save.mock.calls
        .filter(call => call[0].name === 'InventoryMovement')
        .map(call => call[1]);
      
      expect(savedMovements).toHaveLength(2);
      expect(savedMovements).toContainEqual(expect.objectContaining({
        productId: productId1,
        quantity: 3,
        type: 'withdrawal'
      }));
      expect(savedMovements).toContainEqual(expect.objectContaining({
        productId: productId2,
        quantity: 2,
        type: 'withdrawal'
      }));

      expect(mockManager.save).toHaveBeenCalledWith(OrderAggregate, order);
      expect(order.status).toBe('confirmed');
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
      inventoryRepository.getBalance.mockResolvedValueOnce(10).mockResolvedValueOnce(1);
      orderRepository.save.mockResolvedValue(order);

      await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);

      expect(order.status).toBe('draft');
    });

    it('when stock is insufficient, then does not decrement any inventory', async () => {
      const order = createDraftOrderWithItems();
      orderRepository.findById.mockResolvedValue(order);
      inventoryRepository.getBalance.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
      orderRepository.save.mockResolvedValue(order);

      await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);

      expect(inventoryRepository.save).not.toHaveBeenCalled();
    });

    it('when stock is insufficient, then does not persist the order at all', async () => {
      const order = createDraftOrderWithItems();
      orderRepository.findById.mockResolvedValue(order);
      inventoryRepository.getBalance.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

      await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);

      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('when the sum of duplicate items exceeds stock, then throws BusinessRuleException', async () => {
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });

      order.setPaymentType('payment-uuid');

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
      order.setPaymentType('payment-uuid');
      (order as any)._items = [
        { productId: productId1, quantity: 2, subtotal: 20 },
        { productId: productId1, quantity: 3, subtotal: 30 },
      ];

      orderRepository.findById.mockResolvedValue(order);
      inventoryRepository.getBalance.mockResolvedValue(100);

      await useCase.execute({ orderId });

      // 1 consolidated movement + 1 order
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });

    it('when order is already confirmed, then throws BusinessRuleException (re-confirmation check)', async () => {
      const order = createDraftOrderWithItems();
      // Transition to confirmed
      order.confirm();
      
      orderRepository.findById.mockResolvedValue(order);

      await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);
      expect(orderRepository.save).not.toHaveBeenCalled();
    });
  });

    it('when order has no payment type, then throws BusinessRuleException', async () => {
    const order = createDraftOrderWithItems();
    Object.defineProperty(order, '_paymentTypeId', { value: null }); 
    orderRepository.findById.mockResolvedValue(order);

    await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);
    expect(inventoryRepository.getBalance).not.toHaveBeenCalled(); 
  });

  it('when payment validation fails, then throws BusinessRuleException', async () => {
    const order = createDraftOrderWithItems();
    Object.defineProperty(order, '_paymentTypeId', { value: 'payment-uuid' });
    orderRepository.findById.mockResolvedValue(order);
    
    validatePaymentUseCase.execute.mockRejectedValue(
      new BusinessRuleException('Order value outside acceptance range')
    );

    await expect(useCase.execute({ orderId })).rejects.toThrow(BusinessRuleException);
    expect(validatePaymentUseCase.execute).toHaveBeenCalledWith({
      paymentTypeId: 'payment-uuid',
      orderValue: order.totalAmount,
    });
  });
});
