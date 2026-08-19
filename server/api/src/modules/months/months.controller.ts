import { BadRequestException, Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthenticatedUser } from '../../auth/jwt.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MonthsService } from './months.service';

/**
 * Path params are plain strings; the calendar never asks for a month outside
 * this window, so anything else is a malformed request rather than a lookup
 * that happens to be empty.
 */
const MonthParamsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

/**
 * The monthly calendar's read endpoint (KAN-80).
 *
 * Employee-scoped like the rest of time reporting: the JWT decides whose month
 * is returned, and admins are refused here — their view of employee months
 * belongs to the Month Close epic (§7.2).
 */
@ApiTags('months')
@ApiBearerAuth()
@Controller('months')
@UseGuards(JwtGuard, RolesGuard)
@Roles('employee')
export class MonthsController {
  constructor(private readonly months: MonthsService) {}

  @Get(':year/:month')
  @ApiOperation({
    summary: "One month of the signed-in employee's reporting data",
    description:
      'Entries, absences, and lock status in a single response. Absences are an ' +
      'empty array until the Absences epic ships; the key is part of the contract.',
  })
  @ApiResponse({ status: 200, description: 'The month payload.' })
  @ApiResponse({ status: 400, description: 'Year or month outside the accepted range.' })
  async getMonth(
    @Req() req: { user: AuthenticatedUser },
    @Param() params: Record<string, unknown>,
  ) {
    const parsed = MonthParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          rule: 'VAL-MONTH-PARAMS',
          message: issue.message,
        })),
      });
    }

    const data = await this.months.getMonth(req.user.userId, parsed.data.year, parsed.data.month);
    return { data };
  }
}
