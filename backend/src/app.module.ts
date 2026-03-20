import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { Admin } from './models/admin.model';
import { MeridianSyndrome } from './models/meridian-syndrome.model';
import { Patient } from './models/patient.model';
import { Examination } from './models/examination.model';
import { PhuongHuyet } from './models/phuong-huyet.model';
import { BaiThuoc } from './models/bai-thuoc.model';
import { TrieuChung } from './models/trieu-chung.model';

// Routers (NestJS Controllers)
import { AdminsRouter } from './routers/admin.router';
import { AuthRouter } from './routers/auth.router';
import { MeridiansRouter } from './routers/meridian.router';
import { PatientsRouter } from './routers/patient.router';
import { ExaminationsRouter } from './routers/examination.router';
import { ModelsRouter } from './routers/model.router';
import { RecordsRouter } from './routers/record.router';
import { PhuongHuyetRouter } from './routers/phuong-huyet.router';
import { BaiThuocRouter } from './routers/bai-thuoc.router';
import { TrieuChungRouter } from './routers/trieu-chung.router';

// Controllers (NestJS Services)
import { AdminsService } from './controllers/admin.controller';
import { AuthService } from './controllers/auth.controller';
import { MeridiansService } from './controllers/meridian.controller';
import { PatientsService } from './controllers/patient.controller';
import { ExaminationsService } from './controllers/examination.controller';
import { ModelsService } from './controllers/model.controller';
import { PhuongHuyetService } from './controllers/phuong-huyet.controller';
import { BaiThuocService } from './controllers/bai-thuoc.controller';
import { TrieuChungService } from './controllers/trieu-chung.controller';

// Middlewares (Strategies/Guards)
import { JwtStrategy } from './middlewares/auth/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        ssl: {
          rejectUnauthorized: true,
          ca: configService.get<string>('CA_CERTIFICATE'),
        },
        autoLoadEntities: true,
        synchronize: true, // Should be false in production
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Admin, MeridianSyndrome, Patient, Examination, PhuongHuyet, BaiThuoc, TrieuChung]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'fallback_secret_key',
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController, AdminsRouter, AuthRouter, MeridiansRouter, PatientsRouter, ExaminationsRouter, ModelsRouter, RecordsRouter, PhuongHuyetRouter, BaiThuocRouter, TrieuChungRouter],
  providers: [AppService, AdminsService, AuthService, JwtStrategy, MeridiansService, PatientsService, ExaminationsService, ModelsService, PhuongHuyetService, BaiThuocService, TrieuChungService],
})
export class AppModule {}
