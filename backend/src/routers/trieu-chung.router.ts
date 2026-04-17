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
} from '@nestjs/common';
import { TrieuChungService } from '../controllers/trieu-chung.controller';
import { CreateTrieuChungDto, UpdateTrieuChungDto } from '../models/trieu-chung.dto';

@Controller('trieu-chung')
export class TrieuChungRouter {
  constructor(private readonly service: TrieuChungService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 0;
    if (pageNum > 0 && limitNum > 0) {
      return this.service.findPaginated(pageNum, limitNum, search);
    }
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateTrieuChungDto) {
    const item = await this.service.create(dto);
    return { success: true, id: item.id, data: item };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrieuChungDto,
  ) {
    const item = await this.service.update(id, dto);
    return { success: true, data: item };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { success: true };
  }
}
