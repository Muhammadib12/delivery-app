import { Module } from '@nestjs/common';
import {
  OrdersController,
  RestaurantOrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';
import { DispatchModule } from '../dispatch/dispatch.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [DispatchModule, RealtimeModule],
  controllers: [OrdersController, RestaurantOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
