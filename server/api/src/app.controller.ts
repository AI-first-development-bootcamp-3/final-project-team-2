import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/auth.decorators';

@ApiTags('health')
@Controller()
export class AppController {
  // Public by decision (17 Aug 2026, recorded on KAN-41): CI, Docker
  // healthchecks and deploy smoke tests probe this route untokened.
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiOkResponse({
    description: 'Service is up',
    schema: {
      type: 'object',
      properties: { status: { type: 'string', example: 'ok' } },
    },
  })
  getHealth() {
    return { status: 'ok' };
  }
}
