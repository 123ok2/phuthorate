import React, { useState, useEffect, useMemo } from 'react';
import { User, Agency, Evaluation, EvaluationCycle } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

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

  // 1. Lắng nghe Danh sách Cơ quan và Đợt đánh giá (Dữ liệu tĩnh hơn)
  useEffect(() => {
    const unsubAgencies = onSnapshot(collection(db, "agencies"), (snap) => {
      setAgencies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agency)));
    });
    const unsubCycles = onSnapshot(collection(db, "cycles"), (snap) => {
      const cyclesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EvaluationCycle));
      setAllCycles(cyclesData);
      const activeCycle = cyclesData.find(c => c.status === 'ACTIVE');
      if (activeCycle && selectedCycleId === 'all') setSelectedCycleId(activeCycle.id);
    });
    return () => { unsubAgencies(); unsubCycles(); };
  }, []);

  // 2. Lắng nghe Nhân sự và Đánh giá (Dữ liệu biến động - Real-time)
  useEffect(() => {
    if (!selectedAgencyId) return;
    setLoading(true);

    // Lắng nghe nhân sự trong cơ quan
    const qStaff = query(collection(db, "users"), where("agencyId", "==", selectedAgencyId));
    const unsubStaff = onSnapshot(qStaff, (snap) => {
      setAgencyStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      setLoading(false);
    });

    // Lắng nghe toàn bộ đánh giá (để lọc theo cycle)
    const unsubEvals = onSnapshot(collection(db, "evaluations"), (snap) => {
      setAllEvaluations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation)));
    });

    return () => { unsubStaff(); unsubEvals(); };
  }, [selectedAgencyId]);

  const selectedCycle = useMemo(() => allCycles.find(c => c.id === selectedCycleId), [allCycles, selectedCycleId]);

  // Logic tính toán bảng tiến độ (Người đi đánh giá)
  const progressReport = useMemo(() => {
    if (!selectedCycle) return [];
    
    // Chỉ tính những người tham gia đánh giá (Bỏ ADMIN vì admin không bị đánh giá và không đi đánh giá)
    const participants = agencyStaff.filter(s => s.role !== 'ADMIN');
    
    let report = participants.map(evaluator => {
      // Những người mà evaluator này CẦN phải đánh giá (tất cả trừ chính mình)
      const targets = participants.filter(p => p.id !== evaluator.id);
      const totalRequired = targets.length;
      
      // Lấy danh sách ID những người MÀ evaluator này ĐÃ đánh giá trong đợt này
      const doneIds = allEvaluations
        .filter(e => e.evaluatorId === evaluator.id && e.cycleId === selectedCycleId)
        .map(e => e.evaluateeId);
      
      // Lọc duy nhất để tránh đếm trùng
      const uniqueDoneIds = Array.from(new Set(doneIds)).filter(id => targets.some(t => t.id === id));
      const doneCount = uniqueDoneIds.length;
      
      // Danh sách những người còn thiếu
      const missingPeers = targets.filter(p => !uniqueDoneIds.includes(p.id));
      const isComplete = missingPeers.length === 0;

      // Tính %: Nếu chưa xong hoàn toàn, luôn làm tròn xuống để không bao giờ hiện 100% ảo
      const percent = totalRequired > 0 
        ? (isComplete ? 100 : Math.min(99, Math.floor((doneCount / totalRequired) * 100))) 
        : 100;
      
      return {
        evaluator,
        totalRequired,
        doneCount,
        missingCount: missingPeers.length,
        missingNames: missingPeers.map(p => p.name),
        isComplete,
        percent
      };
    }).sort((a, b) => a.percent - b.percent);

    if (onlyIncomplete) {
      report = report.filter(r => !r.isComplete);
    }
    return report;
  }, [agencyStaff, allEvaluations, selectedCycleId, selectedCycle, onlyIncomplete]);

  // Logic tính toán Phân bổ xếp loại (Người được đánh giá)
  const ratingStats = useMemo(() => {
    if (!selectedCycle || !selectedCycle.ratings || agencyStaff.length === 0) return [];

    // Tạo các thùng chứa (buckets) dựa trên cấu hình xếp loại
    // Sắp xếp rating từ điểm thấp đến cao để logic tìm bucket hoạt động đúng (find sẽ tìm cái đầu tiên thỏa mãn)
    // Tuy nhiên logic dưới dùng find(score >= min), nên cần sắp xếp từ Cao xuống Thấp để khớp đúng nhất.
    const sortedRatings = [...selectedCycle.ratings].sort((a, b) => b.minScore - a.minScore);
    
    const statsMap = sortedRatings.map(r => ({
      name: r.label,
      count: 0,
      color: r.color,
      id: r.id,
      minScore: r.minScore
    }));

    // Duyệt qua từng nhân viên (trừ Admin)
    agencyStaff.forEach(staff => {
       if (staff.role === 'ADMIN') return;

       // Lấy tất cả phiếu đánh giá dành cho nhân viên này trong đợt
       const receivedEvals = allEvaluations.filter(e => e.evaluateeId === staff.id && e.cycleId === selectedCycleId);
       
       if (receivedEvals.length > 0) {
          // Tính điểm trung bình tổng
          let sumAvg = 0;
          receivedEvals.forEach(e => {
             const scores = Object.values(e.scores) as number[];
             if (scores.length > 0) {
                sumAvg += scores.reduce((a, b) => a + b, 0) / scores.length;
             }
          });
          const finalScore = sumAvg / receivedEvals.length;

          // Tìm xếp loại phù hợp
          const rating = statsMap.find(r => finalScore >= r.minScore);
          if (rating) {
             rating.count++;
          } else {
             // Nếu điểm thấp hơn mức thấp nhất, gộp vào mức thấp nhất (hoặc xử lý riêng)
             if (statsMap.length > 0) statsMap[statsMap.length - 1].count++;
          }
       }
    });

    // Đảo ngược lại để hiển thị biểu đồ từ Cao -> Thấp hoặc Thấp -> Cao tùy ý. 
    // Ở đây giữ nguyên thứ tự Cao -> Thấp (Xuất sắc bên trái)
    return statsMap;
  }, [agencyStaff, allEvaluations, selectedCycle, selectedCycleId]);

  const lazyStaff = useMemo(() => progressReport.filter(p => p.percent === 0), [progressReport]);

  const handleCopyReminder = (p: any) => {
    const text = `[NHẮC NHỞ ĐÁNH GIÁ]\nKính gửi đồng chí: ${p.evaluator.name}\nHiện tại đợt "${selectedCycle?.name}" đang diễn ra. Đồng chí vẫn còn thiếu ${p.missingCount}/${p.totalRequired} lượt đánh giá cho các đồng nghiệp: ${p.missingNames.join(', ')}.\nVui lòng truy cập hệ thống Phú Thọ Rate để hoàn thành trước thời hạn. Trân trọng!`;
    navigator.clipboard.writeText(text);
    alert(`Đã sao chép nội dung nhắc nhở cho đồng chí ${p.evaluator.name}`);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{label}</p>
          <p className="text-sm font-black text-slate-900" style={{ color: payload[0].payload.color }}>
            {payload[0].value} Nhân sự
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-[10px] font-black uppercase text-slate-400">Đang đồng bộ dữ liệu trực tuyến...</div>;

  return (
    <div className="space-y-6 pb-24">
      {/* CẢNH BÁO NHÂN SỰ CHƯA LÀM GÌ */}
      {lazyStaff.length > 0 && (
        <div className="bg-rose-600 rounded-[2rem] p-8 text-white shadow-2xl shadow-rose-500/30 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <i className="fas fa-bolt text-2xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-black uppercase">Cảnh báo tiến độ 0%</h2>
              <p className="text-rose-100 text-[10px] font-bold uppercase tracking-widest">Phát hiện {lazyStaff.length} cán bộ chưa thực hiện bất kỳ lượt đánh giá nào</p>
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
            <select value={selectedAgencyId} onChange={(e) => setSelectedAgencyId(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-blue-500 transition-all shadow-sm">
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={selectedCycleId} onChange={(e) => setSelectedCycleId(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-blue-500 transition-all shadow-sm">
              <option value="all">Chọn đợt đánh giá</option>
              {allCycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
              onClick={() => setOnlyIncomplete(!onlyIncomplete)}
              className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 shadow-sm ${onlyIncomplete ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
           >
              <i className="fas fa-filter"></i>
              {onlyIncomplete ? 'Đang hiện: Chưa xong' : 'Lọc người chưa xong'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-12 h-12 bg-slate-50 rounded-full group-hover:scale-150 transition-transform"></div>
            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1 relative z-10">Nhân sự tham gia</p>
            <h3 className="text-2xl font-black text-slate-900 relative z-10">{progressReport.length}</h3>
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
            <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest mb-1">Tỉ lệ hoàn tất</p>
            <h3 className="text-2xl font-black text-blue-600">
               {progressReport.length > 0 ? Math.round((progressReport.filter(p => p.isComplete).length / progressReport.length) * 100) : 0}%
            </h3>
         </div>
      </div>

      {/* BIỂU ĐỒ PHÂN BỔ KẾT QUẢ - MỚI THÊM */}
      {ratingStats.length > 0 && (
         <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
               <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase">Phân bổ Kết quả</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Dựa trên kết quả đánh giá hiện tại</p>
               </div>
               <div className="flex gap-2">
                  {ratingStats.map((r, i) => (
                     <div key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }}></span>
                        <span className="text-[9px] font-black uppercase text-slate-600">{r.name}</span>
                     </div>
                  ))}
               </div>
            </div>
            <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ratingStats} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                        dy={10}
                     />
                     <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                     />
                     <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                     <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={60} animationDuration={1500}>
                        {ratingStats.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Cán bộ thực hiện</th>
                <th className="px-8 py-5 text-center">Tiến độ thực tế</th>
                <th className="px-8 py-5">Danh sách thiếu (Cập nhật tức thì)</th>
                <th className="px-8 py-5 text-right">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {progressReport.map((p, idx) => (
                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${p.percent === 0 ? 'bg-rose-50/20' : ''}`}>
                  <td className="px-8 py-6">
                    <div>
                      <p className="text-[11px] font-black text-slate-900 uppercase leading-none mb-1">{p.evaluator.name}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">{p.evaluator.position} | {p.evaluator.department}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-[10px] font-black ${p.isComplete ? 'text-emerald-600' : p.percent < 30 ? 'text-rose-600 animate-pulse' : 'text-amber-600'}`}>
                        {p.percent}% ({p.doneCount}/{p.totalRequired})
                      </span>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden border border-slate-200 shadow-inner">
                        <div 
                          className={`h-full transition-all duration-700 ease-out ${p.isComplete ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : p.percent < 30 ? 'bg-rose-500' : 'bg-amber-500'}`} 
                          style={{ width: `${p.percent}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {p.isComplete ? (
                      <div className="flex items-center gap-2 text-emerald-600">
                         <i className="fas fa-check-circle text-xs"></i>
                         <span className="text-[9px] font-black uppercase italic tracking-widest">Đã hoàn thành tất cả</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {p.missingNames.slice(0, 3).map((name, i) => (
                          <span key={i} className="px-2.5 py-1 bg-white border border-rose-100 text-rose-600 rounded-lg text-[7px] font-black uppercase shadow-sm">
                            {name}
                          </span>
                        ))}
                        {p.missingNames.length > 3 && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-[7px] font-black uppercase">
                            +{p.missingNames.length - 3} người khác
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    {!p.isComplete && (
                      <button 
                        onClick={() => handleCopyReminder(p)}
                        className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center justify-center group"
                        title="Sao chép lời nhắc"
                      >
                        <i className="fas fa-bell text-xs group-hover:animate-ring"></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {progressReport.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                       <i className="fas fa-users-viewfinder text-4xl text-slate-100"></i>
                       <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.3em]">Không tìm thấy cán bộ cần giám sát</p>
                    </div>
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