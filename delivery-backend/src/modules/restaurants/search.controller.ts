import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly service: RestaurantsService) {}

  @Public()
  @Get()
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search keyword (min 2 chars)',
  })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lng', required: false, type: Number })
  search(
    @Query('q') q: string,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    return this.service.search(q, lat, lng);
  }
}
