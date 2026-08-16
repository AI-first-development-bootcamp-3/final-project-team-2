import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  it('GET /health returns { status: "ok" }', async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    const controller = module.get(AppController);
    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });
});
