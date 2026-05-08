import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Restaurants')
@Controller('restaurant-categories')
export class RestaurantCategoriesController {
  constructor(private readonly service: RestaurantsService) {}

  @Public()
  @Get()
  getCategories() {
    return this.service.getCategories();
  }
}
