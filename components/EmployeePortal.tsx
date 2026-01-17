
import React, { useState, useEffect, useMemo } from 'react';
import { User, Evaluation, PerformanceStats, EvaluationCriteria, EvaluationCycle, Agency } from '../types';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';

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
  const [scores, setScores] = useState<EvaluationCriteria>({ professionalism: 5, productivity: 5, collaboration: 5, innovation: 5, discipline: 5 });
  const [submitting, setSubmitting] = useState(false);

  // Avatar mặc định phong cách công sở chuyên nghiệp
  const getAvatarUrl = (u: Partial<User>) => {
    if (u.avatar && u.avatar.startsWith('data:image')) return u.avatar;
    const name = u.name || 'CB';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=f8fafc&bold=true&format=svg&size=128`;
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
        
        const agenciesData = agenciesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agency));
        setAgencies(agenciesData);
        
        const currentActive = filteredCycles.find(c => c.status === 'ACTIVE');
        if (currentActive) setSelectedCycleId(currentActive.id);
        else setSelectedCycleId('all');

        setFilterAgencyId(user.agencyId);

        const peersQuery = query(collection(db, "users"), where("role", "==", "EMPLOYEE"));
        const peersSnap = await getDocs(peersQuery);
        setAllPeers(peersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)).filter(p => p.id !== user.id));
        
        const evalQuery = query(collection(db, "evaluations"), where("evaluateeId", "==", user.id));
        const evalSnap = await getDocs(evalQuery);
        setMyEvaluations(evalSnap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation)));

        const allDoneSnap = await getDocs(query(collection(db, "evaluations"), where("evaluatorId", "==", user.id)));
        setAllEvaluationsDone(allDoneSnap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation)));

      } catch (error) { console.error("Lỗi nạp dữ liệu:", error); }
      setLoading(false);
    };
    fetchData();
  }, [user.id, user.agencyId]);

  const selectedCycle = useMemo(() => cycles.find(c => c.id === selectedCycleId), [cycles, selectedCycleId]);

  const cycleTimeStatus = useMemo(() => {
    if (!selectedCycle) return 'NONE';
    const now = new Date();
    const start = new Date(selectedCycle.startDate);
    const end = new Date(selectedCycle.endDate);
    end.setHours(23, 59, 59, 999); // Tính đến cuối ngày kết thúc

    if (now < start) return 'UPCOMING';
    if (now > end) return 'EXPIRED';
    return 'OPEN';
  }, [selectedCycle]);

  const filteredPeers = useMemo(() => {
    if (filterAgencyId === 'all') return allPeers;
    return allPeers.filter(p => p.agencyId === filterAgencyId);
  }, [allPeers, filterAgencyId]);

  const filteredMyEvaluations = useMemo(() => {
    if (selectedCycleId === 'all') return myEvaluations;
    return myEvaluations.filter(e => e.cycleId === selectedCycleId);
  }, [myEvaluations, selectedCycleId]);

  const stats = useMemo(() => {
    if (filteredMyEvaluations.length === 0) return null;
    const totals = filteredMyEvaluations.reduce((acc, curr) => ({
      professionalism: acc.professionalism + curr.scores.professionalism, 
      productivity: acc.productivity + curr.scores.productivity,
      collaboration: acc.collaboration + curr.scores.collaboration, 
      innovation: acc.innovation + curr.scores.innovation, 
      discipline: acc.discipline + curr.scores.discipline,
    }), { professionalism: 0, productivity: 0, collaboration: 0, innovation: 0, discipline: 0 });
    const count = filteredMyEvaluations.length;
    const avg = { professionalism: totals.professionalism / count, productivity: totals.productivity / count, collaboration: totals.collaboration / count, innovation: totals.innovation / count, discipline: totals.discipline / count };
    const overall = (avg.professionalism + avg.productivity + avg.collaboration + avg.innovation + avg.discipline) / 5;
    let rating: PerformanceStats['rating'] = 'Trung bình';
    if (overall >= 9) rating = 'Xuất sắc'; else if (overall >= 8) rating = 'Tốt'; else if (overall >= 6.5) rating = 'Khá';
    return { averageScores: avg, overallAverage: Number(overall.toFixed(1)), rating, totalEvaluations: count };
  }, [filteredMyEvaluations]);

  const submitEvaluation = async () => {
    if (cycleTimeStatus !== 'OPEN') {
      alert("ĐỢT ĐÁNH GIÁ ĐANG KHÓA HOẶC NGOÀI THỜI GIAN QUY ĐỊNH!");
      return;
    }
    if (!evaluatingPeer || !selectedCycleId || selectedCycleId === 'all') {
      alert("VUI LÒNG CHỌN ĐỢT ĐÁNH GIÁ HỢP LỆ!");
      return;
    }

    setSubmitting(true);
    try {
      const evaluationPayload = { 
        evaluatorId: user.id, 
        evaluateeId: evaluatingPeer.id, 
        cycleId: selectedCycleId, 
        scores, 
        comment: comment.toUpperCase(), 
        timestamp: new Date().toISOString(), 
        createdAt: serverTimestamp(), 
        agencyId: user.agencyId 
      };
      
      const docRef = await addDoc(collection(db, "evaluations"), evaluationPayload);
      setAllEvaluationsDone(prev => [...prev, { id: docRef.id, ...evaluationPayload } as Evaluation]);
      
      alert(`ĐÃ LƯU ĐÁNH GIÁ CHO ${evaluatingPeer.name.toUpperCase()}!`);
      setEvaluatingPeer(null); 
      setComment('');
      setScores({ professionalism: 5, productivity: 5, collaboration: 5, innovation: 5, discipline: 5 });
    } catch (error) { console.error("Lỗi gửi đánh giá:", error); alert("LỖI KẾT NỐI HỆ THỐNG!"); }
    finally { setSubmitting(false); }
  };

  const isAlreadyEvaluated = (peerId: string) => {
    if (selectedCycleId === 'all') return false;
    return allEvaluationsDone.some(e => e.evaluateeId === peerId && e.cycleId === selectedCycleId);
  };

  if (loading) return (
    <div className="p-20 text-center animate-pulse">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đang đồng bộ dữ liệu cán bộ...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Cổng Đánh giá Nhân sự</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Lọc đợt đánh giá dành riêng cho đơn vị của bạn</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
             <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm min-w-[220px]">
                <i className={`fas ${cycleTimeStatus === 'OPEN' ? 'fa-calendar-check text-emerald-500' : 'fa-calendar-times text-rose-500'} text-xs`}></i>
                <div className="flex flex-col flex-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Đợt đánh giá</span>
                  <select 
                    value={selectedCycleId} 
                    onChange={(e) => setSelectedCycleId(e.target.value)}
                    className="bg-transparent border-none p-0 text-[11px] font-black uppercase text-slate-900 focus:ring-0 cursor-pointer w-full"
                  >
                    <option value="all">TẤT CẢ CÁC ĐỢT</option>
                    {cycles.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.status === 'ACTIVE' ? '(ĐANG MỞ)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
             </div>

             <div className="flex bg-slate-200/50 p-1 rounded-2xl border border-slate-100">
                <button onClick={() => setActiveTab('pending')} className={`px-5 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Đánh giá</button>
                <button onClick={() => setActiveTab('my-report')} className={`px-5 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'my-report' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Báo cáo</button>
             </div>
          </div>
        </div>

        {/* Thông báo thời hạn */}
        {selectedCycle && (
          <div className={`px-6 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center justify-between ${
            cycleTimeStatus === 'OPEN' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
            cycleTimeStatus === 'UPCOMING' ? 'bg-amber-50 border-amber-100 text-amber-600' :
            'bg-rose-50 border-rose-100 text-rose-600'
          }`}>
             <div className="flex items-center gap-2">
                <i className="fas fa-clock"></i>
                <span>Thời hạn: {selectedCycle.startDate} ĐẾN {selectedCycle.endDate}</span>
             </div>
             <span>
               {cycleTimeStatus === 'OPEN' ? 'HỆ THỐNG ĐANG MỞ' : 
                cycleTimeStatus === 'UPCOMING' ? 'CHƯA TỚI GIỜ ĐÁNH GIÁ' : 'ĐÃ HẾT HẠN ĐÁNH GIÁ'}
             </span>
          </div>
        )}
      </div>

      {activeTab === 'pending' ? (
        evaluatingPeer ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <button onClick={() => setEvaluatingPeer(null)} className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-2xl hover:bg-white/20 transition-all active:scale-90"><i className="fas fa-arrow-left"></i></button>
                  <div className="flex items-center gap-4">
                    <img src={getAvatarUrl(evaluatingPeer)} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/10 shadow-lg" alt="" />
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-1">{evaluatingPeer.name}</h3>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{evaluatingPeer.position} | {evaluatingPeer.department}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 md:p-12 space-y-12">
                {selectedCycleId === 'all' || cycleTimeStatus !== 'OPEN' ? (
                  <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center gap-4">
                    <i className="fas fa-lock text-3xl text-slate-300"></i>
                    <p className="text-slate-600 font-black uppercase text-xs">
                      {cycleTimeStatus === 'UPCOMING' ? 'ĐỢT ĐÁNH GIÁ CHƯA BẮT ĐẦU. VUI LÒNG QUAY LẠI SAU.' : 
                       cycleTimeStatus === 'EXPIRED' ? 'ĐỢT ĐÁNH GIÁ ĐÃ KẾT THÚC THỜI HẠN QUY ĐỊNH.' :
                       'VUI LÒNG CHỌN MỘT ĐỢT ĐÁNH GIÁ HỢP LỆ ĐỂ BẮT ĐẦU.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="space-y-8">
                      {[
                        { key: 'professionalism', label: 'Năng lực Chuyên môn' },
                        { key: 'productivity', label: 'Hiệu quả & Khối lượng' },
                        { key: 'collaboration', label: 'Tinh thần Hợp tác' },
                        { key: 'innovation', label: 'Sáng kiến & Cải tiến' },
                        { key: 'discipline', label: 'Kỷ luật & Tác phong' }
                      ].map((item) => (
                        <div key={item.key} className="space-y-4">
                          <div className="flex justify-between items-end">
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                            <span className="text-2xl font-black text-blue-600">{scores[item.key as keyof EvaluationCriteria]}</span>
                          </div>
                          <input 
                            type="range" min="1" max="10" 
                            value={scores[item.key as keyof EvaluationCriteria]} 
                            onChange={(e) => setScores({...scores, [item.key]: parseInt(e.target.value)})} 
                            className="w-full h-2.5 bg-slate-100 rounded-full appearance-none accent-blue-600 cursor-pointer shadow-inner" 
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-5">
                      <textarea 
                        rows={9} 
                        value={comment} 
                        onChange={(e) => setComment(e.target.value)} 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 font-bold text-sm outline-none focus:border-blue-500 focus:bg-white transition-all uppercase placeholder:text-slate-300 shadow-inner" 
                        placeholder="Góp ý chân thành để đồng nghiệp cùng tiến bộ..." 
                      />
                      <button 
                        onClick={submitEvaluation} 
                        disabled={submitting || cycleTimeStatus !== 'OPEN'} 
                        className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-blue-600/20 hover:bg-slate-900 transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {submitting ? 'ĐANG LƯU...' : 'Gửi đánh giá'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm max-w-md">
              <i className="fas fa-filter text-slate-400 text-xs"></i>
              <div className="flex flex-col flex-1">
                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1 tracking-widest">Lọc theo cơ quan</span>
                <select 
                  value={filterAgencyId} 
                  onChange={(e) => setFilterAgencyId(e.target.value)}
                  className="bg-transparent border-none p-0 text-[11px] font-black uppercase text-slate-900 focus:ring-0 cursor-pointer"
                >
                  <option value="all">TẤT CẢ CƠ QUAN</option>
                  {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {filteredPeers.map(peer => {
                const alreadyDone = isAlreadyEvaluated(peer.id);
                const isSameAgency = peer.agencyId === user.agencyId;
                const canEvaluate = isSameAgency && cycleTimeStatus === 'OPEN' && !alreadyDone;
                
                return (
                  <div 
                    key={peer.id} 
                    className={`group relative bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4 transition-all ${alreadyDone ? 'bg-emerald-50/20 border-emerald-100' : 'hover:shadow-xl hover:border-blue-200'}`}
                  >
                    <div className="shrink-0 relative">
                      <img src={getAvatarUrl(peer)} className="w-16 h-16 rounded-2xl object-cover shadow-md border-2 border-white transition-all group-hover:scale-110" alt={peer.name} />
                      {alreadyDone && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-lg border-2 border-white">
                          <i className="fas fa-check"></i>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-900 uppercase text-[11px] truncate mb-0.5 leading-none">{peer.name}</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">{peer.department}</p>
                    </div>

                    <div className="shrink-0">
                      {isSameAgency ? (
                        <button 
                          onClick={() => canEvaluate && setEvaluatingPeer(peer)}
                          disabled={!canEvaluate}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${alreadyDone ? 'bg-emerald-50 text-emerald-500' : (!canEvaluate ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-slate-900 shadow-lg shadow-blue-500/20')}`}
                        >
                          <i className={`fas ${alreadyDone ? 'fa-check-double' : (cycleTimeStatus === 'OPEN' ? 'fa-chevron-right' : 'fa-lock')}`}></i>
                        </button>
                      ) : (
                        <div className="w-10 h-10 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center border border-slate-100 opacity-60">
                          <i className="fas fa-lock text-[10px]"></i>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          {stats ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center group hover:border-blue-200 transition-all">
                <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mb-6 text-4xl font-black shadow-inner group-hover:scale-110 transition-transform">{stats.overallAverage}</div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Xếp loại: <span className="text-blue-600">{stats.rating}</span></h3>
              </div>
              <div className="lg:col-span-2 bg-white p-8 md:p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-8 border-l-4 border-blue-600 pl-4">Góp ý từ đồng nghiệp</h3>
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-3 custom-scrollbar">
                  {filteredMyEvaluations.map(e => (
                    <div key={e.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:border-blue-100 transition-all">
                      <p className="text-slate-700 text-xs font-bold leading-relaxed italic uppercase">"{e.comment || 'KHÔNG CÓ NHẬN XÉT CỤ THỂ'}"</p>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50">
                        <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Chu kỳ: {cycles.find(c => c.id === e.cycleId)?.name || 'HỆ THỐNG'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-24 rounded-[4rem] border-2 border-dashed border-slate-200 text-center">
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">Chưa có dữ liệu đánh giá trong đợt này</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeePortal;
