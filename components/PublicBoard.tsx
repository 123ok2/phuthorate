
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
    return u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'CB')}&background=1e293b&color=fff&bold=true`;
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
      return { subject: c.name, A: avg };
    });

    const overall = Number((sumOfAvgs / criteria.length).toFixed(1));
    const rating = ratings.find(r => overall >= r.minScore) || ratings[ratings.length - 1] || { label: 'CHƯA XẾP LOẠI', color: '#94a3b8' };

    return { avg: overall, ratingLabel: rating.label, ratingColor: rating.color, radarData };
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

  const ratingChartData = useMemo(() => {
    if (!selectedCycle) return [];
    return (selectedCycle.ratings || []).map(r => ({
      name: r.label,
      value: filteredStaff.filter(s => s.stats.ratingLabel === r.label).length,
      color: r.color
    }));
  }, [filteredStaff, selectedCycle]);

  const handleExportRankingsExcel = () => {
    if (filteredStaff.length === 0) return alert("KHÔNG CÓ DỮ LIỆU ĐỂ XUẤT");
    
    const cycleName = selectedCycle?.name || 'HỆ THỐNG';
    const exportDate = new Date().toLocaleString('vi-VN');
    const scope = selectedAgency === 'all' ? 'Toàn hệ thống' : (allAgencies.find(a => a.id === selectedAgency)?.name || 'Cơ quan riêng lẻ');

    const styles = `
      <style>
        .report-header { font-size: 20pt; font-weight: bold; text-align: center; color: #1e3a8a; }
        .sub-header { font-size: 11pt; text-align: center; color: #475569; }
        table { border-collapse: collapse; width: 100%; margin-top: 20pt; }
        th { background-color: #1e293b; color: #ffffff; border: 1pt solid #334155; padding: 10pt; text-transform: uppercase; font-size: 9pt; }
        td { border: 1pt solid #e2e8f0; padding: 8pt; font-size: 10pt; }
        .rank-top { background-color: #fefce8; font-weight: bold; color: #854d0e; }
        .rank-normal { background-color: #ffffff; }
        .score-cell { font-weight: bold; color: #1d4ed8; text-align: center; }
        .rating-cell { font-weight: bold; text-align: center; color: #ffffff; }
        .center { text-align: center; }
      </style>
    `;

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8" />${styles}</head>
      <body>
        <table>
          <tr><td colspan="7" class="report-header">BẢNG DANH VỌNG CÁN BỘ - PHÚ THỌ RATE</td></tr>
          <tr><td colspan="7" class="sub-header">Đợt đánh giá: ${cycleName} | Phạm vi: ${scope}</td></tr>
          <tr><td colspan="7" class="center">Ngày trích xuất: ${exportDate}</td></tr>
          <tr><td colspan="7"></td></tr>
          <thead>
            <tr>
              <th>THỨ HẠNG</th>
              <th>HỌ VÀ TÊN</th>
              <th>ĐƠN VỊ CÔNG TÁC</th>
              <th>CHỨC VỤ</th>
              <th>PHÒNG BAN</th>
              <th>ĐIỂM TRUNG BÌNH</th>
              <th>XẾP LOẠI</th>
            </tr>
          </thead>
          <tbody>
            ${filteredStaff.sort((a, b) => b.stats.avg - a.stats.avg).map((s, idx) => `
              <tr class="${idx < 3 ? 'rank-top' : 'rank-normal'}">
                <td class="center">#${idx + 1}</td>
                <td>${s.name}</td>
                <td>${allAgencies.find(a => a.id === s.agencyId)?.name || 'N/A'}</td>
                <td>${s.position}</td>
                <td>${s.department}</td>
                <td class="score-cell">${s.stats.avg}</td>
                <td class="center" style="background-color: ${s.stats.ratingColor}; color: #ffffff; font-weight: bold;">${s.stats.ratingLabel}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BANG_DANH_VONG_${cycleName.replace(/\s+/g, '_')}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-[10px] font-black uppercase text-slate-400">Đang tổng hợp dữ liệu danh vọng...</div>;

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Bảng Danh Vọng</h1>
          <p className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">Dữ liệu công khai toàn hệ thống Phú Thọ Rate</p>
        </div>
        <div className="flex flex-wrap gap-3">
           <button onClick={handleExportRankingsExcel} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 hover:bg-slate-900 transition-all shadow-lg active:scale-95">
              <i className="fas fa-file-excel"></i>
              Tải bảng danh vọng chuyên nghiệp
           </button>
           <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase shadow-sm appearance-none cursor-pointer min-w-[200px]">
             {allCycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
           </select>
           <select value={selectedAgency} onChange={e => setSelectedAgency(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase shadow-sm appearance-none cursor-pointer">
             <option value="all">TẤT CẢ CƠ QUAN</option>
             {allAgencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
          <div className="h-full w-full relative min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={ratingChartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                <YAxis hide />
                <ReTooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>
                  {ratingChartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center">
           <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={ratingChartData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                    {ratingChartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
           </div>
           <div className="w-full space-y-2 mt-4">
              {ratingChartData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-xl">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-[8px] font-black text-slate-500 uppercase">{item.name}</span>
                   </div>
                   <span className="text-[10px] font-black text-slate-900">{item.value}</span>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-slate-50 flex items-center gap-4">
            <div className="relative flex-1">
               <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
               <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 text-[10px] font-black uppercase shadow-inner outline-none focus:border-blue-400" placeholder="TÌM KIẾM CÁN BỘ ĐỊNH DANH..." />
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                  <tr>
                     <th className="px-8 py-6">Thứ hạng</th>
                     <th className="px-8 py-6">Cán bộ</th>
                     <th className="px-5 py-6 text-center">Điểm số</th>
                     <th className="px-5 py-6 text-center">Xếp loại</th>
                     <th className="px-8 py-6 text-right">Chi tiết</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredStaff.sort((a, b) => b.stats.avg - a.stats.avg).map((staff, idx) => (
                    <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-8 py-6">
                          <span className={`text-sm font-black ${idx < 3 ? 'text-blue-600' : 'text-slate-400'}`}>#{idx + 1}</span>
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                             <img src={getAvatarUrl(staff)} className="w-12 h-12 rounded-xl object-cover shadow-sm border border-slate-200" />
                             <div>
                                <p className="text-[12px] font-black text-slate-900 uppercase leading-none mb-1">{staff.name}</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{staff.position} | {staff.department}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-5 py-6 text-center">
                          <span className="text-xl font-black text-slate-900">{staff.stats.avg}</span>
                       </td>
                       <td className="px-5 py-6 text-center">
                          <div className="inline-flex px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm" style={{ backgroundColor: `${staff.stats.ratingColor}15`, color: staff.stats.ratingColor, borderColor: `${staff.stats.ratingColor}30` }}>
                             {staff.stats.ratingLabel}
                          </div>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <button onClick={() => setSelectedStaffId(staff.id)} className="w-10 h-10 bg-slate-100 rounded-xl text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                             <i className="fas fa-chevron-right text-xs"></i>
                          </button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {selectedStaffId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setSelectedStaffId(null)}></div>
           <div className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-8 md:p-12 overflow-hidden animate-in zoom-in-95">
              {(() => {
                const s = filteredStaff.find(u => u.id === selectedStaffId);
                if (!s) return null;
                return (
                  <div className="space-y-10">
                    <div className="flex items-center gap-6">
                       <img src={getAvatarUrl(s)} className="w-24 h-24 rounded-[2rem] object-cover border-4 border-slate-50 shadow-xl" />
                       <div>
                          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2">{s.name}</h3>
                          <div className="flex flex-wrap gap-2">
                             <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-lg uppercase">{s.position}</span>
                             <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg uppercase">{s.department}</span>
                          </div>
                       </div>
                    </div>
                    
                    <div className="h-64 relative min-h-0 min-w-0">
                       <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={s.stats.radarData}>
                             <PolarGrid stroke="#e2e8f0" />
                             <PolarAngleAxis dataKey="subject" tick={{fontSize: 8, fontWeight: 900, fill: '#94a3b8'}} />
                             <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                             <Radar name="Cán bộ" dataKey="A" stroke={s.stats.ratingColor} fill={s.stats.ratingColor} fillOpacity={0.4} />
                          </RadarChart>
                       </ResponsiveContainer>
                    </div>

                    <button onClick={() => setSelectedStaffId(null)} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all">Đóng hồ sơ</button>
                  </div>
                );
              })()}
           </div>
        </div>
      )}
    </div>
  );
};

export default PublicBoard;
