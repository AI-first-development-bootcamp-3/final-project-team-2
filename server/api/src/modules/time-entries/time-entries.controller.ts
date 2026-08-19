import { BadRequestException, Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateTimeEntryBodySchema,
  TimeEntriesListQuerySchema,
  VAL_MESSAGES,
  zodIssuesToDetails,
  type ValCode,
} from '@abra/contracts';
import { Roles } from '../../auth/auth.decorators';
import type { AuthenticatedUser } from '../../auth/jwt.guard';
import { TimeEntriesService } from './time-entries.service';

function hebrewDetails(issues: Parameters<typeof zodIssuesToDetails>[0]) {
  return zodIssuesToDetails(issues).map((detail) => ({
    ...detail,
    message: detail.rule in VAL_MESSAGES ? VAL_MESSAGES[detail.rule as ValCode] : detail.message,
  }));
}

function badRequest(issues: Parameters<typeof zodIssuesToDetails>[0]): never {
  throw new BadRequestException({
    statusCode: 400,
    message: 'Validation failed',
    error: 'Bad Request',
    details: hebrewDetails(issues),
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
@ApiTags('time-entries')
@ApiBearerAuth()
@Controller('time-entries')
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
}
