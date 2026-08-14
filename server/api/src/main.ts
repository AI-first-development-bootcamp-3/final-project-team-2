import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { parseEnv } from './env';

async function bootstrap() {
  const env = parseEnv();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: env.CORS_ORIGINS });

  const config = new DocumentBuilder()
    .setTitle('Abra Timesheet API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  // GENERAL_SPEC §6.11 places docs under the API prefix; same content either way
  app.getHttpAdapter().get('/api/v1/docs', (_req, res) => res.redirect('/docs'));

  await app.listen(env.PORT);
}
bootstrap();
