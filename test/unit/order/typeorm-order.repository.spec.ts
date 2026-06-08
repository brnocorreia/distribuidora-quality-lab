import { TypeOrmOrderRepository } from '@modules/order/infrastructure/persistence/typeorm-order.repository';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';

describe('TypeOrmOrderRepository', () => {
  let repository: TypeOrmOrderRepository;
  let ormRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    ormRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    repository = new TypeOrmOrderRepository(ormRepository as any);
  });

  const orderId = '550e8400-e29b-41d4-a716-446655440000';
  const customerId = '550e8400-e29b-41d4-a716-446655440001';

  describe('findById', () => {
    it('when order exists, then returns the order aggregate', async () => {
      const order = OrderAggregate.create({ customerId });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      ormRepository.findOne.mockResolvedValue(order);

      const result = await repository.findById(orderId);

      expect(result).toBe(order);
      expect(ormRepository.findOne).toHaveBeenCalledWith({
        where: { _id: orderId },
        relations: ['_items'],
      });
    });

    it('when order does not exist, then returns null', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById(orderId);

      expect(result).toBeNull();
    });
  });

  describe('findByCustomerId', () => {
    it('when customer has orders, then returns all matching orders', async () => {
      const order1 = OrderAggregate.create({ customerId });
      const order2 = OrderAggregate.create({ customerId });
      ormRepository.find.mockResolvedValue([order1, order2]);

      const result = await repository.findByCustomerId(customerId);

      expect(result).toHaveLength(2);
      expect(result).toContain(order1);
      expect(result).toContain(order2);
      expect(ormRepository.find).toHaveBeenCalledWith({
        where: { _customerId: customerId },
        relations: ['_items'],
      });
    });

    it('when customer has no orders, then returns empty array', async () => {
      ormRepository.find.mockResolvedValue([]);

      const result = await repository.findByCustomerId(customerId);

      expect(result).toEqual([]);
    });
  });

  describe('save', () => {
    it('when saving an order, then returns the persisted order', async () => {
      const order = OrderAggregate.create({ customerId });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      ormRepository.save.mockResolvedValue(order);

      const result = await repository.save(order);

      expect(result).toBe(order);
      expect(ormRepository.save).toHaveBeenCalledWith(order);
    });
  });

  describe('delete', () => {
    it('when deleting an order, then calls ormRepository.delete with the id', async () => {
      ormRepository.delete.mockResolvedValue(undefined);

      await repository.delete(orderId);

      expect(ormRepository.delete).toHaveBeenCalledWith(orderId);
    });
  });
});
