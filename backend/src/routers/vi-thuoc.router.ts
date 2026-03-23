import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ViThuocService } from '../controllers/vi-thuoc.controller';
import { CreateViThuocDto, UpdateViThuocDto } from '../models/dongy-thuoc.dto';

@Controller('vi-thuoc')
export class ViThuocRouter {
  constructor(private readonly service: ViThuocService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Post()
  async create(@Body() dto: CreateViThuocDto) {
    const item = await this.service.create(dto);
    return { success: true, id: item.id, data: item };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateViThuocDto) {
    const item = await this.service.update(+id, dto);
    return { success: true, data: item };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(+id);
    return { success: true };
  }
}
