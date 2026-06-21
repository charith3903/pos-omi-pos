import { Module } from '@nestjs/common';
import { RentalController } from './rental.controller';
import { RentalService } from './rental.service';

@Module({
  providers: [RentalService],
  controllers: [RentalController],
  exports: [RentalService],
})
export class RentalModule {}
