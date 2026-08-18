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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ProjectsListQuerySchema,
  CreateProjectBodySchema,
  UpdateProjectBodySchema,
  VAL_MESSAGES,
  zodIssuesToDetails,
  type ValCode,
} from '@abra/contracts';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ProjectsService } from './projects.service';

function hebrewDetails(issues: Parameters<typeof zodIssuesToDetails>[0]) {
  return zodIssuesToDetails(issues).map((detail) => ({
    ...detail,
    message: detail.rule in VAL_MESSAGES ? VAL_MESSAGES[detail.rule as ValCode] : detail.message,
  }));
}

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtGuard, RolesGuard)
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
        details: zodIssuesToDetails(parsed.error.issues),
      });
    }
    return this.projectsService.list(parsed.data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID (admin)' })
  async findOne(@Param('id') id: string) {
    const data = await this.projectsService.findOne(id);
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Create project (admin)' })
  async create(@Body() body: unknown) {
    const parsed = CreateProjectBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: hebrewDetails(parsed.error.issues),
      });
    }
    const data = await this.projectsService.create(parsed.data);
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project (admin)' })
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateProjectBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: hebrewDetails(parsed.error.issues),
      });
    }
    const data = await this.projectsService.update(id, parsed.data);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete project (admin)' })
  async remove(@Param('id') id: string) {
    await this.projectsService.softDelete(id);
  }
}
