import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // CORS - allow POS terminals on local network
  app.enableCors({
    origin: true, // In production, restrict to specific origins
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Australian Lighting & Fans POS API')
    .setDescription('Point of Sale system API for in-store operations')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('products', 'Product catalog')
    .addTag('customers', 'Customer management')
    .addTag('orders', 'Order processing')
    .addTag('quotes', 'Quote management')
    .addTag('discounts', 'Discount validation')
    .addTag('reports', 'Reporting')
    .addTag('sync', 'Magento synchronization')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Start server
  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);

  console.log(`
    ========================================
    🏪 Australian Lighting & Fans POS API
    ========================================
    Environment: ${configService.get('NODE_ENV', 'development')}
    Port: ${port}
    API Prefix: /${apiPrefix}
    Swagger Docs: http://localhost:${port}/docs
    ========================================
  `);
}

bootstrap();
