import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from '@shared/infrastructure/database/typeorm.config';
import { HealthModule } from '@shared/infrastructure/health/health.module';
import { MetricsModule } from '@shared/observability/metrics/metrics.module';
import { LoggingModule } from '@shared/infrastructure/logging/logging.module';
import { LoggingInterceptor } from '@shared/infrastructure/logging/logging.interceptor';
import { ProductModule } from '@modules/product/product.module';
import { CustomerModule } from '@modules/customer/customer.module';
import { InventoryModule } from '@modules/inventory/inventory.module';
import { PaymentTypeModule } from '@modules/payment-type/payment-type.module';
import { OrderModule } from '@modules/order/order.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildTypeOrmOptions({
          databaseUrl: configService.getOrThrow<string>('DATABASE_URL'),
          nodeEnv: configService.get<string>('NODE_ENV'),
        }),
    }),
    HealthModule,
    MetricsModule,
    LoggingModule,
    ProductModule,
    CustomerModule,
    InventoryModule,
    PaymentTypeModule,
    OrderModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
