
import React, { useState, useEffect, useMemo } from 'react';
import { User, Evaluation, PerformanceStats, EvaluationScores, EvaluationCycle, Agency, Criterion, RatingConfig } from '../types';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy } from 'firebase/firestore';

interface EmployeePortalProps { user: User; }

const EmployeePortal: React.FC<EmployeePortalProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'my-report'>('pending');
  const [evaluatingPeer, setEvaluatingPeer] = useState<User | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('all');
  const [filterAgencyId, setFilterAgencyId] = useState<string>('all');
  const [allPeers, setAllPeers] = useState<User[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [myEvaluations, setMyEvaluations] = useState<Evaluation[]>([]);
  const [allEvaluationsDone, setAllEvaluationsDone] = useState<Evaluation[]>([]);
  const [cycles, setCycles] = useState<EvaluationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [scores, setScores] = useState<EvaluationScores>({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedCrit, setExpandedCrit] = useState<string | null>(null);

  const getAvatarUrl = (u: Partial<User>) => {
    if (u.avatar && u.avatar.startsWith('data:image')) return u.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'CB')}&background=1e293b&color=f8fafc&bold=true&format=svg&size=128`;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [cyclesSnap, agenciesSnap] = await Promise.all([
          getDocs(collection(db, "cycles")),
          getDocs(collection(db, "agencies"))
        ]);
        
        const allCyclesData = cyclesSnap.docs.map(d => ({ id: d.id, ...d.data() } as EvaluationCycle));
        const filteredCycles = allCyclesData.filter(c => 
          c.targetAgencyIds?.includes('all') || c.targetAgencyIds?.includes(user.agencyId)
        );
        setCycles(filteredCycles);
        setAgencies(agenciesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agency)));

        const currentActive = filteredCycles.find(c => c.status === 'ACTIVE');
        if (currentActive) setSelectedCycleId(currentActive.id);
        else if (filteredCycles.length > 0) setSelectedCycleId(filteredCycles[0].id);

        setFilterAgencyId(user.agencyId);

        const peersSnap = await getDocs(query(collection(db, "users"), where("agencyId", "==", user.agencyId)));
        setAllPeers(peersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)).filter(p => p.id !== user.id));
        
        const evalSnap = await getDocs(query(collection(db, "evaluations"), where("evaluateeId", "==", user.id)));
        setMyEvaluations(evalSnap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation)));

        const allDoneSnap = await getDocs(query(collection(db, "evaluations"), where("evaluatorId", "==", user.id)));
        setAllEvaluationsDone(allDoneSnap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation)));

      } catch (error) { console.error("Lỗi nạp dữ liệu Cổng ĐG:", error); }
      setLoading(false);
    };
    fetchData();
  }, [user.id, user.agencyId]);

  const selectedCycle = useMemo(() => cycles.find(c => c.id === selectedCycleId), [cycles, selectedCycleId]);

  const cycleStatus = useMemo(() => {
    if (!selectedCycle) return { label: 'KHÔNG XÁC ĐỊNH', color: 'text-slate-400', isOpen: false, msg: '' };
    
    if (selectedCycle.status === 'PAUSED') 
      return { label: 'TẠM DỪNG', color: 'text-amber-600 bg-amber-50', isOpen: false, msg: 'Admin đã tạm dừng đợt này để bảo trì hoặc cập nhật.' };

    const now = new Date();
    const start = new Date(selectedCycle.startDate);
    const end = new Date(selectedCycle.endDate);
    end.setHours(23, 59, 59);

    if (selectedCycle.status === 'CLOSED' || now > end) 
      return { label: 'ĐÃ ĐÓNG', color: 'text-rose-600 bg-rose-50', isOpen: false, msg: 'Đợt đánh giá đã kết thúc.' };
    if (now < start) 
      return { label: 'SẮP DIỄN RA', color: 'text-amber-600 bg-amber-50', isOpen: false, msg: 'Vui lòng quay lại khi đến thời hạn.' };
    
    return { label: 'ĐANG MỞ', color: 'text-emerald-600 bg-emerald-50 border border-emerald-100', isOpen: true, msg: '' };
  }, [selectedCycle]);

  const stats = useMemo(() => {
    if (!selectedCycle || !selectedCycle.criteria) return null;
    const evs = myEvaluations.filter(e => e.cycleId === selectedCycleId);
    if (evs.length === 0) return null;
    const criteriaList = selectedCycle.criteria || [];
    const totals: EvaluationScores = {};
    criteriaList.forEach(c => totals[c.id] = 0);
    evs.forEach(e => criteriaList.forEach(c => totals[c.id] += (e.scores[c.id] || 0)));
    const count = evs.length;
    const avg: EvaluationScores = {};
    let sumOfAvgs = 0;
    criteriaList.forEach(c => {
      avg[c.id] = Number((totals[c.id] / count).toFixed(1));
      sumOfAvgs += avg[c.id];
    });
    const overall = Number((sumOfAvgs / (criteriaList.length || 1)).toFixed(1));
    const ratingRules = selectedCycle.ratings || [];
    const rating = ratingRules.find(r => overall >= r.minScore) || ratingRules[ratingRules.length - 1] || { label: 'CHƯA XẾP LOẠI', color: '#94a3b8' };
    return { averageScores: avg, overallAverage: overall, ratingLabel: rating.label, ratingColor: rating.color, totalEvaluations: count };
  }, [myEvaluations, selectedCycleId, selectedCycle]);

  const submitEvaluation = async () => {
    if (!cycleStatus.isOpen || !evaluatingPeer || !selectedCycle) return;
    setSubmitting(true);
    try {
      const payload = { 
        evaluatorId: user.id, evaluateeId: evaluatingPeer.id, cycleId: selectedCycleId, 
        scores, comment: '', timestamp: new Date().toISOString(), 
        agencyId: user.agencyId 
      };
      await addDoc(collection(db, "evaluations"), { ...payload, createdAt: serverTimestamp() });
      alert(`ĐÃ HOÀN THÀNH ĐÁNH GIÁ CHO ĐỒNG NGHIỆP: ${evaluatingPeer.name}`);
      setEvaluatingPeer(null);
      setScores({});
      setAllEvaluationsDone(prev => [...prev, payload as any]);
    } catch (error) { console.error(error); alert("CÓ LỖI XẢY RA!"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-[10px] md:text-xs font-black uppercase text-slate-400 tracking-widest">Đang đồng bộ cổng đánh giá...</div>;

  return (
    <div className="space-y-4 md:space-y-6 pb-20">
      <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
         <div className="z-10 w-full md:w-auto">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase">Cổng Đánh giá</h1>
            {selectedCycle ? (
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-3">
                 <div className="bg-slate-50 px-2 md:px-3 py-1 md:py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                    <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest">Đợt:</span>
                    <span className="text-[9px] md:text-[10px] font-black text-slate-800 uppercase truncate max-w-[120px] md:max-w-none">{selectedCycle.name}</span>
                 </div>
                 <div className={`px-2 md:px-3 py-1 md:py-1.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest ${cycleStatus.color}`}>
                    {cycleStatus.label}
                 </div>
              </div>
            ) : (
              <p className="text-slate-400 text-[8px] md:text-[9px] font-bold uppercase mt-2 italic">Vui lòng chọn đợt đánh giá</p>
            )}
         </div>
         <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0 z-10 w-full md:w-auto">
            <button onClick={() => setActiveTab('pending')} className={`flex-1 md:flex-none px-4 md:px-6 py-2 md:py-3 text-[9px] md:text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'pending' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>Đánh giá</button>
            <button onClick={() => setActiveTab('my-report')} className={`flex-1 md:flex-none px-4 md:px-6 py-2 md:py-3 text-[9px] md:text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'my-report' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>Kết quả</button>
         </div>
         <div className="absolute top-2 right-4 md:top-4 md:right-8 flex items-center gap-2 group cursor-pointer transition-all">
            <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)} className="bg-transparent text-[8px] md:text-[10px] font-black uppercase border-none focus:ring-0 text-slate-400 hover:text-slate-900 cursor-pointer p-0 pr-4">
               {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
         </div>
      </div>

      {activeTab === 'pending' ? (
        evaluatingPeer && selectedCycle ? (
          <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
               <div className="bg-slate-900 p-6 md:p-10 text-white flex flex-col md:flex-row items-center gap-6 justify-between text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center gap-4 md:gap-5 w-full md:w-auto">
                    <button onClick={() => setEvaluatingPeer(null)} className="absolute top-4 left-4 md:static w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 transition-all"><i className="fas fa-arrow-left"></i></button>
                    <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                      <img src={getAvatarUrl(evaluatingPeer)} className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2rem] object-cover border-2 border-white/10 shadow-lg" />
                      <div>
                        <h3 className="text-lg md:text-xl font-black uppercase leading-none mb-1 tracking-tight">{evaluatingPeer.name}</h3>
                        <p className="text-[9px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest">{evaluatingPeer.position} | {evaluatingPeer.department}</p>
                      </div>
                    </div>
                  </div>
               </div>

               <div className="p-4 md:p-10 space-y-6 md:space-y-10">
                  <div className={`space-y-6 md:space-y-8 ${!cycleStatus.isOpen ? 'opacity-40 pointer-events-none' : ''}`}>
                      <div className="grid grid-cols-1 gap-4 md:gap-6">
                         {(selectedCycle.criteria || []).map(c => (
                           <div key={c.id} className="group p-5 md:p-8 bg-slate-50 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 hover:bg-white hover:border-blue-100 transition-all hover:shadow-xl">
                              <div className="flex justify-between items-start mb-4 md:mb-6 gap-4">
                                 <div className="space-y-2 flex-1 min-w-0">
                                    <span className="text-[12px] md:text-[14px] font-black text-slate-900 uppercase tracking-wider block truncate">{c.name}</span>
                                    <button 
                                       onClick={() => setExpandedCrit(expandedCrit === c.id ? null : c.id)}
                                       className="text-[8px] md:text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                                    >
                                       <i className={`fas ${expandedCrit === c.id ? 'fa-minus-circle' : 'fa-info-circle'}`}></i>
                                       {expandedCrit === c.id ? 'Đóng chi tiết' : 'Xem chi tiết căn cứ'}
                                    </button>
                                    {expandedCrit === c.id && (
                                       <div className="mt-3 p-3 md:p-5 bg-white rounded-2xl border border-blue-50 text-[10px] md:text-[11px] font-medium leading-relaxed text-slate-600 animate-in slide-in-from-top-2">
                                          {c.description}
                                       </div>
                                    )}
                                 </div>
                                 <div className="w-14 h-14 md:w-20 md:h-20 bg-white rounded-[1rem] md:rounded-[1.5rem] flex items-center justify-center border-2 border-slate-100 shadow-lg shrink-0">
                                    <span className="text-2xl md:text-4xl font-black text-blue-600 tracking-tighter">{scores[c.id] || 50}</span>
                                 </div>
                              </div>
                              <div className="px-1 pt-2">
                                <input 
                                  type="range" 
                                  min="1" 
                                  max="100" 
                                  step="1"
                                  value={scores[c.id] || 50} 
                                  onChange={e => setScores({...scores, [c.id]: parseInt(e.target.value)})} 
                                  className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 transition-all" 
                                />
                                <div className="flex justify-between mt-3 px-1">
                                  {[10,30,50,70,90,100].map(v => (
                                    <span key={v} className={`text-[8px] md:text-[10px] font-black transition-all ${(scores[c.id] || 50) >= v - 10 && (scores[c.id] || 50) <= v + 10 ? 'text-blue-600 scale-125' : 'text-slate-300'}`}>{v}</span>
                                  ))}
                                </div>
                              </div>
                           </div>
                         ))}
                      </div>

                      <div className="pt-4 md:pt-6">
                         <button 
                            onClick={submitEvaluation} 
                            disabled={submitting || !cycleStatus.isOpen} 
                            className="w-full bg-blue-600 text-white py-5 md:py-7 rounded-[1.5rem] md:rounded-3xl font-black text-xs md:text-[14px] uppercase shadow-2xl shadow-blue-500/30 hover:bg-slate-900 transition-all disabled:opacity-50 tracking-[0.2em] md:tracking-[0.4em]"
                         >
                            {submitting ? <i className="fas fa-circle-notch animate-spin mr-3"></i> : <i className="fas fa-paper-plane mr-3"></i>}
                            GỬI ĐÁNH GIÁ Cán bộ
                         </button>
                         <p className="text-center mt-4 text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Dữ liệu không thể sửa sau khi gửi</p>
                      </div>
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
             {allPeers.map(peer => {
                const isDone = allEvaluationsDone.some(e => e.evaluateeId === peer.id && e.cycleId === selectedCycleId);
                return (
                  <div key={peer.id} className={`bg-white p-4 md:p-5 rounded-2xl md:rounded-[2rem] border shadow-sm flex items-center gap-3 md:gap-4 transition-all ${isDone ? 'bg-emerald-50/20 opacity-60' : 'hover:border-blue-200'}`}>
                      <img src={getAvatarUrl(peer)} className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl object-cover bg-slate-50" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-900 uppercase text-[10px] md:text-[11px] truncate">{peer.name}</h4>
                        <p className="text-[7px] md:text-[8px] text-slate-400 font-bold uppercase truncate">{peer.department}</p>
                      </div>
                      <button 
                        onClick={() => !isDone && cycleStatus.isOpen && setEvaluatingPeer(peer)} 
                        disabled={isDone || !cycleStatus.isOpen} 
                        className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all ${isDone ? 'text-emerald-500 bg-emerald-50' : !cycleStatus.isOpen ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 text-white hover:bg-slate-900 shadow-lg shadow-blue-500/20'}`}
                      >
                        <i className={`fas ${isDone ? 'fa-check' : 'fa-chevron-right'} text-xs`}></i>
                      </button>
                  </div>
                );
             })}
          </div>
        )
      ) : (
        <div className="space-y-4 md:space-y-6">
          {stats ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white p-8 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm text-center">
                 <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-900 rounded-2xl md:rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-2xl md:text-3xl font-black text-white">{stats.overallAverage}</div>
                 <h3 className="text-xs md:text-sm font-black uppercase mb-2">Xếp loại của tôi</h3>
                 <div className="inline-block px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase" style={{ backgroundColor: `${stats.ratingColor}15`, color: stats.ratingColor }}>{stats.ratingLabel}</div>
              </div>
              <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-200">
                 <h3 className="text-[9px] md:text-[10px] font-black text-slate-900 uppercase border-l-4 border-blue-600 pl-4 mb-4 md:mb-6">Chi tiết tiêu chí</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {(selectedCycle?.criteria || []).map(c => (
                      <div key={c.id} className="p-4 md:p-5 bg-slate-50 rounded-2xl flex items-center justify-between">
                         <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase truncate pr-2">{c.name}</span>
                         <span className="text-xs md:text-sm font-black text-slate-900">{stats.averageScores[c.id] || '0.0'}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          ) : (
            <div className="py-20 md:py-32 text-center bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-100">
               <p className="text-slate-400 font-black text-[9px] md:text-[10px] uppercase tracking-widest px-4 text-center">Chưa có dữ liệu thống kê cho đợt này</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeePortal;
