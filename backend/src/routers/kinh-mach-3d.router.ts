import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { KinhMach3dService } from '../controllers/kinh-mach-3d.controller';
import { JwtAuthGuard } from '../middlewares/auth/jwt-auth.guard';

/**
 * API cho tính năng "Chấm Tay" của Đồ Hình Kinh Lạc 3D.
 *
 * nginx (VPS) chuyển /api/* -> backend (cắt prefix /api), nên frontend gọi
 *   GET  /api/kinh-mach-3d/anchors  -> đây
 *   POST /api/kinh-mach-3d/anchors  -> đây
 * Dev: frontend gọi thẳng http://localhost:3001/kinh-mach-3d/anchors.
 */
@Controller('kinh-mach-3d')
export class KinhMach3dRouter {
  constructor(private readonly service: KinhMach3dService) {}

  /** Tải bộ chốt đã lưu (mở — để bản đồ hiển thị cho mọi người đăng nhập). */
  @Get('anchors')
  getAnchors() {
    return this.service.getAnchors();
  }

  /** Lưu (thay toàn bộ) bộ chốt + căn theo — yêu cầu đăng nhập. Trả luôn toạ độ gold. */
  @UseGuards(JwtAuthGuard)
  @Post('anchors')
  saveAnchors(@Body() body: { points?: unknown; needles?: unknown }) {
    return this.service.saveAnchors(body ?? {});
  }

  /** ⚙ Căn Tổng Thể: chạy solver trên các chốt gửi lên, KHÔNG lưu — yêu cầu đăng nhập. */
  @UseGuards(JwtAuthGuard)
  @Post('recompute')
  recompute(@Body() body: { points?: unknown }) {
    return this.service.recompute(body?.points ?? {});
  }
}
