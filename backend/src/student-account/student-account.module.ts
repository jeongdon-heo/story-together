import { Module } from '@nestjs/common';
import { StudentAccountService } from './student-account.service';
import { StudentAccountController } from './student-account.controller';

@Module({
  controllers: [StudentAccountController],
  providers: [StudentAccountService],
  exports: [StudentAccountService],
})
export class StudentAccountModule {}
