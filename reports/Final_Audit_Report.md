# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-03 10:05:28

## ĐIỂM TỔNG DỰ ÁN: 74.14 / 100 (🥉 Khá)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 382936
- Tổng số file: 1623
- Tổng số tính năng: 2

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 38 |
| 🔥 Critical | 19 |
| ⚠️ Major | 1237 |
| ℹ️ Minor | 3996 |
| ℹ️ Info | 2441 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 7.87 | ⚠️ Cần cải thiện |
| Maintainability | 7.3 | ⚠️ Cần cải thiện |
| Reliability | 5.58 | 🚨 Nguy cơ |
| Security | 8.6 | ✅ Tốt |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `growme_api` (LOC: 108635)
**Điểm tính năng: 75.71 / 100** (Nợ: 23351m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -412.0 | 8.41 |
| Maintainability | -1211.5 | 6.92 |
| Reliability | -1363.0 | 5.45 |
| Security | -116.0 | 9.04 |

---
#### 🔹 Tính năng: `growme_app` (LOC: 274301)
**Điểm tính năng: 73.52 / 100** (Nợ: 56944m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -1687.5 | 7.65 |
| Maintainability | -2346.0 | 7.45 |
| Reliability | -3196.0 | 5.63 |
| Security | -511.0 | 8.43 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Maintainability]** source_code/growme_api/code/F1_3_Crontab/cron.py: Import 'requests' might be unused (AST). AI Note: Thư viện 'requests' được import nhưng không được sử dụng ở bất kỳ đâu trong tệp tin này. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** source_code/growme_api/code/F1_3_Crontab/cron.py: Import 'psutil' might be unused (AST). AI Note: Thư viện 'psutil' được import nhưng không được sử dụng trong mã nguồn của tệp tin. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** source_code/growme_api/code/F1_3_Crontab/cron.py: Import 'run_method' might be unused (AST). AI Note: Hàm 'run_method' được import từ module bên ngoài nhưng không được gọi hoặc tham chiếu trong mã. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** source_code/growme_api/code/F1_3_Crontab/cron.py: Import 'socket' might be unused (AST). AI Note: Thư viện 'socket' được import nhưng không có logic nào sử dụng đến nó. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** source_code/growme_api/code/F1_3_Crontab/cron.py: Import 'run_process' might be unused (AST). AI Note: Hàm 'run_process' được import nhưng không được sử dụng trong tệp tin này. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** source_code/growme_api/code/F3_6_Content_Management/views.py: Import 'ThreadPool' might be unused (AST). AI Note: Import 'ThreadPool' không được sử dụng trong toàn bộ file. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** source_code/growme_api/code/F3_6_Content_Management/views.py: Import 'get_data_analytics_source_organic' might be unused (AST). AI Note: Hàm 'get_data_analytics_source_organic' được import nhưng không xuất hiện trong bất kỳ logic xử lý nào của file. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** source_code/growme_api/code/F3_6_Content_Management/views.py: Import 'DateCaculate' might be unused (AST). AI Note: Class 'DateCaculate' được import nhưng không được khởi tạo hay gọi static method nào trong code. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** source_code/growme_api/code/F3_6_Content_Management/views.py: Import 'HubspotCMSBlogPostAPI' might be unused (AST). AI Note: Class 'HubspotCMSBlogPostAPI' không được sử dụng ở bất kỳ dòng code nào. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** source_code/growme_api/code/F3_6_Content_Management/views.py: Import 'scan_data_analytics_hubspot' might be unused (AST). AI Note: Hàm 'scan_data_analytics_hubspot' được import nhưng không được gọi trong các view hay function khác. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `UNUSED_IMPORT` | Maintainability | 2864 | -1432.0 |
| `PRINT_STATEMENT` | Maintainability | 2420 | -1210.0 |
| `MUTABLE_DEFAULT_ARGS` | Reliability | 487 | -1948.0 |
| `NO_TIMEOUT_SET` | Reliability | 345 | -1725.0 |
| `BARE_EXCEPT` | Reliability | 339 | -678.0 |
| `GOD_OBJECT` | Maintainability | 249 | -498.0 |
| `COMMENTED_OUT_CODE` | Maintainability | 239 | -239.0 |
| `N_PLUS_ONE` | Performance | 223 | -1115.0 |
| `HIGH_COMPLEXITY` | Performance | 183 | -366.0 |
| `MEMORY_LEAK_OPEN` | Performance | 131 | -524.0 |
| `TOO_MANY_PARAMS` | Maintainability | 56 | -168.0 |
| `SELECT_STAR` | Performance | 39 | -78.0 |
| `HARDCODED_SECRET` | Security | 38 | -380.0 |
| `SWALLOWED_EXCEPTION` | Reliability | 32 | -160.0 |
| `FORGOTTEN_TODO` | Maintainability | 21 | -10.5 |
| `DANGEROUS_FUNC` | Security | 17 | -136.0 |
| `HARDCODED_IP_ADDRESS` | Reliability | 16 | -48.0 |
| `VERIFY_FALSE` | Security | 15 | -75.0 |
| `ITERROWS_USE` | Performance | 11 | -16.5 |
| `XSS_DANGER` | Security | 2 | -10.0 |
| `SQL_INJECTION` | Security | 2 | -16.0 |
| `INSECURE_HASH` | Security | 2 | -10.0 |


### 👥 Đánh giá theo Thành viên (Last 6 Months)
| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |
|---|---|---|---|
| **vi duc quyet** | 17 | 99.5 | 2m |
| **HieuHD** | 6 | 97.33 | 12m |
| **khanhtc** | 861 | 86.15 | 150m |
| **Nguyen VVB** | 647 | 71.23 | 234m |
| **KhanhTC** | 150 | 71.12 | 149m |
| **QuyetVD** | 10536 | 70.56 | 2041m |

#### 🔍 Chi tiết lỗi theo Thành viên

**vi duc quyet** (Top 5 vi phạm nặng nhất):
- [Maintainability] source_code/growme_app/code/F7_1_Growme_Data/Handle_data/hubspot_data.py:298 - Print statement found in production code. Use logger instead.. AI Note: Lệnh print nằm trong thư mục 'growme_app/code/', được xác định là code production. Theo quy tắc, print() nên được thay thế bằng logging để quản lý log tốt hơn. File này không nằm trong thư mục test hay có dấu hiệu là một script CLI độc lập. (Rule: PRINT_STATEMENT)

**HieuHD** (Top 5 vi phạm nặng nhất):
- [Maintainability] source_code/growme_api/code/F4_1_2_Internal_Link_Management/handle/inlink_url_info.py:105 - Print statement found in production code. Use logger instead.. AI Note: Lệnh print() nằm trong file '.../handle/inlink_url_info.py', đây là một phần của logic xử lý trong mã nguồn ứng dụng (production code), không phải trong thư mục test hay script CLI. Theo tiêu chuẩn phát triển, nên sử dụng thư viện logging thay vì print để quản lý nhật ký hệ thống tốt hơn. (Rule: PRINT_STATEMENT)
- [Maintainability] source_code/growme_api/code/F4_1_2_Internal_Link_Management/handle/inlink_url_info.py:106 - Print statement found in production code. Use logger instead.. AI Note: Tương tự vi phạm số 3, lệnh print() này xuất hiện trong code production nhằm mục đích debug/log thông tin preview. Việc để lại print trong môi trường production có thể làm ô nhiễm log stdout/stderr và không linh hoạt bằng việc dùng logger. (Rule: PRINT_STATEMENT)
- [Maintainability] source_code/growme_app/code/F4_1_2_Internal_Link_Management/handle_view/inlink_url_info_view.py:805 - Print statement found in production code. Use logger instead.. AI Note: Lệnh print() nằm trong file 'inlink_url_info_view.py', thuộc thư mục 'source_code/growme_app/code/'. Đây là code production (view handler) chứ không phải file test hay CLI script. Việc sử dụng print thay cho logger là vi phạm quy chuẩn Maintainability. (Rule: PRINT_STATEMENT)
- [Maintainability] source_code/growme_app/code/F4_1_2_Internal_Link_Management/handle_view/inlink_url_info_view.py:806 - Print statement found in production code. Use logger instead.. AI Note: Tương tự vi phạm #1, lệnh print() được sử dụng trong code xử lý logic của ứng dụng (view) thay vì sử dụng hệ thống logging chuyên dụng. (Rule: PRINT_STATEMENT)
- [Maintainability] source_code/growme_app/code/F4_1_2_Internal_Link_Management/handle_view/inlink_url_info_view.py:807 - Print statement found in production code. Use logger instead.. AI Note: Tương tự vi phạm #1 và #2, các lệnh print() phục vụ việc debug trực tiếp trong code production cần được thay thế bằng logger. (Rule: PRINT_STATEMENT)

**khanhtc** (Top 5 vi phạm nặng nhất):
- [Maintainability] source_code/growme_api/code/F4_1_2_Internal_Link_Management/handle/inlink_url_info.py:233 - Function has too many parameters (Consider DTO/Dict): set_post_replace_inlink (13 > 12). AI Note: Hàm 'set_post_replace_inlink' có tới 13 tham số (bao gồm cả self), vượt quá ngưỡng khuyến nghị là 12. Việc có quá nhiều tham số làm tăng độ phức tạp của hàm và khó kiểm soát trạng thái dữ liệu. Nên cân nhắc sử dụng DTO hoặc Dictionary để đóng gói dữ liệu. (Rule: TOO_MANY_PARAMS)
- [Maintainability] source_code/growme_api/code/F4_1_2_Internal_Link_Management/handle/inlink_url_info.py:233 - Function too long (God Object anti-pattern): set_post_replace_inlink (> 150 lines). AI Note: Hàm 'set_post_replace_inlink' được báo cáo là dài hơn 150 dòng. Đây là một vi phạm về khả năng bảo trì (Maintainability) theo nguyên tắc Clean Code để tránh 'God Object'. Việc gộp quá nhiều logic xử lý vào một hàm duy nhất gây khó khăn cho việc đọc và kiểm thử. (Rule: GOD_OBJECT)
- [Maintainability] source_code/growme_api/code/F4_1_2_Internal_Link_Management/handle/inlink_url_info.py:30 - Print statement found in production code. Use logger instead.. AI Note: File 'inlink_url_info.py' nằm trong thư mục 'source_code/growme_api/code/', thuộc cấu trúc logic xử lý của ứng dụng (production code), không phải là file test hay công cụ CLI script. Việc sử dụng print thay vì logger trong mã nguồn production gây khó khăn cho việc quản lý log. (Rule: PRINT_STATEMENT)
- [Maintainability] source_code/growme_api/code/F4_1_2_Internal_Link_Management/handle/inlink_url_info.py:36 - Print statement found in production code. Use logger instead.. AI Note: Tương tự vi phạm #0, đoạn mã này nằm trong module xử lý logic chính của hệ thống. Trong môi trường production, lỗi retry nên được ghi nhận qua logger để có thể theo dõi tập trung và cấu hình mức độ ưu tiên (level). (Rule: PRINT_STATEMENT)
- [Maintainability] source_code/growme_api/code/F4_1_2_Internal_Link_Management/handle/inlink_url_info.py:78 - Print statement found in production code. Use logger instead.. AI Note: Lệnh print được sử dụng trong logic retry của một handler ứng dụng. Đây là production code, việc dùng print vi phạm quy tắc về Maintainability. (Rule: PRINT_STATEMENT)

**Nguyen VVB** (Top 5 vi phạm nặng nhất):
- [Performance] source_code/growme_app/code/F4_6_1_Site_Content/handle_view/api_views.py:361 - N+1 Query Pattern Detected (DB/API Call inside a loop). Found 'cursor.execute()' inside loop.. AI Note: Lệnh `cursor.execute(sql, params)` nằm bên trong vòng lặp `for sid, s_p_ids in hub_post_ids_by_site.items()` (dòng 527). Truy vấn này thực hiện lấy trạng thái index cho các site_id và post_id cụ thể trong mỗi lần lặp, dẫn đến mô hình N+1 Query. Tuy nhiên, dữ liệu đã được nhóm theo site_id, nhưng vẫn thực hiện truy vấn lặp lại cho từng site. (Rule: N_PLUS_ONE)
- [Performance] source_code/growme_app/code/F4_6_1_Site_Content/handle_view/api_views.py:382 - N+1 Query Pattern Detected (DB/API Call inside a loop). Found 'cursor.execute()' inside loop.. AI Note: Tương tự như vi phạm #0, lệnh `cursor.execute(sql, params)` nằm bên trong vòng lặp `for sid, s_p_ids in hub_post_ids_by_site.items()` (dòng 548). Nó thực hiện truy vấn trạng thái kiểm tra (inspection status) cho từng nhóm site_id trong vòng lặp, tạo ra vấn đề N+1 Performance. (Rule: N_PLUS_ONE)
- [Performance] source_code/growme_app/code/F4_6_1_Site_Content/handle_view/api_views.py:311 - N+1 Query Pattern Detected (DB/API Call inside a loop). Found 'cursor.execute()' inside loop.. AI Note: Mặc dù đã có xử lý 'chunking' (chia nhỏ theo nhóm 500 ids), nhưng lệnh 'cursor.execute' vẫn nằm trong vòng lặp 'while count < len(post_ids)'. Đây vẫn được coi là một dạng N+1 (hoặc Batch-N+1) ảnh hưởng đến hiệu năng so với việc thực hiện một câu lệnh SQL duy nhất nếu kích thước toàn bộ không quá lớn. (Rule: N_PLUS_ONE)
- [Performance] source_code/growme_app/code/F4_6_1_Site_Content/handle_view/api_views.py:477 - N+1 Query Pattern Detected (DB/API Call inside a loop). Found 'HubPostInfo.objects.filter()' inside loop.. AI Note: Truy vấn database 'HubPostInfo.objects.filter()' được thực thi bên trong vòng lặp và sử dụng các biến lặp như 'sid' (site_id) và 'chunk_post_ids'. Điều này tạo ra N truy vấn tới database tương ứng với số lần lặp, gây sụt giảm hiệu năng nghiêm trọng (N+1 Query Pattern). Nên sử dụng kỹ thuật fetch dữ liệu một lần trước vòng lặp hoặc tối ưu lại logic truy vấn. (Rule: N_PLUS_ONE)
- [Maintainability] source_code/growme_api/code/F4_6_1_Site_Content/handle_api/api_views.py:341 - Print statement found in production code. Use logger instead.. AI Note: Lệnh print('[DEBUG] PAIRS:...') được sử dụng để debug trong code production (api_views.py). Các lệnh debug này nên được gỡ bỏ hoặc chuyển sang dùng logger.debug(). (Rule: PRINT_STATEMENT)

**KhanhTC** (Top 5 vi phạm nặng nhất):
- [Security] source_code/growme_app/code/F5_9_2_Export_Mql_Contacts/data_handle/data_history_score.py:235 - Dangerous function 'eval' detected (Arbitrary Code Execution). AI Note: Hàm eval() đang thực thi một chuỗi lấy từ 'obj_contacts.get("action")'. Vì dữ liệu này đến từ tập dữ liệu contact (có nguồn gốc bên ngoài hoặc từ database), nó có thể bị lợi dụng để thực thi mã độc (RCE). Nên sử dụng json.loads() hoặc ast.literal_eval() thay thế. (Rule: DANGEROUS_FUNC)
- [Performance] source_code/growme_app/code/F5_9_2_Export_Mql_Contacts/data_handle/data_history_score.py:281 - N+1 Query Pattern Detected (DB/API Call inside a loop). Found 'HubLandingPageInfo.objects.filter()' inside loop.. AI Note: Việc gọi 'HubLandingPageInfo.objects.filter().first()' bên trong vòng lặp xử lý dữ liệu lịch sử/contacts để lấy thông tin theo 'path' là lỗi N+1 Query. Điều này sẽ gây ra hàng loạt truy vấn vào DB. Nên lấy toàn bộ thông tin cần thiết ra một bản đồ (map) trước khi vào vòng lặp. (Rule: N_PLUS_ONE)
- [Reliability] source_code/growme_app/code/F5_9_2_Export_Mql_Contacts/data_handle/data_history_score.py:205 - Function uses a mutable default argument (e.g. list or dict). This can cause unexpected state retention across calls.. AI Note: Hàm '_data_action_to_mql_contacts' sử dụng '{}' làm giá trị mặc định cho tham số 'dict_all_contacts'. Cần thay đổi thành 'None' và khởi tạo dict bên trong hàm để đảm bảo tính an toàn. (Rule: MUTABLE_DEFAULT_ARGS)
- [Maintainability] source_code/growme_api/code/F5_9_2_Export_Mql_Contacts/handle/history_mql.py:464 - Print statement found in production code. Use logger instead.. AI Note: Lệnh print() nằm trong file production code của API (/growme_api/code/.../handle/history_mql.py), không phải trong thư mục test. Đây là logic xử lý (handler) nên cần sử dụng logger thay vì print để đảm bảo tính duy trì và quản lý log tốt hơn. (Rule: PRINT_STATEMENT)
- [Maintainability] source_code/growme_api/code/F5_9_2_Export_Mql_Contacts/handle/history_mql.py:466 - Print statement found in production code. Use logger instead.. AI Note: Lệnh print() nằm trong file production code của API, không phải file test hay công cụ CLI độc lập. Việc in kết quả ra tiêu chuẩn stdout bằng print() trong code handler của API là vi phạm quy tắc duy trì mã nguồn. (Rule: PRINT_STATEMENT)

**QuyetVD** (Top 5 vi phạm nặng nhất):
- [Security] source_code/growme_api/code/__LP_Library/API/Data_For_SEO_V3/_Base/_const.py:11 - Hardcoded Secret/Token/Password detected. AI Note: Tương tự vi phạm #2, đây là thông tin tài khoản và mật khẩu thực tế ('thomnth@liftsoft.vn') được lưu trực tiếp trong code production, gây rủi ro bảo mật nghiêm trọng. (Rule: HARDCODED_SECRET)
- [Security] source_code/growme_api/code/__LP_Library/API/Data_For_Seo/_Base/_const.py:2 - Hardcoded Secret/Token/Password detected. AI Note: File '_const.py' chứa thông tin đăng nhập thực tế của dịch vụ DataForSeo bao gồm email vận hành ('thomnth@liftsoft.vn') và một chuỗi hash/token đóng vai trò mật khẩu. Các giá trị này không phải là placeholder hay ví dụ minh họa, do đó việc hardcode chúng trực tiếp vào mã nguồn là lỗi bảo mật nghiêm trọng. (Rule: HARDCODED_SECRET)
- [Security] source_code/growme_app/code/__LP_Library/API/Data_For_SEO_V3/_Base/_const.py:11 - Hardcoded Secret/Token/Password detected. AI Note: Tương tự như vi phạm #0, đây là thông tin tài khoản và mật khẩu API thực được hardcode vào mã nguồn, vi phạm quy tắc bảo mật. (Rule: HARDCODED_SECRET)
- [Security] source_code/growme_app/code/__LP_Library/API/Data_For_Seo/_Base/_const.py:2 - Hardcoded Secret/Token/Password detected. AI Note: Các giá trị 'USER_NAME' và 'PASSWORD' trong file '_const.py' có định dạng của thông tin xác thực thực tế (email cá nhân/doanh nghiệp và chuỗi mã hex). Chúng không phải là placeholder (như 'your_key') hay ví dụ minh họa và được gán vào các hằng số dùng cho kết nối API DataForSeo, do đó đây là lỗi Hardcoded Secret thật. (Rule: HARDCODED_SECRET)
- [Security] source_code/growme_app/code/growme_app/settings.py:346 - Hardcoded Secret/Token/Password detected (Rule: HARDCODED_SECRET)
