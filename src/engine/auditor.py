"""
Bộ máy kiểm toán mã nguồn (Core Auditor Engine).
Quản lý luồng thực thi 5 bước: Discovery, Scanning, Verification, Aggregation, Reporting.
"""

import os
import json
import sys
import logging

logger = logging.getLogger(__name__)
from src.config import WEIGHTS
from src.engine.discovery import DiscoveryStep
from src.engine.verification import VerificationStep
from src.engine.scoring import ScoringEngine

try:
    from src.api.audit_state import AuditState
except ImportError:
    class AuditState:
        is_cancelled = False

class CodeAuditor:
    def __init__(self, target_dir='.', custom_rules=None):
        """
        Khởi tạo Auditor cho một thư mục cụ thể.
        """
        self.target_dir = os.path.abspath(target_dir)
        self.custom_rules = custom_rules
        self.discovery_data = None
        
        # Đường dẫn xuất báo cáo (luôn nằm trong thư mục 'reports' của project hiện tại)
        report_dir = os.path.abspath('reports')
        if not os.path.exists(report_dir):
            os.makedirs(report_dir)
            
        self.ledger_path = os.path.join(report_dir, 'ai_violation_ledger.md')
        self.report_path = os.path.join(report_dir, 'Final_Audit_Report.md')
        self.violations = []
        self.violation_counter = 0

    def log_violation(self, pillar, file, reason, weight, snippet="", rule_id="", line=0, is_custom=False):
        """Ghi nhận một vi phạm mới và lưu vào danh sách."""
        # Chuyển đổi thành đường dẫn tương đối (bỏ /tmp/...)
        if file.startswith(self.target_dir):
            file = os.path.relpath(file, self.target_dir)
        elif self.target_dir in file:
            file = file.split(self.target_dir, 1)[-1].lstrip('/\\')
            
        violation = {
            "id": f"v_{self.violation_counter}",
            "pillar": pillar,
            "file": file,
            "reason": reason,
            "weight": weight,
            "snippet": snippet,
            "rule_id": rule_id,
            "line": line,
            "is_custom": is_custom
        }
        self.violation_counter += 1
        self.violations.append(violation)
        
        # Ghi nối vào file Ledger (Sổ cái bằng chứng)
        with open(self.ledger_path, 'a') as f:
            f.write(f"- [{pillar}] | [{file}:{line}] | Lý do: {reason} | Trình bày: {rule_id} | Trọng số: {weight}\n")

    def run(self):
        """Thực thi toàn bộ quy trình kiểm toán."""
        # Khởi tạo lại file Ledger
        with open(self.ledger_path, 'w') as f:
            f.write("# SỔ CÁI VI PHẠM (AI VIOLATION LEDGER)\n\n")

        logger.info(f"🚀 Bắt đầu kiểm toán cho: {self.target_dir}")
        
        # BƯỚC 1: DISCOVERY (Khám phá tài nguyên)
        logger.info("[1/5] Bước 1: Khám phá tài nguyên (Discovery)...")
        discovery = DiscoveryStep(self.target_dir)
        self.discovery_data = discovery.run_discovery()
        
        # Áp dụng TEST_MODE để cắt giảm số lượng file xử lý
        try:
            from src.config import TEST_MODE_LIMIT_FILES
            if TEST_MODE_LIMIT_FILES and TEST_MODE_LIMIT_FILES > 0:
                original_count = len(self.discovery_data['files'])
                if original_count > TEST_MODE_LIMIT_FILES:
                    self.discovery_data['files'] = self.discovery_data['files'][:TEST_MODE_LIMIT_FILES]
                    logger.warning(f"⚠️ [TEST MODE] Đã giới hạn phân tích: {TEST_MODE_LIMIT_FILES}/{original_count} files để tiết kiệm Token!")
        except ImportError:
            pass

        total_loc = self.discovery_data['total_loc']
        logger.info(f"   - Tổng số dòng code (LOC): {total_loc}")
        logger.info(f"   - Tổng số file: {self.discovery_data['total_files']}")

        # BƯỚC 2 & 3: SCANNING & VERIFICATION (Quét và Xác thực)
        logger.info("[2-3/5] Bước 2 & 3: Quét và Xác thực lỗi (Scanning & Verification)...")
        verifier = VerificationStep(self.target_dir, self.discovery_data['files'], custom_rules=self.custom_rules)
        automated_violations = verifier.run_verification()
        
        # Load merged rules for metadata (severity, debt) later in Aggregation
        self.merged_rules = verifier.load_rules()
        
        # BƯỚC 3.5: AI HYBRID VALIDATION (Xác thực AI theo Batch)
        logger.info("[3.5/5] Bước 3.5: Xác thực AI (AI Hybrid Validation - Batching) với Async I/O...")
        from src.engine.ai_service import ai_service
        import asyncio
        
        # Chia violations thành từng nhóm 5 cái (Batch size = 5 để ổn định hơn)
        batch_size = 5
        chunks = [automated_violations[i:i + batch_size] for i in range(0, len(automated_violations), batch_size)]
        
        sem_val = asyncio.Semaphore(25)
        async def process_validation_chunk(idx, chunk):
            if AuditState.is_cancelled: return idx, chunk, {}
            # Thêm sleep để stagger (giảm burst lúc đầu) - tránh lỗi 502
            await asyncio.sleep(idx * 0.1)
            async with sem_val:
                return idx, chunk, await ai_service.verify_violations_batch(chunk)

        if chunks:
            logger.info(f"   -> Đang xác thực AI song song (Async I/O) cho {len(chunks)} nhóm lỗi (Batch size: {batch_size})")
            
            async def run_all_validations():
                tasks = [process_validation_chunk(idx, chunk) for idx, chunk in enumerate(chunks)]
                results = []
                for f in asyncio.as_completed(tasks):
                    if AuditState.is_cancelled:
                        logger.info("\n❌ CẢNH BÁO: Kiểm toán đã bị hủy bởi người dùng.")
                        raise Exception("Kiểm toán đã bị hủy bởi người dùng.")
                    res = await f
                    results.append(res)
                return results

            try:
                loop = asyncio.get_event_loop()
                if loop.is_closed(): loop = asyncio.new_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
            completed_results = loop.run_until_complete(run_all_validations())
            
            for idx, chunk, batch_results in completed_results:
                for i_in_chunk, v in enumerate(chunk):
                    res = batch_results.get(i_in_chunk, {})
                    is_fp = res.get("is_false_positive", False)
                    ai_reason = res.get("explanation", "")
                    conf = res.get("confidence", 1.0)
                    
                    # Cho phép AI loại bỏ cả các luật Tùy chỉnh (Custom Rules) bị sai (False Positive)
                    # vì Static analysis Regex do AI sinh ra rất hay match nhầm context.
                    is_custom = v.get('rule_id', '').startswith('CUSTOM_') or v.get('rule_id', '').startswith('FORBIDDEN')
                    
                    if is_fp and conf > 0.7:
                        lbl = "Tùy chỉnh (AI-Gen)" if is_custom else "Mặc định (Core)"
                        logger.info(f"   ✨ AI Gác cổng đã loại bỏ False Positive [{lbl}]: {v['reason']} tại {v['file']} (Độ tin cậy: {conf})")
                        continue
                    
                    final_reason = f"{v['reason']}. AI Note: {ai_reason}" if ai_reason else v['reason']
                    self.log_violation(v['type'], v['file'], final_reason, v['weight'], snippet=v.get('snippet', ''), rule_id=v.get('rule_id', ''), line=v.get('line', 0), is_custom=is_custom)

        # BƯỚC 3.6: AI REASONING AUDIT (Quét sâu)
        logger.info("[3.6/5] Bước 3.6: AI Reasoning Audit (Full Code Coverage)...")
        
        audit_files = self.discovery_data['files']
        
        # === SMART BATCHING (Dynamic) ===
        # Tối đa 5 file/batch, nhưng nếu file lớn quá thì chỉ gửi 1 file
        # Budget: ~60K tokens cho code (~210K chars với tỷ lệ ~3.5 chars/token)
        MAX_FILES_PER_BATCH = 5
        MAX_CHARS_PER_BATCH = 210000  # ~60K tokens budget cho phần code
        AVG_CHARS_PER_LINE = 45       # Ước tính trung bình cho Python

        deep_chunks = []
        current_batch = []
        current_size = 0

        for f_info in audit_files:
            try:
                with open(f_info['path'], 'r', encoding='utf-8') as file_obj:
                    content = file_obj.read()
            except Exception:
                continue
            
            file_chars = len(content)
            file_data = {"path": f_info['path'], "content": content}
            
            # Nếu file đơn lẻ đã vượt budget → batch riêng (sẽ bị truncate ở ai_service)
            if file_chars >= MAX_CHARS_PER_BATCH:
                # Flush batch hiện tại trước
                if current_batch:
                    deep_chunks.append(current_batch)
                    current_batch = []
                    current_size = 0
                deep_chunks.append([file_data])  # Batch chỉ chứa 1 file lớn
                continue
            
            # Nếu thêm file này vào batch hiện tại sẽ vượt budget hoặc đạt max files → flush
            if (current_size + file_chars > MAX_CHARS_PER_BATCH) or (len(current_batch) >= MAX_FILES_PER_BATCH):
                if current_batch:
                    deep_chunks.append(current_batch)
                current_batch = []
                current_size = 0
            
            current_batch.append(file_data)
            current_size += file_chars

        if current_batch:
            deep_chunks.append(current_batch)

        # Log thống kê batching
        batch_sizes = [len(c) for c in deep_chunks]
        logger.info(f"   -> Smart Batching: {len(deep_chunks)} batches (files/batch: {batch_sizes})")

        sem_deep = asyncio.Semaphore(25)
        async def process_deep_chunk(idx, chunk_data):
            if AuditState.is_cancelled: return []
            await asyncio.sleep(idx * 0.2)
            async with sem_deep:
                return await ai_service.deep_audit_batch(chunk_data, self.custom_rules)

        if deep_chunks:
            async def run_all_deep_audits():
                tasks = [process_deep_chunk(idx, c) for idx, c in enumerate(deep_chunks)]
                results = []
                for f in asyncio.as_completed(tasks):
                    if AuditState.is_cancelled:
                        logger.info("\n❌ CẢNH BÁO: Kiểm toán đã bị hủy bởi người dùng.")
                        raise Exception("Kiểm toán đã bị hủy bởi người dùng.")
                    res = await f
                    results.append(res)
                return results
                
            try:
                loop = asyncio.get_event_loop()
                if loop.is_closed(): loop = asyncio.new_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
            completed_deep_results = loop.run_until_complete(run_all_deep_audits())
            
            confirmed_violations = []
            flagged_violations = []
            for reasoning_violations in completed_deep_results:
                for rv in reasoning_violations:
                    if rv.get('needs_verification'):
                        flagged_violations.append(rv)
                    else:
                        confirmed_violations.append(rv)
                        
            # BƯỚC 3.7: CROSS-CHECK FLAGGED ISSUES (TWO-PASS AUDIT)
            if flagged_violations:
                logger.info(f"[3.7/5] Bước 3.7: Xác minh chéo (Cross-Check) {len(flagged_violations)} lỗi bị AI cắm cờ...")
                from src.engine.symbol_indexer import AstContextExtractor
                indexer = AstContextExtractor(self.target_dir)
                indexer.index_project()
                
                context_cache = {}
                for fv in flagged_violations:
                    target = fv.get('verify_target')
                    if target and target not in context_cache:
                        context_cache[target] = indexer.get_symbol_snippet(target)
                        
                verified_issues = loop.run_until_complete(ai_service.verify_flagged_issues(flagged_violations, context_cache))
                confirmed_violations.extend(verified_issues)
                
            for rv in confirmed_violations:
                weight = float(rv.get('weight', -3.0))
                if weight > 0: weight = -weight
                
                pillar = rv.get('type', 'Maintainability')
                from src.config import WEIGHTS
                if pillar not in WEIGHTS:
                    pillar = 'Maintainability' # Default
                
                self.log_violation(
                    pillar, 
                    rv.get('file', 'unknown'), 
                    rv.get('reason', 'AI Logic Audit'), 
                    weight,
                    rule_id=rv.get('rule_id', 'AI_REASONING'),
                    line=rv.get('line', 0),
                    is_custom=rv.get('is_custom', False)
                )

        # BƯỚC 4: AGGREGATION (Tổng hợp điểm số Phân cấp)
        logger.info("[4/5] Bước 4: Tổng hợp dữ liệu (Aggregation)...")
        from src.config import WEIGHTS
        from src.engine.authorship import AuthorshipTracker
        
        auth_tracker = AuthorshipTracker(self.target_dir)
        
        # Ánh xạ file -> feature
        file_to_feature = {f['path']: f.get('feature', 'unknown') for f in self.discovery_data['files']}
        
        # Khởi tạo bảng điểm phạt: feature -> pillar -> punishment
        feature_punishments = {}
        feature_meta = {} # {feature: {pillar: {debt: 0, max_sev: 'Info'}}}
        
        member_punishments = {}
        member_meta = {}
        member_violations = {}
        
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
            
            # Chuẩn bị Metadata dạng phẳng từ mảng rules nguyên khối
            flat_meta = {r.get('id'): r for r in getattr(self, 'merged_rules', {}).get('rules', [])}

            # SonarQube Meta
            rule_id = v.get('rule_id', '')
            meta_rule = flat_meta.get(rule_id, {})
            meta = {
                "severity": meta_rule.get("severity", "Minor"),
                "debt": meta_rule.get("debt", 10)
            }
            feature_meta[feat][pillar]["debt"] += meta["debt"]
            
            # Cập nhật mức độ nghiêm trọng cao nhất
            if sev_levels.index(meta["severity"]) > sev_levels.index(feature_meta[feat][pillar]["max_sev"]):
                feature_meta[feat][pillar]["max_sev"] = meta["severity"]
                
            # Cập nhật điểm thành viên (Membership Tracking)
            author_info = auth_tracker.get_author_info(v['file'], v.get('line', 0))
            if not author_info['boundary']:
                author = author_info['author']
                if author not in member_punishments:
                    member_punishments[author] = {p: 0 for p in WEIGHTS.keys()}
                    member_meta[author] = {p: {"debt": 0, "max_sev": "Info"} for p in WEIGHTS.keys()}
                    member_violations[author] = []
                
                member_punishments[author][pillar] += v['weight']
                member_meta[author][pillar]['debt'] += meta['debt']
                member_violations[author].append(v)

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
                p_scores[pillar] = ScoringEngine.calculate_pillar_score(punishments[pillar], feat_loc, pillar)
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

        # Tính điểm 4 trụ cột cho tổng dự án bằng Trung bình có trọng số theo Kích thước (LOC)
        # để đảm bảo đồng nhất toán học với Điểm tổng kết (final_score)
        self.project_pillars = {}
        for pillar in WEIGHTS.keys():
            if total_loc > 0 and self.feature_results:
                w_score = sum(res['pillars'][pillar] * res.get('loc', 0) for res in self.feature_results.values())
                self.project_pillars[pillar] = round(w_score / total_loc, 2)
            else:
                self.project_pillars[pillar] = ScoringEngine.calculate_pillar_score(project_punishments[pillar], total_loc, pillar)

        # Điểm tổng kết dự án = Trung bình có trọng số theo Kích thước (Weighted Average by LOC)
        final_score = ScoringEngine.calculate_final_score_from_features(self.feature_results)
            
        rating = ScoringEngine.get_rating(final_score)

        # Tính toán kết quả cho từng Member
        self.member_results = {}
        member_locs = auth_tracker.get_all_member_loc()
        for author, punishments in member_punishments.items():
            author_loc = member_locs.get(author, 0)
            if author_loc == 0: continue
            
            p_scores = {}
            for pillar in WEIGHTS.keys():
                p_scores[pillar] = ScoringEngine.calculate_pillar_score(punishments[pillar], author_loc, pillar)
                
            f_score = ScoringEngine.calculate_final_score(p_scores)
            self.member_results[author] = {
                "pillars": p_scores,
                "final": f_score,
                "punishments": punishments,
                "loc": author_loc,
                "debt_mins": sum(m["debt"] for m in member_meta[author].values()),
                "violations": member_violations.get(author, [])
            }

        # BƯỚC 5: REPORTING
        logger.info("[5/5] Bước 5: Xuất báo cáo (Reporting)...")
        self.generate_report(self.feature_results, self.project_pillars, final_score, rating)
        
        # LƯU VÀO LỊCH SỬ
        # Ghi chú: Việc lưu AuditDB (Database) được quản lý ở Backend API `api_server.py`
        # để tránh tạo records rác đối với các phân tích bằng /tmp/ thư mục git.
        
        logger.info(f"\n✅ Kiểm toán hoàn tất!")
        logger.info(f"   - Điểm tổng thể: {final_score}/100")
        logger.info(f"   - Xếp hạng: {rating}")
        logger.info(f"   - Báo cáo chi tiết: {self.report_path}")

    def generate_report(self, feature_results, project_pillars, final_score, rating):
        """Tạo file báo cáo Markdown chuyên nghiệp phân cấp theo Tính năng."""
        from datetime import datetime
        
        flat_meta = {r.get('id'): r for r in getattr(self, 'merged_rules', {}).get('rules', [])}
        rule_stats = {}
        severity_dist = {"Blocker": 0, "Critical": 0, "Major": 0, "Minor": 0, "Info": 0}
        
        for v in self.violations:
            rule_id = v.get('rule_id', 'UNKNOWN')
            if not rule_id: rule_id = 'UNKNOWN'
            
            if rule_id not in rule_stats:
                rule_stats[rule_id] = {'count': 0, 'weight': 0.0, 'pillars': set()}
            
            rule_stats[rule_id]['count'] += 1
            rule_stats[rule_id]['weight'] += v.get('weight', 0)
            rule_stats[rule_id]['pillars'].add(v.get('pillar', 'Maintainability'))
            
            meta_rule = flat_meta.get(rule_id, {})
            sev = meta_rule.get('severity', 'Minor')
            if sev in severity_dist:
                severity_dist[sev] += 1
            else:
                severity_dist['Minor'] += 1
                
        with open(self.report_path, 'w') as f:
            f.write(f"# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)\n\n")
            f.write(f"**Thời gian báo cáo:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"## ĐIỂM TỔNG DỰ ÁN: {final_score} / 100 ({rating})\n\n")
            
            f.write("### 📊 Chỉ số dự án (Project Metrics)\n")
            f.write(f"- Tổng LOC: {self.discovery_data['total_loc']}\n")
            f.write(f"- Tổng số file: {self.discovery_data['total_files']}\n")
            f.write(f"- Tổng số tính năng: {len(feature_results)}\n\n")
            
            f.write("### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)\n")
            f.write("| Mức độ | Số lượng |\n")
            f.write("|---|---|\n")
            for sev in ["Blocker", "Critical", "Major", "Minor", "Info"]:
                if severity_dist[sev] > 0 or sev in ["Critical", "Blocker"]:
                    icon = "🔥" if sev in ["Blocker", "Critical"] else "⚠️" if sev == "Major" else "ℹ️"
                    f.write(f"| {icon} {sev} | {severity_dist[sev]} |\n")
            f.write("\n")

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

            if rule_stats:
                f.write("\n### 📈 Thống kê theo Luật (Rule Breakdown)\n")
                f.write("| Rule ID | Trụ cột | Số lượng | Tổng phạt |\n")
                f.write("|---|---|---|---|\n")
                sorted_rules = sorted(rule_stats.items(), key=lambda x: x[1]['count'], reverse=True)
                for r_id, stats in sorted_rules:
                    pillars_str = ", ".join(sorted(list(stats['pillars'])))
                    f.write(f"| `{r_id}` | {pillars_str} | {stats['count']} | {round(stats['weight'], 2)} |\n")
                f.write("\n")

            if hasattr(self, 'member_results') and self.member_results:
                f.write("\n### 👥 Đánh giá theo Thành viên (Last 6 Months)\n")
                f.write("| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |\n")
                f.write("|---|---|---|---|\n")
                for author, res in sorted(self.member_results.items(), key=lambda x: x[1]['final'], reverse=True):
                    f.write(f"| **{author}** | {res['loc']} | {res['final']} | {res['debt_mins']}m |\n")
                
                f.write("\n#### 🔍 Chi tiết lỗi theo Thành viên\n")
                for author, res in sorted(self.member_results.items(), key=lambda x: x[1]['final'], reverse=True):
                    if res['violations']:
                        f.write(f"\n**{author}** (Top 5 vi phạm nặng nhất):\n")
                        # Sort violations by weight (most penalty first)
                        top_v = sorted(res['violations'], key=lambda x: x['weight'])[:5]
                        for v in top_v:
                            rule_info = f" (Rule: {v['rule_id']})" if v.get('rule_id') else ""
                            f.write(f"- [{v['pillar']}] {v['file']}:{v.get('line', 0)} - {v['reason']}{rule_info}\n")

if __name__ == "__main__":
    # Điểm vào chính của script
    target = sys.argv[1] if len(sys.argv) > 1 else '.'
    auditor = CodeAuditor(target)
    auditor.run()
