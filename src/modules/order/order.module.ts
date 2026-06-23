import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderAggregate } from './domain/aggregates/order.aggregate';
import { OrderItem } from './domain/entities/order-item.entity';
import { ORDER_REPOSITORY } from './domain/repositories/order.repository';
import { TypeOrmOrderRepository } from './infrastructure/persistence/typeorm-order.repository';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { AddItemToOrderUseCase } from './application/use-cases/add-item-to-order.use-case';
import { RemoveItemFromOrderUseCase } from './application/use-cases/remove-item-from-order.use-case';
import { ConfirmOrderUseCase } from './application/use-cases/confirm-order.use-case';
import { TransitionOrderStatusUseCase } from './application/use-cases/transition-order-status.use-case';
import { CancelOrderUseCase } from './application/use-cases/cancel-order.use-case';
import { OrderController } from './interface/controllers/order.controller';
import { ProductModule } from '../product/product.module';
import { CustomerModule } from '../customer/customer.module';
import { PaymentTypeModule } from '../payment-type/payment-type.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderAggregate, OrderItem]),
    ProductModule,
    CustomerModule,
    PaymentTypeModule,
  ],
  controllers: [OrderController],
  providers: [
    {
      provide: ORDER_REPOSITORY,
      useClass: TypeOrmOrderRepository,
    },
    CreateOrderUseCase,
    AddItemToOrderUseCase,
    RemoveItemFromOrderUseCase,
    ConfirmOrderUseCase,
    TransitionOrderStatusUseCase,
    CancelOrderUseCase,
  ],
  exports: [ORDER_REPOSITORY],
})
export class OrderModule {}
