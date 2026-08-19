import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MeController } from './me.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MeController],
  providers: [],
})
export class MeModule {}
