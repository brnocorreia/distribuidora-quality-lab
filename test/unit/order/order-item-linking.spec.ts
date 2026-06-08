import { describe, it, expect } from '@jest/globals';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { OrderItem } from '@modules/order/domain/entities/order-item.entity';

describe('OrderAggregate — New Order Item Linking', () => {
  it('should have orderId set on items when added to a new order (repro bug)', () => {
    const customerId = '550e8400-e29b-41d4-a716-446655440001';
    const productId = '660e8400-e29b-41d4-a716-446655440001';
    const order = OrderAggregate.create({ customerId });

    expect(order.id as any).toBeUndefined();

    const item: OrderItem = order.addItem(productId, 2, 10.0);

    expect(item.order).toBeDefined();
    expect(item.order).toBe(order);

    const generatedId = '550e8400-e29b-41d4-a716-446655440099';

    Object.defineProperty(order, '_id', { value: generatedId, writable: true, configurable: true });

    expect(order.id).toBe(generatedId);
    expect(item.orderId).toBe(generatedId);
  });
});
