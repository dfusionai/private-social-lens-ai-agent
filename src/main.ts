import 'dotenv/config';
import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import validationOptions from './utils/validation-options';
import { AllConfigType } from './config/config.type';
import { ResolvePromisesInterceptor } from './utils/serializer.interceptor';

async function bootstrap() {
  const logger = new Logger('Main');

  const app = await NestFactory.create(AppModule, {
    cors: true,
    bodyParser: false, // Disable default body parser to configure our own with custom limit
  });
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const configService = app.get(ConfigService<AllConfigType>);

  // Configure body parser limit for JSON payloads
  // Use maxFileSize from config or default to 10MB for JSON body parsing
  // Note: NestJS doesn't support passing body parser options directly in NestFactory.create(),
  // so we disable the default and configure our own
  const maxFileSize =
    configService.get('file.maxFileSize', { infer: true }) || 10485760; // 10MB default
  app.use(json({ limit: maxFileSize }));
  app.use(urlencoded({ limit: maxFileSize, extended: true }));

  logger.log(
    `Body parser limit set to ${maxFileSize} bytes (${(maxFileSize / 1024 / 1024).toFixed(2)} MB)`,
  );

  app.enableShutdownHooks();
  app.setGlobalPrefix(
    configService.getOrThrow('app.apiPrefix', { infer: true }),
    {
      exclude: ['/'],
    },
  );
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.useGlobalPipes(new ValidationPipe(validationOptions));
  app.useGlobalInterceptors(
    // ResolvePromisesInterceptor is used to resolve promises in responses because class-transformer can't do it
    // https://github.com/typestack/class-transformer/issues/549
    new ResolvePromisesInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  const options = new DocumentBuilder()
    .setTitle('API')
    .setDescription('API docs')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      in: 'header',
      required: false,
      name: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
      schema: {
        example: 'en',
      },
    })
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('docs', app, document);

  const port = configService.getOrThrow('app.port', { infer: true });

  await app.listen(port);

  logger.log(`Server is running on port http://localhost:${port}`);
  logger.log(`Swagger is running on port http://localhost:${port}/docs`);
}
void bootstrap();
