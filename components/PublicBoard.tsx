
import React, { useState, useEffect, useMemo } from 'react';
import { User, Evaluation, Agency, EvaluationCycle, Criterion, RatingConfig } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

interface PublicBoardProps { user: User; }

const PublicBoard: React.FC<PublicBoardProps> = ({ user }) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([]);
  const [allCycles, setAllCycles] = useState<EvaluationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  
  const [selectedCycleId, setSelectedCycleId] = useState<string>('all');
  const [selectedAgency, setSelectedAgency] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getAvatarUrl = (u: Partial<User>) => {
    if (u.avatar && u.avatar.startsWith('data:image')) return u.avatar;
    const name = u.name || 'CB';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=fff&bold=true&size=128`;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [userSnap, agencySnap, evalSnap, cycleSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "agencies")),
          getDocs(collection(db, "evaluations")),
          getDocs(collection(db, "cycles"))
        ]);
        
        setAllUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
        setAllAgencies(agencySnap.docs.map(d => ({ id: d.id, ...d.data() } as Agency)));
        setAllEvaluations(evalSnap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation)));
        
        const cyclesData = cycleSnap.docs.map(d => ({ id: d.id, ...d.data() } as EvaluationCycle));
        setAllCycles(cyclesData);

        const activeCycle = cyclesData.find(d => d.status === 'ACTIVE');
        if (activeCycle) setSelectedCycleId(activeCycle.id);
        else if (cyclesData.length > 0) setSelectedCycleId(cyclesData[0].id);
      } catch (error) { console.error(error); }
      setLoading(false);
    };
    fetchData();
  }, []);

  const selectedCycle = useMemo(() => allCycles.find(c => c.id === selectedCycleId), [allCycles, selectedCycleId]);

  const getStaffStats = (userId: string) => {
    if (!selectedCycle) return { avg: 0, ratingLabel: '--', ratingColor: '#94a3b8', radarData: [] };
    
    const evs = allEvaluations.filter(e => e.evaluateeId === userId && e.cycleId === selectedCycleId);
    const criteria = selectedCycle.criteria || [];
    const ratings = selectedCycle.ratings || [];

    if (evs.length === 0 || criteria.length === 0) return { avg: 0, ratingLabel: 'CHƯA ĐG', ratingColor: '#94a3b8', radarData: [] };
    
    let sumOfAvgs = 0;
    const radarData = criteria.map(c => {
      const sum = evs.reduce((acc, curr) => acc + (curr.scores[c.id] || 0), 0);
      const avg = Number((sum / evs.length).toFixed(1));
      sumOfAvgs += avg;
      return { subject: c.name, A: avg, fullMark: 100 };
    });

    const overall = Number((sumOfAvgs / (criteria.length || 1)).toFixed(1));
    const rating = ratings.find(r => overall >= r.minScore) || ratings[ratings.length - 1] || { label: 'CHƯA XẾP LOẠI', color: '#94a3b8' };

    return { avg: overall, ratingLabel: rating.label, ratingColor: rating.color, radarData, totalEvs: evs.length };
  };

  const filteredStaff = useMemo(() => {
    if (!selectedCycle) return [];
    return allUsers.filter(s => {
      const matchAgency = selectedAgency === 'all' || s.agencyId === selectedAgency;
      const matchSearch = s.name.toUpperCase().includes(searchTerm.toUpperCase());
      const inTargetAgencies = (selectedCycle.targetAgencyIds || []).includes('all') || (selectedCycle.targetAgencyIds || []).includes(s.agencyId);
      return s.role === 'EMPLOYEE' && matchAgency && matchSearch && inTargetAgencies;
    }).map(s => ({ ...s, stats: getStaffStats(s.id) }));
  }, [allUsers, selectedAgency, searchTerm, allEvaluations, selectedCycleId, selectedCycle]);

  const selectedStaff = useMemo(() => {
    if (!selectedStaffId) return null;
    return filteredStaff.find(s => s.id === selectedStaffId);
  }, [filteredStaff, selectedStaffId]);

  if (loading) return (
    <div className="p-20 text-center animate-pulse">
      <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <i className="fas fa-chart-line animate-bounce text-blue-600"></i>
      </div>
      <p className="text-[10px] md:text-xs font-black uppercase text-slate-400 tracking-widest">Đang tổng hợp Bảng Danh Vọng...</p>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6 pb-24 animate-fade-in">
      {/* Modal Chi tiết Cán bộ */}
      {selectedStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedStaffId(null)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-8 text-white relative shrink-0">
               <button onClick={() => setSelectedStaffId(null)} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 transition-all active:scale-90"><i className="fas fa-times"></i></button>
               <div className="flex items-center gap-6">
                  <img src={getAvatarUrl(selectedStaff)} className="w-20 h-20 rounded-3xl object-cover border-4 border-white/10 shadow-lg" alt="" />
                  <div>
                     <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">{selectedStaff.name}</h3>
                     <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{selectedStaff.position} | {selectedStaff.department}</p>
                     <p className="text-[8px] text-white/40 font-bold uppercase mt-2">{allAgencies.find(a => a.id === selectedStaff.agencyId)?.name}</p>
                  </div>
               </div>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
               <div className="grid grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-center">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Điểm trung bình</p>
                     <h4 className="text-4xl font-black text-slate-900 leading-none">{selectedStaff.stats.avg}</h4>
                     <p className="text-[7px] text-slate-400 font-bold uppercase mt-2">Dựa trên {selectedStaff.stats.totalEvs} đánh giá</p>
                  </div>
                  <div className="p-6 rounded-[2rem] border flex flex-col items-center justify-center text-center" style={{ backgroundColor: `${selectedStaff.stats.ratingColor}10`, borderColor: `${selectedStaff.stats.ratingColor}20` }}>
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Xếp loại hiện tại</p>
                     <h4 className="text-sm font-black uppercase leading-tight" style={{ color: selectedStaff.stats.ratingColor }}>{selectedStaff.stats.ratingLabel}</h4>
                  </div>
               </div>

               <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm h-[300px]">
                  <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Biểu đồ năng lực đa chiều</h5>
                  <ResponsiveContainer width="100%" height="90%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={selectedStaff.stats.radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 7 }} />
                      <Radar name={selectedStaff.name} dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.5} />
                    </RadarChart>
                  </ResponsiveContainer>
               </div>

               <div className="space-y-3">
                  <h5 className="text-[9px] font-black text-slate-900 uppercase border-l-4 border-blue-600 pl-3 tracking-widest">Chi tiết từng tiêu chí</h5>
                  <div className="grid grid-cols-1 gap-2">
                     {selectedStaff.stats.radarData.map((d: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-blue-100 transition-all">
                           <span className="text-[9px] font-black text-slate-500 uppercase">{d.subject}</span>
                           <div className="flex items-center gap-3">
                              <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                 <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${d.A}%` }}></div>
                              </div>
                              <span className="text-[11px] font-black text-slate-900">{d.A}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
               <button onClick={() => setSelectedStaffId(null)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-blue-600 transition-all">Đóng thông tin</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Bảng Danh Vọng</h1>
          <p className="text-slate-400 font-medium text-[9px] md:text-[11px] uppercase tracking-wider mt-1">Vinh danh cán bộ xuất sắc</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3 justify-center md:justify-end">
           <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-[9px] md:text-[10px] font-black uppercase shadow-sm outline-none cursor-pointer flex-1 md:flex-none transition-all hover:border-blue-400">
             {allCycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
           </select>
           <select value={selectedAgency} onChange={e => setSelectedAgency(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-[9px] md:text-[10px] font-black uppercase shadow-sm outline-none cursor-pointer flex-1 md:flex-none transition-all hover:border-blue-400">
             <option value="all">TẤT CẢ CƠ QUAN</option>
             {allAgencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
           </select>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-fade-in-up">
         <div className="p-4 md:p-6 border-b border-slate-50 bg-slate-50/20">
            <div className="relative w-full group">
               <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs transition-colors group-focus-within:text-blue-500"></i>
               <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 md:py-3 text-[9px] md:text-[10px] font-black uppercase outline-none focus:border-blue-400 focus:shadow-lg focus:shadow-blue-500/5 transition-all" placeholder="TÌM KIẾM THEO TÊN CÁN BỘ..." />
            </div>
         </div>
         <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left min-w-[600px]">
               <thead className="bg-slate-900 text-white text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] sticky top-0 z-10">
                  <tr>
                     <th className="px-6 md:px-8 py-4 md:py-6">Hạng</th>
                     <th className="px-6 md:px-8 py-4 md:py-6">Thông tin Cán bộ</th>
                     <th className="px-4 md:px-5 py-4 md:py-6 text-center">Điểm số</th>
                     <th className="px-4 md:px-5 py-4 md:py-6 text-center">Xếp loại</th>
                     <th className="px-6 md:px-8 py-4 md:py-6 text-right">Chi tiết</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredStaff.sort((a, b) => b.stats.avg - a.stats.avg).map((staff, idx) => (
                    <tr key={staff.id} className="hover:bg-slate-50 transition-all group cursor-pointer" onClick={() => setSelectedStaffId(staff.id)}>
                       <td className="px-6 md:px-8 py-4 md:py-6">
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-xs md:text-sm font-black transition-all ${idx === 0 ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-500/20' : idx === 1 ? 'bg-slate-100 text-slate-600' : idx === 2 ? 'bg-orange-50 text-orange-600' : 'text-slate-400'}`}>
                             {idx + 1}
                          </div>
                       </td>
                       <td className="px-6 md:px-8 py-4 md:py-6">
                          <div className="flex items-center gap-3 md:gap-4">
                             <img src={getAvatarUrl(staff)} className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl object-cover border border-slate-200 shadow-sm" />
                             <div className="min-w-0">
                                <p className="text-[10px] md:text-[12px] font-black text-slate-900 uppercase truncate max-w-[120px] md:max-w-[200px] leading-tight group-hover:text-blue-600 transition-colors">{staff.name}</p>
                                <p className="text-[7px] md:text-[8px] text-slate-400 font-bold uppercase truncate">{staff.department}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-4 md:px-5 py-4 md:py-6 text-center">
                          <span className="text-base md:text-xl font-black text-slate-900 group-hover:scale-110 inline-block transition-transform">{staff.stats.avg}</span>
                       </td>
                       <td className="px-4 md:px-5 py-4 md:py-6 text-center">
                          <div className="inline-flex px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl text-[7px] md:text-[8px] font-black uppercase tracking-widest border transition-all group-hover:shadow-md" style={{ backgroundColor: `${staff.stats.ratingColor}15`, color: staff.stats.ratingColor, borderColor: `${staff.stats.ratingColor}30` }}>
                             {staff.stats.ratingLabel}
                          </div>
                       </td>
                       <td className="px-6 md:px-8 py-4 md:py-6 text-right">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedStaffId(staff.id); }} 
                            className="w-8 h-8 md:w-10 md:h-10 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm group-hover:translate-x-1"
                          >
                             <i className="fas fa-chevron-right text-[10px]"></i>
                          </button>
                       </td>
                    </tr>
                  ))}
                  {filteredStaff.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-200"><i className="fas fa-users-slash text-xl"></i></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Không tìm thấy cán bộ phù hợp</p>
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

export default PublicBoard;
