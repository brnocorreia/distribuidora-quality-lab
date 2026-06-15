import { OrderItem } from '@modules/order/domain/entities/order-item.entity';
import { ValidationException } from '@shared/domain/exceptions';

describe('OrderItem Boundary Issues', () => {
  it('should throw ValidationException for NaN unitPrice', () => {
    expect(() => {
      OrderItem.create({
        productId: 'prod-1',
        quantity: 1,
        unitPrice: NaN
      });
    }).toThrow(ValidationException);
  });

  it('should throw ValidationException for unitPrice with more than 2 decimal places', () => {
    expect(() => {
      OrderItem.create({
        productId: 'prod-1',
        quantity: 1,
        unitPrice: 10.555
      });
    }).toThrow(ValidationException);
  });
});
