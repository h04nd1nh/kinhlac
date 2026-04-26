# Hướng Dẫn Triển Khai Hệ Thống Lên Server Linux (Docker)

Tài liệu này hướng dẫn bạn cách khởi chạy toàn bộ hệ thống (Frontend, Backend, và Database) lên máy chủ (Server) Linux hoặc máy ảo VPS một cách nhanh chóng thông qua `Docker` và `Docker Compose`.

## 1. Yêu Cầu Hệ Thống (Prerequisites)

Trước khi bắt đầu, server của bạn phải được cài đặt sẵn 2 thành phần:
- **Docker**: Nền tảng chạy container.
- **Docker Compose**: Công cụ quản lý nhiều container.

*(Bạn có thể dễ dàng cài đặt 2 ứng dụng này bằng cách Google "How to install Docker on Ubuntu/Centos", chỉ mất khoảng 2 phút)*

## 2. Chuẩn Bị Mã Nguồn

1. Đưa toàn bộ mã nguồn thư mục `medicine` hiện tại lên server của bạn (thông qua Git Clone, FTP, hoặc SCP).
2. Di chuyển vào thư mục gốc của dự án (nơi chứa file `docker-compose.yml`):
   ```bash
   cd /path/to/medicine
   ```

## 3. Cấu Hình Biến Môi Trường (Quan trọng)

Mặc định, ứng dụng đang sử dụng các thông số Database giả định. Để bảo mật, bạn nên mở file `docker-compose.yml` và thay đổi các cấu hình sau ở cả 2 phần `backend` và `postgres`:

```yaml
# Trong file docker-compose.yml
environment:
  - POSTGRES_USER=your_db_user_here
  - POSTGRES_PASSWORD=your_secure_password_here
  - POSTGRES_DB=medicine
```
*(Hãy chắc chắn rằng thông tin ở phần `backend` khớp hoàn toàn với thông tin khởi tạo ở phần `postgres`)*

> [!NOTE] 
> Đối với Backend, ngoài cấu hình DB, bạn cũng có thể tự map thêm các biến môi trường khác (VD: `JWT_SECRET`) vào mục `environment` của service `backend` nếu trong mã nguồn có yêu cầu.

## 4. Lệnh Chạy (Deploy)

Sau khi đã hoàn tất chuẩn bị, bạn chỉ cần gõ đúng 1 lệnh sau tại thư mục gốc của dự án:

```bash
docker-compose up -d --build
```

**Ý nghĩa của lệnh:**
- `up`: Khởi động toàn bộ các service được định nghĩa trong file YML.
- `-d` (Detached): Chạy ngầm trong background, bạn có thể tắt terminal mà server vẫn chạy.
- `--build`: Ép Docker phải Build lại các file `Dockerfile` của frontend và backend để lấy source code mới nhất.

### 🚀 Kết Quả:
- **Frontend** của bạn giờ đã có thể truy cập qua: `http://<IP-của-Server>` (Port 80)
- **Backend (API)** sẽ lắng nghe ở: `http://<IP-của-Server>:3000`
- **Database (Postgres)** kết nối nội bộ hoặc từ bên ngoài qua port `5432`. Dữ liệu sẽ được tự động lưu trữ vĩnh viễn vào volume `postgres_data` nên không sợ bị mất dữ liệu khi restart.

---

## 5. Các Lệnh Quản Trị Hữu Ích Khác

Dưới đây là một số lệnh thường dùng trong quá trình vận hành hệ thống:

**1. Xem trạng thái các ứng dụng đang chạy:**
```bash
docker-compose ps
```

**2. Xem log (lỗi/hoạt động) của Backend:**
```bash
docker-compose logs -f backend
```

**3. Tạm dừng hệ thống:**
```bash
docker-compose stop
```

**4. Dừng hoàn toàn và xóa các container (Không làm mất dữ liệu DB):**
```bash
docker-compose down
```

**5. Cập nhật mã nguồn mới (Khi bạn có code mới update):**
```bash
# 1. Kéo code mới về
git pull

# 2. Build lại và chạy (Hệ thống sẽ tự thay thế không gián đoạn quá lâu)
docker-compose up -d --build
```
