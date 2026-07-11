import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetOrderPaymentTypeDto {
  @ApiProperty({ description: 'Payment type ID (UUID)' })
  @IsUUID('4', { message: 'paymentTypeId must be a valid UUID' })
  @IsNotEmpty({ message: 'paymentTypeId is required' })
  paymentTypeId: string;
}
