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
  ClientsListQuerySchema,
  CreateClientBodySchema,
  UpdateClientBodySchema,
  VAL_MESSAGES,
  zodIssuesToDetails,
  type ValCode,
} from '@abra/contracts';
import { Roles } from '../../auth/auth.decorators';
import { ClientsService } from './clients.service';

function hebrewDetails(issues: Parameters<typeof zodIssuesToDetails>[0]) {
  return zodIssuesToDetails(issues).map((detail) => ({
    ...detail,
    message: detail.rule in VAL_MESSAGES ? VAL_MESSAGES[detail.rule as ValCode] : detail.message,
  }));
}

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
@Roles('admin')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'List clients (admin)' })
  async list(@Query() query: Record<string, unknown>) {
    const parsed = ClientsListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToDetails(parsed.error.issues),
      });
    }
    return this.clientsService.list(parsed.data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get client by ID (admin)' })
  async findOne(@Param('id') id: string) {
    const data = await this.clientsService.findOne(id);
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Create client (admin)' })
  async create(@Body() body: unknown) {
    const parsed = CreateClientBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: hebrewDetails(parsed.error.issues),
      });
    }
    const data = await this.clientsService.create(parsed.data);
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update client (admin)' })
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateClientBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: hebrewDetails(parsed.error.issues),
      });
    }
    const data = await this.clientsService.update(id, parsed.data);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete client (admin)' })
  async remove(@Param('id') id: string) {
    await this.clientsService.softDelete(id);
  }
}
