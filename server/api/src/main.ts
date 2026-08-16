import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { EnvValidationError, parseEnv, type Env } from './env';

function loadEnvOrExit(): Env {
  try {
    return parseEnv();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

async function bootstrap() {
  const env = loadEnvOrExit();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: env.CORS_ORIGINS });

  const config = new DocumentBuilder()
    .setTitle('Abra Timesheet API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  // GENERAL_SPEC §6.11 places docs under the API prefix; same content either way.
  // Deliberately 302, not 301: browsers cache 301s indefinitely, which would
  // strand clients if this path ever serves real content.
  app.getHttpAdapter().get('/api/v1/docs', (_req, res) => res.redirect(302, '/docs'));

  await app.listen(env.PORT);
}
bootstrap();
