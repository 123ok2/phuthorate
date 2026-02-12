
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp, query, orderBy, deleteDoc } from 'firebase/firestore';
import { User, Agency, EvaluationCycle, Criterion, RatingConfig, Role, Evaluation } from '../types';
import ExcelJS from 'exceljs';
import saveAs from 'file-saver';

interface AdminPanelProps { currentUser: User; }

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'cycles' | 'accounts'>('cycles');
  const [users, setUsers] = useState<User[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [cycles, setCycles] = useState<EvaluationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const [searchStaff, setSearchStaff] = useState('');
  const [filterAgency, setFilterAgency] = useState('all');
  const [editingCycle, setEditingCycle] = useState<EvaluationCycle | null>(null);

  const [newCycle, setNewCycle] = useState<Omit<EvaluationCycle, 'id' | 'status'>>({
    name: '',
    startDate: '',
    endDate: '',
    targetAgencyIds: ['all'],
    criteria: [
      { id: 'c1', name: 'HIỆU SUẤT', description: 'TIẾN ĐỘ VÀ CHẤT LƯỢNG HOÀN THÀNH NHIỆM VỤ', order: 0 },
      { id: 'c2', name: 'KỶ LUẬT', description: 'CHẤP HÀNH NỘI QUY VÀ GIỜ GIẤC TÁC PHONG', order: 1 },
      { id: 'c3', name: 'PHỐI HỢP', description: 'KHẢ NĂNG LÀM VIỆC NHÓM VÀ HỖ TRỢ ĐỒNG NGHIỆP', order: 2 }
    ],
    ratings: [
      { id: 'r1', label: 'XUẤT SẮC', minScore: 90.0, color: '#10b981', order: 0 },
      { id: 'r2', label: 'TỐT', minScore: 80.0, color: '#3b82f6', order: 1 },
      { id: 'r3', label: 'KHÁ', minScore: 65.0, color: '#f59e0b', order: 2 },
      { id: 'r4', label: 'TRUNG BÌNH', minScore: 50.0, color: '#64748b', order: 3 },
      { id: 'r5', label: 'YẾU', minScore: 0, color: '#ef4444', order: 4 }
    ]
  });

  const fetchData = async () => {
    try {
      const [userSnap, agencySnap, cycleSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "agencies")),
        getDocs(query(collection(db, "cycles"), orderBy("startDate", "desc")))
      ]);
      setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setAgencies(agencySnap.docs.map(d => ({ id: d.id, ...d.data() } as Agency)));
      setCycles(cycleSnap.docs.map(d => ({ id: d.id, ...d.data() } as EvaluationCycle)));
    } catch (error) {
      console.error("Firebase fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // KHÔI PHỤC: Chức năng Sao chép đợt đánh giá
  const handleCloneCycle = (cycle: EvaluationCycle) => {
    setNewCycle({
      name: `${cycle.name} (SAO CHÉP)`,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      targetAgencyIds: [...(cycle.targetAgencyIds || ['all'])],
      criteria: cycle.criteria.map(c => ({ 
        ...c, 
        id: `crit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` 
      })),
      ratings: cycle.ratings.map(r => ({ 
        ...r, 
        id: `rate_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` 
      }))
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    alert("Đã nhân bản cấu hình đợt đánh giá. Vui lòng kiểm tra lại Tên, Thời gian và Phạm vi!");
  };

  const handleExportCycleReport = async (cycle: EvaluationCycle) => {
    setProcessing(true);
    try {
      const evalSnap = await getDocs(query(collection(db, "evaluations")));
      const allEvals = evalSnap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation));
      const cycleEvals = allEvals.filter(e => e.cycleId === cycle.id);

      if (cycleEvals.length === 0) {
        alert("KHÔNG CÓ DỮ LIỆU ĐÁNH GIÁ TRONG ĐỢT NÀY!");
        setProcessing(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Báo cáo chi tiết');

      worksheet.mergeCells('A1:K1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'HỆ THỐNG PHÚ THỌ RATE - BÁO CÁO ĐÁNH GIÁ NHÂN SỰ';
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 40;

      worksheet.mergeCells('A2:K2');
      const subTitleCell = worksheet.getCell('A2');
      subTitleCell.value = `ĐỢT ĐÁNH GIÁ: ${cycle.name.toUpperCase()}`;
      subTitleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF334155' } };
      subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 25;

      const columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'HỌ VÀ TÊN', key: 'name', width: 25 },
        { header: 'CƠ QUAN', key: 'agency', width: 30 },
        { header: 'PHÒNG BAN', key: 'dept', width: 20 },
        { header: 'CHỨC VỤ', key: 'pos', width: 20 },
        ...cycle.criteria.map(c => ({ header: c.name, key: c.id, width: 15 })),
        { header: 'TỔNG ĐIỂM', key: 'total', width: 15 },
        { header: 'XẾP LOẠI', key: 'rating', width: 18 }
      ];

      worksheet.getRow(5).values = columns.map(c => c.header);
      worksheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }));

      const headerRow = worksheet.getRow(5);
      headerRow.height = 35;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      const reportRows = users
        .filter(u => u.role !== 'ADMIN')
        .map((u, index) => {
          const userEvals = cycleEvals.filter(e => e.evaluateeId === u.id);
          const criterionScores: any = {};
          let sumOfAvgs = 0;
          cycle.criteria.forEach(c => {
            const scores = userEvals.map(e => e.scores[c.id] || 0);
            const avg = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
            criterionScores[c.id] = avg;
            sumOfAvgs += avg;
          });
          const overall = Number((sumOfAvgs / (cycle.criteria.length || 1)).toFixed(1));
          const rating = cycle.ratings.slice().sort((a,b) => b.minScore - a.minScore).find(r => overall >= r.minScore) || { label: "K.XẾP LOẠI", color: "#94a3b8" };
          return {
            stt: index + 1,
            name: u.name,
            agency: agencies.find(a => a.id === u.agencyId)?.name || "N/A",
            dept: u.department,
            pos: u.position,
            ...criterionScores,
            total: overall,
            rating: rating.label,
            ratingColor: rating.color.replace('#', 'FF')
          };
        })
        .filter(row => row.total > 0)
        .sort((a, b) => b.total - a.total);

      reportRows.forEach((data, idx) => {
        data.stt = idx + 1;
        const row = worksheet.addRow(data);
        row.height = 28;
        row.eachCell((cell, colNumber) => {
          cell.alignment = { vertical: 'middle', horizontal: colNumber <= 5 ? 'left' : 'center' };
          cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
          if (idx % 2 !== 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          if (colNumber === columns.length) {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: data.ratingColor } };
          }
          if (colNumber === columns.length - 1) cell.font = { bold: true };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `PhuThoRate_BaoCao_${cycle.name.replace(/\s+/g, '_')}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("LỖI XUẤT EXCEL!");
    } finally {
      setProcessing(false);
    }
  };

  const updateRating = (id: string, field: keyof RatingConfig, value: any) => {
    setNewCycle(prev => ({ ...prev, ratings: prev.ratings.map(r => r.id === id ? { ...r, [field]: value } : r) }));
  };
  const updateEditRating = (id: string, field: keyof RatingConfig, value: any) => {
    if (!editingCycle) return;
    setEditingCycle(prev => prev ? ({ ...prev, ratings: prev.ratings.map(r => r.id === id ? { ...r, [field]: value } : r) }) : null);
  };
  const addRating = (isEdit: boolean) => {
    const newRate: RatingConfig = { id: `rate_${Date.now()}`, label: 'HẠNG MỚI', minScore: 0, color: '#94a3b8', order: 0 };
    if (isEdit && editingCycle) {
      setEditingCycle({ ...editingCycle, ratings: [...(editingCycle.ratings || []), newRate] });
    } else {
      setNewCycle({ ...newCycle, ratings: [...newCycle.ratings, newRate] });
    }
  };
  const removeRating = (id: string, isEdit: boolean) => {
    if (isEdit && editingCycle) {
       setEditingCycle({ ...editingCycle, ratings: editingCycle.ratings.filter(r => r.id !== id) });
    } else {
       setNewCycle({ ...newCycle, ratings: newCycle.ratings.filter(r => r.id !== id) });
    }
  };

  const updateCriterion = (id: string, field: keyof Criterion, value: string) => {
    setNewCycle(prev => ({ ...prev, criteria: prev.criteria.map(c => c.id === id ? { ...c, [field]: value.toUpperCase() } : c) }));
  };
  const updateEditCriterion = (id: string, field: keyof Criterion, value: string) => {
    if (!editingCycle) return;
    setEditingCycle(prev => prev ? ({ ...prev, criteria: prev.criteria.map(c => c.id === id ? { ...c, [field]: value.toUpperCase() } : c) }) : null);
  };
  const addCycleCriterion = () => {
    const newCrit: Criterion = { id: `crit_${Date.now()}`, name: 'TIÊU CHÍ MỚI', description: '', order: newCycle.criteria.length };
    setNewCycle(prev => ({ ...prev, criteria: [...prev.criteria, newCrit] }));
  };
  const removeCycleCriterion = (id: string) => {
    if (newCycle.criteria.length <= 1) return;
    setNewCycle(prev => ({ ...prev, criteria: prev.criteria.filter(c => c.id !== id) }));
  };

  // LOGIC CHỌN CƠ QUAN
  const toggleTargetAgency = (agencyId: string, isEdit: boolean) => {
    const currentCycle = isEdit ? editingCycle : newCycle;
    if (!currentCycle) return;
    
    let currentIds = [...(currentCycle.targetAgencyIds || [])];
    
    // Nếu đang chọn "Toàn bộ" mà người dùng click chọn 1 cơ quan -> Xóa "all" và thêm cơ quan đó
    if (currentIds.includes('all')) {
      currentIds = [agencyId];
    } else {
      if (currentIds.includes(agencyId)) {
        currentIds = currentIds.filter(id => id !== agencyId);
      } else {
        currentIds.push(agencyId);
      }
    }

    if (isEdit && editingCycle) {
      setEditingCycle({ ...editingCycle, targetAgencyIds: currentIds });
    } else {
      setNewCycle({ ...newCycle, targetAgencyIds: currentIds });
    }
  };

  const setAllTargets = (isEdit: boolean) => {
    if (isEdit && editingCycle) setEditingCycle({ ...editingCycle, targetAgencyIds: ['all'] });
    else setNewCycle({ ...newCycle, targetAgencyIds: ['all'] });
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCycle.targetAgencyIds || newCycle.targetAgencyIds.length === 0) {
      alert("Vui lòng chọn ít nhất một cơ quan hoặc 'Toàn hệ thống'");
      return;
    }
    setProcessing(true);
    try {
      await addDoc(collection(db, "cycles"), { ...newCycle, status: 'ACTIVE', createdAt: serverTimestamp() });
      alert("ĐÃ PHÁT ĐỘNG ĐỢT ĐÁNH GIÁ!");
      fetchData();
      setNewCycle(prev => ({ 
        ...prev, 
        name: '', 
        startDate: '', 
        endDate: '',
        targetAgencyIds: ['all'],
        criteria: [
          { id: 'c1', name: 'HIỆU SUẤT', description: 'TIẾN ĐỘ VÀ CHẤT LƯỢNG HOÀN THÀNH NHIỆM VỤ', order: 0 },
          { id: 'c2', name: 'KỶ LUẬT', description: 'CHẤP HÀNH NỘI QUY VÀ GIỜ GIẤC TÁC PHONG', order: 1 },
          { id: 'c3', name: 'PHỐI HỢP', description: 'KHẢ NĂNG LÀM VIỆC NHÓM VÀ HỖ TRỢ ĐỒNG NGHIỆP', order: 2 }
        ],
        ratings: [
          { id: 'r1', label: 'XUẤT SẮC', minScore: 90.0, color: '#10b981', order: 0 },
          { id: 'r2', label: 'TỐT', minScore: 80.0, color: '#3b82f6', order: 1 },
          { id: 'r3', label: 'KHÁ', minScore: 65.0, color: '#f59e0b', order: 2 },
          { id: 'r4', label: 'TRUNG BÌNH', minScore: 50.0, color: '#64748b', order: 3 },
          { id: 'r5', label: 'YẾU', minScore: 0, color: '#ef4444', order: 4 }
        ]
      }));
    } catch (err) { console.error(err); } finally { setProcessing(false); }
  };

  const handleUpdateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCycle) return;
    if (!editingCycle.targetAgencyIds || editingCycle.targetAgencyIds.length === 0) {
      alert("Vui lòng chọn ít nhất một cơ quan hoặc 'Toàn hệ thống'");
      return;
    }
    setProcessing(true);
    try {
      const { id, ...updateData } = editingCycle;
      await updateDoc(doc(db, "cycles", id), updateData);
      alert("ĐÃ CẬP NHẬT!");
      setEditingCycle(null);
      fetchData();
    } catch (err) { console.error(err); } finally { setProcessing(false); }
  };

  const updateStatus = async (id: string, newStatus: 'ACTIVE' | 'CLOSED' | 'UPCOMING' | 'PAUSED') => {
    setProcessing(true);
    try {
      await updateDoc(doc(db, "cycles", id), { status: newStatus });
      alert("ĐÃ CẬP NHẬT TRẠNG THÁI!");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("LỖI CẬP NHẬT TRẠNG THÁI!");
    } finally {
      setProcessing(false);
    }
  };

  const changeUserRole = async (userId: string, newRole: Role) => {
    if (userId === currentUser.id) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      await fetchData();
    } catch (err) { console.error(err); } finally { setProcessing(false); }
  };

  const deleteUser = async (userId: string) => {
    if (userId === currentUser.id) return;
    if (!window.confirm("XÓA TÀI KHOẢN?")) return;
    setProcessing(true);
    try {
      await deleteDoc(doc(db, "users", userId));
      await fetchData();
    } catch (err) { console.error(err); } finally { setProcessing(false); }
  };

  const getAvatarUrl = (u: Partial<User>) => {
    if (u.avatar && u.avatar.startsWith('data:image')) return u.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'CB')}&background=1e293b&color=fff&bold=true&size=128`;
  };

  const filteredUsersMemo = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.name.toUpperCase().includes(searchStaff.toUpperCase());
      const matchAgency = filterAgency === 'all' || u.agencyId === filterAgency;
      return matchSearch && matchAgency;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, searchStaff, filterAgency]);

  if (loading) return <div className="p-20 text-center animate-pulse text-slate-400">Đang tải dữ liệu...</div>;

  return (
    <div className="space-y-8 pb-24">
      {processing && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-sm z-[200] flex items-center justify-center">
           <div className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <i className="fas fa-circle-notch animate-spin"></i>
              <span className="text-[10px] font-black uppercase">Đang xử lý...</span>
           </div>
        </div>
      )}

      {/* MODAL EDIT CYCLE */}
      {editingCycle && (
         <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 uppercase">Chỉnh sửa đợt đánh giá</h3>
                    <button onClick={() => setEditingCycle(null)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm"><i className="fas fa-times"></i></button>
                </div>
                
                <div className="overflow-y-auto p-8 space-y-10 custom-scrollbar flex-1">
                     <form id="edit-cycle-form" onSubmit={handleUpdateCycle} className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-8">
                             <div className="space-y-4">
                                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Thông tin cơ bản</label>
                                <input required value={editingCycle.name} onChange={e => setEditingCycle({...editingCycle, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase" placeholder="TÊN ĐỢT" />
                                <div className="grid grid-cols-2 gap-4">
                                   <input required type="date" value={editingCycle.startDate} onChange={e => setEditingCycle({...editingCycle, startDate: e.target.value})} className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold" />
                                   <input required type="date" value={editingCycle.endDate} onChange={e => setEditingCycle({...editingCycle, endDate: e.target.value})} className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold" />
                                </div>
                             </div>
                             
                             {/* EDIT TARGET AGENCIES */}
                             <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phạm vi áp dụng</label>
                                <div className="flex gap-4">
                                   <button type="button" onClick={() => setAllTargets(true)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${editingCycle.targetAgencyIds?.includes('all') ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>Toàn hệ thống</button>
                                   <button type="button" onClick={() => editingCycle.targetAgencyIds?.includes('all') && setEditingCycle({...editingCycle, targetAgencyIds: []})} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${!editingCycle.targetAgencyIds?.includes('all') ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>Tùy chọn cơ quan</button>
                                </div>
                                {!editingCycle.targetAgencyIds?.includes('all') && (
                                   <div className="grid grid-cols-2 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-48 overflow-y-auto custom-scrollbar">
                                      {agencies.map(a => (
                                        <label key={a.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                           <input 
                                              type="checkbox" 
                                              className="accent-blue-600 w-4 h-4"
                                              checked={editingCycle.targetAgencyIds?.includes(a.id)}
                                              onChange={() => toggleTargetAgency(a.id, true)}
                                           />
                                           <span className="text-[9px] font-bold text-slate-700 uppercase truncate">{a.name}</span>
                                        </label>
                                      ))}
                                   </div>
                                )}
                             </div>

                             <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                   <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Thang điểm Xếp loại</label>
                                   <button type="button" onClick={() => addRating(true)} className="text-[9px] font-black text-emerald-600 uppercase">+ Thêm hạng</button>
                                </div>
                                <div className="space-y-3">
                                   {editingCycle.ratings?.map(r => (
                                     <div key={r.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <input type="color" value={r.color} onChange={e => updateEditRating(r.id, 'color', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent" />
                                        <input value={r.label} onChange={e => updateEditRating(r.id, 'label', e.target.value.toUpperCase())} className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-black uppercase" />
                                        <input type="number" value={r.minScore} onChange={e => updateEditRating(r.id, 'minScore', parseFloat(e.target.value))} className="w-16 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-black" />
                                        <button type="button" onClick={() => removeRating(r.id, true)} className="text-rose-500 hover:text-rose-700 px-2"><i className="fas fa-trash"></i></button>
                                     </div>
                                   ))}
                                </div>
                             </div>
                        </div>

                        <div className="space-y-4">
                             <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Bộ tiêu chí đánh giá</label>
                             <div className="space-y-4">
                                {editingCycle.criteria?.map((c) => (
                                  <div key={c.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-3 relative">
                                     <input value={c.name} onChange={e => updateEditCriterion(c.id, 'name', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase" />
                                     <textarea value={c.description} rows={2} onChange={e => updateEditCriterion(c.id, 'description', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-2 rounded-xl text-[9px] font-medium" />
                                  </div>
                                ))}
                             </div>
                        </div>
                     </form>
                </div>

                <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex gap-4">
                    <button onClick={() => setEditingCycle(null)} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase">Hủy</button>
                    <button type="submit" form="edit-cycle-form" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Lưu thay đổi</button>
                </div>
            </div>
         </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase">Trung tâm Quản trị</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Hệ thống Phú Thọ Rate</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => setActiveSubTab('cycles')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${activeSubTab === 'cycles' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>Đợt Đánh giá</button>
          <button onClick={() => setActiveSubTab('accounts')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${activeSubTab === 'accounts' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>Tài khoản cán bộ</button>
        </div>
      </div>

      {activeSubTab === 'cycles' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div ref={formRef} className="xl:col-span-8 space-y-8 scroll-mt-24">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl">
               <h3 className="text-[11px] font-black text-slate-900 uppercase border-l-4 border-blue-600 pl-4 mb-10">Phát động Đợt Đánh giá mới</h3>
               <form onSubmit={handleCreateCycle} className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cấu hình chung</label>
                        <input required value={newCycle.name} onChange={e => setNewCycle({...newCycle, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase" placeholder="TÊN ĐỢT ĐÁNH GIÁ" />
                        <div className="grid grid-cols-2 gap-4">
                           <input required type="date" value={newCycle.startDate} onChange={e => setNewCycle({...newCycle, startDate: e.target.value})} className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold" />
                           <input required type="date" value={newCycle.endDate} onChange={e => setNewCycle({...newCycle, endDate: e.target.value})} className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold" />
                        </div>
                     </div>
                     
                     {/* CREATE TARGET AGENCIES */}
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phạm vi áp dụng</label>
                        <div className="flex gap-4">
                           <button type="button" onClick={() => setAllTargets(false)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${newCycle.targetAgencyIds?.includes('all') ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>Toàn hệ thống</button>
                           <button type="button" onClick={() => newCycle.targetAgencyIds?.includes('all') && setNewCycle({...newCycle, targetAgencyIds: []})} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${!newCycle.targetAgencyIds?.includes('all') ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>Tùy chọn cơ quan</button>
                        </div>
                        {!newCycle.targetAgencyIds?.includes('all') && (
                           <div className="grid grid-cols-2 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-48 overflow-y-auto custom-scrollbar animate-fade-in-up">
                              {agencies.map(a => (
                                <label key={a.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                   <input 
                                      type="checkbox" 
                                      className="accent-slate-900 w-4 h-4"
                                      checked={newCycle.targetAgencyIds?.includes(a.id)}
                                      onChange={() => toggleTargetAgency(a.id, false)}
                                   />
                                   <span className="text-[9px] font-bold text-slate-700 uppercase truncate">{a.name}</span>
                                </label>
                              ))}
                           </div>
                        )}
                     </div>

                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Thang điểm Xếp loại</label>
                           <button type="button" onClick={() => addRating(false)} className="text-[9px] font-black text-emerald-600 uppercase">+ Thêm hạng</button>
                        </div>
                        <div className="space-y-3">
                           {newCycle.ratings.map(r => (
                             <div key={r.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 transition-all hover:bg-white hover:shadow-md">
                                <input type="color" value={r.color} onChange={e => updateRating(r.id, 'color', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent" />
                                <input value={r.label} onChange={e => updateRating(r.id, 'label', e.target.value.toUpperCase())} className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-black uppercase" />
                                <input type="number" value={r.minScore} onChange={e => updateRating(r.id, 'minScore', parseFloat(e.target.value))} className="w-16 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-black" />
                                <button type="button" onClick={() => removeRating(r.id, false)} className="text-rose-500 hover:text-rose-700 px-2"><i className="fas fa-trash"></i></button>
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Bộ tiêu chí (100 điểm)</label>
                        <button type="button" onClick={addCycleCriterion} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg">+ Thêm mới</button>
                     </div>
                     <div className="space-y-4">
                        {newCycle.criteria.map((c) => (
                          <div key={c.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group relative space-y-3 hover:bg-white hover:border-blue-200 transition-all">
                             <input value={c.name} onChange={e => updateCriterion(c.id, 'name', e.target.value)} className="w-full bg-transparent border-none text-[12px] font-black text-slate-900 uppercase p-0 outline-none" placeholder="TÊN TIÊU CHÍ" />
                             <textarea value={c.description} rows={2} onChange={e => updateCriterion(c.id, 'description', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-[10px] text-slate-600 font-medium" placeholder="MÔ TẢ CĂN CỨ..." />
                             <button type="button" onClick={() => removeCycleCriterion(c.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-rose-500 p-2"><i className="fas fa-times"></i></button>
                          </div>
                        ))}
                     </div>
                     <button type="submit" disabled={processing} className="w-full bg-slate-900 text-white py-8 rounded-[3rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:bg-emerald-600 transition-all mt-6">
                        PHÁT ĐỘNG CHÍNH THỨC
                     </button>
                  </div>
               </form>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3">Lịch sử đợt đánh giá</h3>
             <div className="grid grid-cols-1 gap-4">
                {cycles.map((c) => (
                  <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-lg transition-all group border-b-4" style={{ borderColor: c.status === 'ACTIVE' ? '#10b981' : '#e2e8f0' }}>
                     <div className="mb-4">
                        <h4 className="text-[12px] font-black text-slate-900 uppercase mb-3 leading-snug group-hover:text-blue-600 transition-colors">{c.name}</h4>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                               <i className="far fa-calendar-alt"></i> {c.startDate} - {c.endDate}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                               <button onClick={() => handleExportCycleReport(c)} title="Báo cáo Excel" className="w-8 h-8 flex items-center justify-center text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><i className="fas fa-file-excel text-[10px]"></i></button>
                               <button onClick={() => handleCloneCycle(c)} title="Sao chép (Clone)" className="w-8 h-8 flex items-center justify-center text-slate-600 bg-slate-50 rounded-xl hover:bg-slate-900 hover:text-white transition-all"><i className="fas fa-copy text-[10px]"></i></button>
                               <button onClick={() => setEditingCycle(c)} title="Chỉnh sửa" className="w-8 h-8 flex items-center justify-center text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><i className="fas fa-edit text-[10px]"></i></button>
                            </div>
                        </div>

                        {c.targetAgencyIds && !c.targetAgencyIds.includes('all') && (
                           <div className="mt-3 flex flex-wrap gap-1">
                              {c.targetAgencyIds.slice(0, 3).map(aid => {
                                 const ag = agencies.find(a => a.id === aid);
                                 return ag ? <span key={aid} className="px-2 py-1 bg-slate-100 text-[7px] font-bold text-slate-500 uppercase rounded-md">{ag.name}</span> : null;
                              })}
                              {c.targetAgencyIds.length > 3 && <span className="px-2 py-1 bg-slate-100 text-[7px] font-bold text-slate-500 uppercase rounded-md">+{c.targetAgencyIds.length - 3}</span>}
                           </div>
                        )}
                        {(!c.targetAgencyIds || c.targetAgencyIds.includes('all')) && (
                           <div className="mt-3">
                              <span className="px-2 py-1 bg-blue-50 text-[7px] font-bold text-blue-600 uppercase rounded-md">Toàn hệ thống</span>
                           </div>
                        )}
                     </div>
                     <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                        <span className={`px-3 py-1 rounded-xl text-[8px] font-black uppercase ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                           {c.status === 'ACTIVE' ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                        </span>
                        <button onClick={() => updateStatus(c.id, c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')} className="text-[9px] font-black text-slate-600 uppercase hover:text-blue-600 transition-colors">
                           {c.status === 'ACTIVE' ? 'Dừng đợt' : 'Mở lại'}
                        </button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-center">
              <div className="relative flex-1 w-full group">
                 <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600"></i>
                 <input value={searchStaff} onChange={e => setSearchStaff(e.target.value)} placeholder="TÌM KIẾM TÊN CÁN BỘ..." className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-[11px] font-black uppercase outline-none focus:bg-white focus:border-blue-600 transition-all" />
              </div>
              <select value={filterAgency} onChange={e => setFilterAgency(e.target.value)} className="w-full md:w-64 bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none focus:bg-white focus:border-blue-600 transition-all">
                  <option value="all">TẤT CẢ CƠ QUAN</option>
                  {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredUsersMemo.map(u => (
                <div key={u.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between">
                   <div className="flex items-center gap-4 mb-6">
                      <img src={getAvatarUrl(u)} className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-50 shadow-md group-hover:scale-110 transition-transform" />
                      <div className="min-w-0">
                         <h4 className="text-[11px] font-black text-slate-900 uppercase truncate group-hover:text-blue-600 transition-colors">{u.name}</h4>
                         <p className="text-[8px] text-slate-400 font-bold uppercase truncate">{u.position} | {u.department}</p>
                      </div>
                   </div>
                   
                   <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                         <i className="fas fa-building text-[10px] text-slate-400"></i>
                         <p className="text-[8px] font-black text-slate-500 uppercase truncate">{agencies.find(a => a.id === u.agencyId)?.name || 'Hệ thống'}</p>
                      </div>
                      <div className={`flex items-center justify-center gap-2 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest ${u.role === 'ADMIN' ? 'bg-slate-900 text-white' : u.role === 'LEADER' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                         {u.role === 'ADMIN' ? 'Quản trị viên' : u.role === 'LEADER' ? 'Lãnh đạo đơn vị' : 'Cán bộ nhân viên'}
                      </div>
                   </div>

                   <div className="flex gap-2 pt-4 border-t border-slate-50">
                      <div className="flex-1 flex gap-1">
                         <button onClick={() => changeUserRole(u.id, u.role === 'EMPLOYEE' ? 'LEADER' : 'EMPLOYEE')} className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl text-[8px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all"><i className="fas fa-exchange-alt"></i></button>
                         <button onClick={() => changeUserRole(u.id, 'ADMIN')} className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl text-[8px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all"><i className="fas fa-shield-alt"></i></button>
                      </div>
                      <button onClick={() => deleteUser(u.id)} className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center"><i className="fas fa-trash-alt text-[10px]"></i></button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
