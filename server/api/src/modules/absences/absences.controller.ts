import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AbsencesListQuerySchema,
  CreateAbsenceBodySchema,
  UpdateAbsenceBodySchema,
  VAL_MESSAGES,
  zodIssuesToHebrewDetails,
} from '@abra/contracts';
import { Roles } from '../../auth/auth.decorators';
import type { AuthenticatedUser } from '../../auth/jwt.guard';
import { AbsencesService } from './absences.service';

function badRequest(issues: Parameters<typeof zodIssuesToHebrewDetails>[0]): never {
  throw new BadRequestException({
    statusCode: 400,
    message: 'Validation failed',
    error: 'Bad Request',
    details: zodIssuesToHebrewDetails(issues),
  });
}

/**
 * Absence reporting and review.
 *
 * Writes are employee-only and always scoped to the authenticated employee —
 * admins report nothing of their own (ADR-26), and admin *edits* of employee
 * absences must be audit-logged, which belongs to the Month Close epic. Reads
 * are open to both roles: an admin may read any employee's absences by passing
 * a user id, an employee only ever sees their own.
 */
@ApiTags('absences')
@ApiBearerAuth()
@Controller('absences')
@Roles('employee', 'admin')
export class AbsencesController {
  constructor(private readonly absences: AbsencesService) {}

  @Post()
  @ApiOperation({
    summary: 'Report an absence for the signed-in employee',
    description:
      'A range spanning a weekend is stored as one record per contiguous run of working days (VAL-43); every record from one report shares a groupId. Returns all of them.',
  })
  @ApiResponse({ status: 201, description: 'The stored records, earliest first.' })
  @ApiResponse({ status: 400, description: 'Validation failed (VAL-40/41/42/43).' })
  @ApiResponse({
    status: 403,
    description: 'Month locked for this type (VAL-45), or the caller is an admin.',
  })
  @ApiResponse({ status: 409, description: 'Overlaps an existing absence.' })
  async create(@Req() req: { user: AuthenticatedUser }, @Body() body: unknown) {
    this.assertEmployee(req.user);

    const parsed = CreateAbsenceBodySchema.safeParse(body);
    if (!parsed.success) {
      badRequest(parsed.error.issues);
    }

    const data = await this.absences.create(req.user.userId, parsed.data);
    return { data };
  }

  @Get()
  @ApiOperation({
    summary: 'List absences',
    description:
      'Employees always read their own. Admins may pass a userId to read one employee. Pass year and month to narrow to absences overlapping that month.',
  })
  @ApiResponse({ status: 200, description: 'The matching absences, earliest first.' })
  @ApiResponse({ status: 400, description: 'Malformed query.' })
  async list(@Req() req: { user: AuthenticatedUser }, @Query() query: Record<string, unknown>) {
    const parsed = AbsencesListQuerySchema.safeParse(query);
    if (!parsed.success) {
      badRequest(parsed.error.issues);
    }

    // An employee's scope is their JWT, whatever the query asked for — the
    // userId parameter is only meaningful for an admin.
    const targetUserId =
      req.user.role === 'admin' ? (parsed.data.userId ?? req.user.userId) : req.user.userId;

    const data = await this.absences.list(targetUserId, parsed.data);
    return { data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one absence' })
  @ApiResponse({ status: 200, description: 'The absence.' })
  @ApiResponse({ status: 404, description: 'No such absence belonging to the caller.' })
  async findOne(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    const data = await this.absences.findOne(req.user.userId, id);
    return { data };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit one of the signed-in employee own absences',
    description:
      'Applies to every record sharing the addressed record groupId: the range is re-split and the group replaced.',
  })
  @ApiResponse({ status: 200, description: 'The replacement records.' })
  @ApiResponse({ status: 400, description: 'The merged absence breaks a rule.' })
  @ApiResponse({ status: 403, description: 'Month locked (VAL-45).' })
  @ApiResponse({ status: 404, description: 'No such absence belonging to the caller.' })
  @ApiResponse({ status: 409, description: 'Overlaps an existing absence.' })
  async update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    this.assertEmployee(req.user);

    const parsed = UpdateAbsenceBodySchema.safeParse(body);
    if (!parsed.success) {
      badRequest(parsed.error.issues);
    }

    const data = await this.absences.update(req.user.userId, id, parsed.data);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete one of the signed-in employee own absences',
    description: 'Soft delete, applied to every record sharing the addressed record groupId.',
  })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 403, description: 'Month locked (VAL-45).' })
  @ApiResponse({ status: 404, description: 'No such absence belonging to the caller.' })
  async remove(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string): Promise<void> {
    this.assertEmployee(req.user);
    await this.absences.remove(req.user.userId, id);
  }

  /**
   * Refuses a write from an admin.
   *
   * The role guard admits both roles because reads are shared, so the write
   * routes narrow it here rather than splitting the controller in two for a
   * single check. Admin edits of employee absences are audit-logged and belong
   * to the Month Close epic (§7.2).
   */
  private assertEmployee(user: AuthenticatedUser): void {
    if (user.role !== 'admin') {
      return;
    }

    throw new ForbiddenException({
      statusCode: 403,
      message: 'Forbidden',
      error: 'Forbidden',
      details: [{ field: 'role', rule: 'VAL-12', message: VAL_MESSAGES['VAL-12'] }],
    });
  }
}
