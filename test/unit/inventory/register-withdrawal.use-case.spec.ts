import { RegisterWithdrawalUseCase } from '@modules/inventory/application/use-cases/register-withdrawal.use-case';
import { InventoryService } from '@modules/inventory/domain/services/inventory.service';
import { NotFoundException, BusinessRuleException } from '@shared/domain/exceptions';

describe('RegisterWithdrawalUseCase', () => {
  let useCase: RegisterWithdrawalUseCase;
  let inventoryService: InventoryService;
  let inventoryRepository: {
    findMovementsByProductId: jest.Mock;
    save: jest.Mock;
    getBalance: jest.Mock;
  };
  let productRepository: {
    findById: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    findAll: jest.Mock;
  };

  beforeEach(() => {
    inventoryRepository = {
      findMovementsByProductId: jest.fn(),
      save: jest.fn(),
      getBalance: jest.fn(),
    };
    productRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };

    inventoryService = new InventoryService(
      inventoryRepository as any,
      productRepository as any,
    );

    useCase = new RegisterWithdrawalUseCase(inventoryService);
  });

  const productId = '550e8400-e29b-41d4-a716-446655440000';

  describe('execute', () => {
    it('when product exists and stock is sufficient, then registers withdrawal', async () => {
      const product = { id: productId, markAsUnavailable: jest.fn() };
      productRepository.findById.mockResolvedValue(product);
      inventoryRepository.getBalance.mockResolvedValue(20);
      inventoryRepository.save.mockImplementation((movement) => {
        Object.defineProperty(movement, '_id', { value: 'generated-uuid', writable: true });
        Object.defineProperty(movement, '_createdAt', { value: new Date('2024-01-15'), writable: true });
        return Promise.resolve(movement);
      });

      const result = await useCase.execute({
        productId,
        quantity: 5,
        reason: 'Venda para cliente',
      });

      expect(result.productId).toBe(productId);
      expect(result.type).toBe('withdrawal');
      expect(result.quantity).toBe(5);
      expect(result.reason).toBe('Venda para cliente');
      expect(productRepository.save).not.toHaveBeenCalled();
    });

    it('when product does not exist, then throws NotFoundException', async () => {
      productRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ productId, quantity: 5, reason: 'Venda' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('when quantity exceeds available stock, then throws BusinessRuleException', async () => {
      productRepository.findById.mockResolvedValue({ id: productId });
      inventoryRepository.getBalance.mockResolvedValue(3);

      await expect(
        useCase.execute({ productId, quantity: 10, reason: 'Venda' }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('when withdrawal zeroes the balance, then marks product as unavailable', async () => {
      const product = {
        id: productId,
        markAsUnavailable: jest.fn(),
      };
      productRepository.findById.mockResolvedValue(product);
      inventoryRepository.getBalance.mockResolvedValue(5);
      inventoryRepository.save.mockImplementation((movement) => {
        Object.defineProperty(movement, '_id', { value: 'generated-uuid', writable: true });
        Object.defineProperty(movement, '_createdAt', { value: new Date('2024-01-15'), writable: true });
        return Promise.resolve(movement);
      });

      await useCase.execute({ productId, quantity: 5, reason: 'Última unidade' });

      expect(product.markAsUnavailable).toHaveBeenCalledTimes(1);
      expect(productRepository.save).toHaveBeenCalledWith(product);
    });

    it('when withdrawal does not zero the balance, then does not mark product unavailable', async () => {
      const product = {
        id: productId,
        markAsUnavailable: jest.fn(),
      };
      productRepository.findById.mockResolvedValue(product);
      inventoryRepository.getBalance.mockResolvedValue(10);
      inventoryRepository.save.mockImplementation((movement) => {
        Object.defineProperty(movement, '_id', { value: 'generated-uuid', writable: true });
        Object.defineProperty(movement, '_createdAt', { value: new Date('2024-01-15'), writable: true });
        return Promise.resolve(movement);
      });

      await useCase.execute({ productId, quantity: 3, reason: 'Parcial' });

      expect(product.markAsUnavailable).not.toHaveBeenCalled();
      expect(productRepository.save).not.toHaveBeenCalled();
    });
  });
});
