import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Save, Settings2, FileText, CheckCircle2, ChevronRight, ChevronDown, Search, Filter, Wand2, Terminal, AlertTriangle, Trash2, Box, ShieldCheck, Database, Beaker, XCircle, Info } from 'lucide-react';
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const WeightInput = ({ value, onChange, disabled, className }) => {
    const step = 0.5;
    const inputRef = useRef(null);
    
    // Safely parse number
    const currentVal = parseFloat(value);
    const displayVal = isNaN(currentVal) ? -2.0 : currentVal;

    const increment = () => {
        if (disabled) return;
        onChange((displayVal + step).toFixed(1));
    };

    const decrement = () => {
        if (disabled) return;
        onChange((displayVal - step).toFixed(1));
    };

    useEffect(() => {
        const handleWheel = (e) => {
            if (disabled) return;
            e.preventDefault(); // Thực sự chặn cuộn trang để chỉnh số
            if (e.deltaY < 0) {
                increment();
            } else if (e.deltaY > 0) {
                decrement();
            }
        };
        const el = inputRef.current;
        if (el) {
            el.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (el) el.removeEventListener('wheel', handleWheel);
        };
    }, [displayVal, disabled]);

    return (
        <div 
           ref={inputRef}
           className={cn("flex items-stretch bg-black/50 border border-white/10 rounded overflow-hidden transition-colors focus-within:border-emerald-500", disabled && "opacity-50 cursor-not-allowed", className)}
           title="Gợi ý: Chỉ chuột vào khung và Cuộn chuột để tăng/giảm số"
        >
            <button 
                onClick={decrement} 
                disabled={disabled}
                className="w-8 flex items-center justify-center text-slate-400 font-black hover:text-white hover:bg-white/10 bg-white/5 transition-colors disabled:hover:bg-transparent cursor-pointer border-r border-white/5"
            >
                -
            </button>
            <input 
                type="number" 
                step="0.5" 
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className={cn(
                    "w-12 text-sm text-center font-bold font-mono outline-none bg-transparent cursor-ns-resize", 
                    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                )}
            />
            <button 
                onClick={increment} 
                disabled={disabled}
                className="w-8 flex items-center justify-center text-slate-400 font-black hover:text-white hover:bg-white/10 bg-white/5 transition-colors disabled:hover:bg-transparent cursor-pointer border-l border-white/5"
            >
                +
            </button>
        </div>
    );
};

const RulesConfigurator = ({ targetId, projectName, mode = 'all' }) => {
  const [naturalText, setNaturalText] = useState("");
  const [compiledJson, setCompiledJson] = useState(null);
  const [defaultRules, setDefaultRules] = useState({});
  const [disabledCoreRules, setDisabledCoreRules] = useState([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [customWeights, setCustomWeights] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Sandbox state
  const [testCode, setTestCode] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testViolations, setTestViolations] = useState(null);
  const [activeTab, setActiveTab] = useState('core');
  const [isTestRun, setIsTestRun] = useState(false);
  const [sandboxTab, setSandboxTab] = useState('code');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPillar, setFilterPillar] = useState('ALL');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedRules, setExpandedRules] = useState({});

  const filteredCoreRules = useMemo(() => {
      return Object.entries(defaultRules).filter(([key, meta]) => {
          if (filterPillar !== 'ALL' && (meta.category || 'Uncategorized') !== filterPillar) return false;
          if (searchTerm) {
              const searchLower = searchTerm.toLowerCase();
              if (!key.toLowerCase().includes(searchLower) && 
                  !(meta.reason || '').toLowerCase().includes(searchLower) &&
                  !(meta.category || '').toLowerCase().includes(searchLower)) {
                  return false;
              }
          }
          return true;
      });
  }, [defaultRules, filterPillar, searchTerm]);

  const availableCategories = useMemo(() => {
      const cats = new Set();
      Object.values(defaultRules).forEach(meta => cats.add(meta.category || 'Uncategorized'));
      return Array.from(cats).sort();
  }, [defaultRules]);

  const groupedRules = useMemo(() => {
      const groups = {};
      filteredCoreRules.forEach(([key, meta]) => {
          const cat = meta.category || 'Uncategorized';
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push([key, meta]);
      });
      return groups;
  }, [filteredCoreRules]);

  const toggleCategory = (cat) => {
      setExpandedCategories(prev => ({
          ...prev,
          [cat]: prev[cat] === undefined ? false : !prev[cat]
      }));
  };

  const codeTextareaRef = useRef(null);
  const jsonTextareaRef = useRef(null);

  const adjustTextareaHeight = (el) => {
      if (!el) return;
      el.style.height = '0px';
      el.style.height = `${Math.max(300, el.scrollHeight)}px`;
  };

  useEffect(() => {
    if (sandboxTab === 'code') {
        setTimeout(() => adjustTextareaHeight(codeTextareaRef.current), 10);
    } else if (sandboxTab === 'json') {
        setTimeout(() => adjustTextareaHeight(jsonTextareaRef.current), 10);
    }
  }, [testCode, compiledJson, sandboxTab]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRules = async () => {
    if (!targetId) return;
    try {
      const res = await fetch(`/api/rules?target=${encodeURIComponent(targetId)}`);
      const result = await res.json();
      if (result.status === 'success' && result.data) {
        setDefaultRules(result.data.default_rules || {});
        setDisabledCoreRules(result.data.disabled_core_rules || []);
        if (result.data.custom_weights) {
            setCustomWeights(result.data.custom_weights);
        } else {
            setCustomWeights({});
        }
        if (result.data.compiled_json) {
            setCompiledJson(result.data.compiled_json);
        } else {
            // Keep empty if no custom rules
        }
        setNaturalText(result.data.natural_text || "");
      }
    } catch (e) {
      console.error("Lỗi lấy rules", e);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [targetId]);

  const handleCompile = async () => {
    if (!naturalText.trim()) return;
    setIsCompiling(true);
    setTestViolations(null);
    setSaved(false);

    try {
      const response = await fetch('/api/rules/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ natural_text: naturalText })
      });

      const fullText = await response.text();
      let jsonStr = null;
      const jsonMatch = fullText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonStr = jsonMatch[1].trim();
      } else {
        const firstBrace = fullText.indexOf('{');
        const lastBrace = fullText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = fullText.substring(firstBrace, lastBrace + 1);
        }
      }

      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          setCompiledJson(parsed);
          if (parsed.test_case) {
            setTestCode(parsed.test_case);
          }
          setIsTestRun(false);
        } catch (parseError) {
          showToast("Cấu trúc JSON do AI trả về bị lỗi: " + parseError.message, "error");
        }
      } else {
        showToast("Không thể tìm thấy JSON hợp lệ trong phản hồi của AI", "error");
      }
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setIsCompiling(false);
    }
  };

  const handleSave = async () => {
    if (!targetId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/rules/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: targetId,
          natural_text: naturalText,
          compiled_json: compiledJson,
          custom_weights: customWeights
        })
      });
      if (res.ok) {
        setSaved(true);
        showToast("Đã lưu quy tắc thành công!");
        setTimeout(() => setSaved(false), 3000);
        fetchRules();
      } else {
        showToast("Lỗi khi lưu quy tắc", "error");
      }
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRule = async (ruleId, isDisable) => {
     try {
       const res = await fetch('/api/rules/toggle', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ target: targetId, rule_id: ruleId, is_disabled: isDisable })
       });
       if (res.ok) {
          showToast(`Đã ${isDisable ? 'tắt' : 'bật'} luật ${ruleId}`);
          fetchRules();
       }
     } catch (e) {
       showToast("Lỗi cập nhật luật", "error");
     }
  };

  const handleWeightChange = async (ruleId, newWeight, isCustomRule = false, customRuleType = null, customRuleIdx = null) => {
    const val = parseFloat(newWeight);
    if (isNaN(val)) return;
    
    // Nếu là luật AI Custom -> Cập nhật trực tiếp vào compiledJson
    if (isCustomRule) {
      if (!compiledJson) return;
      const updatedJson = JSON.parse(JSON.stringify(compiledJson));
      if (customRuleType === 'regex' && Array.isArray(updatedJson.regex_rules)) {
        updatedJson.regex_rules[customRuleIdx].weight = val;
      } else if (customRuleType === 'ast' && updatedJson.ast_rules && Array.isArray(updatedJson.ast_rules.dangerous_functions)) {
        updatedJson.ast_rules.dangerous_functions[customRuleIdx].weight = val;
      }
      setCompiledJson(updatedJson);
      try {
        await fetch('/api/rules/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: targetId,
            natural_text: naturalText,
            compiled_json: updatedJson,
            custom_weights: customWeights
          })
        });
      } catch(e) {}
      return;
    }
    
    // Nếu là luật Core -> Lưu vào customWeights
    const updatedWeights = { ...customWeights, [ruleId]: val };
    setCustomWeights(updatedWeights);

    try {
      await fetch('/api/rules/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: targetId,
          natural_text: naturalText,
          compiled_json: compiledJson,
          custom_weights: updatedWeights
        })
      });
    } catch(e) {}
  };

  const handleDeleteCustomRule = async (type, index) => {
    const newJson = JSON.parse(JSON.stringify(compiledJson));
    if (type === 'regex' && Array.isArray(newJson.regex_rules)) {
        newJson.regex_rules.splice(index, 1);
    } else if (type === 'ast' && newJson.ast_rules && Array.isArray(newJson.ast_rules.dangerous_functions)) {
        newJson.ast_rules.dangerous_functions.splice(index, 1);
    }
    
    setCompiledJson(newJson);
    
    try {
      const res = await fetch('/api/rules/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: targetId,
          natural_text: naturalText,
          compiled_json: newJson,
          custom_weights: customWeights
        })
      });
      if (res.ok) {
        showToast("Đã xóa luật tùy chỉnh thành công!");
        fetchRules();
      } else {
        showToast("Lỗi khi lưu, đang khôi phục...", "error");
        fetchRules();
      }
    } catch (e) {
      showToast(e.message, "error");
      fetchRules();
    }
  };

  const handleTestRule = async () => {
      if (!compiledJson || !testCode.trim()) return;
      setIsTesting(true);
      setTestViolations(null);
      try {
         const res = await fetch('/api/rules/test', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
               code_snippet: testCode,
               compiled_json: compiledJson
            })
         });
         if (res.ok) {
            const data = await res.json();
            setTestViolations(data.violations || []);
            setIsTestRun(true);
         } else {
            showToast("Lỗi khi test sandbox", "error");
         }
      } catch (e) {
         showToast("Lỗi kết nối API", "error");
      } finally {
         setIsTesting(false);
      }
  };

  const severityColors = {
    Blocker: "bg-red-500/20 text-red-500 border-red-500/30",
    Critical: "bg-orange-500/20 text-orange-500 border-orange-500/30",
    Major: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
    Minor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Info: "bg-slate-500/20 text-slate-400 border-slate-500/30"
  };

  const templates = [
      "Cấm sử dụng hàm eval() theo OWASP Security",
      "Không được phép dùng bare except",
      "Hàm không dài quá 50 dòng",
      "Bắt buộc dùng biến môi trường thay vì Hardcode"
  ];

  return (
    <div className="flex-1 flex flex-col w-full bg-transparent text-[#1e293b] pt-0 pb-12 gap-6 font-sans relative">
      <div className="flex justify-between items-center mb-4 z-10 shrink-0">
        <div>
          <p className="text-slate-400 text-sm font-semibold flex items-center gap-2 bg-black/20 px-4 py-2 rounded-full border border-white/5 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse block" />
            Định cấu hình quy tắc kiểm toán cho dự án: <span className="text-violet-300 font-bold tracking-tight">{projectName}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
            {/* Moved Reset Button to Settings Tab */}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 50, x: "-50%" }}
            className={cn(
              "fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] border backdrop-blur-xl flex items-center gap-3",
              toast.type === 'error' ? "bg-red-500/10 border-red-500/30 text-red-700" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
            )}
          >
            {toast.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            <span className="font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn("flex-1 w-full relative z-10 gap-6 pb-6", mode === 'all' ? "grid grid-cols-12" : "flex flex-col")}>
         
         {/* LEFT COLUMN: Rule List */}
         {(mode === 'all' || mode === 'manager') && (
         <div className={cn("bg-slate-900/60 backdrop-blur-lg border border-white/10 rounded-2xl p-6 flex flex-col", mode === 'all' ? "col-span-12 xl:col-span-5" : "flex-1")}>
            <div className="flex items-center gap-3 mb-6 text-slate-100 font-extrabold tracking-tight shrink-0">
               <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <ShieldCheck size={20} />
               </div>
               Danh sách Rule Đang Chạy
            </div>
            
            <div className="flex bg-black/40 rounded-xl p-1 mb-6 border border-white/10 shrink-0">
               <button
                  onClick={() => setActiveTab('core')}
                  className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'core' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200")}
               >
                  Luật Mặc Định
               </button>
               <button
                  onClick={() => setActiveTab('custom')}
                  className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2", activeTab === 'custom' ? "bg-violet-600 text-white shadow" : "text-slate-400 hover:text-slate-200")}
               >
                  <Wand2 size={14} /> Luật Tùy Chỉnh AI
               </button>
            </div>
            
            <div className="flex flex-col gap-3 pb-8">
               {activeTab === 'custom' && (
                   <div className="mb-2">
                       {(!compiledJson || (!Array.isArray(compiledJson?.ast_rules?.dangerous_functions) || compiledJson.ast_rules.dangerous_functions.length === 0) && (!Array.isArray(compiledJson?.regex_rules) || compiledJson.regex_rules.length === 0)) && (
                           <div className="text-xs text-slate-500 italic bg-black/20 p-4 rounded-xl border border-white/5 text-center flex flex-col items-center justify-center gap-2 h-32">
                               <Wand2 size={24} className="opacity-50" />
                               Chưa có luật tùy chỉnh nào được cấu hình.<br/>Hãy tạo ở Wizard bên cạnh.
                           </div>
                       )}
                       
                       {compiledJson && Array.isArray(compiledJson.regex_rules) && compiledJson.regex_rules.map((r, idx) => (
                           <div key={`regex-${idx}`} className="bg-violet-900/10 border border-violet-500/20 rounded-xl p-4 flex flex-col gap-2 mb-2 relative group transition-all hover:bg-violet-900/20">
                               <div className="flex justify-between items-start">
                                   <span className="font-bold text-violet-300 text-sm">REGEX: {r.id}</span>
                                   <div className="flex items-center gap-2">
                                       <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full uppercase border border-red-500/30">Security</span>
                                       <button 
                                          onClick={() => handleDeleteCustomRule('regex', idx)}
                                          title="Xóa luật này"
                                          className="relative z-20 opacity-40 hover:opacity-100 p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                       >
                                           <Trash2 size={14} />
                                       </button>
                                   </div>
                               </div>
                               <div className="text-xs text-slate-400">{r.reason}</div>
                               <code className="text-[10px] bg-black/50 p-2 rounded text-emerald-400 font-mono mt-1 mb-2 break-all border border-emerald-500/10">{r.pattern}</code>
                               <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-2 mt-auto">
                                   <span className="text-[10px] text-slate-500 font-medium">TRỌNG SỐ:</span>
                                   <WeightInput 
                                      value={r.weight !== undefined ? r.weight : -2.0}
                                      onChange={(val) => handleWeightChange(r.id, val, true, 'regex', idx)}
                                      className="text-violet-300 focus-within:border-violet-500 border-white/10"
                                   />
                               </div>
                           </div>
                       ))}
                       
                       {compiledJson && compiledJson.ast_rules && Array.isArray(compiledJson.ast_rules.dangerous_functions) && compiledJson.ast_rules.dangerous_functions.map((df, idx) => (
                           <div key={`ast-${idx}`} className="bg-violet-900/10 border border-violet-500/20 rounded-xl p-4 flex flex-col gap-2 mb-2 relative group transition-all hover:bg-violet-900/20">
                               <div className="flex justify-between items-start">
                                   <span className="font-bold text-violet-300 text-sm">AST FORBIDDEN: {df.name}</span>
                                   <div className="flex items-center gap-2">
                                       <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full uppercase border border-yellow-500/30">{df.pillar || 'Security'}</span>
                                       <button 
                                          onClick={() => handleDeleteCustomRule('ast', idx)}
                                          title="Xóa luật này"
                                          className="relative z-20 opacity-40 hover:opacity-100 p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                       >
                                           <Trash2 size={14} />
                                       </button>
                                   </div>
                               </div>
                               <div className="text-xs text-slate-400 mb-2">{df.reason}</div>
                               <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-2 mt-auto">
                                   <span className="text-[10px] text-slate-500 font-medium">TRỌNG SỐ:</span>
                                   <WeightInput 
                                      value={df.weight !== undefined ? df.weight : -2.0}
                                      onChange={(val) => handleWeightChange(df.name || df.id, val, true, 'ast', idx)}
                                      className="text-violet-300 focus-within:border-violet-500 border-white/10"
                                   />
                               </div>
                           </div>
                       ))}
                   </div>
               )}

               {activeTab === 'core' && (
                   <div className="flex flex-col gap-4 mb-4">
                       <div className="flex items-center gap-3">
                           <div className="flex-1 relative">
                               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                               <input 
                                   type="text" 
                                   placeholder="Tìm kiếm theo ID, mô tả..." 
                                   value={searchTerm}
                                   onChange={(e) => setSearchTerm(e.target.value)}
                                   className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:border-violet-500/50 outline-none transition-colors"
                               />
                           </div>
                           <div className="relative shrink-0">
                               <select 
                                   value={filterPillar}
                                   onChange={(e) => setFilterPillar(e.target.value)}
                                   className="appearance-none bg-black/40 border border-white/10 rounded-xl py-2 pl-4 pr-10 text-sm text-slate-200 focus:border-violet-500/50 outline-none transition-colors font-bold cursor-pointer"
                               >
                                   <option value="ALL">Tất cả Pillars ({Object.keys(defaultRules).length})</option>
                                   {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                               <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                           </div>
                       </div>
                   </div>
               )}

               {activeTab === 'core' && Object.keys(groupedRules).length === 0 && (
                   <div className="text-sm text-slate-500 italic bg-black/20 p-6 rounded-xl border border-white/5 text-center mt-4">
                       Không tìm thấy luật nào phù hợp với bộ lọc hiện tại.
                   </div>
               )}

               {activeTab === 'core' && Object.entries(groupedRules).map(([category, rules]) => {
                  const isExpanded = expandedCategories[category] !== false; // true or undefined
                  return (
                  <div key={category} className="mb-4 bg-black/20 border border-white/5 rounded-2xl shadow-sm">
                      <button 
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.05] transition-colors rounded-2xl"
                      >
                          <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown size={18} className="text-violet-400 transition-transform" /> : <ChevronRight size={18} className="text-slate-500 transition-transform" />}
                              <span className="font-extrabold text-sm tracking-wide text-slate-200 uppercase flex items-center gap-2">
                                 <Box size={16} className="text-violet-400 opacity-70" /> {category}
                              </span>
                              <span className="bg-violet-500/10 text-violet-300 px-2.5 py-0.5 rounded-full text-[10px] font-black">{rules.length} LUẬT</span>
                          </div>
                      </button>
                      
                      <AnimatePresence>
                          {isExpanded && (
                              <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                              >
                                  <div className="p-4 pt-1 gap-3 flex flex-col">
                                      {rules.map(([ruleKey, meta]) => {
                                          const isDisabled = disabledCoreRules.includes(ruleKey);
                                          const isRuleExpanded = expandedRules[ruleKey];
                                          return (
                                          <div key={ruleKey} className={cn("border rounded-xl p-4 flex flex-col gap-3 transition-all", isDisabled ? "bg-slate-900/30 border-slate-800 opacity-60 grayscale" : "bg-black/40 border-white/10")}>
                                            <div className="flex justify-between items-start">
                                               <div className="flex items-center gap-2">
                                                   <span className="font-mono text-[0.8rem] font-bold text-slate-200 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg break-all">
                                                      {ruleKey}
                                                   </span>
                                                   <button
                                                      onClick={() => setExpandedRules(prev => ({...prev, [ruleKey]: !prev[ruleKey]}))}
                                                      className="text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 p-1.5 rounded-lg transition-colors border border-transparent hover:border-violet-500/20"
                                                      title="Xem chi tiết luật"
                                                   >
                                                      <Info size={16} />
                                                   </button>
                                               </div>
                                               <div className="flex items-center gap-3 shrink-0">
                                                  <span className={cn(
                                                     "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border whitespace-nowrap",
                                                     severityColors[meta.severity] || severityColors.Info
                                                  )}>{meta.severity}</span>
                                                   <div className="flex items-center gap-2 bg-black/20 p-1 pr-2 rounded-full border border-white/5">
                                                       <button
                                                           onClick={() => handleToggleRule(ruleKey, !isDisabled)}
                                                           className={cn(
                                                               "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none shadow-inner",
                                                               !isDisabled ? "bg-emerald-500" : "bg-slate-700"
                                                           )}
                                                           role="switch"
                                                           aria-checked={!isDisabled}
                                                       >
                                                           <span
                                                               aria-hidden="true"
                                                               className={cn(
                                                                   "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                                                                   !isDisabled ? "translate-x-4" : "translate-x-0.5"
                                                               )}
                                                           />
                                                       </button>
                                                       <span className={cn("text-[9px] font-black w-6 text-center tracking-widest select-none", !isDisabled ? "text-emerald-400" : "text-slate-500")}>
                                                          {!isDisabled ? "ON" : "OFF"}
                                                       </span>
                                                   </div>
                                                </div>
                                             </div>
                                             <div className="flex items-center justify-between mt-1">
                                                <div className="text-[11px] text-slate-400 line-clamp-2" title={meta.reason || meta.category}>{meta.reason ? `${meta.reason}` : meta.category} | Nợ KH: {meta.debt}m</div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                   <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">TRỌNG SỐ:</span>
                                                   <WeightInput 
                                                      value={customWeights[ruleKey] !== undefined ? customWeights[ruleKey] : (meta.weight !== undefined ? meta.weight : -2.0)}
                                                      onChange={(val) => handleWeightChange(ruleKey, val)}
                                                      disabled={isDisabled}
                                                      className={!isDisabled ? "text-emerald-400 field-sizing-content" : "field-sizing-content"}
                                                   />
                                                </div>
                                             </div>
                                              
                                             {/* Rule Details Panel */}
                                             <AnimatePresence>
                                               {isRuleExpanded && (
                                                  <motion.div
                                                     initial={{ height: 0, opacity: 0 }}
                                                     animate={{ height: 'auto', opacity: 1 }}
                                                     exit={{ height: 0, opacity: 0 }}
                                                     transition={{ duration: 0.2 }}
                                                     className="overflow-hidden mt-2 border-t border-white/5 pt-3"
                                                  >
                                                     <div className="flex flex-col gap-3 text-sm">
                                                         {meta.reason && (
                                                             <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                                 <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mô tả</span>
                                                                 <span className="text-slate-300">{meta.reason}</span>
                                                             </div>
                                                         )}
                                                         {meta.regex && typeof meta.regex === 'object' && meta.regex.pattern && (
                                                             <div className="bg-white/5 rounded-lg p-3 border border-emerald-500/20">
                                                                 <span className="text-[10px] font-bold text-emerald-500 uppercase block mb-1">Regex Pattern</span>
                                                                 <code className="text-[11px] text-emerald-400 font-mono break-all leading-loose">{meta.regex.pattern}</code>
                                                             </div>
                                                         )}
                                                         {meta.ast && typeof meta.ast === 'object' && meta.ast.type && (
                                                             <div className="bg-white/5 rounded-lg p-3 border border-blue-500/20">
                                                                 <span className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-2 mb-1">AST Properties</span>
                                                                 <div className="text-[11px] text-blue-300">
                                                                     <strong>Type:</strong> {meta.ast.type}
                                                                     {meta.ast.limit && <span className="ml-3"><strong>Limit:</strong> {meta.ast.limit}</span>}
                                                                 </div>
                                                             </div>
                                                         )}
                                                         {meta.ai && typeof meta.ai === 'object' && meta.ai.prompt && (
                                                             <div className="bg-white/5 rounded-lg p-3 border border-violet-500/20">
                                                                 <span className="text-[10px] font-bold text-violet-500 uppercase flex items-center gap-2 mb-1"><Wand2 size={12}/> AI Prompt</span>
                                                                 <span className="text-[11px] text-violet-300 block leading-relaxed">{meta.ai.prompt}</span>
                                                             </div>
                                                         )}
                                                         {!meta.regex && !meta.ast && !meta.ai && (
                                                             <div className="text-xs text-slate-500 italic">Không có metadata chi tiết cho luật này.</div>
                                                         )}
                                                     </div>
                                                  </motion.div>
                                               )}
                                             </AnimatePresence>
                                          </div>
                                          )
                                      })}
                                  </div>
                              </motion.div>
                          )}
                      </AnimatePresence>
                  </div>
               )})}
            </div>
         </div>
         )}
         
         {/* RIGHT COLUMN: AI Prompt & Sandbox */}
         {(mode === 'all' || mode === 'sandbox') && (
         <div className={cn("flex flex-col gap-6", mode === 'all' ? "col-span-12 xl:col-span-7" : "flex-1")}>
            
            {/* AI Generator */}
            <div className="bg-slate-900/60 backdrop-blur-lg border border-white/10 rounded-2xl p-6 flex flex-col shrink-0">
                 <div className="flex items-center gap-3 text-slate-100 font-extrabold tracking-tight mb-4">
                    <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
                      <Wand2 size={20} />
                    </div>
                    Tạo Luật Mới bằng AI
                 </div>
                 
                 <div className="flex flex-wrap gap-2 mb-4">
                     {templates.map((tpl, i) => (
                         <button key={i} onClick={() => setNaturalText(tpl)} className="text-[11px] bg-slate-800 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700 hover:border-violet-500 hover:text-violet-300 transition block font-medium">
                             + {tpl}
                         </button>
                     ))}
                 </div>
                 
                 <textarea 
                  value={naturalText}
                  onChange={(e) => setNaturalText(e.target.value)}
                  placeholder="Diễn đạt mong muốn của bạn bằng Tiếng Việt (VD: Cấm dùng hàm subprocess)..."
                  className="w-full min-h-[90px] bg-black/40 border border-white/5 rounded-xl p-4 text-slate-200 font-medium placeholder-slate-600 outline-none focus:border-violet-500/40 transition-all resize-none"
                 />
                 
                 <div className="mt-4 flex justify-between items-center">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 italic">
                        Luật mới sinh ra sẽ tự động chèn vào danh sách bên trái.
                    </div>
                    <button
                        onClick={handleCompile}
                        disabled={isCompiling}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-300 border border-violet-500/30 font-bold hover:from-violet-500/30 hover:to-purple-500/30 transition-all"
                    >
                        {isCompiling ? <span className="animate-spin text-lg">◌</span> : <Play size={16} />}
                        {isCompiling ? 'Đang dịch...' : 'Biên dịch AI'}
                    </button>
                 </div>
            </div>
            
            {/* Interactive Sandbox */}
            <div className="flex-1 bg-slate-900/60 backdrop-blur-lg border border-white/10 rounded-2xl p-6 flex flex-col">
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 text-slate-100 font-extrabold tracking-tight">
                       <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                         <Beaker size={20} />
                       </div>
                       Interactive Sandbox (Kiểm chứng luật)
                    </div>
                 </div>
                 
                 {!compiledJson ? (
                     <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4 opacity-70 bg-black/20 rounded-xl border border-dashed border-white/5">
                         <Beaker size={40} className="mb-2" />
                         <p className="font-bold text-sm">Biên dịch AI thành công để hiển thị Sandbox</p>
                     </div>
                 ) : (
                     <div className="flex-1 flex flex-col">
                         <div className="flex-1 flex flex-col gap-6">
                             <div className="flex flex-col bg-[#0d1117] border border-white/10 rounded-xl relative shrink-0">
                                 <div className="flex text-[10px] font-bold text-slate-500 uppercase border-b border-white/5 bg-black/40 shrink-0">
                                     <button 
                                        onClick={() => setSandboxTab('code')}
                                        className={cn("px-4 py-3 border-r border-white/5 transition-all outline-none", sandboxTab === 'code' ? "bg-white/5 text-slate-200" : "hover:bg-white/5")}
                                     >
                                        Test Case Code
                                     </button>
                                     <button 
                                        onClick={() => setSandboxTab('json')}
                                        className={cn("px-4 py-3 border-r border-white/5 transition-all outline-none", sandboxTab === 'json' ? "bg-white/5 text-violet-300" : "hover:bg-white/5")}
                                     >
                                        JSON Rules (Editable)
                                     </button>
                                 </div>
                                 
                                 {sandboxTab === 'json' ? (
                                    <textarea
                                        ref={jsonTextareaRef}
                                        value={JSON.stringify(compiledJson, null, 2)}
                                        onChange={(e) => {
                                            try {
                                                const newJson = JSON.parse(e.target.value);
                                                setCompiledJson(newJson);
                                                setIsTestRun(false);
                                                adjustTextareaHeight(e.target);
                                            } catch(err) {
                                                // Handle error if needed
                                            }
                                        }}
                                        className="w-full min-h-[300px] overflow-hidden font-mono text-sm bg-transparent p-6 text-violet-300 outline-none resize-none leading-relaxed border-none focus:ring-1 focus:ring-violet-500"
                                    ></textarea>
                                 ) : (
                                    <textarea
                                        ref={codeTextareaRef}
                                        value={testCode}
                                        onChange={(e) => {
                                            setTestCode(e.target.value);
                                            setIsTestRun(false);
                                            adjustTextareaHeight(e.target);
                                        }}
                                        placeholder="Viết một đoạn code giả lập lỗi (Ví dụ Python hoặc JS)\n\ndef main():\n    eval('x=1')"
                                        className="w-full min-h-[300px] overflow-hidden font-mono text-base bg-transparent p-6 text-slate-300 outline-none resize-none leading-relaxed"
                                    ></textarea>
                                 )}
                             </div>
                             
                             <div className="flex flex-col bg-[#0d1117] border border-white/10 rounded-xl shrink-0 min-h-[200px]">
                                 <div className="text-[10px] font-bold text-slate-500 uppercase px-4 py-2 border-b border-white/5 bg-black/40">Real-time Result</div>
                                 <div className="p-6">
                                    {isTesting ? (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 text-sm">
                                           <span className="animate-spin text-2xl text-blue-400">◌</span> 
                                           Đang Test Rule...
                                        </div>
                                    ) : testViolations === null ? (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2 text-xs italic text-center">
                                           <FileText size={24} className="opacity-50" />
                                           Hãy gõ code vào ô bên trái <br/>và ấn Run Test
                                        </div>
                                    ) : testViolations.length === 0 ? (
                                        <div className="text-sm font-bold text-emerald-500 flex flex-col items-center justify-center gap-3 h-full bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                            <CheckCircle2 size={36} /> An toàn
                                            <span className="text-xs font-normal text-slate-400 text-center px-4">Luật Regex/AST không phát hiện lỗi trong đoạn mã này.</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            <div className="text-sm font-bold text-red-500 flex items-center gap-2 mb-1">
                                                <XCircle size={18} /> {testViolations.length} Violations
                                            </div>
                                            {testViolations.map((v, i) => (
                                                <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs flex flex-col shadow-inner shadow-red-500/5">
                                                    <span className="font-bold text-red-400 border-b border-red-500/10 pb-1 mb-2">{v.rule_id}</span>
                                                    <p className="text-slate-200">{v.reason}</p>
                                                    <div className="text-slate-500 font-mono mt-2 bg-black/30 p-1.5 rounded inline-block w-fit">Line {v.line}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                 </div>
                             </div>
                         </div>
                         <div className="flex justify-end pt-6 shrink-0 gap-4 border-t border-white/10 mt-4">
                            <button
                                onClick={handleTestRule}
                                disabled={isTesting || !testCode.trim() || !compiledJson}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-8 rounded-xl flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                            >
                                {isTesting ? <span className="animate-spin">◌</span> : <Terminal size={16} />}
                                Run Test
                            </button>
                            
                            <motion.button
                                whileHover={isTestRun ? { scale: 1.02, translateY: -2 } : {}}
                                whileTap={isTestRun ? { scale: 0.98 } : {}}
                                onClick={handleSave}
                                disabled={isSaving || !isTestRun}
                                className={cn(
                                    "flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold transition-all shadow-xl",
                                    !isTestRun ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700" :
                                    saved 
                                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 shadow-emerald-500/10" 
                                        : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-violet-500/20 border border-white/20"
                                )}
                            >
                                {isSaving ? <span className="animate-spin text-xl">◌</span> : saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
                                {saved ? "Đã Lưu Thành Công" : "Lưu Rule Cục Bộ"}
                            </motion.button>
                         </div>
                     </div>
                 )}
            </div>

         </div>
         )}
      </div>
    </div>
  );
};

export default RulesConfigurator;
