import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AdminsService } from './controllers/admin.controller';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const adminsService = app.get(AdminsService);

  const username = 'admin';
  const password = 'password123';
  
  const existingAdmin = await adminsService.findByUsername(username);
  if (existingAdmin) {
    console.log(`Admin user '${username}' already exists.`);
  } else {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    await adminsService.create(username, passwordHash);
    console.log(`Admin user '${username}' created successfully with password '${password}'.`);
  }

  await app.close();
}

bootstrap();
