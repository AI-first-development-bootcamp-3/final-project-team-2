import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { AuthModule } from './auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { ENV } from '../env.provider';
import { makeFakePrisma, TEST_ENV } from './auth.testing';

describe('Swagger documentation for auth endpoints', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] })
      .overrideProvider(PrismaService)
      .useValue(makeFakePrisma([]))
      .overrideProvider(ENV)
      .useValue(TEST_ENV)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').setVersion('1.0').build(),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['/api/v1/auth/login', '200', true],
    ['/api/v1/auth/refresh', '200', true],
    ['/api/v1/auth/logout', '204', false],
  ])('documents POST %s with a summary and %s response', (path, successStatus, expects401) => {
    const operation = document.paths[path]?.post;
    expect(operation, `missing ${path}`).toBeDefined();
    expect(operation?.summary, `missing summary on ${path}`).toBeTruthy();
    expect(
      operation?.responses?.[successStatus],
      `missing ${successStatus} on ${path}`,
    ).toBeDefined();
    if (expects401) {
      expect(operation?.responses?.['401'], `missing 401 on ${path}`).toBeDefined();
    }
  });
});
