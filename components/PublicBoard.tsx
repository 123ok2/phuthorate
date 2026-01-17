
import React, { useState, useEffect, useMemo } from 'react';
import { User, Evaluation, Agency, EvaluationCycle } from '../types';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

interface PublicBoardProps { user: User; }

const COLORS = {
  'XUẤT SẮC': '#10b981', 
  'TỐT': '#3b82f6',      
  'KHÁ': '#f59e0b',      
  'TRUNG BÌNH': '#6366f1', 
  'YẾU': '#f43f5e',      
  'CHƯA ĐG': '#94a3b8'    
};

const PublicBoard: React.FC<PublicBoardProps> = ({ user }) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([]);
  const [allCycles, setAllCycles] = useState<EvaluationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  
  const [selectedCycleId, setSelectedCycleId] = useState<string>('all');
  const [selectedAgency, setSelectedAgency] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getAvatarUrl = (u: Partial<User>) => {
    return u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'CB')}&background=3b82f6&color=fff&bold=true`;
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
        
        const cyclesData = cycleSnap.docs.map(d => ({ id: d.id, ...d.data() } as EvaluationCycle));
        setAllCycles(cyclesData);
        
        const activeCycle = cyclesData.find(c => c.status === 'ACTIVE');
        if (activeCycle) setSelectedCycleId(activeCycle.id);

        setAllUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
        setAllAgencies(agencySnap.docs.map(d => ({ id: d.id, ...d.data() } as Agency)));
        setAllEvaluations(evalSnap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation)));
      } catch (error) { console.error(error); }
      setLoading(false);
    };
    fetchData();
  }, []);

  const departmentsList = useMemo(() => {
    const depts = new Set<string>();
    allUsers.forEach(u => {
      if (u.department && (selectedAgency === 'all' || u.agencyId === selectedAgency)) {
        depts.add(u.department.toUpperCase());
      }
    });
    return Array.from(depts).sort();
  }, [allUsers, selectedAgency]);

  const filteredEvaluations = useMemo(() => {
    if (selectedCycleId === 'all') return allEvaluations;
    return allEvaluations.filter(e => e.cycleId === selectedCycleId);
  }, [allEvaluations, selectedCycleId]);

  const getStaffStats = (userId: string) => {
    const evs = filteredEvaluations.filter(e => e.evaluateeId === userId);
    if (evs.length === 0) return { 
      avg: 0, count: 0, rating: 'CHƯA ĐG', color: COLORS['CHƯA ĐG'],
      criteria: { professionalism: 0, productivity: 0, collaboration: 0, innovation: 0, discipline: 0 }
    };
    
    const count = evs.length;
    const sums = evs.reduce((acc, curr) => ({
      professionalism: acc.professionalism + curr.scores.professionalism,
      productivity: acc.productivity + curr.scores.productivity,
      collaboration: acc.collaboration + curr.scores.collaboration,
      innovation: acc.innovation + curr.scores.innovation,
      discipline: acc.discipline + curr.scores.discipline
    }), { professionalism: 0, productivity: 0, collaboration: 0, innovation: 0, discipline: 0 });

    const criteriaAvg = {
      professionalism: Number((sums.professionalism / count).toFixed(1)),
      productivity: Number((sums.productivity / count).toFixed(1)),
      collaboration: Number((sums.collaboration / count).toFixed(1)),
      innovation: Number((sums.innovation / count).toFixed(1)),
      discipline: Number((sums.discipline / count).toFixed(1))
    };

    const avg = (criteriaAvg.professionalism + criteriaAvg.productivity + criteriaAvg.collaboration + criteriaAvg.innovation + criteriaAvg.discipline) / 5;
    
    let rating: keyof typeof COLORS = 'TRUNG BÌNH';
    if (avg >= 9) rating = 'XUẤT SẮC';
    else if (avg >= 8) rating = 'TỐT';
    else if (avg >= 6.5) rating = 'KHÁ';
    else if (avg < 5) rating = 'YẾU';
    
    return { avg: Number(avg.toFixed(1)), count, rating, color: COLORS[rating], criteria: criteriaAvg };
  };

  const getPeerEvalStatus = (userId: string, agencyId: string) => {
    const agencyPeers = allUsers.filter(u => u.agencyId === agencyId && u.role === 'EMPLOYEE' && u.id !== userId);
    const totalToEval = agencyPeers.length;
    const evsSubmitted = allEvaluations.filter(e => 
      e.evaluatorId === userId && (selectedCycleId === 'all' || e.cycleId === selectedCycleId)
    );
    const submittedCount = evsSubmitted.length;
    const percentage = totalToEval > 0 ? Math.round((submittedCount / totalToEval) * 100) : 100;
    return {
      text: submittedCount >= totalToEval ? "HOÀN THÀNH" : `${percentage}% (${submittedCount}/${totalToEval})`,
      done: submittedCount >= totalToEval,
      count: submittedCount,
      total: totalToEval,
      percentage
    };
  };

  const filteredStaff = useMemo(() => {
    return allUsers.filter(s => {
      const matchAgency = selectedAgency === 'all' || s.agencyId === selectedAgency;
      const matchDept = selectedDept === 'all' || s.department.toUpperCase() === selectedDept.toUpperCase();
      const matchSearch = s.name.toUpperCase().includes(searchTerm.toUpperCase());
      return s.role === 'EMPLOYEE' && matchAgency && matchDept && matchSearch;
    });
  }, [allUsers, selectedAgency, selectedDept, searchTerm]);

  const dashboardStats = useMemo(() => {
    const list = filteredStaff.map(s => ({ ...s, stats: getStaffStats(s.id), evalStatus: getPeerEvalStatus(s.id, s.agencyId) }));
    const total = list.length || 0;
    const totalWithData = total || 1;
    const completedEval = list.filter(l => l.evalStatus.done).length;
    const avgSystemScore = list.reduce((acc, curr) => acc + curr.stats.avg, 0) / totalWithData;
    
    const ratingDistribution = [
      { name: 'XUẤT SẮC', value: list.filter(l => l.stats.rating === 'XUẤT SẮC').length, color: COLORS['XUẤT SẮC'] },
      { name: 'TỐT', value: list.filter(l => l.stats.rating === 'TỐT').length, color: COLORS['TỐT'] },
      { name: 'KHÁ', value: list.filter(l => l.stats.rating === 'KHÁ').length, color: COLORS['KHÁ'] },
      { name: 'TRUNG BÌNH', value: list.filter(l => l.stats.rating === 'TRUNG BÌNH').length, color: COLORS['TRUNG BÌNH'] },
      { name: 'YẾU', value: list.filter(l => l.stats.rating === 'YẾU').length, color: COLORS['YẾU'] },
    ];

    return { 
      total, 
      completedEval, 
      completionRate: total > 0 ? Math.round((completedEval / total) * 100) : 0,
      avgSystemScore: avgSystemScore.toFixed(1),
      ratingDistribution
    };
  }, [filteredStaff, filteredEvaluations]);

  const selectedStaffData = useMemo(() => {
    if (!selectedStaffId) return null;
    const staff = allUsers.find(u => u.id === selectedStaffId);
    if (!staff) return null;
    const stats = getStaffStats(staff.id);
    const evs = filteredEvaluations.filter(e => e.evaluateeId === staff.id);
    const radarData = [
      { subject: 'Chuyên môn', A: stats.criteria.professionalism },
      { subject: 'Hiệu suất', A: stats.criteria.productivity },
      { subject: 'Hợp tác', A: stats.criteria.collaboration },
      { subject: 'Đổi mới', A: stats.criteria.innovation },
      { subject: 'Kỷ luật', A: stats.criteria.discipline },
    ];
    return { staff, stats, evaluations: evs, radarData };
  }, [selectedStaffId, filteredEvaluations, allUsers]);

  const handleExportExcel = (mode: 'current' | 'all') => {
    const cycleName = allCycles.find(c => c.id === selectedCycleId)?.name || "TẤT CẢ GIAI ĐOẠN";
    const exportList = mode === 'all' ? allUsers.filter(u => u.role === 'EMPLOYEE') : filteredStaff;
    const reportTitle = mode === 'all' ? "BÁO CÁO TỔNG HỢP TOÀN HỆ THỐNG PHÚ THỌ RATE" : `BÁO CÁO KẾT QUẢ ĐÁNH GIÁ ĐỊNH KỲ`;
    const exportDate = new Date().toLocaleString('vi-VN');

    // Tính toán tỉ trọng xếp loại cho tệp Excel
    const summaryData = {
      'XUẤT SẮC': exportList.filter(s => getStaffStats(s.id).rating === 'XUẤT SẮC').length,
      'TỐT': exportList.filter(s => getStaffStats(s.id).rating === 'TỐT').length,
      'KHÁ': exportList.filter(s => getStaffStats(s.id).rating === 'KHÁ').length,
      'TRUNG BÌNH': exportList.filter(s => getStaffStats(s.id).rating === 'TRUNG BÌNH').length,
      'YẾU': exportList.filter(s => getStaffStats(s.id).rating === 'YẾU').length,
      'CHƯA ĐG': exportList.filter(s => getStaffStats(s.id).rating === 'CHƯA ĐG').length
    };
    const totalCount = exportList.length || 1;

    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          .header { background-color: #1e40af; color: #ffffff; font-weight: bold; text-align: center; }
          .sub-header { background-color: #f1f5f9; font-weight: bold; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .rating-cell { font-weight: bold; }
          .summary-header { background-color: #334155; color: #ffffff; font-weight: bold; }
          td, th { border: 1px solid #cbd5e1; padding: 8px; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="16" class="header" style="font-size: 18pt; padding: 20px;">${reportTitle}</td></tr>
          <tr><td colspan="16" class="text-center" style="font-style: italic;">PHẠM VI: ${cycleName} | NGÀY XUẤT: ${exportDate}</td></tr>
          
          <!-- BẢNG THỐNG KÊ TỈ TRỌNG -->
          <tr><td colspan="16"></td></tr>
          <tr><td colspan="4" class="summary-header">BẢNG THỐNG KÊ TỈ TRỌNG XẾP LOẠI</td><td colspan="12"></td></tr>
          <tr class="sub-header">
            <td colspan="2">PHÂN LOẠI</td>
            <td>SỐ LƯỢNG (HỒ SƠ)</td>
            <td>TỈ LỆ (%)</td>
            <td colspan="12"></td>
          </tr>
          ${Object.entries(summaryData).map(([key, value]) => `
            <tr>
              <td colspan="2" style="font-weight: bold; color: ${COLORS[key as keyof typeof COLORS]}">${key}</td>
              <td class="text-center">${value}</td>
              <td class="text-center">${Math.round((value / totalCount) * 100)}%</td>
              <td colspan="12"></td>
            </tr>
          `).join('')}
          <tr>
            <td colspan="2" style="font-weight: bold; background-color: #f8fafc;">TỔNG CỘNG</td>
            <td class="text-center" style="font-weight: bold;">${exportList.length}</td>
            <td class="text-center" style="font-weight: bold;">100%</td>
            <td colspan="12"></td>
          </tr>

          <!-- DANH SÁCH CHI TIẾT -->
          <tr><td colspan="16"></td></tr>
          <tr class="sub-header">
            <th rowspan="2">STT</th>
            <th rowspan="2">HỌ VÀ TÊN</th>
            <th rowspan="2">EMAIL</th>
            <th rowspan="2">CƠ QUAN</th>
            <th rowspan="2">BỘ PHẬN</th>
            <th rowspan="2">CHỨC VỤ</th>
            <th colspan="5" class="text-center">ĐIỂM CHI TIẾT (TRUNG BÌNH)</th>
            <th rowspan="2" class="text-center">ĐIỂM TỔNG</th>
            <th rowspan="2" class="text-center">XẾP LOẠI</th>
            <th rowspan="2" class="text-center">LƯỢT ĐG NHẬN</th>
            <th rowspan="2" class="text-center">TIẾN ĐỘ ĐG BẢN THÂN</th>
            <th rowspan="2" class="text-center">TRẠNG THÁI</th>
          </tr>
          <tr class="sub-header">
            <th>CHUYÊN MÔN</th>
            <th>HIỆU SUẤT</th>
            <th>HỢP TÁC</th>
            <th>ĐỔI MỚI</th>
            <th>KỶ LUẬT</th>
          </tr>
    `;

    exportList.forEach((s, index) => {
      const stats = getStaffStats(s.id);
      const agency = allAgencies.find(a => a.id === s.agencyId);
      const evalStatus = getPeerEvalStatus(s.id, s.agencyId);
      
      tableHtml += `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td class="text-left">${s.name}</td>
          <td class="text-left">${s.email}</td>
          <td class="text-left">${agency?.name || 'HỆ THỐNG'}</td>
          <td class="text-left">${s.department}</td>
          <td class="text-left">${s.position}</td>
          <td class="text-center">${stats.criteria.professionalism}</td>
          <td class="text-center">${stats.criteria.productivity}</td>
          <td class="text-center">${stats.criteria.collaboration}</td>
          <td class="text-center">${stats.criteria.innovation}</td>
          <td class="text-center">${stats.criteria.discipline}</td>
          <td class="text-center" style="font-weight: bold; background-color: #eff6ff;">${stats.avg}</td>
          <td class="text-center rating-cell" style="color: ${stats.color};">${stats.rating}</td>
          <td class="text-center">${stats.count}</td>
          <td class="text-center">${evalStatus.count} / ${evalStatus.total}</td>
          <td class="text-center" style="color: ${evalStatus.done ? '#10b981' : '#f43f5e'};">${evalStatus.done ? 'HOÀN THÀNH' : 'CHƯA XONG'}</td>
        </tr>
      `;
    });

    tableHtml += `</table></body></html>`;
    const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PhuThoRate_BaoCaoTongHop_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportOptions(false);
  };

  if (loading) return (
    <div className="p-20 text-center animate-pulse">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Đang tổng hợp dữ liệu danh vọng...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
             <i className="fas fa-chart-line text-[8px]"></i>
             <span className="text-[8px] font-black uppercase tracking-widest">Analytics Dashboard</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Bảng Danh Vọng <span className="text-blue-600">.</span></h1>
          <p className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">Hệ thống đo lường hiệu suất và minh bạch năng lực.</p>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setShowExportOptions(!showExportOptions)} 
            className="bg-slate-900 hover:bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 transition-all active:scale-95"
          >
            <i className="fas fa-file-export text-blue-400"></i> Xuất Báo Cáo
          </button>
          {showExportOptions && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in slide-in-from-top-2">
              <button onClick={() => handleExportExcel('all')} className="w-full px-5 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50 transition-colors">
                <i className="fas fa-globe text-blue-500 text-[10px]"></i>
                <span className="text-[10px] font-black uppercase">Toàn hệ thống</span>
              </button>
              <button onClick={() => handleExportExcel('current')} className="w-full px-5 py-3 text-left hover:bg-slate-50 flex items-center gap-3 transition-colors">
                <i className="fas fa-filter text-emerald-500 text-[10px]"></i>
                <span className="text-[10px] font-black uppercase">Theo bộ lọc hiện tại</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SUMMARY STATS (Bento) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center gap-4 group hover:shadow-md hover:border-blue-200 transition-all">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-lg shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all">
            <i className="fas fa-user-group"></i>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cán bộ</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">{dashboardStats.total}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase">Hồ sơ</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center gap-4 group hover:shadow-md hover:border-emerald-200 transition-all">
          <div className="relative shrink-0 w-12 h-12">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-100" />
              <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray={132} strokeDashoffset={132 - (132 * dashboardStats.completionRate) / 100} className="text-emerald-500 transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="fas fa-check text-emerald-500 text-[10px]"></i>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Đánh giá</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">{dashboardStats.completionRate}%</span>
              <span className="text-[8px] font-bold text-emerald-500 uppercase">Hoàn tất</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center gap-4 group hover:shadow-md hover:border-amber-200 transition-all">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-lg shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-all">
            <i className="fas fa-star"></i>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Điểm TB</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">{dashboardStats.avgSystemScore}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase">Hệ thống</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-[1.5rem] shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 text-white rounded-xl flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-calendar"></i>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Chu kỳ</p>
            <p className="text-[10px] font-black text-white uppercase truncate tracking-tight">
              {allCycles.find(c => c.id === selectedCycleId)?.name || 'HỆ THỐNG'}
            </p>
          </div>
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm">
           <div className="flex items-center justify-between mb-4 border-l-4 border-blue-600 pl-3">
              <div>
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Phân bổ năng lực</h3>
              </div>
              <div className="flex gap-1">
                {Object.values(COLORS).map((c, i) => <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }}></div>)}
              </div>
           </div>
           <div className="h-[200px] w-full relative min-h-0 min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={dashboardStats.ratingDistribution} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 7, fontWeight: 900, fill: '#94a3b8' }} />
                  <YAxis hide />
                  <ReTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '8px' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                    {dashboardStats.ratingDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="mb-2 border-l-4 border-emerald-500 pl-3">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Tỷ trọng xếp loại</h3>
           </div>
           <div className="h-[160px] relative min-h-0 min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={dashboardStats.ratingDistribution} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                    {dashboardStats.ratingDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-900">{dashboardStats.total}</span>
                <span className="text-[7px] font-black text-slate-400 uppercase mt-0.5">Nhân sự</span>
              </div>
           </div>
           <div className="mt-2 space-y-1">
             {dashboardStats.ratingDistribution.slice(0, 5).map((item, idx) => (
               <div key={idx} className="flex items-center justify-between p-1 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-[7px] font-black text-slate-500 uppercase">{item.name}</span>
                  </div>
                  <span className="text-[8px] font-black text-slate-900">{Math.round((item.value / (dashboardStats.total || 1)) * 100)}%</span>
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* FILTER & DATA TABLE */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select value={selectedCycleId} onChange={(e) => setSelectedCycleId(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase shadow-sm appearance-none cursor-pointer">
              <option value="all">TẤT CẢ GIAI ĐOẠN</option>
              {allCycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={selectedAgency} onChange={(e) => { setSelectedAgency(e.target.value); setSelectedDept('all'); }} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase shadow-sm appearance-none cursor-pointer">
              <option value="all">TOÀN HỆ THỐNG</option>
              {allAgencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase shadow-sm appearance-none cursor-pointer">
              <option value="all">TẤT CẢ BỘ PHẬN</option>
              {departmentsList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
              <input type="text" placeholder="TÌM TÊN CÁN BỘ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-[10px] font-black uppercase shadow-sm" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-8 py-6 w-1/3">Hồ sơ Cán bộ</th>
                <th className="px-5 py-6 text-center">Xếp hạng</th>
                <th className="px-5 py-6 text-center">Phân loại</th>
                <th className="px-5 py-6 text-center">Nghĩa vụ ĐG</th>
                <th className="px-8 py-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.map(staff => {
                const stats = getStaffStats(staff.id);
                const evalStatus = getPeerEvalStatus(staff.id, staff.agencyId);
                return (
                  <tr key={staff.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img src={getAvatarUrl(staff)} className="w-14 h-14 rounded-2xl object-cover border border-slate-100 shadow-sm" alt="" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-black text-slate-900 uppercase leading-tight mb-1 truncate" title={staff.name}>{staff.name}</p>
                          <div className="flex items-center flex-wrap gap-2">
                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{staff.position}</span>
                             <span className="text-[9px] text-slate-300">|</span>
                             <span className="text-[9px] font-bold text-blue-600 uppercase tracking-tight">{staff.department}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-6 text-center">
                      <div className="inline-block bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 min-w-[60px]">
                        <span className="text-xl font-black text-slate-900 leading-none">{stats.avg || '--'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-6 text-center">
                      <div className="inline-flex">
                        <span 
                          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm flex items-center justify-center min-w-[100px]" 
                          style={{ backgroundColor: `${stats.color}15`, color: stats.color, borderColor: `${stats.color}30` }}
                        >
                          {stats.rating}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-6 text-center">
                      <div className="flex flex-col items-center min-w-[140px]">
                        <div className="flex justify-between w-full mb-2">
                          <span className={`text-[9px] font-black uppercase ${evalStatus.done ? "text-emerald-500" : "text-slate-400"}`}>{evalStatus.text}</span>
                          <span className="text-[9px] font-bold text-slate-300">{evalStatus.percentage}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div className={`h-full rounded-full transition-all duration-1000 ${evalStatus.done ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-blue-600'}`} style={{ width: `${evalStatus.percentage}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => setSelectedStaffId(staff.id)}
                        className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all active:scale-90 shadow-sm flex items-center justify-center ml-auto"
                      >
                        <i className="fas fa-chevron-right text-xs"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredStaff.length === 0 && (
            <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">
              Không tìm thấy kết quả phù hợp
            </div>
          )}
        </div>
      </div>

      {/* MODAL CHI TIẾT HỒ SƠ */}
      {selectedStaffData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setSelectedStaffId(null)}></div>
           <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-slate-100 flex flex-col">
              
              {/* Header Modal */}
              <div className="bg-slate-900 p-8 text-white flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-6">
                    <img src={getAvatarUrl(selectedStaffData.staff)} className="w-20 h-20 rounded-[2rem] object-cover border-4 border-white/10" alt="" />
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{selectedStaffData.staff.name}</h3>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{selectedStaffData.staff.position}</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{selectedStaffData.staff.department}</span>
                      </div>
                    </div>
                 </div>
                 <button onClick={() => setSelectedStaffId(null)} className="w-12 h-12 bg-white/10 rounded-2xl hover:bg-white/20 transition-all flex items-center justify-center">
                    <i className="fas fa-times"></i>
                 </button>
              </div>

              {/* Body Modal */}
              <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12">
                 
                 {/* Top Analytics */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 text-center flex flex-col items-center justify-center">
                       <span className="text-5xl font-black text-slate-900 mb-2">{selectedStaffData.stats.avg}</span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Điểm trung bình</span>
                       <div 
                         className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm"
                         style={{ backgroundColor: `${selectedStaffData.stats.color}15`, color: selectedStaffData.stats.color, borderColor: `${selectedStaffData.stats.color}30` }}
                       >
                         {selectedStaffData.stats.rating}
                       </div>
                    </div>

                    <div className="md:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-200 flex flex-col min-h-0 min-w-0">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Phân tích đa chiều</h4>
                       <div className="h-[200px] w-full relative">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={selectedStaffData.radarData}>
                              <PolarGrid stroke="#e2e8f0" />
                              <PolarAngleAxis dataKey="subject" tick={{fontSize: 8, fontWeight: 900, fill: '#64748b'}} />
                              <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                              <Radar name="Cán bộ" dataKey="A" stroke={selectedStaffData.stats.color} fill={selectedStaffData.stats.color} fillOpacity={0.5} />
                            </RadarChart>
                          </ResponsiveContainer>
                       </div>
                    </div>
                 </div>

                 {/* Comments List */}
                 <div className="space-y-6">
                    <div className="flex items-center justify-between border-l-4 border-blue-600 pl-4">
                       <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Lời nhắn từ đồng nghiệp ({selectedStaffData.evaluations.length})</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {selectedStaffData.evaluations.map((e, idx) => (
                         <div key={idx} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:border-blue-100 transition-all">
                            <p className="text-slate-700 text-xs font-bold leading-relaxed italic uppercase">"{e.comment || 'KHÔNG CÓ NHẬN XÉT CHI TIẾT'}"</p>
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50">
                               <span className="text-[8px] font-black text-slate-400 uppercase">{new Date(e.timestamp).toLocaleDateString('vi-VN')}</span>
                               <div className="flex gap-0.5">
                                 {[...Array(5)].map((_, i) => (
                                   <div key={i} className={`w-1 h-1 rounded-full ${i < Math.round(selectedStaffData.stats.avg / 2) ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                                 ))}
                               </div>
                            </div>
                         </div>
                       ))}
                       {selectedStaffData.evaluations.length === 0 && (
                         <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                            <i className="fas fa-comment-slash text-slate-200 text-3xl mb-4"></i>
                            <p className="text-slate-400 text-[10px] font-black uppercase">Chưa có dữ liệu nhận xét</p>
                         </div>
                       )}
                    </div>
                 </div>
              </div>

              {/* Footer Modal */}
              <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0 flex justify-end gap-4">
                 <button onClick={() => setSelectedStaffId(null)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-blue-600 transition-all active:scale-95">
                    Đóng hồ sơ
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PublicBoard;
