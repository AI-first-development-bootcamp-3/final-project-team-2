import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validation';

async function bootstrap() {
  validateEnv(process.env);
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
