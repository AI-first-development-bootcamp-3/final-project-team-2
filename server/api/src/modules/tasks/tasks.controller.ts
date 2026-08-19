import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  TasksListQuerySchema,
  CreateTaskBodySchema,
  UpdateTaskBodySchema,
  zodIssuesToDetails,
  zodIssuesToHebrewDetails,
} from '@abra/contracts';
import { Roles } from '../../auth/auth.decorators';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
@Roles('admin')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List tasks (admin)' })
  async list(@Query() query: Record<string, unknown>) {
    const parsed = TasksListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToDetails(parsed.error.issues),
      });
    }
    return this.tasksService.list(parsed.data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID (admin)' })
  async findOne(@Param('id') id: string) {
    const data = await this.tasksService.findOne(id);
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Create task (admin)' })
  async create(@Body() body: unknown) {
    const parsed = CreateTaskBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToHebrewDetails(parsed.error.issues),
      });
    }
    const data = await this.tasksService.create(parsed.data);
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update task (admin)' })
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateTaskBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToHebrewDetails(parsed.error.issues),
      });
    }
    const data = await this.tasksService.update(id, parsed.data);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete task (admin)' })
  async remove(@Param('id') id: string) {
    await this.tasksService.softDelete(id);
  }
}
