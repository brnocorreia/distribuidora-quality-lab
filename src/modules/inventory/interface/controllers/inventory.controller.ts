import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegisterEntryUseCase } from '../../application/use-cases/register-entry.use-case';
import { RegisterWithdrawalUseCase } from '../../application/use-cases/register-withdrawal.use-case';
import { GetBalanceUseCase } from '../../application/use-cases/get-balance.use-case';
import { GetMovementHistoryUseCase } from '../../application/use-cases/get-movement-history.use-case';
import { RegisterEntryDto } from '../dtos/register-entry.dto';
import { RegisterWithdrawalDto } from '../dtos/register-withdrawal.dto';

@ApiTags('inventory')
@Controller('inventory')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class InventoryController {
  constructor(
    private readonly registerEntryUseCase: RegisterEntryUseCase,
    private readonly registerWithdrawalUseCase: RegisterWithdrawalUseCase,
    private readonly getBalanceUseCase: GetBalanceUseCase,
    private readonly getMovementHistoryUseCase: GetMovementHistoryUseCase,
  ) {}

  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a stock entry' })
  @ApiResponse({ status: 201, description: 'Entry registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async registerEntry(@Body() dto: RegisterEntryDto) {
    return this.registerEntryUseCase.execute({
      productId: dto.productId,
      quantity: dto.quantity,
    });
  }

  @Post('withdrawals')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a stock withdrawal' })
  @ApiResponse({ status: 201, description: 'Withdrawal registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 422, description: 'Insufficient stock' })
  async registerWithdrawal(@Body() dto: RegisterWithdrawalDto) {
    return this.registerWithdrawalUseCase.execute({
      productId: dto.productId,
      quantity: dto.quantity,
      reason: dto.reason,
    });
  }

  @Get(':productId/balance')
  @ApiOperation({ summary: 'Get current stock balance for a product' })
  @ApiResponse({ status: 200, description: 'Balance retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getBalance(@Param('productId', new ParseUUIDPipe()) productId: string) {
    return this.getBalanceUseCase.execute(productId);
  }

  @Get(':productId/movements')
  @ApiOperation({ summary: 'Get movement history for a product' })
  @ApiResponse({ status: 200, description: 'Movement history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getMovements(@Param('productId', new ParseUUIDPipe()) productId: string) {
    return this.getMovementHistoryUseCase.execute(productId);
  }
}
