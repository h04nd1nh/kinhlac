import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { SeoService } from '../controllers/seo.controller';
import {
  AnalyzeBatchDto,
  CreateDoiThuDto,
  GenerateDraftDto,
  GenerateImagesDto,
  RunTrendsDto,
  UpdateBaiVietDto,
} from '../models/seo.dto';

// Guard JWT là TOÀN CỤC (APP_GUARD) → mọi endpoint dưới đây đã yêu cầu đăng nhập.
@Controller('seo')
export class SeoRouter {
  constructor(private readonly service: SeoService) {}

  // ---- Đối thủ -------------------------------------------------------------
  @Get('doi-thu')
  async listDoiThu() {
    const data = await this.service.listDoiThu();
    return { success: true, data };
  }

  @Post('doi-thu')
  async createDoiThu(@Body() dto: CreateDoiThuDto) {
    const data = await this.service.createDoiThu(dto);
    return { success: true, data };
  }

  @Delete('doi-thu/:id')
  async removeDoiThu(@Param('id') id: string) {
    await this.service.removeDoiThu(+id);
    return { success: true };
  }

  @Post('doi-thu/:id/crawl')
  async crawl(@Param('id') id: string) {
    const data = await this.service.crawlSitemap(+id);
    return { success: true, data };
  }

  @Post('doi-thu/:id/analyze-batch')
  async analyzeBatch(@Param('id') id: string, @Body() dto: AnalyzeBatchDto) {
    const data = await this.service.analyzeBatch(+id, dto?.limit ?? 10);
    return { success: true, data };
  }

  // ---- URL -----------------------------------------------------------------
  @Get('url')
  async listUrls(
    @Query('doiThuId') doiThuId?: string,
    @Query('trangThai') trangThai?: string,
  ) {
    const data = await this.service.listUrls(
      doiThuId ? +doiThuId : undefined,
      trangThai || undefined,
    );
    return { success: true, data };
  }

  @Post('url/:id/analyze')
  async analyzeUrl(@Param('id') id: string) {
    const data = await this.service.analyzeUrl(+id);
    return { success: true, data };
  }

  @Delete('url/:id')
  async removeUrl(@Param('id') id: string) {
    await this.service.removeUrl(+id);
    return { success: true };
  }

  // ---- Cụm chủ đề / gap analysis ------------------------------------------
  @Get('cum')
  async listCum() {
    const data = await this.service.listCum();
    return { success: true, data };
  }

  @Post('gap-analysis')
  async gapAnalysis() {
    const data = await this.service.gapAnalysis();
    return { success: true, data };
  }

  // ---- Phase 2: Lò Viết Bài ------------------------------------------------
  @Get('bai-viet')
  async listBaiViet() {
    const data = await this.service.listBaiViet();
    return { success: true, data };
  }

  @Post('bai-viet/generate')
  async generateDraft(@Body() dto: GenerateDraftDto) {
    const data = await this.service.generateDraft(dto);
    return { success: true, data };
  }

  @Get('bai-viet/:id')
  async getBaiViet(@Param('id') id: string) {
    const data = await this.service.getBaiViet(+id);
    return { success: true, data };
  }

  @Get('bai-viet/:id/export')
  async exportArticle(@Param('id') id: string) {
    const data = await this.service.exportArticle(+id);
    return { success: true, data };
  }

  @Post('bai-viet/:id/publish')
  async publishArticle(@Param('id') id: string) {
    const data = await this.service.publishArticle(+id);
    return { success: true, data };
  }

  @Post('bai-viet/:id/generate-images')
  async generateImages(@Param('id') id: string, @Body() dto: GenerateImagesDto) {
    const data = await this.service.generateBodyImages(+id, dto?.max ?? 4);
    return { success: true, data };
  }

  @Put('bai-viet/:id')
  async updateBaiViet(@Param('id') id: string, @Body() dto: UpdateBaiVietDto) {
    const data = await this.service.updateBaiViet(+id, dto);
    return { success: true, data };
  }

  @Delete('bai-viet/:id')
  async removeBaiViet(@Param('id') id: string) {
    await this.service.removeBaiViet(+id);
    return { success: true };
  }

  // ---- Phase 3: Tự đăng theo xu hướng -------------------------------------
  @Get('trends/discover')
  async discoverTrends(@Query('seeds') seeds?: string) {
    const list = seeds
      ? seeds.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const data = await this.service.discoverTrends(list);
    return { success: true, data };
  }

  @Post('trends/run')
  async runTrends(@Body() dto: RunTrendsDto) {
    const data = await this.service.runTrendDrafts(dto?.keywords || []);
    return { success: true, data };
  }
}
