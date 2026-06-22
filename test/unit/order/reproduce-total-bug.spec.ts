import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';

describe('OrderAggregate — Total Recalculation Bug', () => {
  const customerId = '550e8400-e29b-41d4-a716-446655440000';

  it('should update totalAmount when an item quantity is updated via aggregate', () => {
    const order = OrderAggregate.create({ customerId });
    const item = order.addItem('product-1', 1, 10.0);
    Object.defineProperty(item, '_id', { value: 'item-1' });
    
    expect(order.totalAmount).toBe(10.0);
    
    order.updateItemQuantity('item-1', 2);
    
    expect(order.totalAmount).toBe(20.0);
  });

  it('should throw BusinessRuleException when updating quantity of a confirmed order', () => {
    const order = OrderAggregate.create({ customerId });
    const item = order.addItem('product-1', 1, 10.0);
    Object.defineProperty(item, '_id', { value: 'item-1' });
    order.setPaymentType('payment-uuid');
    order.confirm();

    expect(() => {
      order.updateItemQuantity('item-1', 2);
    }).toThrow();
  });
});
