import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateTimeEntryBodySchema,
  TimeEntriesListQuerySchema,
  UpdateTimeEntryBodySchema,
  zodIssuesToHebrewDetails,
} from '@abra/contracts';
import type { AuthenticatedUser } from '../../auth/jwt.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TimeEntriesService } from './time-entries.service';


function badRequest(issues: Parameters<typeof zodIssuesToHebrewDetails>[0]): never {
  throw new BadRequestException({
    statusCode: 400,
    message: 'Validation failed',
    error: 'Bad Request',
    details: zodIssuesToHebrewDetails(issues),
  });
}

/**
 * Employee-facing time reporting.
 *
 * Every route is scoped to the authenticated employee: the JWT decides whose
 * entries are read and written, so there is no user parameter to tamper with.
 * Admins report no hours of their own (ADR-26) and are refused here; their
 * access to employee entries belongs to the Month Close epic.
 */
/**
 * An id that is not a UUID names no entry, so it is reported as missing.
 *
 * `TimeEntry.id` is `@db.Uuid`, so handing a malformed value to Prisma raises
 * P2023 — and with no filter mapping Prisma errors, the caller got a 500 where
 * the endpoint documents a 404. Answering "not found" also keeps this
 * consistent with an entry owned by somebody else, which is deliberately
 * indistinguishable from one that does not exist.
 */
function entryIdOrNotFound(id: string): string {
  if (!UUID_PATTERN.test(id)) {
    throw new NotFoundException('דיווח השעות לא נמצא');
  }

  return id;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('time-entries')
@ApiBearerAuth()
@Controller('time-entries')
@UseGuards(JwtGuard, RolesGuard)
@Roles('employee')
export class TimeEntriesController {
  constructor(private readonly timeEntries: TimeEntriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a time entry for the signed-in employee' })
  @ApiResponse({ status: 201, description: 'The created entry.' })
  @ApiResponse({ status: 400, description: 'Validation failed (VAL-30/31/35/36/38).' })
  @ApiResponse({ status: 403, description: 'Month locked (VAL-34) or task not assigned (VAL-33).' })
  async create(@Req() req: { user: AuthenticatedUser }, @Body() body: unknown) {
    const parsed = CreateTimeEntryBodySchema.safeParse(body);
    if (!parsed.success) {
      badRequest(parsed.error.issues);
    }

    const data = await this.timeEntries.create(req.user.userId, parsed.data);
    return { data };
  }

  @Get()
  @ApiOperation({
    summary: "List the signed-in employee's entries for a day or a date range",
    description:
      'Pass `date=YYYY-MM-DD` for a single day, or `from` and `to` for an inclusive range.',
  })
  @ApiResponse({ status: 200, description: 'The matching entries, oldest first.' })
  @ApiResponse({ status: 400, description: 'Missing or malformed period (VAL-DATE-RANGE).' })
  async list(@Req() req: { user: AuthenticatedUser }, @Query() query: Record<string, unknown>) {
    const parsed = TimeEntriesListQuerySchema.safeParse(query);
    if (!parsed.success) {
      badRequest(parsed.error.issues);
    }

    const data = await this.timeEntries.list(req.user.userId, parsed.data);
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: "Edit one of the signed-in employee's own entries" })
  @ApiResponse({ status: 200, description: 'The updated entry.' })
  @ApiResponse({ status: 400, description: 'The merged entry breaks a rule (VAL-30/31/35/36/38).' })
  @ApiResponse({ status: 403, description: 'Month locked (VAL-34) or task not assigned (VAL-33).' })
  @ApiResponse({ status: 404, description: 'No such entry belonging to the caller.' })
  @ApiResponse({
    status: 409,
    description: 'Overlaps another entry (VAL-32), or the entry is running (VAL-RUNNING-ENTRY).',
  })
  async update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateTimeEntryBodySchema.safeParse(body);
    if (!parsed.success) {
      badRequest(parsed.error.issues);
    }

    const data = await this.timeEntries.update(
      req.user.userId,
      entryIdOrNotFound(id),
      parsed.data,
    );
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete one of the signed-in employee's own entries",
    description:
      'Soft delete: the row is retained and excluded from every subsequent read, day total, and overlap check.',
  })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 403, description: 'Month locked (VAL-34).' })
  @ApiResponse({ status: 404, description: 'No such entry belonging to the caller.' })
  @ApiResponse({ status: 409, description: 'The entry is running (VAL-RUNNING-ENTRY).' })
  async remove(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string): Promise<void> {
    await this.timeEntries.remove(req.user.userId, entryIdOrNotFound(id));
  }
}
