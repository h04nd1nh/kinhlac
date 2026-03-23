import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { HuyetViService } from '../controllers/huyet-vi.controller';
import { CreateHuyetViDto, UpdateHuyetViDto } from '../models/huyet-vi.dto';

@Controller('huyet-vi')
export class HuyetViRouter {
  constructor(private readonly service: HuyetViService) {}

  @Get()
  findAll(@Query('kinh_mach') kinhMachId?: string) {
    if (kinhMachId) {
      return this.service.findByKinhMach(parseInt(kinhMachId, 10));
    }
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateHuyetViDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHuyetViDto) {
    return this.service.update(id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
