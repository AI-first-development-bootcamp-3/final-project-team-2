import 'dotenv/config';
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
  // credentials: true is required for the spec's httpOnly refresh-cookie flow
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });

  const config = new DocumentBuilder()
    .setTitle('Abra Timesheet API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // Mounted twice so both the short path and GENERAL_SPEC §6.11's prefixed
  // path serve the full UI including docs-json/docs-yaml — no redirect needed.
  SwaggerModule.setup('docs', app, document);
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });

  await app.listen(env.PORT);
}
bootstrap();
