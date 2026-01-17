
import React, { useState, useEffect, useMemo } from 'react';
import { User, Agency, Evaluation, EvaluationCriteria, EvaluationCycle } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';

interface LeaderDashboardProps { user: User; }

const LeaderDashboard: React.FC<LeaderDashboardProps> = ({ user }) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>(user?.agencyId || '');
  const [agencyStaff, setAgencyStaff] = useState<User[]>([]);
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([]);
  const [allCycles, setAllCycles] = useState<EvaluationCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const getAvatarUrl = (u: Partial<User>) => {
    return u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'CB')}&background=3b82f6&color=fff&bold=true`;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [agencySnap, cycleSnap] = await Promise.all([
          getDocs(collection(db, "agencies")),
          getDocs(collection(db, "cycles"))
        ]);
        
        const agencyList = agencySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agency));
        setAgencies(agencyList);
        
        const cyclesData = cycleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EvaluationCycle));
        setAllCycles(cyclesData);
        const activeCycle = cyclesData.find(c => c.status === 'ACTIVE');
        if (activeCycle) setSelectedCycleId(activeCycle.id);

        const staffQuery = query(collection(db, "users"), where("agencyId", "==", selectedAgencyId || user.agencyId));
        const staffSnap = await getDocs(staffQuery);
        const staffList = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setAgencyStaff(staffList);
        
        const evalSnap = await getDocs(collection(db, "evaluations"));
        setAllEvaluations(evalSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation)));
      } catch (error) { console.error(error); }
      setLoading(false);
    };
    fetchData();
  }, [selectedAgencyId, user.agencyId]);

  const filteredEvaluations = useMemo(() => {
    return allEvaluations.filter(ev => {
      const matchCycle = selectedCycleId === 'all' || ev.cycleId === selectedCycleId;
      const matchStaff = agencyStaff.some(s => s.id === ev.evaluateeId);
      return matchCycle && matchStaff;
    });
  }, [allEvaluations, selectedCycleId, agencyStaff]);

  const analytics = useMemo(() => {
    if (agencyStaff.length === 0) return { completionRate: "0", avgScore: "0", radarData: [], totalStaff: 0, totalEvals: 0 };
    
    const evaluatedStaffIds = new Set(filteredEvaluations.map(e => e.evaluateeId));
    const criteriaSum: EvaluationCriteria = { professionalism: 0, productivity: 0, collaboration: 0, innovation: 0, discipline: 0 };
    
    filteredEvaluations.forEach(e => {
      criteriaSum.professionalism += e.scores.professionalism;
      criteriaSum.productivity += e.scores.productivity;
      criteriaSum.collaboration += e.scores.collaboration;
      criteriaSum.innovation += e.scores.innovation;
      criteriaSum.discipline += e.scores.discipline;
    });

    const count = filteredEvaluations.length || 1;
    const radarData = [
      { subject: 'Chuyên môn', A: Number((criteriaSum.professionalism / count).toFixed(1)) },
      { subject: 'Hiệu suất', A: Number((criteriaSum.productivity / count).toFixed(1)) },
      { subject: 'Hợp tác', A: Number((criteriaSum.collaboration / count).toFixed(1)) },
      { subject: 'Đổi mới', A: Number((criteriaSum.innovation / count).toFixed(1)) },
      { subject: 'Kỷ luật', A: Number((criteriaSum.discipline / count).toFixed(1)) },
    ];

    return {
      completionRate: ((evaluatedStaffIds.size / agencyStaff.length) * 100).toFixed(0),
      avgScore: (radarData.reduce((sum, r) => sum + r.A, 0) / 5).toFixed(1),
      radarData, 
      totalStaff: agencyStaff.length, 
      totalEvals: filteredEvaluations.length
    };
  }, [agencyStaff, filteredEvaluations]);

  if (loading) return <div className="p-20 text-center text-[10px] font-black uppercase tracking-widest animate-pulse">Đang nạp dữ liệu phân tích...</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-3">
          <h1 className="text-2xl font-black text-slate-900 uppercase">Giám sát Đơn vị</h1>
          <div className="flex flex-wrap gap-3">
             <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Cơ quan</label>
              <select 
                value={selectedAgencyId} 
                onChange={(e) => setSelectedAgencyId(e.target.value)} 
                className="w-full sm:w-64 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black shadow-sm outline-none uppercase"
              >
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Đợt đánh giá</label>
              <select 
                value={selectedCycleId} 
                onChange={(e) => setSelectedCycleId(e.target.value)} 
                className="w-full sm:w-48 bg-blue-50 text-blue-700 border-none rounded-xl px-4 py-2.5 text-[10px] font-black shadow-sm outline-none uppercase"
              >
                <option value="all">Tất cả các đợt</option>
                {allCycles.map(c => <option key={c.id} value={c.id}>{c.name} {c.status === 'ACTIVE' ? '(HIỆN TẠI)' : ''}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {[
          { label: 'Tổng nhân sự', val: analytics.totalStaff, icon: 'fa-users', color: 'slate' },
          { label: 'Đã đánh giá', val: `${analytics.completionRate}%`, icon: 'fa-tasks', color: 'emerald' },
          { label: 'Điểm trung bình', val: analytics.avgScore, icon: 'fa-star', color: 'blue' },
          { label: 'Tổng lượt ĐG', val: analytics.totalEvals, icon: 'fa-comments', color: 'amber' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[8px] md:text-[9px] text-slate-400 font-black uppercase tracking-widest mb-2">{item.label}</p>
            <div className="flex items-center justify-between">
              <h3 className="text-xl md:text-2xl font-black text-slate-900">{item.val}</h3>
              <i className={`fas ${item.icon} text-slate-100 text-2xl`}></i>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 border-l-4 border-blue-600 pl-4">Biểu đồ Năng lực Tập thể</h3>
          <div className="h-64 md:h-80 relative min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analytics.radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{fontSize: 9, fontWeight: 700, fill: '#64748b'}} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                <Radar name="Cơ quan" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[8px] text-center text-slate-400 uppercase font-bold mt-4">Phân tích đa chiều dựa trên {analytics.totalEvals} lượt đánh giá xác thực</p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-l-4 border-emerald-500 pl-4">Cán bộ Tiêu biểu (Đợt này)</h3>
          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {agencyStaff
              .map(s => {
                const sEvals = filteredEvaluations.filter(e => e.evaluateeId === s.id);
                const avg = sEvals.length > 0 ? (sEvals.reduce((acc, curr) => acc + (curr.scores.professionalism + curr.scores.productivity + curr.scores.collaboration + curr.scores.innovation + curr.scores.discipline) / 5, 0) / sEvals.length) : 0;
                return { ...s, avg };
              })
              .sort((a, b) => b.avg - a.avg)
              .slice(0, 8)
              .map((staff, i) => (
                <div key={staff.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md active:scale-[0.98]">
                  <div className="flex items-center gap-3">
                    <img 
                      src={getAvatarUrl(staff)} 
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200" 
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=3b82f6&color=fff&bold=true` }}
                    />
                    <div>
                      <p className="text-[11px] font-black text-slate-900 uppercase leading-tight">{staff.name}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{staff.position}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-blue-600">{staff.avg > 0 ? staff.avg.toFixed(1) : '--'}</span>
                    <p className="text-[7px] text-slate-400 font-black uppercase">Điểm TB</p>
                  </div>
                </div>
              ))}
              {agencyStaff.length === 0 && <div className="text-center py-20 text-slate-400 text-[10px] font-black uppercase">Chưa có dữ liệu nhân sự</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderDashboard;
