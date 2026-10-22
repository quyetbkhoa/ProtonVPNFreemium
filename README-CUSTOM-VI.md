# VPN Site Router rc3

Bản tùy biến cá nhân, không chính thức, từ mã nguồn mở Proton VPN extension
(GPL-3.0). Dùng **thay** extension Proton gốc, không phải extension phụ chạy cùng.

Mục tiêu: chỉ domain bạn chọn đi qua Proton VPN; các domain còn lại đi trực tiếp.
Cho phép cấu hình định tuyến cục bộ với tài khoản Free. Không đổi hạng tài khoản,
không mở máy chủ trả phí, không đổi cơ chế xác thực của Proton.

rc2 mở giao diện chọn thủ công quốc gia, thành phố và máy chủ cho mọi hạng tài
khoản. Chọn được mọi nước trong danh sách có máy chủ được phép dùng; nước chỉ có
máy chủ trả phí vẫn yêu cầu nâng gói. Không có cam kết mở toàn bộ quốc gia của
Proton cho tài khoản Free. Danh sách và quyền truy cập phụ thuộc dữ liệu máy chủ
Proton trả về; chưa kiểm chứng kết nối thực tế. Không lấy mã từ Swift fork.

rc3 thêm Recent connections cho Free, lịch sử 30 lựa chọn, Favorites theo quốc gia/
máy chủ, nút thêm site hiện tại và nhập/xuất JSON. Auto-connect và hạn chế rò WebRTC
đã có sẵn trong Features cho Free; giữ nguyên lựa chọn bật/tắt hiện có của bạn.

## Cài thử, giữ nguyên profile hiện tại

1. Tạo một **Chrome profile riêng để thử**, không bật đồng bộ extension vào đó.
2. Giải nén `artifacts/rc3/VPN-Site-Router-rc3.zip` vào một thư mục cố định. Nếu dùng
   ngay trong workspace, có thể chọn thư mục `W:\ProtonVPNCustom\distribution`.
3. Trong profile thử, mở `chrome://extensions`, bật **Developer mode**, chọn
   **Load unpacked** và chọn thư mục chứa `manifest.json` vừa giải nén.
4. Kiểm tra tên **VPN Site Router - Unofficial Proton fork**, phiên bản hiển thị
   `1.3.6-site-router-rc3`. Ghim extension lên thanh công cụ.
5. Đăng nhập qua trang Proton chính thức mà extension mở. Không gửi mật khẩu,
   cookie hay token cho người khác. Tôi chưa kiểm chứng đăng nhập bản fork này.
6. Vào **Features → Split tunneling**, bật công tắc, chọn **Include mode**.
   Thêm `xda-developers.com`, bật **Also add subdomains** nếu muốn dùng cả forum.
   Nhập domain, không nhập đường dẫn, wildcard hoặc URL vào ô này.
7. Chọn một quốc gia có máy chủ Free trong danh sách rồi bấm **Connect**. Có thể
   mở dấu `>` để chọn thành phố/máy chủ phù hợp. **Quick Connect** vẫn hoạt động.
   Nếu nước đó chỉ có máy chủ trả phí, giao diện vẫn yêu cầu nâng gói. Mở lại trang.

Nếu đã cài bản cũ từ thư mục `distribution`, bấm **Reload** trên trang quản lý
extension sau khi build rc3. Nếu đã cài từ thư mục giải nén riêng, dùng bản ZIP rc3
và kiểm tra thư mục nguồn trong Details. Không cần gỡ tài khoản hoặc xóa dữ liệu.
ZIP rc1 và hash cũ được giữ nguyên tại `artifacts/`, rc2 nằm riêng ở `artifacts/rc2/`.
rc3 nằm riêng ở `artifacts/rc3/`, không ghi đè ZIP của các bản trước.

Cấu hình mới mặc định bật Include mode, danh sách rỗng. Hãy thêm site trước khi dùng.
Nếu khôi phục dữ liệu cũ, kiểm tra lại mode và danh sách; không ghi đè cấu hình cũ.

**Quan trọng về ID:** bản này giữ public manifest key và app ID gốc để tương thích
callback đăng nhập từ `account.proton.me`. Đây không phải private signing key.
Vì cùng ID, không thể cài song song hai bản trong một Chrome profile; chỉ tắt bản
gốc không giải quyết xung đột ID. Profile thử riêng tránh phải gỡ bản đang dùng.
Không có thao tác tự cài/gỡ extension hay thay đổi profile hiện tại trong dự án này.

## Cách hoạt động và giới hạn

- `xda-developers.com` và các subdomain được chọn → VPN.
- Domain tải file khác, không nằm trong danh sách → trực tiếp.
- File tải từ **chính domain đã chọn** vẫn qua VPN. Extension không phân biệt
  lướt trang và tải file trên cùng hostname, cũng không định tuyến theo tab.
- Script, ảnh, đăng nhập hoặc CDN ở domain khác sẽ đi trực tiếp trừ khi thêm riêng.
  Nếu trang vẫn lỗi, xác định domain tài nguyên cần VPN rồi thêm đúng domain đó.
- Include mode vẫn giữ ngoại lệ dịch vụ Proton của mã nguồn gốc: các subdomain
  `.protonvpn.net` và `.protonvpn.com` đi qua VPN; API tài khoản và mạng nội bộ được
  loại trừ. Không hứa mọi request đều tuân theo riêng danh sách người dùng.
- Tắt **Split tunneling** trong lúc VPN đang kết nối sẽ quay về VPN toàn Chrome.
  **Disconnect** VPN sẽ trả trình duyệt về kết nối bình thường. Không phải kill
  switch vĩnh viễn; không dùng rc3 như một bảo đảm chống lộ IP.
- Nếu Windows đang chạy VPN hệ thống hoặc proxy khác, domain “trực tiếp” vẫn chịu
  tác động của cấu hình đó. Tốc độ tải phụ thuộc đường truyền và máy chủ file.
- Giữ quyền truy cập, hành vi telemetry/crash reports và giao diện Proton upstream.
  Có thể xem các tùy chọn gửi số liệu trong Features. Đây là bản thử cục bộ, chưa
  được kiểm toán bảo mật, không tự nhận hỗ trợ chính thức từ Proton.

## Các tiện ích mới trong rc3

- **Dùng VPN cho site này:** mở trang HTTP/HTTPS, mở popup và bấm nút trên danh sách
  quốc gia. Thêm đúng hostname, không đoán domain cha hoặc tự thêm subdomain. Nếu
  đang Exclude, nhãn nút nói rõ sẽ bật Include: chỉ site trong danh sách Include
  dùng VPN. Danh sách Exclude cũ vẫn giữ riêng. Nếu VPN chưa kết nối, bấm Connect.
- **Favorites:** mở “Favorites và sao lưu quy tắc”; chọn quốc gia rồi “Lưu quốc
  gia”, hoặc kết nối VPN rồi “Lưu máy chủ đang dùng”. Bấm tên để gửi yêu cầu kết
  nối, Xóa để bỏ. Tối đa 100 mục, không lưu trùng; kiểm tra lại quyền/khả dụng trước
  khi kết nối. Máy chủ offline, đã nghỉ hoặc không thuộc quyền tài khoản bị khóa.
- **Recents:** bật/tắt trong Features; Free được dùng, lưu tối đa 30 lựa chọn, mới
  nhất trước. Giữ dữ liệu cũ khi nâng cấp; không khôi phục được các mục mà giới hạn
  5 của bản trước đã loại bỏ. Lịch sử ghi lựa chọn/yêu cầu, không chứng nhận mỗi
  lần kết nối đều thành công.
- **Xuất JSON:** tải `vpn-site-router-settings.json`, chỉ chứa quy tắc Include/
  Exclude và Favorites. Không xuất tài khoản, cookie, token hay thông tin proxy.
- **Nhập JSON:** chọn backup Site Router v1, xem số mục rồi bấm “Nhập và gộp quy
  tắc”. Tối đa 1 MiB, 1000 quy tắc, 100 Favorites. Gộp thêm mục mới; giữ mode, bật/
  tắt hiện tại và lựa chọn subdomain của quy tắc đã có. Không tự chuyển theo mode
  của file. JSON sai bị từ chối trước khi ghi. Một lần ghi Chrome storage lưu cả
  quy tắc và Favorites được nhập. Cấu hình do quản trị viên quản lý không cho sửa.

Dữ liệu lưu local trong profile extension; các tiện ích này không cần Pro. Quyền
truy cập máy chủ trả phí vẫn giữ nguyên.

## Kiểm tra thực tế rc3

Build và test offline không chứng minh VPN đã hoạt động trên Chrome. Cần kiểm tra:

1. Đăng nhập tài khoản Free. Chọn ít nhất hai quốc gia có máy chủ Free, xác nhận
   tên nước đang kết nối và IP thực tế. Thử chọn thành phố/máy chủ cụ thể và Quick
   Connect. Nước/máy chủ chỉ có trả phí phải hiện nâng gói, không báo kết nối giả.
2. Dùng một site kiểm tra IP đáng tin cậy: để ngoài Include list, tải lại và ghi IP;
   thêm domain chính xác vào Include list, tải lại và so sánh IP. Sau đó bỏ quy tắc
   thử này. Không ghi token/cookie vào bằng chứng.
3. XDA truy cập được, đồng thời tải **một file mới** từ domain ngoài danh sách.
   Với site kiểm tra IP ngoài danh sách, IP vẫn là đường trực tiếp. So sánh tốc độ
   trong cùng điều kiện; không lấy build/test làm bằng chứng tăng tốc.
4. Thử domain chính, subdomain và lựa chọn không bao gồm subdomain; thêm/xóa rule
   trong lúc đang kết nối; khởi động lại Chrome và xác nhận cấu hình còn đúng.
5. Thử reconnect, đổi máy chủ Free, lỗi kết nối, disconnect; quan sát lỗi và IP
   trước khi dùng cho dữ liệu nhạy cảm. DNS/WebRTC và tải chuyển hướng CDN chưa
   được kiểm chứng bởi test offline.
6. Thử thêm site khi VPN đang bật/tắt: đúng hostname, giữ quy tắc cũ, Include được
   bật rõ ràng. Site ngoài danh sách vẫn đi trực tiếp khi không có VPN hệ thống.
7. Lưu/xóa/kết nối Favorite; mở lại Chrome kiểm tra dữ liệu. Bật/tắt Recents. Xuất
   JSON, thêm quy tắc mới rồi nhập lại: phải gộp và giữ nguyên mục/mode hiện tại.
8. Thử chuột/bàn phím, sáng/tối và cỡ chữ lớn. Auto-connect/WebRTC cần kiểm chứng
   runtime riêng, không suy từ giá trị mặc định hoặc test offline.

Nếu muốn quay lại bản đang dùng, đóng profile thử. Gỡ bản thử trong profile đó khi
không cần; profile Chrome chính và extension gốc không bị thay đổi bởi các bước này.

## Build từ nguồn

Yêu cầu Node.js và npm tương thích lockfile upstream. Đã build bằng Node 24.19.0,
npm 11.17.0 trên Windows. Chạy tại thư mục dự án:

```powershell
npm ci --ignore-scripts
npm run test:site
npm run test:locations
npm run test:local
npx tsc --noEmit
npm run build
npm run package:custom
```

Thư mục `distribution` là extension unpacked. `artifacts/rc3` chứa ZIP cài, ZIP mã
nguồn tương ứng và `CHECKSUMS.json`; mỗi ZIP kèm LICENSE. Source archive không chứa node_modules,
profile trình duyệt hay thông tin tài khoản. Lệnh package không build lại: luôn
chạy build trước. Kiểm tra hash bằng `Get-FileHash -Algorithm SHA256 <file.zip>`.

Nguồn gốc: https://github.com/ProtonVPN/proton-vpn-browser-extension

Revision upstream: `71d7d86f164a2ee8e50ce5a389c9e5cbe0fd6883` (1.3.6).
Tài liệu tính năng: https://protonvpn.com/support/browser-extensions
Mã tier gate gốc: `source/js/vpn/getSplitTunnelingConfig.ts` ở revision trên.
Các thay đổi cục bộ mở tiện ích xử lý trên máy và mặc định Include; giữ nguyên
kiểm tra quyền máy chủ trong `state.ts` và các chức năng trả phí phía server.

rc3 có 12 test định tuyến, 12 test chọn vị trí và 18 test tiện ích/DOM: tổng 42.
Test mô phỏng server/storage/tab và thực thi logic/renderers production. Fixture
popup offline dùng HTML/CSS production đã được xem bằng Chrome headless ở sáng/
tối và chữ 200%, gồm chuỗi dài: không tràn ngang/cắt chữ nút trong các mẫu đã thử.
Tạo fixture bằng `node scripts/preview-local-tools.cjs` sau build; kết quả ở
`logs/ui-rc3/`. Đây là QA bố cục, không phải extension đã cài hay kiểm tra mạng/IP.

Dependency audit tại lúc tạo rc1: runtime `npm audit --omit=dev` báo 0 lỗi; toàn bộ
cây dependency upstream có 38 cảnh báo (6 moderate, 29 high, 3 critical), thuộc
phạm vi dev/build. Chưa tự nâng dependency để tránh tạo thêm thay đổi chưa kiểm
chứng. Audit không phải chứng nhận bảo mật của bản build.
