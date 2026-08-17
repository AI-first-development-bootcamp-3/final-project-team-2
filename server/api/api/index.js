const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');

let cachedServer;

module.exports = async (req, res) => {
  if (!cachedServer) {
    const { AppModule } = require('../dist/app.module');
    const { parseEnv } = require('../dist/env');

    const server = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
    const env = parseEnv();

    app.setGlobalPrefix('api/v1');
    app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });

    const config = new DocumentBuilder()
      .setTitle('Abra Timesheet API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });

    await app.init();
    cachedServer = server;
  }
  cachedServer(req, res);
};
