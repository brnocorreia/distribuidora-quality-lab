import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrderItemQuantityDto {
  @ApiProperty({ description: 'New item quantity', minimum: 1 })
  @IsInt({ message: 'quantity must be a positive integer' })
  @Min(1, { message: 'quantity must be a positive integer greater than 0' })
  quantity: number;
}
