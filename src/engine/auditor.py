"""
Bộ máy kiểm toán mã nguồn (Core Auditor Engine).
Quản lý luồng thực thi 5 bước: Discovery, Scanning, Verification, Aggregation, Reporting.
"""

import os
import json
import sys
from src.config import WEIGHTS, K_FACTOR
from src.engine.discovery import DiscoveryStep
from src.engine.verification import VerificationStep
from src.engine.scoring import ScoringEngine
from src.engine.database import AuditDatabase

class CodeAuditor:
    def __init__(self, target_dir='.'):
        """
        Khởi tạo Auditor cho một thư mục cụ thể.
        """
        self.target_dir = os.path.abspath(target_dir)
        self.discovery_data = None
        
        # Đường dẫn xuất báo cáo (luôn nằm trong thư mục 'reports' của project hiện tại)
        report_dir = os.path.abspath('reports')
        if not os.path.exists(report_dir):
            os.makedirs(report_dir)
            
        self.ledger_path = os.path.join(report_dir, 'ai_violation_ledger.md')
        self.report_path = os.path.join(report_dir, 'Final_Audit_Report.md')
        self.violations = []

    def log_violation(self, pillar, file, reason, weight, snippet=""):
        """Ghi nhận một vi phạm mới và lưu vào danh sách."""
        violation = {
            "pillar": pillar,
            "file": file,
            "reason": reason,
            "weight": weight,
            "snippet": snippet
        }
        self.violations.append(violation)
        
        # Ghi nối vào file Ledger (Sổ cái bằng chứng)
        with open(self.ledger_path, 'a') as f:
            f.write(f"- [{pillar}] | [{file}] | Lý do: {reason} | Trọng số: {weight} | `{snippet}`\n")

    def run(self):
        """Thực thi toàn bộ quy trình kiểm toán."""
        # Khởi tạo lại file Ledger
        with open(self.ledger_path, 'w') as f:
            f.write("# SỔ CÁI VI PHẠM (AI VIOLATION LEDGER)\n\n")

        print(f"🚀 Bắt đầu kiểm toán cho: {self.target_dir}")
        
        # BƯỚC 1: DISCOVERY (Khám phá tài nguyên)
        print("[1/5] Bước 1: Khám phá tài nguyên (Discovery)...")
        discovery = DiscoveryStep(self.target_dir)
        self.discovery_data = discovery.run_discovery()
        total_loc = self.discovery_data['total_loc']
        print(f"   - Tổng số dòng code (LOC): {total_loc}")
        print(f"   - Tổng số file: {self.discovery_data['total_files']}")

        # BƯỚC 2 & 3: SCANNING & VERIFICATION (Quét và Xác thực)
        print("[2-3/5] Bước 2 & 3: Quét và Xác thực lỗi (Scanning & Verification)...")
        verifier = VerificationStep(self.target_dir, self.discovery_data['files'])
        automated_violations = verifier.run_verification()
        
        # Lưu kết quả từ bộ máy xác thực tự động
        for v in automated_violations:
            self.log_violation(v['type'], v['file'], v['reason'], v['weight'])

        # BƯỚC 4: AGGREGATION (Tổng hợp điểm số)
        print("[4/5] Bước 4: Tổng hợp dữ liệu (Aggregation)...")
        pillar_punishments = {p: 0 for p in WEIGHTS.keys()}
        for v in self.violations:
            pillar_punishments[v['pillar']] += v['weight']

        pillar_scores = {}
        for pillar in WEIGHTS.keys():
            pillar_scores[pillar] = ScoringEngine.calculate_pillar_score(
                pillar_punishments[pillar], 
                total_loc
            )

        final_score = ScoringEngine.calculate_final_score(pillar_scores)
        rating = ScoringEngine.get_rating(final_score)

        # BƯỚC 5: REPORTING (Xuất báo cáo)
        print("[5/5] Bước 5: Xuất báo cáo (Reporting)...")
        self.generate_report(pillar_scores, final_score, rating, pillar_punishments)
        
        # LƯU VÀO LỊCH SỬ (V2)
        AuditDatabase.save_audit(
            target=self.target_dir,
            score=final_score,
            rating=rating,
            loc=total_loc,
            violations_count=len(self.violations),
            pillar_scores=pillar_scores
        )
        
        print(f"\n✅ Kiểm toán hoàn tất!")
        print(f"   - Điểm tổng thể: {final_score}/100")
        print(f"   - Xếp hạng: {rating}")
        print(f"   - Báo cáo chi tiết: {self.report_path}")

    def generate_report(self, pillar_scores, final_score, rating, punishments):
        """Tạo file báo cáo Markdown chuyên nghiệp."""
        with open(self.report_path, 'w') as f:
            f.write(f"# BÁO CÁO KIỂM TOÁN CUỐI CÙNG (FINAL AUDIT REPORT) - V3\n\n")
            f.write(f"## Điểm số tổng quát: {final_score} / 100 ({rating})\n\n")
            
            f.write("### Chỉ số dự án (Metrics)\n")
            f.write(f"- Tổng LOC: {self.discovery_data['total_loc']}\n")
            f.write(f"- Tổng số file: {self.discovery_data['total_files']}\n\n")
            
            f.write("### Chi tiết theo trụ cột (Pillar Breakdown)\n")
            f.write("| Trụ cột | Trọng số | Tổng điểm phạt | Điểm quy đổi (Thang 10) |\n")
            f.write("|---|---|---|---|\n")
            for pillar, score in pillar_scores.items():
                f.write(f"| {pillar} | {int(WEIGHTS[pillar]*100)}% | {punishments[pillar]} | {score} |\n")
            
            f.write("\n### Top 10 Vi phạm tiêu biểu\n")
            for v in self.violations[:10]:
                f.write(f"- **[{v['pillar']}]** {v['file']}: {v['reason']} (Trọng số: {v['weight']})\n")
            
            if not self.violations:
                f.write("Không tìm thấy vi phạm nào. Mã nguồn đạt chuẩn Gold Standard!\n")

if __name__ == "__main__":
    # Điểm vào chính của script
    target = sys.argv[1] if len(sys.argv) > 1 else '.'
    auditor = CodeAuditor(target)
    auditor.run()
