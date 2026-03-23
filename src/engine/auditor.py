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

try:
    from src.api.audit_state import AuditState
except ImportError:
    class AuditState:
        is_cancelled = False

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

    def log_violation(self, pillar, file, reason, weight, snippet="", rule_id=""):
        """Ghi nhận một vi phạm mới và lưu vào danh sách."""
        violation = {
            "pillar": pillar,
            "file": file,
            "reason": reason,
            "weight": weight,
            "snippet": snippet,
            "rule_id": rule_id
        }
        self.violations.append(violation)
        
        # Ghi nối vào file Ledger (Sổ cái bằng chứng)
        with open(self.ledger_path, 'a') as f:
            f.write(f"- [{pillar}] | [{file}] | Lý do: {reason} | Trình bày: {rule_id} | Trọng số: {weight}\n")

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
        
        # BƯỚC 3.5: AI HYBRID VALIDATION (Xác thực AI theo Batch)
        print("[3.5/5] Bước 3.5: Xác thực AI (AI Hybrid Validation - Batching)...")
        from src.engine.ai_service import ai_service
        
        # Chia violations thành từng nhóm 10 cái (Batch size = 10)
        batch_size = 10
        for i in range(0, len(automated_violations), batch_size):
            if AuditState.is_cancelled:
                print("\n❌ CẢNH BÁO: Kiểm toán đã bị hủy bởi người dùng.")
                raise Exception("Kiểm toán đã bị hủy bởi người dùng.")
                
            chunk = automated_violations[i:i + batch_size]
            print(f"   -> Đang xác thực AI cho nhóm lỗi {i//batch_size + 1} (Size: {len(chunk)})")
            
            batch_results = ai_service.verify_violations_batch(chunk)
            
            for idx, v in enumerate(chunk):
                res = batch_results.get(idx, {})
                is_fp = res.get("is_false_positive", False)
                ai_reason = res.get("explanation", "")
                conf = res.get("confidence", 1.0)
                
                if is_fp and conf > 0.7:
                    print(f"   ✨ AI đã loại bỏ False Positive: {v['reason']} tại {v['file']} (Độ tin cậy: {conf})")
                    continue
                
                final_reason = f"{v['reason']}. AI Note: {ai_reason}" if ai_reason else v['reason']
                self.log_violation(v['type'], v['file'], final_reason, v['weight'], snippet=v.get('snippet', ''), rule_id=v.get('rule_id', ''))

        # BƯỚC 3.6: AI REASONING AUDIT (Quét sâu)
        print("[3.6/5] Bước 3.6: AI Reasoning Audit (Full Code Coverage)...")
        
        audit_files = self.discovery_data['files']
        deep_batch_size = 5
        for i in range(0, len(audit_files), deep_batch_size):
            if AuditState.is_cancelled:
                print("\n❌ CẢNH BÁO: Kiểm toán đã bị hủy bởi người dùng.")
                raise Exception("Kiểm toán đã bị hủy bởi người dùng.")
                
            chunk_files = audit_files[i:i + deep_batch_size]
            chunk_data = []
            for f in chunk_files:
                try:
                    # Chỉ quét các file nguồn chính, bỏ qua thư mục tests nếu muốn thu hẹp, 
                    # nhưng ở đây tuân thủ "toàn bộ code" của user.
                    with open(f['path'], 'r', encoding='utf-8') as file_obj:
                        chunk_data.append({"path": f['path'], "content": file_obj.read()})
                except Exception:
                    continue
            
            if not chunk_data: continue
            
            print(f"   -> Đang thực hiện Deep Audit nhóm {i//deep_batch_size + 1}...")
            reasoning_violations = ai_service.deep_audit_batch(chunk_data)
            
            for rv in reasoning_violations:
                # Đảm bảo trọng số âm cho điểm phạt
                weight = float(rv.get('weight', -3.0))
                if weight > 0: weight = -weight
                
                # Ánh xạ pillar về các trụ cột hợp lệ
                pillar = rv.get('type', 'Maintainability')
                from src.config import WEIGHTS
                if pillar not in WEIGHTS:
                    pillar = 'Maintainability' # Default
                
                self.log_violation(
                    pillar, 
                    rv.get('file', 'unknown'), 
                    rv.get('reason', 'AI Logic Audit'), 
                    weight,
                    rule_id='AI_REASONING'
                )

        # BƯỚC 4: AGGREGATION (Tổng hợp điểm số Phân cấp)
        print("[4/5] Bước 4: Tổng hợp dữ liệu (Aggregation)...")
        from src.config import RULES_METADATA, WEIGHTS
        
        # Ánh xạ file -> feature
        file_to_feature = {f['path']: f.get('feature', 'unknown') for f in self.discovery_data['files']}
        
        # Khởi tạo bảng điểm phạt: feature -> pillar -> punishment
        feature_punishments = {}
        feature_meta = {} # {feature: {pillar: {debt: 0, max_sev: 'Info'}}}
        
        for feature in self.discovery_data['features'].keys():
            feature_punishments[feature] = {p: 0 for p in WEIGHTS.keys()}
            feature_meta[feature] = {p: {"debt": 0, "max_sev": "Info"} for p in WEIGHTS.keys()}
            
        sev_levels = ["Info", "Minor", "Major", "Critical", "Blocker"]

        for v in self.violations:
            feat = file_to_feature.get(v['file'], 'root')
            if feat not in feature_punishments:
                feature_punishments[feat] = {p: 0 for p in WEIGHTS.keys()}
                feature_meta[feat] = {p: {"debt": 0, "max_sev": "Info"} for p in WEIGHTS.keys()}
                
            pillar = v['pillar']
            feature_punishments[feat][pillar] += v['weight']
            
            # SonarQube Meta
            rule_id = v.get('rule_id', '')
            meta = RULES_METADATA.get(rule_id, {"severity": "Minor", "debt": 10})
            feature_meta[feat][pillar]["debt"] += meta["debt"]
            
            # Cập nhật mức độ nghiêm trọng cao nhất
            if sev_levels.index(meta["severity"]) > sev_levels.index(feature_meta[feat][pillar]["max_sev"]):
                feature_meta[feat][pillar]["max_sev"] = meta["severity"]

        # Tính điểm cho từng Tính năng và Tổng kết dự án
        self.feature_results = {}
        total_features_score = 0
        project_punishments = {p: 0 for p in WEIGHTS.keys()}
        project_meta = {p: {"debt": 0, "max_sev": "Info"} for p in WEIGHTS.keys()}
        
        for feature, punishments in feature_punishments.items():
            feat_loc = self.discovery_data['features'].get(feature, {}).get('loc', 0)
            if feat_loc == 0: continue
            
            p_scores = {}
            for pillar in WEIGHTS.keys():
                # Score (0-10)
                p_scores[pillar] = ScoringEngine.calculate_pillar_score(punishments[pillar], feat_loc)
                project_punishments[pillar] += punishments[pillar]
                
                # Meta (Informational)
                meta = feature_meta[feature][pillar]
                project_meta[pillar]["debt"] += meta["debt"]
                if sev_levels.index(meta["max_sev"]) > sev_levels.index(project_meta[pillar]["max_sev"]):
                    project_meta[pillar]["max_sev"] = meta["max_sev"]
            
            f_score = ScoringEngine.calculate_final_score(p_scores)
            self.feature_results[feature] = {
                "pillars": p_scores,
                "final": f_score,
                "punishments": punishments,
                "loc": feat_loc,
                "debt_mins": sum(m["debt"] for m in feature_meta[feature].values())
            }
            total_features_score += f_score

        # Tính điểm 4 trụ cột cho tổng dự án (Numeric)
        self.project_pillars = {}
        for pillar in WEIGHTS.keys():
            self.project_pillars[pillar] = ScoringEngine.calculate_pillar_score(project_punishments[pillar], total_loc)

        # Điểm tổng kết dự án = Trung bình cộng điểm các tính năng
        if self.feature_results:
            final_score = round(total_features_score / len(self.feature_results), 2)
        else:
            final_score = 100.0
            
        rating = ScoringEngine.get_rating(final_score)

        # BƯỚC 5: REPORTING
        print("[5/5] Bước 5: Xuất báo cáo (Reporting)...")
        self.generate_report(self.feature_results, self.project_pillars, final_score, rating)
        
        # LƯU VÀO LỊCH SỬ (V2)
        AuditDatabase.save_audit(
            target=self.target_dir,
            score=final_score,
            rating=rating,
            loc=total_loc,
            violations_count=len(self.violations),
            pillar_scores={
                "project": self.project_pillars,
                "features": self.feature_results
            }
        )
        
        print(f"\n✅ Kiểm toán hoàn tất!")
        print(f"   - Điểm tổng thể: {final_score}/100")
        print(f"   - Xếp hạng: {rating}")
        print(f"   - Báo cáo chi tiết: {self.report_path}")

    def generate_report(self, feature_results, project_pillars, final_score, rating):
        """Tạo file báo cáo Markdown chuyên nghiệp phân cấp theo Tính năng."""
        with open(self.report_path, 'w') as f:
            f.write(f"# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)\n\n")
            f.write(f"## ĐIỂM TỔNG DỰ ÁN: {final_score} / 100 ({rating})\n\n")
            
            f.write("### 📊 Chỉ số dự án (Project Metrics)\n")
            f.write(f"- Tổng LOC: {self.discovery_data['total_loc']}\n")
            f.write(f"- Tổng số file: {self.discovery_data['total_files']}\n")
            f.write(f"- Tổng số tính năng: {len(feature_results)}\n\n")

            f.write("### 🛡️ Đánh giá 4 Trụ cột Dự án\n")
            f.write("| Trụ cột | Điểm (Thang 10) | Trạng thái |\n")
            f.write("|---|---|---|\n")
            for pillar, score in project_pillars.items():
                status = "✅ Tốt" if score >= 8.5 else "⚠️ Cần cải thiện" if score >= 6 else "🚨 Nguy cơ"
                f.write(f"| {pillar} | {score} | {status} |\n")
            f.write("\n")
            
            f.write("### 🧩 Chi tiết theo Tính năng (Feature Breakdown)\n")
            for feature, res in feature_results.items():
                f.write(f"#### 🔹 Tính năng: `{feature}` (LOC: {res['loc']})\n")
                f.write(f"**Điểm tính năng: {res['final']} / 100** (Nợ: {res['debt_mins']}m)\n\n")
                f.write("| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |\n")
                f.write("|---|---|---|\n")
                for pillar, p_score in res['pillars'].items():
                    f.write(f"| {pillar} | {res['punishments'][pillar]} | {p_score} |\n")
                f.write("\n---\n")
            
            f.write("\n### 🚨 Top 10 Vi phạm tiêu biểu\n")
            for v in self.violations[:10]:
                rule_info = f" (Rule: {v['rule_id']})" if v.get('rule_id') else ""
                f.write(f"- **[{v['pillar']}]** {v['file']}: {v['reason']}{rule_info} (Trọng số: {v['weight']})\n")
            
            if not self.violations:
                f.write("Không tìm thấy vi phạm nào. Mã nguồn đạt chuẩn Gold Standard!\n")

if __name__ == "__main__":
    # Điểm vào chính của script
    target = sys.argv[1] if len(sys.argv) > 1 else '.'
    auditor = CodeAuditor(target)
    auditor.run()
