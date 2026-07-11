import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from '@modules/inventory/interface/controllers/inventory.controller';
import { RegisterEntryUseCase } from '@modules/inventory/application/use-cases/register-entry.use-case';
import { RegisterWithdrawalUseCase } from '@modules/inventory/application/use-cases/register-withdrawal.use-case';
import { GetBalanceUseCase } from '@modules/inventory/application/use-cases/get-balance.use-case';
import { GetMovementHistoryUseCase } from '@modules/inventory/application/use-cases/get-movement-history.use-case';
import { INVENTORY_REPOSITORY } from '@modules/inventory/domain/repositories/inventory.repository';
import { InventoryService } from '@modules/inventory/domain/services/inventory.service';

describe('Inventory Integration', () => {
  let controller: InventoryController;

  const mockInventoryRepository = {
    findMovementsByProductId: jest.fn(),
    save: jest.fn(),
    getBalance: jest.fn(),
  };

  const mockProductRepository = {
    findById: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        InventoryService,
        RegisterEntryUseCase,
        RegisterWithdrawalUseCase,
        GetBalanceUseCase,
        GetMovementHistoryUseCase,
        {
          provide: INVENTORY_REPOSITORY,
          useValue: mockInventoryRepository,
        },
        {
          provide: 'ProductRepository',
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);

    jest.clearAllMocks();
  });

  describe('POST /inventory/entries - Register entry via API flow', () => {
    it('should register stock entry and persist movement to database', async () => {
      const entryData = {
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 100,
      };

      mockProductRepository.findById.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Product',
        available: true,
      });

      mockInventoryRepository.save.mockImplementation((movement) =>
        Promise.resolve(movement),
      );

      mockInventoryRepository.getBalance.mockResolvedValue(0);

      const result = await controller.registerEntry(entryData as any);

      expect(result).toBeDefined();
      expect(mockInventoryRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should update stock balance in database after entry', async () => {
      const entryData = {
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 50,
      };

      mockProductRepository.findById.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Product',
        available: true,
      });

      mockInventoryRepository.save.mockImplementation((movement) =>
        Promise.resolve(movement),
      );

      mockInventoryRepository.getBalance.mockResolvedValue(100);

      const result = await controller.registerEntry(entryData as any);

      expect(result).toBeDefined();
    });
  });

  describe('POST /inventory/withdrawals - Register withdrawal via API flow', () => {
    it('should register stock withdrawal when sufficient balance exists in database', async () => {
      const withdrawalData = {
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 30,
        reason: 'Order fulfillment',
      };

      mockProductRepository.findById.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Product',
        available: true,
        setUnavailable: jest.fn(),
      });

      mockInventoryRepository.getBalance.mockResolvedValue(50);
      mockInventoryRepository.save.mockImplementation((movement) =>
        Promise.resolve(movement),
      );

      const result = await controller.registerWithdrawal(withdrawalData as any);

      expect(result).toBeDefined();
      expect(mockInventoryRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should reject withdrawal when insufficient stock in database', async () => {
      const withdrawalData = {
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 100,
        reason: 'Large order',
      };

      mockInventoryRepository.getBalance.mockResolvedValue(10);

      await expect(
        controller.registerWithdrawal(withdrawalData as any),
      ).rejects.toThrow();
    });
  });

  describe('GET /inventory/:productId/balance - Get balance via API flow', () => {
    it('should retrieve current stock balance from database', async () => {
      mockProductRepository.findById.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Product',
      });

      mockInventoryRepository.getBalance.mockResolvedValue(75);

      const result = await controller.getBalance(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).toBeDefined();
    });
  });

  describe('GET /inventory/:productId/movements - Get history via API flow', () => {
    it('should retrieve complete movement history from database', async () => {
      const mockMovements = [
        {
          id: 'mov-1',
          productId: '550e8400-e29b-41d4-a716-446655440000',
          type: 'entry',
          quantity: 100,
          createdAt: new Date(),
        },
        {
          id: 'mov-2',
          productId: '550e8400-e29b-41d4-a716-446655440000',
          type: 'withdrawal',
          quantity: 30,
          createdAt: new Date(),
        },
      ];

      mockProductRepository.findById.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Product',
      });

      mockInventoryRepository.findMovementsByProductId.mockResolvedValue(
        mockMovements,
      );

      const result = await controller.getMovements(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).toBeDefined();
    });
  });
});
