import { Injectable, OnModuleInit, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export type UploadFolder = 'restaurant-logos' | 'menu-images';

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    cloudinary.config({
      cloud_name: this.config.get<string>('cloudinary.cloudName'),
      api_key: this.config.get<string>('cloudinary.apiKey'),
      api_secret: this.config.get<string>('cloudinary.apiSecret'),
    });
    this.logger.log('Cloudinary configured');
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: UploadFolder,
  ): Promise<{ url: string; publicId: string }> {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `delivery/${folder}`,
          // Convert every upload to WebP for smaller file size
          format: 'webp',
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'webp' },
          ],
          resource_type: 'image',
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload failed', error);
            reject(new BadRequestException('UPLOAD_FAILED'));
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      // Pipe buffer into cloudinary stream
      const readable = new Readable();
      readable.push(file.buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      this.logger.warn(`Could not delete image ${publicId}`, err);
    }
  }

  private validateFile(file: Express.Multer.File) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('INVALID_FILE_TYPE');
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('FILE_TOO_LARGE');
    }
  }
}
