import { Module } from '@nestjs/common';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantCategoriesController } from './restaurant-categories.controller';
import { SearchController } from './search.controller';
import { RestaurantsService } from './restaurants.service';
import { MenuService } from '../menu/menu.service';

@Module({
  controllers: [
    RestaurantsController,
    RestaurantCategoriesController,
    SearchController,
  ],
  providers: [RestaurantsService, MenuService],
  exports: [RestaurantsService],
})
export class RestaurantsModule {}
