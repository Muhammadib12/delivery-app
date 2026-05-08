import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Upload')
@ApiBearerAuth('access-token')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // ─── Restaurant logo ──────────────────────────────────────────────────────
  // Only RESTAURANT_OWNER or ADMIN can upload a logo

  @Post('restaurant-logo')
  @Roles('RESTAURANT_OWNER', 'ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadRestaurantLogo(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('FILE_REQUIRED');
    return this.uploadService.uploadImage(file, 'restaurant-logos');
  }

  // ─── Menu product image ───────────────────────────────────────────────────
  // RESTAURANT_OWNER or RESTAURANT_STAFF can upload menu images

  @Post('menu-image')
  @Roles('RESTAURANT_OWNER', 'RESTAURANT_STAFF', 'ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadMenuImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('FILE_REQUIRED');
    return this.uploadService.uploadImage(file, 'menu-images');
  }
}
