import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';

describe('OrderAggregate — Total Calculation', () => {
  const customerId = '550e8400-e29b-41d4-a716-446655440000';

  describe('calculateTotal (via addItem)', () => {
    it('when order has no items, then total is 0', () => {
      const order = OrderAggregate.create({ customerId });

      expect(order.totalAmount).toBe(0);
    });

    it('when one item is added, then total equals quantity * unitPrice', () => {
      const order = OrderAggregate.create({ customerId });

      order.addItem('product-1', 3, 10.5);

      expect(order.totalAmount).toBe(31.5);
    });

    it('when multiple items are added, then total is sum of all subtotals', () => {
      const order = OrderAggregate.create({ customerId });

      order.addItem('product-1', 2, 25.0);
      order.addItem('product-2', 1, 99.99);

      expect(order.totalAmount).toBe(149.99);
    });

    it('when item is removed, then total is recalculated without it', () => {
      const order = OrderAggregate.create({ customerId });

      const item1 = order.addItem('product-1', 2, 50.0);
      order.addItem('product-2', 1, 30.0);

      order.removeItem(item1.id);

      expect(order.totalAmount).toBe(30.0);
    });

    it('when items have fractional prices, then total rounds to 2 decimal places', () => {
      const order = OrderAggregate.create({ customerId });

      order.addItem('product-1', 3, 33.33);

      expect(order.totalAmount).toBe(99.99);
    });

    it('when many items with small values are added, precision is maintained (edge case)', () => {
      const order = OrderAggregate.create({ customerId });

      // 100 items of 0.01 should sum to 1.00 exactly
      for (let i = 0; i < 100; i++) {
        order.addItem(`product-${i}`, 1, 0.01);
      }

      expect(order.totalAmount).toBe(1.00);
    });
  });
});
