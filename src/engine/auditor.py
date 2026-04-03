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

    def log_violation(self, violation_data: dict):
        """Ghi nhận một vi phạm mới và lưu vào danh sách.
        Args:
            violation_data: Dict chứa keys: pillar, file, reason, weight, snippet, rule_id, line, is_custom
        """
        file = violation_data.get('file', '')
        # Chuyển đổi thành đường dẫn tương đối (bỏ /tmp/...)
        if file.startswith(self.target_dir):
            file = os.path.relpath(file, self.target_dir)
        elif self.target_dir in file:
            file = file.split(self.target_dir, 1)[-1].lstrip('/\\')
        
        pillar = violation_data.get('pillar', violation_data.get('type', 'Maintainability'))
        reason = violation_data.get('reason', '')
        weight = violation_data.get('weight', -1.0)
        rule_id = violation_data.get('rule_id', '')
        line = violation_data.get('line', 0)
            
        violation = {
            "id": f"v_{self.violation_counter}",
            "pillar": pillar, "file": file, "reason": reason,
            "weight": weight, "snippet": violation_data.get('snippet', ''),
            "rule_id": rule_id, "line": line,
            "is_custom": violation_data.get('is_custom', False)
        }
        self.violation_counter += 1
        self.violations.append(violation)
        
        # Ghi nối vào file Ledger (Sổ cái bằng chứng)
        with open(self.ledger_path, 'a') as f:
            f.write(f"- [{pillar}] | [{file}:{line}] | Lý do: {reason} | Trình bày: {rule_id} | Trọng số: {weight}\n")

    def run(self):
        """Thực thi toàn bộ quy trình kiểm toán."""
        with open(self.ledger_path, 'w') as f:
            f.write("# SỔ CÁI VI PHẠM (AI VIOLATION LEDGER)\n\n")
        logger.info(f"🚀 Bắt đầu kiểm toán cho: {self.target_dir}")
        
        # BƯỚC 1: DISCOVERY
        self._step_discovery()
        
        # BƯỚC 2-3: SCANNING & VERIFICATION
        automated_violations = self._step_scanning()
        
        # BƯỚC 3.5-3.7: AI PROCESSING hoặc STATIC-ONLY
        from src.config import AI_ENABLED
        if AI_ENABLED:
            self._step_ai_processing(automated_violations)
        else:
            logger.info("[3.5/5] ⏭️ AI đã bị TẮT (AI_ENABLED=false). Bỏ qua bước Xác thực AI.")
            logger.info("[3.6/5] ⏭️ AI đã bị TẮT. Bỏ qua bước AI Reasoning Audit.")
            for v in automated_violations:
                is_custom = v.get('rule_id', '').startswith('CUSTOM_') or v.get('rule_id', '').startswith('FORBIDDEN')
                self.log_violation({**v, 'is_custom': is_custom})

        # BƯỚC 4: AGGREGATION & SCORING
        final_score, rating = self._step_aggregation()
        
        # BƯỚC 5: REPORTING
        self._step_reporting(final_score, rating)

    def _step_discovery(self):
        """BƯỚC 1: Khám phá tài nguyên (Discovery)."""
        logger.info("[1/5] Bước 1: Khám phá tài nguyên (Discovery)...")
        discovery = DiscoveryStep(self.target_dir)
        self.discovery_data = discovery.run_discovery()
        
        try:
            from src.config import TEST_MODE_LIMIT_FILES
            if TEST_MODE_LIMIT_FILES and TEST_MODE_LIMIT_FILES > 0:
                original_count = len(self.discovery_data['files'])
                if original_count > TEST_MODE_LIMIT_FILES:
                    self.discovery_data['files'] = self.discovery_data['files'][:TEST_MODE_LIMIT_FILES]
                    logger.warning(f"⚠️ [TEST MODE] Đã giới hạn phân tích: {TEST_MODE_LIMIT_FILES}/{original_count} files!")
        except ImportError:
            logger.warning("Could not import TEST_MODE_LIMIT_FILES, running in full mode.")

        logger.info(f"   - Tổng LOC: {self.discovery_data['total_loc']}, Files: {self.discovery_data['total_files']}")

    def _step_scanning(self):
        """BƯỚC 2-3: Quét và Xác thực lỗi (Scanning & Verification)."""
        logger.info("[2-3/5] Bước 2 & 3: Quét và Xác thực lỗi (Scanning & Verification)...")
        verifier = VerificationStep(self.target_dir, self.discovery_data['files'], custom_rules=self.custom_rules)
        automated_violations = verifier.run_verification()
        self.merged_rules = verifier.load_rules()
        return automated_violations

    def _step_ai_processing(self, automated_violations):
        """BƯỚC 3.5-3.7: AI Validation + Reasoning + Cross-Check."""
        import asyncio
        from src.engine.ai_service import ai_service
        
        # 3.5: AI VALIDATION
        self._step_ai_validation(automated_violations, ai_service, asyncio)
        
        # 3.6-3.7: AI REASONING + CROSS-CHECK
        self._step_ai_reasoning(ai_service, asyncio)

    def _step_ai_validation(self, automated_violations, ai_service, asyncio):
        """BƯỚC 3.5: Xác thực AI theo Batch."""
        logger.info("[3.5/5] Bước 3.5: Xác thực AI (AI Hybrid Validation)...")
        
        batch_size = 5
        chunks = [automated_violations[i:i + batch_size] for i in range(0, len(automated_violations), batch_size)]
        
        sem_val = asyncio.Semaphore(25)
        async def process_chunk(idx, chunk):
            if AuditState.is_cancelled: return idx, chunk, {}
            await asyncio.sleep(idx * 0.1)
            async with sem_val:
                return idx, chunk, await ai_service.verify_violations_batch(chunk)

        if not chunks:
            return
            
        logger.info(f"   -> Xác thực AI cho {len(chunks)} nhóm lỗi (Batch: {batch_size})")
        
        async def run_all():
            tasks = [process_chunk(idx, c) for idx, c in enumerate(chunks)]
            return [await f for f in asyncio.as_completed(tasks)]

        loop = asyncio.new_event_loop()
        completed = loop.run_until_complete(run_all())
        
        for idx, chunk, batch_results in completed:
            for i, v in enumerate(chunk):
                res = batch_results.get(i, {})
                is_fp = res.get("is_false_positive", False)
                ai_reason = res.get("explanation", "")
                conf = res.get("confidence", 1.0)
                is_custom = v.get('rule_id', '').startswith('CUSTOM_') or v.get('rule_id', '').startswith('FORBIDDEN')
                
                if is_fp and conf > 0.7:
                    lbl = "Tùy chỉnh" if is_custom else "Core"
                    logger.info(f"   ✨ AI loại bỏ FP [{lbl}]: {v['reason']} tại {v['file']}")
                    continue
                
                final_reason = f"{v['reason']}. AI Note: {ai_reason}" if ai_reason else v['reason']
                self.log_violation({**v, 'pillar': v['type'], 'reason': final_reason, 'is_custom': is_custom})

    def _step_ai_reasoning(self, ai_service, asyncio):
        """BƯỚC 3.6-3.7: AI Deep Audit + Cross-Check."""
        logger.info("[3.6/5] Bước 3.6: AI Reasoning Audit...")
        
        deep_chunks = self._build_deep_audit_batches()
        if not deep_chunks:
            return
            
        batch_sizes = [len(c) for c in deep_chunks]
        logger.info(f"   -> Smart Batching: {len(deep_chunks)} batches (files/batch: {batch_sizes})")

        sem_deep = asyncio.Semaphore(25)
        async def process_deep(idx, chunk_data):
            if AuditState.is_cancelled: return []
            await asyncio.sleep(idx * 0.2)
            async with sem_deep:
                return await ai_service.deep_audit_batch(chunk_data, self.custom_rules)

        async def run_all():
            tasks = [process_deep(idx, c) for idx, c in enumerate(deep_chunks)]
            return [await f for f in asyncio.as_completed(tasks)]

        loop = asyncio.new_event_loop()
        all_results = loop.run_until_complete(run_all())
        
        confirmed, flagged = [], []
        for batch in all_results:
            for rv in batch:
                (flagged if rv.get('needs_verification') else confirmed).append(rv)
                
        # 3.7: CROSS-CHECK
        if flagged:
            logger.info(f"[3.7/5] Bước 3.7: Cross-Check {len(flagged)} lỗi cắm cờ...")
            from src.engine.symbol_indexer import AstContextExtractor
            indexer = AstContextExtractor(self.target_dir)
            indexer.index_project()
            context_cache = {}
            for fv in flagged:
                target = fv.get('verify_target')
                if target and target not in context_cache:
                    context_cache[target] = indexer.get_symbol_snippet(target)
            verified = loop.run_until_complete(ai_service.verify_flagged_issues(flagged, context_cache))
            confirmed.extend(verified)
        
        self._log_ai_violations(confirmed)

    def _build_deep_audit_batches(self):
        """Chia files thành các batch thông minh dựa trên kích thước."""
        MAX_FILES, MAX_CHARS = 5, 210000
        deep_chunks, current_batch, current_size = [], [], 0

        for f_info in self.discovery_data['files']:
            try:
                with open(f_info['path'], 'r', encoding='utf-8') as fobj:
                    content = fobj.read()
            except Exception:
                continue
            
            file_chars = len(content)
            file_data = {"path": f_info['path'], "content": content}
            
            if file_chars >= MAX_CHARS:
                if current_batch:
                    deep_chunks.append(current_batch)
                    current_batch, current_size = [], 0
                deep_chunks.append([file_data])
                continue
            
            if (current_size + file_chars > MAX_CHARS) or (len(current_batch) >= MAX_FILES):
                if current_batch:
                    deep_chunks.append(current_batch)
                current_batch, current_size = [], 0
            
            current_batch.append(file_data)
            current_size += file_chars

        if current_batch:
            deep_chunks.append(current_batch)
        return deep_chunks

    def _log_ai_violations(self, confirmed_violations):
        """Ghi nhận violations từ AI reasoning."""
        from src.config import WEIGHTS
        for rv in confirmed_violations:
            try:
                weight = float(rv.get('weight', -3.0))
            except (ValueError, TypeError):
                weight = -3.0
            if weight > 0: weight = -weight
            
            pillar = rv.get('type', 'Maintainability')
            if pillar not in WEIGHTS:
                pillar = 'Maintainability'
            rule_id = rv.get('rule_id', 'AI_REASONING')
            
            # Capping and Overriding AI hallucinated weights
            if rule_id == 'AI_REASONING' and weight < -2.0:
                weight = -2.0 # Giới hạn tối đa mức phạt do AI tự biên tự diễn
            elif rule_id != 'AI_REASONING':
                for r in getattr(self, 'merged_rules', {}).get('rules', []):
                    if r.get('id') == rule_id and r.get('weight'):
                        weight = float(r.get('weight'))
                        break

            self.log_violation({
                'pillar': pillar, 'file': rv.get('file', 'unknown'),
                'reason': rv.get('reason', 'AI Logic Audit'), 'weight': weight,
                'rule_id': rule_id,
                'line': rv.get('line', 0), 'is_custom': rv.get('is_custom', False)
            })

    def _step_aggregation(self):
        """BƯỚC 4: Tổng hợp dữ liệu (Aggregation)."""
        logger.info("[4/5] Bước 4: Tổng hợp dữ liệu (Aggregation)...")
        from src.config import WEIGHTS
        from src.engine.authorship import AuthorshipTracker
        
        auth_tracker = AuthorshipTracker(self.target_dir)
        total_loc = self.discovery_data['total_loc']
        file_to_feature = {
            os.path.relpath(f['path'], self.target_dir): f.get('feature', 'unknown') 
            for f in self.discovery_data['files']
        }
        
        feature_punishments = {}
        feature_meta = {}
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
            
            flat_meta = {r.get('id'): r for r in getattr(self, 'merged_rules', {}).get('rules', [])}
            rule_id = v.get('rule_id', '')
            meta_rule = flat_meta.get(rule_id, {})
            meta = {
                "severity": meta_rule.get("severity", "Minor"),
                "debt": meta_rule.get("debt", 10)
            }
            feature_meta[feat][pillar]["debt"] += meta["debt"]
            if sev_levels.index(meta["severity"]) > sev_levels.index(feature_meta[feat][pillar]["max_sev"]):
                feature_meta[feat][pillar]["max_sev"] = meta["severity"]
                
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

        self.feature_results = {}
        project_punishments = {p: 0 for p in WEIGHTS.keys()}
        project_meta = {p: {"debt": 0, "max_sev": "Info"} for p in WEIGHTS.keys()}
        
        for feature, punishments in feature_punishments.items():
            feat_loc = self.discovery_data['features'].get(feature, {}).get('loc', 0)
            if feat_loc == 0: continue
            
            p_scores = {}
            for pillar in WEIGHTS.keys():
                p_scores[pillar] = ScoringEngine.calculate_pillar_score(punishments[pillar], feat_loc, pillar)
                project_punishments[pillar] += punishments[pillar]
                
                meta = feature_meta[feature][pillar]
                project_meta[pillar]["debt"] += meta["debt"]
                if sev_levels.index(meta["max_sev"]) > sev_levels.index(project_meta[pillar]["max_sev"]):
                    project_meta[pillar]["max_sev"] = meta["max_sev"]
            
            f_score = ScoringEngine.calculate_final_score(p_scores)
            self.feature_results[feature] = {
                "pillars": p_scores, "final": f_score, "punishments": punishments, "loc": feat_loc,
                "debt_mins": sum(m["debt"] for m in feature_meta[feature].values())
            }

        self.project_pillars = {}
        for pillar in WEIGHTS.keys():
            if total_loc > 0 and self.feature_results:
                w_score = sum(res['pillars'][pillar] * res.get('loc', 0) for res in self.feature_results.values())
                self.project_pillars[pillar] = round(w_score / total_loc, 2)
            else:
                self.project_pillars[pillar] = ScoringEngine.calculate_pillar_score(project_punishments[pillar], total_loc, pillar)

        final_score = ScoringEngine.calculate_final_score_from_features(self.feature_results)
        rating = ScoringEngine.get_rating(final_score)

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
                "pillars": p_scores, "final": f_score, "punishments": punishments, "loc": author_loc,
                "debt_mins": sum(m["debt"] for m in member_meta[author].values()),
                "violations": member_violations.get(author, [])
            }
            
        return final_score, rating

    def _step_reporting(self, final_score, rating):
        """BƯỚC 5: Xuất báo cáo (Reporting)."""
        logger.info("[5/5] Bước 5: Xuất báo cáo (Reporting)...")
        self.generate_report(self.feature_results, self.project_pillars, final_score, rating)
        
        logger.info(f"\n✅ Kiểm toán hoàn tất!")
        logger.info(f"   - Điểm tổng thể: {final_score}/100")
        logger.info(f"   - Xếp hạng: {rating}")
        logger.info(f"   - Báo cáo chi tiết: {self.report_path}")

    def generate_report(self, feature_results, project_pillars, final_score, rating):
        """Tạo file báo cáo Markdown chuyên nghiệp phân cấp theo Tính năng."""
        rule_stats, severity_dist = self._build_report_stats()
        self._write_report_content(feature_results, project_pillars, final_score, rating, rule_stats, severity_dist)

    def _build_report_stats(self):
        flat_meta = {r.get('id'): r for r in getattr(self, 'merged_rules', {}).get('rules', [])}
        rule_stats = {}
        severity_dist = {"Blocker": 0, "Critical": 0, "Major": 0, "Minor": 0, "Info": 0}
        
        for v in self.violations:
            rule_id = v.get('rule_id', 'UNKNOWN') or 'UNKNOWN'
            
            if rule_id not in rule_stats:
                rule_stats[rule_id] = {'count': 0, 'weight': 0.0, 'pillars': set()}
            
            rule_stats[rule_id]['count'] += 1
            rule_stats[rule_id]['weight'] += v.get('weight', 0)
            rule_stats[rule_id]['pillars'].add(v.get('pillar', 'Maintainability'))
            
            sev = flat_meta.get(rule_id, {}).get('severity', 'Minor')
            severity_dist[sev] = severity_dist.get(sev, 0) + 1
            
        return rule_stats, severity_dist

    def _write_report_content(self, feature_results, project_pillars, final_score, rating, rule_stats, severity_dist):
        from datetime import datetime
        with open(self.report_path, 'w') as f:
            f.write(f"# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)\n\n")
            f.write(f"**Thời gian báo cáo:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"## ĐIỂM TỔNG DỰ ÁN: {final_score} / 100 ({rating})\n\n")
            
            f.write("### 📊 Chỉ số dự án (Project Metrics)\n")
            f.write(f"- Tổng LOC: {self.discovery_data['total_loc']}\n")
            f.write(f"- Tổng số file: {self.discovery_data['total_files']}\n")
            f.write(f"- Tổng số tính năng: {len(feature_results)}\n\n")
            
            f.write("### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)\n")
            f.write("| Mức độ | Số lượng |\n|---|---|\n")
            for sev in ["Blocker", "Critical", "Major", "Minor", "Info"]:
                if severity_dist[sev] > 0 or sev in ["Critical", "Blocker"]:
                    icon = "🔥" if sev in ["Blocker", "Critical"] else "⚠️" if sev == "Major" else "ℹ️"
                    f.write(f"| {icon} {sev} | {severity_dist[sev]} |\n")
            
            f.write("\n### 🛡️ Đánh giá 4 Trụ cột Dự án\n")
            f.write("| Trụ cột | Điểm (Thang 10) | Trạng thái |\n|---|---|---|\n")
            for pillar, score in project_pillars.items():
                status = "✅ Tốt" if score >= 8.5 else "⚠️ Cần cải thiện" if score >= 6 else "🚨 Nguy cơ"
                f.write(f"| {pillar} | {score} | {status} |\n")
            
            f.write("\n### 🧩 Chi tiết theo Tính năng (Feature Breakdown)\n")
            for feature, res in feature_results.items():
                f.write(f"#### 🔹 Tính năng: `{feature}` (LOC: {res['loc']})\n")
                f.write(f"**Điểm tính năng: {res['final']} / 100** (Nợ: {res['debt_mins']}m)\n\n")
                f.write("| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |\n|---|---|---|\n")
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
                f.write("| Rule ID | Trụ cột | Số lượng | Tổng phạt |\n|---|---|---|---|\n")
                for r_id, stats in sorted(rule_stats.items(), key=lambda x: x[1]['count'], reverse=True):
                    pillars_str = ", ".join(sorted(list(stats['pillars'])))
                    f.write(f"| `{r_id}` | {pillars_str} | {stats['count']} | {round(stats['weight'], 2)} |\n")
                f.write("\n")

            if hasattr(self, 'member_results') and self.member_results:
                f.write("\n### 👥 Đánh giá theo Thành viên (Last 6 Months)\n")
                f.write("| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |\n|---|---|---|---|\n")
                for author, res in sorted(self.member_results.items(), key=lambda x: x[1]['final'], reverse=True):
                    f.write(f"| **{author}** | {res['loc']} | {res['final']} | {res['debt_mins']}m |\n")
                
                f.write("\n#### 🔍 Chi tiết lỗi theo Thành viên\n")
                for author, res in sorted(self.member_results.items(), key=lambda x: x[1]['final'], reverse=True):
                    if res['violations']:
                        f.write(f"\n**{author}** (Top 5 vi phạm nặng nhất):\n")
                        for v in sorted(res['violations'], key=lambda x: x['weight'])[:5]:
                            rule_info = f" (Rule: {v['rule_id']})" if v.get('rule_id') else ""
                            f.write(f"- [{v['pillar']}] {v['file']}:{v.get('line', 0)} - {v['reason']}{rule_info}\n")

if __name__ == "__main__":
    # Điểm vào chính của script
    target = sys.argv[1] if len(sys.argv) > 1 else '.'
    auditor = CodeAuditor(target)
    auditor.run()
