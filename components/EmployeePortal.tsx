
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
  
  const [comment, setComment] = useState('');
  const [scores, setScores] = useState<EvaluationScores>({});
  const [submitting, setSubmitting] = useState(false);

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
        scores, comment: comment.toUpperCase(), timestamp: new Date().toISOString(), 
        agencyId: user.agencyId 
      };
      await addDoc(collection(db, "evaluations"), { ...payload, createdAt: serverTimestamp() });
      alert(`ĐÃ HOÀN THÀNH ĐÁNH GIÁ CHO ĐỒNG NGHIỆP: ${evaluatingPeer.name}`);
      setEvaluatingPeer(null);
      setComment('');
      setScores({});
      setAllEvaluationsDone(prev => [...prev, payload as any]);
    } catch (error) { console.error(error); alert("CÓ LỖI XẢY RA!"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-[10px] font-black uppercase text-slate-400">Đang đồng bộ cổng đánh giá...</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
         <div className="z-10">
            <h1 className="text-2xl font-black text-slate-900 uppercase">Cổng Đánh giá</h1>
            {selectedCycle ? (
              <div className="flex flex-wrap items-center gap-3 mt-3">
                 <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Đợt:</span>
                    <span className="text-[10px] font-black text-slate-800 uppercase">{selectedCycle.name}</span>
                 </div>
                 <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${cycleStatus.color}`}>
                    {cycleStatus.label}
                 </div>
                 {!cycleStatus.isOpen && (
                   <span className="text-[8px] font-bold text-rose-500 uppercase tracking-tighter italic">{cycleStatus.msg || 'Hệ thống đang tạm khóa'}</span>
                 )}
              </div>
            ) : (
              <p className="text-slate-400 text-[9px] font-bold uppercase mt-2 italic">Vui lòng chọn đợt đánh giá từ danh sách</p>
            )}
         </div>
         <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0 z-10">
            <button onClick={() => setActiveTab('pending')} className={`px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'pending' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>Đánh giá</button>
            <button onClick={() => setActiveTab('my-report')} className={`px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'my-report' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>Kết quả</button>
         </div>
         <div className="absolute top-4 right-8 flex items-center gap-2 group cursor-pointer transition-all">
            <i className="fas fa-history text-[10px] text-slate-300 group-hover:text-blue-500 transition-colors"></i>
            <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)} className="bg-transparent text-[10px] font-black uppercase border-none focus:ring-0 text-slate-400 hover:text-slate-900 cursor-pointer p-0 pr-6">
               {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
         </div>
      </div>

      {activeTab === 'pending' ? (
        evaluatingPeer && selectedCycle ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden">
             <div className="bg-slate-900 p-8 text-white flex items-center gap-5">
                <button onClick={() => setEvaluatingPeer(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl"><i className="fas fa-arrow-left"></i></button>
                <div className="flex items-center gap-4">
                  <img src={getAvatarUrl(evaluatingPeer)} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/10" />
                  <div>
                    <h3 className="text-lg font-black uppercase leading-none mb-1">{evaluatingPeer.name}</h3>
                    <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">{evaluatingPeer.position} | {evaluatingPeer.department}</p>
                  </div>
                </div>
             </div>
             <div className="p-8 md:p-12">
                {!cycleStatus.isOpen && (
                  <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl mb-10 text-center">
                    <p className="text-rose-600 font-black text-xs uppercase tracking-widest animate-pulse">{cycleStatus.msg}</p>
                  </div>
                )}
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 ${!cycleStatus.isOpen ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="space-y-6">
                       {(selectedCycle.criteria || []).map(c => (
                         <div key={c.id} className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex justify-between items-end">
                               <span className="text-[10px] font-black text-slate-500 uppercase">{c.name}</span>
                               <span className="text-2xl font-black text-blue-600">{scores[c.id] || 5}</span>
                            </div>
                            <input type="range" min="1" max="10" value={scores[c.id] || 5} onChange={e => setScores({...scores, [c.id]: parseInt(e.target.value)})} className="w-full accent-blue-600" />
                         </div>
                       ))}
                    </div>
                    <div className="space-y-4">
                       <label className="text-[9px] font-black text-slate-400 uppercase">Nhận xét</label>
                       <textarea rows={6} value={comment} onChange={e => setComment(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] p-6 text-xs uppercase focus:bg-white outline-none" placeholder="..." />
                       <button onClick={submitEvaluation} disabled={submitting || !cycleStatus.isOpen} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-[10px] uppercase shadow-xl hover:bg-slate-900 transition-all disabled:opacity-50">
                          GỬI ĐÁNH GIÁ
                       </button>
                    </div>
                </div>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
             {allPeers.map(peer => {
                const isDone = allEvaluationsDone.some(e => e.evaluateeId === peer.id && e.cycleId === selectedCycleId);
                return (
                  <div key={peer.id} className={`bg-white p-5 rounded-[2rem] border shadow-sm flex items-center gap-4 transition-all ${isDone ? 'bg-emerald-50/20 opacity-60' : 'hover:border-blue-200'}`}>
                      <img src={getAvatarUrl(peer)} className="w-14 h-14 rounded-2xl object-cover bg-slate-50" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-900 uppercase text-[11px] truncate">{peer.name}</h4>
                        <p className="text-[8px] text-slate-400 font-bold uppercase truncate">{peer.department}</p>
                      </div>
                      <button 
                        onClick={() => !isDone && cycleStatus.isOpen && setEvaluatingPeer(peer)} 
                        disabled={isDone || !cycleStatus.isOpen} 
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDone ? 'text-emerald-500 bg-emerald-50' : !cycleStatus.isOpen ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 text-white hover:bg-slate-900 shadow-lg shadow-blue-500/20'}`}
                      >
                        <i className={`fas ${isDone ? 'fa-check' : 'fa-chevron-right'}`}></i>
                      </button>
                  </div>
                );
             })}
          </div>
        )
      ) : (
        <div className="space-y-6">
          {stats ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm text-center">
                 <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-3xl font-black text-white">{stats.overallAverage}</div>
                 <h3 className="text-sm font-black uppercase mb-2">Xếp loại của tôi</h3>
                 <div className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase" style={{ backgroundColor: `${stats.ratingColor}15`, color: stats.ratingColor }}>{stats.ratingLabel}</div>
              </div>
              <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-200">
                 <h3 className="text-[10px] font-black text-slate-900 uppercase border-l-4 border-blue-600 pl-4 mb-6">Chi tiết tiêu chí</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(selectedCycle?.criteria || []).map(c => (
                      <div key={c.id} className="p-5 bg-slate-50 rounded-2xl flex items-center justify-between">
                         <span className="text-[9px] font-black text-slate-500 uppercase">{c.name}</span>
                         <span className="text-sm font-black text-slate-900">{stats.averageScores[c.id] || '0.0'}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          ) : (
            <div className="py-32 text-center bg-white rounded-[3rem] border border-slate-100">
               <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Chưa có dữ liệu cho đợt này</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeePortal;
