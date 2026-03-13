"""
API Server for AI Static Analysis Engine (V3).
Provides a RESTful interface to trigger code audits and retrieve results.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# Đảm bảo import được các module từ thư mục 'src'
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.engine.auditor import CodeAuditor
from src.config import WEIGHTS
from src.engine.scoring import ScoringEngine
from src.engine.database import AuditDatabase

app = FastAPI(
    title="AI Static Analysis API (V1)",
    description="Hệ thống cung cấp API cho việc kiểm toán mã nguồn tự động dựa trên Framework V3.",
    version="1.0.0"
)

# Cấu hình CORS để Frontend (React) có thể gọi API từ cổng khác
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Trong thực tế nên giới hạn domain cụ thể
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/list-dir")
async def list_directory(path: str = Query(".", description="Path to list contents for")):
    """
    Liệt kê các thư mục con của một đường dẫn cụ thể.
    Sử dụng cho trình duyệt thư mục trên giao diện Web.
    """
    abs_path = os.path.abspath(path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Đường dẫn không tồn tại")
    
    try:
        items = []
        # Lấy danh sách các thư mục con
        for item in os.listdir(abs_path):
            item_path = os.path.join(abs_path, item)
            if os.path.isdir(item_path):
                # Không hiển thị các thư mục ẩn hoặc thư mục đặc biệt
                if not item.startswith('.') or item == '.':
                    items.append({
                        "name": item,
                        "path": item_path,
                        "is_dir": True
                    })
        
        # Thêm mục quay lại thư mục cha
        parent_dir = os.path.dirname(abs_path)
        
        return {
            "current_path": abs_path,
            "parent_path": parent_dir if parent_dir != abs_path else None,
            "folders": sorted(items, key=lambda x: x['name'].lower())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    """Kiểm tra trạng thái hoạt động của API."""
    return {
        "status": "ready",
        "engine": "AI Static Analysis V3",
        "author": "Antigravity",
        "message": "API đang hoạt động ổn định."
    }

@app.get("/audit")
async def run_audit(target: str = Query(".", description="Path to the directory to be audited")):
    """
    Điểm cuối (Endpoint) để thực hiện kiểm toán mã nguồn.
    
    Args:
        target (str): Đường dẫn đến thư mục cần quét (mặc định là thư mục hiện tại).
        
    Returns:
        JSON bao gồm các chỉ số Metrics, Điểm số (Scores) và danh sách Vi phạm (Violations).
    """
    # 1. Kiểm tra sự tồn tại của thư mục mục tiêu
    target_path = os.path.abspath(target)
    if not os.path.exists(target_path):
        raise HTTPException(
            status_code=404, 
            detail=f"Không tìm thấy thư mục: {target}"
        )
    
    try:
        # 2. Khởi tạo và chạy bộ máy kiểm toán (Auditor)
        auditor = CodeAuditor(target_path)
        auditor.run()
        
        # 3. Tổng hợp dữ liệu vi phạm theo từng trụ cột
        pillar_punishments = {p: 0 for p in WEIGHTS.keys()}
        for v in auditor.violations:
            pillar_punishments[v['pillar']] += v['weight']
            
        total_loc = auditor.discovery_data['total_loc']
        
        # 4. Tính toán điểm quy đổi và xếp hạng
        pillar_scores = {}
        for pillar in WEIGHTS.keys():
            pillar_scores[pillar] = ScoringEngine.calculate_pillar_score(
                pillar_punishments[pillar], 
                total_loc
            )
            
        final_score = ScoringEngine.calculate_final_score(pillar_scores)
        rating = ScoringEngine.get_rating(final_score)
        
        # 5. Trả về kết quả cho Frontend
        return {
            "status": "success",
            "project_name": os.path.basename(target_path),
            "metrics": {
                "total_loc": total_loc,
                "total_files": auditor.discovery_data['total_files']
            },
            "scores": {
                "final": final_score,
                "rating": rating,
                "pillars": pillar_scores
            },
            "violations": auditor.violations # Danh sách chi tiết lỗi để hiển thị lên bảng Sổ Cái
        }
    except Exception as e:
        # Xử lý lỗi hệ thống nếu có
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

@app.get("/history")
async def get_audit_history(target: str = None):
    """Lấy danh sách lịch sử các lần kiểm toán."""
    try:
        history = AuditDatabase.get_history(target)
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Khởi chạy server tại port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
