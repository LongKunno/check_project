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

        # BƯỚC 4: AGGREGATION (Tổng hợp điểm số Phân cấp)
        print("[4/5] Bước 4: Tổng hợp dữ liệu (Aggregation)...")
        
        # Ánh xạ file -> feature
        file_to_feature = {f['path']: f.get('feature', 'unknown') for f in self.discovery_data['files']}
        
        # Khởi tạo bảng điểm phạt: feature -> pillar -> punishment
        feature_punishments = {}
        for feature in self.discovery_data['features'].keys():
            feature_punishments[feature] = {p: 0 for p in WEIGHTS.keys()}
            
        for v in self.violations:
            feat = file_to_feature.get(v['file'], 'unknown')
            if feat not in feature_punishments:
                feature_punishments[feat] = {p: 0 for p in WEIGHTS.keys()}
            feature_punishments[feat][v['pillar']] += v['weight']

        # Tính điểm cho từng Tính năng
        self.feature_results = {}
        total_features_score = 0
        
        for feature, punishments in feature_punishments.items():
            feat_loc = self.discovery_data['features'].get(feature, {}).get('loc', 0)
            if feat_loc == 0: continue
            
            p_scores = {}
            for pillar in WEIGHTS.keys():
                p_scores[pillar] = ScoringEngine.calculate_pillar_score(punishments[pillar], feat_loc)
            
            f_score = ScoringEngine.calculate_final_score(p_scores)
            self.feature_results[feature] = {
                "pillars": p_scores,
                "final": f_score,
                "punishments": punishments,
                "loc": feat_loc
            }
            total_features_score += f_score

        # Điểm tổng kết dự án = Trung bình cộng điểm các tính năng
        if self.feature_results:
            final_score = round(total_features_score / len(self.feature_results), 2)
        else:
            final_score = 100.0
            
        rating = ScoringEngine.get_rating(final_score)

        # BƯỚC 5: REPORTING (Xuất báo cáo theo Tính năng)
        print("[5/5] Bước 5: Xuất báo cáo (Reporting)...")
        self.generate_report(self.feature_results, final_score, rating)
        
        # LƯU VÀO LỊCH SỬ (V2)
        AuditDatabase.save_audit(
            target=self.target_dir,
            score=final_score,
            rating=rating,
            loc=total_loc,
            violations_count=len(self.violations),
            pillar_scores=self.feature_results # Lưu object phân cấp
        )
        
        print(f"\n✅ Kiểm toán hoàn tất!")
        print(f"   - Điểm tổng thể: {final_score}/100")
        print(f"   - Xếp hạng: {rating}")
        print(f"   - Báo cáo chi tiết: {self.report_path}")

    def generate_report(self, feature_results, final_score, rating):
        """Tạo file báo cáo Markdown chuyên nghiệp phân cấp theo Tính năng."""
        with open(self.report_path, 'w') as f:
            f.write(f"# BÁO CÁO KIỂM TOÁN PHÂN CẤP (HIERARCHICAL AUDIT REPORT)\n\n")
            f.write(f"## ĐIỂM TỔNG DỰ ÁN: {final_score} / 100 ({rating})\n\n")
            
            f.write("### 📊 Chỉ số dự án (Project Metrics)\n")
            f.write(f"- Tổng LOC: {self.discovery_data['total_loc']}\n")
            f.write(f"- Tổng số file: {self.discovery_data['total_files']}\n")
            f.write(f"- Tổng số tính năng: {len(feature_results)}\n\n")
            
            f.write("### 🧩 Chi tiết theo Tính năng (Feature Breakdown)\n")
            for feature, res in feature_results.items():
                f.write(f"#### 🔹 Tính năng: `{feature}` (LOC: {res['loc']})\n")
                f.write(f"**Điểm tính năng: {res['final']} / 100**\n\n")
                f.write("| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |\n")
                f.write("|---|---|---|\n")
                for pillar, p_score in res['pillars'].items():
                    f.write(f"| {pillar} | {res['punishments'][pillar]} | {p_score} |\n")
                f.write("\n---\n")
            
            f.write("\n### 🚨 Top 10 Vi phạm tiêu biểu\n")
            for v in self.violations[:10]:
                f.write(f"- **[{v['pillar']}]** {v['file']}: {v['reason']} (Trọng số: {v['weight']})\n")
            
            if not self.violations:
                f.write("Không tìm thấy vi phạm nào. Mã nguồn đạt chuẩn Gold Standard!\n")

if __name__ == "__main__":
    # Điểm vào chính của script
    target = sys.argv[1] if len(sys.argv) > 1 else '.'
    auditor = CodeAuditor(target)
    auditor.run()
