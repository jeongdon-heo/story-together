import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { User } from '@prisma/client';
import { StudentAccountService } from './student-account.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { BulkCreateStudentDto } from './dto/bulk-create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { MoveClassDto } from './dto/move-class.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('students')
@Roles('teacher')
export class StudentAccountController {
  constructor(private studentAccountService: StudentAccountService) {}

  @Post()
  async createStudent(
    @CurrentUser() user: User,
    @Body() dto: CreateStudentDto,
  ) {
    const data = await this.studentAccountService.createStudent(user.id, dto);
    return { data };
  }

  @Post('bulk')
  async bulkCreateStudents(
    @CurrentUser() user: User,
    @Body() dto: BulkCreateStudentDto,
  ) {
    const data = await this.studentAccountService.bulkCreateStudents(
      user.id,
      dto,
    );
    return { data };
  }

  @Get()
  async getMyStudents(@CurrentUser() user: User) {
    const data = await this.studentAccountService.getMyStudents(user.id);
    return { data, meta: { total: data.length } };
  }

  @Get('class/:classId')
  async getStudentsByClass(
    @CurrentUser() user: User,
    @Param('classId') classId: string,
  ) {
    const data = await this.studentAccountService.getStudentsByClass(
      user.id,
      classId,
    );
    return { data };
  }

  @Patch(':id')
  async updateStudent(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    const data = await this.studentAccountService.updateStudent(
      user.id,
      id,
      dto,
    );
    return { data };
  }

  @Post(':id/reset-password')
  async resetPassword(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    const data = await this.studentAccountService.resetPassword(user.id, id);
    return { data };
  }

  @Post(':id/move-class')
  async moveClass(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: MoveClassDto,
  ) {
    const data = await this.studentAccountService.moveClass(
      user.id,
      id,
      dto.newClassId,
    );
    return { data };
  }

  @Patch(':id/deactivate')
  async deactivateStudent(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    const data = await this.studentAccountService.deactivateStudent(
      user.id,
      id,
    );
    return { data };
  }

  @Delete(':id')
  async deleteStudent(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    const data = await this.studentAccountService.deleteStudent(user.id, id);
    return { data };
  }

  @Get('class/:classId/export/csv')
  async exportCsv(
    @CurrentUser() user: User,
    @Param('classId') classId: string,
    @Res() res: Response,
  ) {
    const exportData = await this.studentAccountService.getExportData(
      user.id,
      classId,
    );

    const BOM = '\uFEFF';
    let csv = BOM + '이름,로그인ID,학년\n';
    for (const s of exportData.students) {
      csv += `${s.name},${s.loginId},${s.grade}\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(exportData.className)}_students.csv"`,
    );
    res.send(csv);
  }

  @Get('class/:classId/export/cards-pdf')
  async exportCardsPdf(
    @CurrentUser() user: User,
    @Param('classId') classId: string,
    @Res() res: Response,
  ) {
    // PDF 생성은 별도 라이브러리 필요 → 현재는 JSON으로 카드 데이터 반환
    const exportData = await this.studentAccountService.getExportData(
      user.id,
      classId,
    );

    res.json({
      data: {
        className: exportData.className,
        cards: exportData.students,
        message: 'PDF 생성 기능은 추후 구현 예정입니다. 현재는 카드 데이터를 반환합니다.',
      },
    });
  }
}
