import { Global, Module } from '@nestjs/common';
import { FinanceService } from './finance.service';

// Global — متاح لكل الـ Modules بدون import
@Global()
@Module({
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
