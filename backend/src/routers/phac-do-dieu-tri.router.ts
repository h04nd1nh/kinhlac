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
import { PhacDoDieuTriService } from '../controllers/phac-do-dieu-tri.controller';
import { CreatePhacDoDieuTriDto, UpdatePhacDoDieuTriDto } from '../models/phac-do-dieu-tri.dto';

@Controller('phac-do-dieu-tri')
export class PhacDoDieuTriRouter {
  constructor(private readonly service: PhacDoDieuTriService) {}

  @Get()
  findAll(@Query('benh') benhId?: string) {
    if (benhId) {
      return this.service.findByBenh(parseInt(benhId, 10));
    }
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePhacDoDieuTriDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePhacDoDieuTriDto) {
    return this.service.update(id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
