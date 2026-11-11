import type { Request, Response } from 'express';

import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  return app;
}

// On Vercel each function instance boots the app once and reuses it for every
// Request it serves. Without an exported handler, a request reaching a cold
// Instance raced the bootstrap and failed with FUNCTION_INVOCATION_FAILED,
// Which carries no CORS headers, so browsers reported it as a CORS error.
let serverPromise: Promise<(req: Request, res: Response) => void> | null = null;

function getServer() {
  if (!serverPromise) {
    serverPromise = createApp()
      .then(async (app) => {
        await app.init();
        return app.getHttpAdapter().getInstance();
      })
      .catch((error: unknown) => {
        // Let the next request retry the bootstrap instead of caching a failure.
        serverPromise = null;
        throw error;
      });
  }
  return serverPromise;
}

export default async function handler(req: Request, res: Response) {
  const server = await getServer();
  return server(req, res);
}

if (!process.env.VERCEL) {
  createApp().then((app) => {
    return app.listen(process.env.PORT || 3000);
  });
}
