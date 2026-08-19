import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AssignmentsListQuerySchema,
  CreateAssignmentBodySchema,
  VAL_MESSAGES,
  zodIssuesToDetails,
  type ValCode,
} from '@abra/contracts';
import { Roles } from '../../auth/auth.decorators';
import { AssignmentsService } from './assignments.service';

function hebrewDetails(issues: Parameters<typeof zodIssuesToDetails>[0]) {
  return zodIssuesToDetails(issues).map((detail) => ({
    ...detail,
    message: detail.rule in VAL_MESSAGES ? VAL_MESSAGES[detail.rule as ValCode] : detail.message,
  }));
}

@ApiTags('assignments')
@ApiBearerAuth()
@Controller('assignments')
@Roles('admin')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List assignments (admin); groupBy=task returns one row per task' })
  async list(@Query() query: Record<string, unknown>) {
    const parsed = AssignmentsListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToDetails(parsed.error.issues),
      });
    }
    if (parsed.data.groupBy === 'task') {
      return this.assignmentsService.listGroupedByTask(parsed.data);
    }
    return this.assignmentsService.list(parsed.data);
  }

  @Post()
  @ApiOperation({ summary: 'Create assignment (admin)' })
  async create(@Body() body: unknown) {
    const parsed = CreateAssignmentBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: hebrewDetails(parsed.error.issues),
      });
    }
    const data = await this.assignmentsService.create(parsed.data);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove assignment (admin)' })
  async remove(@Param('id') id: string) {
    await this.assignmentsService.hardDelete(id);
  }
}
