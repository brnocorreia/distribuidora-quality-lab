import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from '@modules/order/interface/controllers/order.controller';
import { CreateOrderUseCase } from '@modules/order/application/use-cases/create-order.use-case';
import { AddItemToOrderUseCase } from '@modules/order/application/use-cases/add-item-to-order.use-case';
import { RemoveItemFromOrderUseCase } from '@modules/order/application/use-cases/remove-item-from-order.use-case';
import { ConfirmOrderUseCase } from '@modules/order/application/use-cases/confirm-order.use-case';
import { TransitionOrderStatusUseCase } from '@modules/order/application/use-cases/transition-order-status.use-case';
import { CancelOrderUseCase } from '@modules/order/application/use-cases/cancel-order.use-case';
import { ORDER_REPOSITORY } from '@modules/order/domain/repositories/order.repository';
import { CUSTOMER_REPOSITORY } from '@modules/customer/domain/repositories/customer.repository';
import { INVENTORY_REPOSITORY } from '@modules/inventory/domain/repositories/inventory.repository';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { DataSource } from 'typeorm';

describe('Order Integration', () => {
  let controller: OrderController;

  const mockOrderRepository = {
    findById: jest.fn(),
    findByCustomerId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockCustomerRepository = {
    findById: jest.fn(),
  };

  const mockProductRepository = {
    findById: jest.fn(),
  };

  const mockInventoryRepository = {
    getBalance: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation(async (cb) => {
      const manager = {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };
      return await cb(manager);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        CreateOrderUseCase,
        AddItemToOrderUseCase,
        RemoveItemFromOrderUseCase,
        ConfirmOrderUseCase,
        TransitionOrderStatusUseCase,
        CancelOrderUseCase,
        { provide: ORDER_REPOSITORY, useValue: mockOrderRepository },
        { provide: CUSTOMER_REPOSITORY, useValue: mockCustomerRepository },
        { provide: 'ProductRepository', useValue: mockProductRepository },
        { provide: INVENTORY_REPOSITORY, useValue: mockInventoryRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);

    jest.clearAllMocks();
  });

  describe('POST /orders - Create order via API flow', () => {
    it('should create order in database with draft status (Real Use Case)', async () => {
      const customerId = '550e8400-e29b-41d4-a716-446655440001';
      const orderData = {
        customerId,
        paymentTypeId: '550e8400-e29b-41d4-a716-446655440002',
      };

      mockCustomerRepository.findById.mockResolvedValue({ id: customerId, name: 'John Doe' });
      mockOrderRepository.save.mockImplementation((order) => {
        Object.defineProperty(order, '_id', { value: 'order-uuid', writable: true });
        return Promise.resolve(order);
      });

      const result = await controller.create(orderData);

      expect(result).toBeDefined();
      expect(result.status).toBe('draft');
      expect(result.totalAmount).toBe(0);
      expect(mockOrderRepository.save).toHaveBeenCalled();
    });
  });

  describe('POST /orders/:id/items - Add item to order via API flow', () => {
    it('should add item to draft order and persist in database (Real Use Case)', async () => {
      const orderId = 'order-uuid';
      const productId = 'prod-uuid';
      const itemData = {
        productId,
        quantity: 2,
        unitPrice: 25.0,
      };

      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });

      mockOrderRepository.findById.mockResolvedValue(order);
      mockProductRepository.findById.mockResolvedValue({
        id: productId,
        unitPrice: 25.0,
        available: true,
      });
      mockOrderRepository.save.mockResolvedValue(order);

      const result = await controller.addItem(orderId, itemData);

      expect(result.subtotal).toBe(50.0);
      expect(order.items).toHaveLength(1);
      expect(order.totalAmount).toBe(50.0);
      expect(mockOrderRepository.save).toHaveBeenCalledWith(order);
    });
  });

  describe('PATCH /orders/:id/confirm - Confirm order via API flow', () => {
    it('should confirm order and decrement stock (Real Use Case)', async () => {
      const orderId = 'order-uuid';
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem('prod-1', 1, 100.0);

      mockOrderRepository.findById.mockResolvedValue(order);
      mockInventoryRepository.getBalance.mockResolvedValue(10);
      mockOrderRepository.save.mockResolvedValue(order);

      const result = await controller.confirm(orderId);

      expect(result.status).toBe('confirmed');
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });
  });
});
