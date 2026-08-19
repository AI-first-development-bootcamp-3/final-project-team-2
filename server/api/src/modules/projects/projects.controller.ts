import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ProjectsListQuerySchema,
  CreateProjectBodySchema,
  UpdateProjectBodySchema,
  UpdateProjectReportTypeBodySchema,
  VAL_MESSAGES,
  zodIssuesToHebrewDetails,
} from '@abra/contracts';
import { Roles } from '../../auth/auth.decorators';
import { ProjectsService } from './projects.service';

// A malformed :id must be a 400 in the API's details shape, not a Prisma
// P2023 surfacing as a 500. VAL-25 is the existing "valid project" rule.
const projectIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      error: 'Bad Request',
      details: [{ field: 'id', rule: 'VAL-25', message: VAL_MESSAGES['VAL-25'] }],
    }),
});

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
@Roles('admin')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects (admin)' })
  async list(@Query() query: Record<string, unknown>) {
    const parsed = ProjectsListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToHebrewDetails(parsed.error.issues),
      });
    }
    return this.projectsService.list(parsed.data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID (admin)' })
  async findOne(@Param('id', projectIdPipe) id: string) {
    const data = await this.projectsService.findOne(id);
    return { data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create project (admin)' })
  async create(@Body() body: unknown) {
    const parsed = CreateProjectBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToHebrewDetails(parsed.error.issues),
      });
    }
    const data = await this.projectsService.create(parsed.data);
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project (admin)' })
  async update(@Param('id', projectIdPipe) id: string, @Body() body: unknown) {
    const parsed = UpdateProjectBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToHebrewDetails(parsed.error.issues),
      });
    }
    const data = await this.projectsService.update(id, parsed.data);
    return { data };
  }

  @Patch(':id/report-type')
  @ApiOperation({ summary: 'Update project report type (admin)' })
  async updateReportType(@Param('id', projectIdPipe) id: string, @Body() body: unknown) {
    const parsed = UpdateProjectReportTypeBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToHebrewDetails(parsed.error.issues),
      });
    }
    // Same write path as the generic PATCH — the dedicated URL is kept for
    // the admin UI, but there is exactly one way to mutate report_type.
    const data = await this.projectsService.update(id, { reportType: parsed.data.reportType });
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete project (admin)' })
  async remove(@Param('id', projectIdPipe) id: string) {
    await this.projectsService.softDelete(id);
  }
}
