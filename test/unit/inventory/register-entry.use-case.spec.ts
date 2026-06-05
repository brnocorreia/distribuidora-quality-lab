import { RegisterEntryUseCase } from '@modules/inventory/application/use-cases/register-entry.use-case';
import { NotFoundException } from '@shared/domain/exceptions';
import { ValidationException } from '@shared/domain/exceptions';

describe('RegisterEntryUseCase', () => {
  let useCase: RegisterEntryUseCase;
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

    useCase = new RegisterEntryUseCase(
      inventoryRepository as any,
      productRepository as any,
    );
  });

  describe('execute', () => {
    const validInput = {
      productId: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 10,
    };

    it('when product exists and quantity is valid, then registers entry movement', async () => {
      productRepository.findById.mockResolvedValue({ id: validInput.productId });
      inventoryRepository.save.mockImplementation((movement) => {
        Object.defineProperty(movement, '_id', { value: 'generated-uuid', writable: true });
        Object.defineProperty(movement, '_createdAt', { value: new Date('2024-01-15'), writable: true });
        return Promise.resolve(movement);
      });

      const result = await useCase.execute(validInput);

      expect(result.productId).toBe(validInput.productId);
      expect(result.type).toBe('entry');
      expect(result.quantity).toBe(10);
      expect(inventoryRepository.save).toHaveBeenCalledTimes(1);
    });

    it('when product does not exist, then throws NotFoundException', async () => {
      productRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(validInput)).rejects.toThrow(NotFoundException);
    });

    it('when quantity is zero, then throws ValidationException', async () => {
      productRepository.findById.mockResolvedValue({ id: validInput.productId });

      await expect(
        useCase.execute({ ...validInput, quantity: 0 }),
      ).rejects.toThrow(ValidationException);
    });

    it('when quantity is negative, then throws ValidationException', async () => {
      productRepository.findById.mockResolvedValue({ id: validInput.productId });

      await expect(
        useCase.execute({ ...validInput, quantity: -5 }),
      ).rejects.toThrow(ValidationException);
    });
  });
});
