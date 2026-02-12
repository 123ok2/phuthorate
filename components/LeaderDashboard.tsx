
import React, { useState, useEffect, useMemo } from 'react';
import { User, Agency, Evaluation, EvaluationScores, EvaluationCycle } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface LeaderDashboardProps { user: User; }

const LeaderDashboard: React.FC<LeaderDashboardProps> = ({ user }) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>(user?.agencyId || '');
  const [agencyStaff, setAgencyStaff] = useState<User[]>([]);
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([]);
  const [allCycles, setAllCycles] = useState<EvaluationCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [agencySnap, cycleSnap, evalSnap] = await Promise.all([
          getDocs(collection(db, "agencies")),
          getDocs(collection(db, "cycles")),
          getDocs(collection(db, "evaluations"))
        ]);
        
        const agencyList = agencySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agency));
        setAgencies(agencyList);
        const cyclesData = cycleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EvaluationCycle));
        setAllCycles(cyclesData);
        
        const activeCycle = cyclesData.find(c => c.status === 'ACTIVE');
        if (activeCycle && selectedCycleId === 'all') setSelectedCycleId(activeCycle.id);

        const staffQuery = query(collection(db, "users"), where("agencyId", "==", selectedAgencyId));
        const staffSnap = await getDocs(staffQuery);
        setAgencyStaff(staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        setAllEvaluations(evalSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation)));
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [selectedAgencyId]);

  const selectedCycle = useMemo(() => allCycles.find(c => c.id === selectedCycleId), [allCycles, selectedCycleId]);

  const progressReport = useMemo(() => {
    if (!selectedCycle) return [];
    const activeStaff = agencyStaff.filter(s => s.role !== 'ADMIN');
    
    let report = activeStaff.map(evaluator => {
      const targetPeers = activeStaff.filter(p => p.id !== evaluator.id);
      const doneIds = allEvaluations
        .filter(e => e.evaluatorId === evaluator.id && e.cycleId === selectedCycleId)
        .map(e => e.evaluateeId);
      
      const missingPeers = targetPeers.filter(p => !doneIds.includes(p.id));
      
      return {
        evaluator,
        totalRequired: targetPeers.length,
        doneCount: doneIds.length,
        missingCount: missingPeers.length,
        missingNames: missingPeers.map(p => p.name),
        isComplete: missingPeers.length === 0,
        percent: targetPeers.length > 0 ? Math.round((doneIds.length / targetPeers.length) * 100) : 100
      };
    }).sort((a, b) => a.percent - b.percent);

    if (onlyIncomplete) {
      report = report.filter(r => !r.isComplete);
    }
    return report;
  }, [agencyStaff, allEvaluations, selectedCycleId, selectedCycle, onlyIncomplete]);

  const lazyStaff = useMemo(() => progressReport.filter(p => p.percent === 0), [progressReport]);

  const handleCopyReminder = (p: any) => {
    const text = `[NHẮC NHỞ ĐÁNH GIÁ]\nKính gửi đồng chí: ${p.evaluator.name}\nHiện tại đợt "${selectedCycle?.name}" đang diễn ra. Đồng chí vẫn còn thiếu ${p.missingCount}/${p.totalRequired} lượt đánh giá cho các đồng nghiệp: ${p.missingNames.join(', ')}.\nVui lòng truy cập hệ thống Phú Thọ Rate để hoàn thành trước thời hạn. Trân trọng!`;
    navigator.clipboard.writeText(text);
    alert(`Đã sao chép nội dung nhắc nhở cho đồng chí ${p.evaluator.name}`);
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-[10px] font-black uppercase text-slate-400">Đang kiểm tra tiến độ...</div>;

  return (
    <div className="space-y-6 pb-24">
      {/* KHU VỰC CẢNH BÁO NHANH */}
      {lazyStaff.length > 0 && (
        <div className="bg-rose-600 rounded-[2rem] p-8 text-white shadow-2xl shadow-rose-500/30 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-2xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-black uppercase">Cán bộ chưa thực hiện đánh giá</h2>
              <p className="text-rose-100 text-[10px] font-bold uppercase tracking-widest">Phát hiện {lazyStaff.length} nhân sự chưa có bất kỳ lượt đánh giá nào (0%)</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {lazyStaff.map(p => (
              <div key={p.evaluator.id} className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 flex items-center gap-4">
                <span className="text-[11px] font-black uppercase">{p.evaluator.name}</span>
                <button onClick={() => handleCopyReminder(p)} className="text-[9px] font-black bg-white text-rose-600 px-3 py-1 rounded-lg hover:bg-rose-50 transition-colors uppercase">Nhắc nhở</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-3">
          <h1 className="text-2xl font-black text-slate-900 uppercase">Giám sát & Đôn đốc</h1>
          <div className="flex flex-wrap gap-3">
            <select value={selectedAgencyId} onChange={(e) => setSelectedAgencyId(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none">
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={selectedCycleId} onChange={(e) => setSelectedCycleId(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none">
              <option value="all">Chọn đợt đánh giá</option>
              {allCycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
              onClick={() => setOnlyIncomplete(!onlyIncomplete)}
              className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${onlyIncomplete ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
           >
              <i className="fas fa-filter"></i>
              {onlyIncomplete ? 'Đang lọc: Chưa xong' : 'Lọc người chưa xong'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Tổng nhân sự</p>
            <h3 className="text-2xl font-black text-slate-900">{agencyStaff.length}</h3>
         </div>
         <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm">
            <p className="text-[8px] text-rose-400 font-black uppercase tracking-widest mb-1">Chưa hoàn thành</p>
            <h3 className="text-2xl font-black text-rose-600">{progressReport.filter(p => !p.isComplete).length}</h3>
         </div>
         <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
            <p className="text-[8px] text-emerald-400 font-black uppercase tracking-widest mb-1">Đã hoàn thành</p>
            <h3 className="text-2xl font-black text-emerald-600">{progressReport.filter(p => p.isComplete).length}</h3>
         </div>
         <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
            <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest mb-1">Tỉ lệ đơn vị</p>
            <h3 className="text-2xl font-black text-blue-600">
               {agencyStaff.length > 0 ? Math.round((progressReport.filter(p => p.isComplete).length / agencyStaff.length) * 100) : 0}%
            </h3>
         </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Nhân sự thực hiện</th>
                <th className="px-8 py-5 text-center">Tiến độ</th>
                <th className="px-8 py-5">Còn thiếu đánh giá ai?</th>
                <th className="px-8 py-5 text-right">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {progressReport.map((p, idx) => (
                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${p.percent === 0 ? 'bg-rose-50/30' : ''}`}>
                  <td className="px-8 py-6">
                    <div>
                      <p className="text-[11px] font-black text-slate-900 uppercase">{p.evaluator.name}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">{p.evaluator.position}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-[10px] font-black ${p.isComplete ? 'text-emerald-600' : p.percent < 30 ? 'text-rose-600 animate-pulse' : 'text-amber-600'}`}>
                        {p.percent}% ({p.doneCount}/{p.totalRequired})
                      </span>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden border border-slate-200">
                        <div className={`h-full transition-all duration-1000 ${p.isComplete ? 'bg-emerald-500' : p.percent < 30 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${p.percent}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {p.isComplete ? (
                      <span className="text-[9px] font-black text-emerald-600 uppercase italic">Đã xong hoàn tất</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.missingNames.slice(0, 3).map((name, i) => (
                          <span key={i} className="px-2 py-1 bg-white border border-rose-100 text-rose-600 rounded-lg text-[7px] font-black uppercase">
                            {name}
                          </span>
                        ))}
                        {p.missingNames.length > 3 && <span className="text-[7px] font-bold text-slate-400">+{p.missingNames.length - 3} người khác</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    {!p.isComplete && (
                      <button 
                        onClick={() => handleCopyReminder(p)}
                        className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all group"
                        title="Sao chép nội dung nhắc nhở"
                      >
                        <i className="fas fa-copy text-xs"></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {progressReport.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-[10px] font-black uppercase text-slate-300 tracking-widest">
                    Không có nhân sự nào cần đôn đốc trong danh sách này
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaderDashboard;
