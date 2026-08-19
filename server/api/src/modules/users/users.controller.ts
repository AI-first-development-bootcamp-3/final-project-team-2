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
  CreateUserBodySchema,
  ResetPasswordSchema,
  UpdateUserSchema,
  UsersListQuerySchema,
  zodIssuesToDetails,
  zodIssuesToHebrewDetails,
} from '@abra/contracts';
import { Roles } from '../../auth/auth.decorators';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (admin directory)' })
  async list(@Query() query: Record<string, unknown>) {
    const parsed = UsersListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToDetails(parsed.error.issues),
      });
    }
    return this.usersService.list(parsed.data);
  }

  @Post()
  @ApiOperation({ summary: 'Create user (admin)' })
  async create(@Body() body: unknown) {
    const parsed = CreateUserBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToHebrewDetails(parsed.error.issues),
      });
    }
    const data = await this.usersService.create(parsed.data);
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile, role & HR metadata (admin only)' })
  async updateUser(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToDetails(parsed.error.issues),
      });
    }
    return this.usersService.updateUser(id, parsed.data);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password & revoke active sessions (admin only)' })
  async resetPassword(@Param('id') id: string, @Body() body: unknown) {
    const parsed = ResetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToDetails(parsed.error.issues),
      });
    }
    return this.usersService.resetPassword(id, parsed.data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate user & revoke active sessions instantly (admin only)' })
  async deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate soft-deleted user (admin only)' })
  async restoreUser(@Param('id') id: string) {
    return this.usersService.restoreUser(id);
  }
}
