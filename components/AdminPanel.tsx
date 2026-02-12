
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp, query, orderBy, deleteDoc, writeBatch } from 'firebase/firestore';
import { User, Agency, EvaluationCycle, Criterion, RatingConfig, Role } from '../types';

interface AdminPanelProps { currentUser: User; }

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'cycles' | 'accounts'>('cycles');
  const [users, setUsers] = useState<User[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [cycles, setCycles] = useState<EvaluationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // States cho quản lý Cán bộ
  const [searchStaff, setSearchStaff] = useState('');
  const [filterAgency, setFilterAgency] = useState('all');

  // State cho việc chỉnh sửa
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

  // Lọc cán bộ
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.name.toUpperCase().includes(searchStaff.toUpperCase());
      const matchAgency = filterAgency === 'all' || u.agencyId === filterAgency;
      return matchSearch && matchAgency;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, searchStaff, filterAgency]);

  const changeUserRole = async (userId: string, newRole: Role) => {
    if (userId === currentUser.id) { alert("KHÔNG THỂ TỰ THAY ĐỔI QUYỀN CỦA CHÍNH MÌNH!"); return; }
    setProcessing(true);
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      fetchData();
    } catch (err) { console.error(err); }
    finally { setProcessing(false); }
  };

  const deleteUser = async (userId: string) => {
    if (userId === currentUser.id) { alert("KHÔNG THỂ XÓA TÀI KHOẢN ĐANG ĐĂNG NHẬP!"); return; }
    if (!window.confirm("BẠN CÓ CHẮC CHẮN MUỐN XÓA TÀI KHOẢN CÁN BỘ NÀY KHÔNG?")) return;
    setProcessing(true);
    try {
      await deleteDoc(doc(db, "users", userId));
      fetchData();
    } catch (err) { console.error(err); }
    finally { setProcessing(false); }
  };

  const handleCloneCycle = (cycle: EvaluationCycle) => {
    setNewCycle({
      name: `${cycle.name} (SAO CHÉP)`,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      targetAgencyIds: [...(cycle.targetAgencyIds || ['all'])],
      criteria: cycle.criteria.map(c => ({ ...c, id: `crit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` })),
      ratings: cycle.ratings.map(r => ({ ...r, id: `rate_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }))
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updateStatus = async (cycleId: string, status: EvaluationCycle['status']) => {
    setProcessing(true);
    try {
      await updateDoc(doc(db, "cycles", cycleId), { status });
      await fetchData();
    } catch (err: any) { console.error(err); } finally { setProcessing(false); }
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCycle.name) { alert("VUI LÒNG NHẬP TÊN ĐỢT"); return; }
    setProcessing(true);
    try {
      await addDoc(collection(db, "cycles"), {
        ...newCycle,
        status: 'ACTIVE',
        createdAt: serverTimestamp()
      });
      alert("ĐÃ PHÁT ĐỘNG ĐỢT ĐÁNH GIÁ THÀNH CÔNG!");
      fetchData();
      setNewCycle(prev => ({ ...prev, name: '', startDate: '', endDate: '' }));
    } catch (err) { console.error(err); }
    finally { setProcessing(false); }
  };

  const handleUpdateCycle = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingCycle) return;
      setProcessing(true);
      try {
          const cycleRef = doc(db, "cycles", editingCycle.id);
          const { id, ...updateData } = editingCycle;
          await updateDoc(cycleRef, updateData);
          alert("ĐÃ CẬP NHẬT THÔNG TIN ĐỢT ĐÁNH GIÁ!");
          setEditingCycle(null);
          fetchData();
      } catch (err: any) { console.error(err); } finally { setProcessing(false); }
  };

  // Quản lý Tiêu chí & Xếp loại (giữ nguyên logic đã có)
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
  const updateRating = (id: string, field: keyof RatingConfig, value: any) => {
    setNewCycle(prev => ({ ...prev, ratings: prev.ratings.map(r => r.id === id ? { ...r, [field]: field === 'minScore' ? parseFloat(value) : value } : r) }));
  };
  const updateEditRating = (id: string, field: keyof RatingConfig, value: any) => {
    if (!editingCycle) return;
    setEditingCycle(prev => prev ? ({ ...prev, ratings: prev.ratings.map(r => r.id === id ? { ...r, [field]: field === 'minScore' ? parseFloat(value) : value } : r) }) : null);
  };
  const addRating = () => {
    const newRate: RatingConfig = { id: `rate_${Date.now()}`, label: 'MỨC MỚI', minScore: 0, color: '#64748b', order: newCycle.ratings.length };
    setNewCycle(prev => ({ ...prev, ratings: [...prev.ratings, newRate] }));
  };
  const removeRating = (id: string) => {
    if (newCycle.ratings.length <= 1) return;
    setNewCycle(prev => ({ ...prev, ratings: prev.ratings.filter(r => r.id !== id) }));
  };

  const getAvatarUrl = (u: Partial<User>) => {
    if (u.avatar && u.avatar.startsWith('data:image')) return u.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'CB')}&background=1e293b&color=fff&bold=true&size=128`;
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-[10px] font-black uppercase text-slate-400 tracking-widest">Đang kết nối hệ thống...</div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-24 relative">
      {processing && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-[2px] z-[200] flex items-center justify-center">
           <div className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700">
              <i className="fas fa-circle-notch animate-spin text-sm text-blue-400"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">Đang xử lý dữ liệu...</span>
           </div>
        </div>
      )}

      {/* MODAL EDIT CYCLE (Giữ nguyên) */}
      {editingCycle && (
         <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
            <div className="bg-white w-full max-w-4xl h-full md:h-auto md:max-h-[95vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-scale-in border border-slate-100">
                <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Cập nhật đợt đánh giá</h3>
                    <button onClick={() => setEditingCycle(null)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm hover:text-rose-600 transition-all border border-slate-100 active:scale-90"><i className="fas fa-times"></i></button>
                </div>
                
                <div className="overflow-y-auto p-8 space-y-10 custom-scrollbar flex-1">
                     <form id="edit-cycle-form" onSubmit={handleUpdateCycle} className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-2 md:col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên đợt</label>
                                <input required value={editingCycle.name} onChange={e => setEditingCycle({...editingCycle, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase focus:border-blue-500 outline-none transition-all shadow-sm" />
                             </div>
                             <div className="space-y-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Từ ngày</label>
                                  <input required type="date" value={editingCycle.startDate} onChange={e => setEditingCycle({...editingCycle, startDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold shadow-sm" />
                             </div>
                             <div className="space-y-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Đến ngày</label>
                                  <input required type="date" value={editingCycle.endDate} onChange={e => setEditingCycle({...editingCycle, endDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold shadow-sm" />
                             </div>
                        </div>

                        <div className="space-y-4">
                             <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Bộ tiêu chí</label>
                             <div className="grid grid-cols-1 gap-4">
                                {editingCycle.criteria?.map((c) => (
                                  <div key={c.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col gap-4 shadow-sm">
                                     <input value={c.name} onChange={e => updateEditCriterion(c.id, 'name', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500" />
                                     <textarea value={c.description} rows={2} onChange={e => updateEditCriterion(c.id, 'description', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-[9px] font-medium leading-relaxed outline-none focus:border-blue-500" />
                                  </div>
                                ))}
                             </div>
                        </div>

                        <div className="space-y-6">
                             <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">XẾP LOẠI & THANG ĐIỂM</label>
                             <div className="grid grid-cols-1 gap-4">
                                {editingCycle.ratings?.map((r) => (
                                  <div key={r.id} className="bg-slate-50/50 p-5 rounded-[1.5rem] border border-slate-100 flex flex-col md:flex-row items-center gap-4">
                                     <input value={r.label} onChange={e => updateEditRating(r.id, 'label', e.target.value.toUpperCase())} className="flex-[2] w-full bg-white border border-slate-200 px-5 py-3 rounded-xl text-[10px] font-black uppercase outline-none focus:border-emerald-500 shadow-sm" />
                                     <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-xl border border-slate-200 shadow-sm flex-1 w-full">
                                        <div className="flex flex-col shrink-0">
                                           <span className="text-[7px] font-black text-slate-400 uppercase leading-none">ĐIỂM SÀN:</span>
                                        </div>
                                        <input type="number" step="0.1" value={r.minScore} onChange={e => updateEditRating(r.id, 'minScore', e.target.value)} className="w-full bg-transparent text-sm font-black text-center outline-none" />
                                     </div>
                                     <div className="relative w-12 h-10 rounded-xl overflow-hidden border border-slate-200 shrink-0 shadow-sm" style={{ backgroundColor: r.color }}>
                                          <input type="color" value={r.color} onChange={e => updateEditRating(r.id, 'color', e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                     </div>
                                  </div>
                                ))}
                             </div>
                        </div>
                     </form>
                </div>

                <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex gap-4 shrink-0">
                    <button onClick={() => setEditingCycle(null)} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-slate-100">Hủy</button>
                    <button type="submit" form="edit-cycle-form" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all hover:bg-slate-900 active:scale-95">Lưu thay đổi</button>
                </div>
            </div>
         </div>
      )}

      {/* HEADER QUẢN TRỊ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">Trung tâm Quản trị</h1>
          <p className="text-slate-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-1">Hệ thống Phú Thọ Rate</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => setActiveSubTab('cycles')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${activeSubTab === 'cycles' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Đợt ĐG</button>
          <button onClick={() => setActiveSubTab('accounts')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${activeSubTab === 'accounts' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Cán bộ</button>
        </div>
      </div>

      {activeSubTab === 'cycles' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Biểu mẫu tạo đợt đánh giá (Giữ nguyên giao diện đẹp đã có) */}
          <div ref={formRef} className="xl:col-span-8 space-y-8 animate-fade-in-up">
            <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-200 shadow-xl relative overflow-hidden">
               <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-10 border-l-4 border-blue-600 pl-4">Thiết lập Đợt Đánh giá mới</h3>
               <form onSubmit={handleCreateCycle} className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2 md:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên đợt đánh giá</label>
                        <input required value={newCycle.name} onChange={e => setNewCycle({...newCycle, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs md:text-sm font-black uppercase focus:border-blue-500 outline-none transition-all shadow-sm" placeholder="VD: ĐÁNH GIÁ THÁNG 03/2026" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Từ ngày</label>
                        <input required type="date" value={newCycle.startDate} onChange={e => setNewCycle({...newCycle, startDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs md:text-sm font-black focus:border-blue-500 outline-none transition-all shadow-sm" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Đến ngày</label>
                        <input required type="date" value={newCycle.endDate} onChange={e => setNewCycle({...newCycle, endDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs md:text-sm font-black focus:border-blue-500 outline-none transition-all shadow-sm" />
                     </div>
                  </div>
                  
                  {/* Bộ Tiêu chí */}
                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Bộ tiêu chí (100 điểm)</label>
                        <button type="button" onClick={addCycleCriterion} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:bg-slate-900 transition-all shadow-lg">+ Thêm mới</button>
                     </div>
                     <div className="grid grid-cols-1 gap-6">
                        {newCycle.criteria.map((c) => (
                          <div key={c.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group relative space-y-4 transition-all hover:bg-white hover:border-blue-200 hover:shadow-xl">
                             <input value={c.name} onChange={e => updateCriterion(c.id, 'name', e.target.value)} className="w-full bg-transparent border-none text-[12px] font-black text-slate-900 uppercase p-0 outline-none" placeholder="Tên tiêu chí" />
                             <textarea value={c.description} rows={2} onChange={e => updateCriterion(c.id, 'description', e.target.value)} className="w-full bg-white border border-slate-200 px-5 py-4 rounded-xl text-[10px] text-slate-600 font-medium leading-relaxed outline-none focus:border-blue-400" placeholder="Chi tiết các đầu việc căn cứ..." />
                             <button type="button" onClick={() => removeCycleCriterion(c.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-rose-500 p-3 hover:bg-rose-50 rounded-xl transition-all"><i className="fas fa-times text-sm"></i></button>
                          </div>
                        ))}
                     </div>
                  </div>

                  {/* Xếp loại - 1 hàng ngang cực đẹp */}
                  <div className="space-y-8">
                     <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black text-[#059669] uppercase tracking-widest ml-1">XẾP LOẠI & THANG ĐIỂM</label>
                        <button type="button" onClick={addRating} className="bg-[#059669] text-white px-6 py-2.5 rounded-2xl text-[9px] font-black uppercase hover:bg-slate-900 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center gap-2">
                          <i className="fas fa-plus"></i> THÊM MỨC
                        </button>
                     </div>
                     <div className="grid grid-cols-1 gap-4">
                        {newCycle.ratings.map((r) => (
                          <div key={r.id} className="bg-slate-50/50 p-5 rounded-[2.5rem] border border-slate-100 group relative flex flex-col md:flex-row items-center gap-5 hover:shadow-2xl hover:bg-white transition-all">
                             <input value={r.label} onChange={e => updateRating(r.id, 'label', e.target.value.toUpperCase())} className="flex-[3] w-full bg-white border border-slate-200 px-6 py-4 rounded-2xl text-[11px] font-black uppercase outline-none focus:border-emerald-500 shadow-sm transition-all" placeholder="Tên xếp loại" />
                             <div className="flex items-center gap-4 px-6 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm flex-[2] w-full group-focus-within:border-emerald-500 transition-all">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter shrink-0">ĐIỂM SÀN:</span>
                                <input type="number" step="0.1" value={r.minScore} onChange={e => updateRating(r.id, 'minScore', e.target.value)} className="w-full bg-transparent text-base font-black text-center outline-none" />
                             </div>
                             <div className="relative w-16 h-12 rounded-2xl overflow-hidden border border-slate-200 shrink-0 shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: r.color }}>
                                <input type="color" value={r.color} onChange={e => updateRating(r.id, 'color', e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                             </div>
                             <button type="button" onClick={() => removeRating(r.id)} className="absolute -top-3 -right-3 bg-white text-rose-500 w-10 h-10 rounded-full border border-rose-100 opacity-0 group-hover:opacity-100 shadow-2xl transition-all flex items-center justify-center hover:bg-rose-500 hover:text-white active:scale-90"><i className="fas fa-times text-xs"></i></button>
                          </div>
                        ))}
                     </div>
                  </div>

                  <button disabled={processing} className="w-full bg-slate-900 text-white py-8 rounded-[3rem] font-black text-xs md:text-sm uppercase tracking-[0.4em] shadow-2xl shadow-blue-500/10 disabled:opacity-50 hover:bg-emerald-600 transition-all active:scale-[0.98]">
                     PHÁT ĐỘNG ĐỢT ĐÁNH GIÁ CHÍNH THỨC
                  </button>
               </form>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3">Hoạt động gần đây</h3>
             <div className="grid grid-cols-1 gap-4">
                {cycles.map((c) => (
                  <div key={c.id} className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-lg transition-all group border-b-4" style={{ borderColor: c.status === 'ACTIVE' ? '#10b981' : '#e2e8f0' }}>
                     <div className="mb-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                           <h4 className="text-[12px] font-black text-slate-900 uppercase truncate pr-4 group-hover:text-blue-600 transition-colors">{c.name}</h4>
                           <div className="flex items-center gap-2 shrink-0">
                               <button onClick={() => handleCloneCycle(c)} title="Nhân bản" className="w-9 h-9 flex items-center justify-center text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100"><i className="fas fa-copy text-[10px]"></i></button>
                               <button onClick={() => setEditingCycle(c)} title="Sửa" className="w-9 h-9 flex items-center justify-center text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100"><i className="fas fa-edit text-[10px]"></i></button>
                           </div>
                        </div>
                        <div className="flex items-center gap-2 text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                           <i className="far fa-calendar-alt"></i>
                           {c.startDate} <i className="fas fa-long-arrow-alt-right mx-1"></i> {c.endDate}
                        </div>
                     </div>
                     <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                        <span className={`px-3 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                           {c.status === 'ACTIVE' ? 'ĐANG MỞ' : 'TẠM DỪNG'}
                        </span>
                        <button onClick={() => updateStatus(c.id, c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')} className="text-[9px] font-black text-slate-600 uppercase hover:text-blue-600 transition-colors flex items-center gap-2">
                           <i className={`fas ${c.status === 'ACTIVE' ? 'fa-pause-circle' : 'fa-play-circle'}`}></i>
                           {c.status === 'ACTIVE' ? 'Dừng' : 'Mở'}
                        </button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      ) : (
        /* MỤC QUẢN LÝ CÁN BỘ - TRƯỚC ĐÓ BỊ TRỐNG */
        <div className="space-y-8 animate-fade-in">
           {/* Thanh công cụ lọc */}
           <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-center">
              <div className="relative flex-1 w-full group">
                 <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors"></i>
                 <input 
                   value={searchStaff} 
                   onChange={e => setSearchStaff(e.target.value)} 
                   placeholder="TÌM KIẾM THEO TÊN CÁN BỘ..." 
                   className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-[11px] font-black uppercase outline-none focus:bg-white focus:border-blue-600 transition-all shadow-sm"
                 />
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest hidden lg:block">Cơ quan:</span>
                 <select 
                   value={filterAgency} 
                   onChange={e => setFilterAgency(e.target.value)} 
                   className="flex-1 md:w-64 bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none focus:bg-white focus:border-blue-600 shadow-sm transition-all"
                 >
                    <option value="all">TẤT CẢ CƠ QUAN</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                 </select>
              </div>
           </div>

           {/* Grid cán bộ */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredUsers.map(u => (
                <div key={u.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between">
                   <div className="flex items-center gap-4 mb-6">
                      <img 
                        src={getAvatarUrl(u)} 
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-50 bg-slate-100 shadow-md group-hover:scale-110 transition-transform" 
                        alt="" 
                      />
                      <div className="min-w-0">
                         <h4 className="text-[11px] font-black text-slate-900 uppercase truncate group-hover:text-blue-600 transition-colors">{u.name}</h4>
                         <p className="text-[8px] text-slate-400 font-bold uppercase truncate">{u.position} | {u.department}</p>
                      </div>
                   </div>
                   
                   <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                         <i className="fas fa-building text-[10px] text-slate-400 shrink-0"></i>
                         <p className="text-[8px] font-black text-slate-500 uppercase truncate">{agencies.find(a => a.id === u.agencyId)?.name || 'Hệ thống'}</p>
                      </div>
                      <div className={`flex items-center justify-center gap-2 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest ${
                         u.role === 'ADMIN' ? 'bg-slate-900 text-white' : 
                         u.role === 'LEADER' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 
                         'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>
                         <i className={`fas ${u.role === 'ADMIN' ? 'fa-user-shield' : u.role === 'LEADER' ? 'fa-user-tie' : 'fa-user-check'}`}></i>
                         {u.role === 'ADMIN' ? 'Quản trị viên' : u.role === 'LEADER' ? 'Lãnh đạo đơn vị' : 'Cán bộ nhân viên'}
                      </div>
                   </div>

                   <div className="flex gap-2 pt-4 border-t border-slate-50">
                      <div className="flex-1 flex gap-1">
                         <button 
                           onClick={() => changeUserRole(u.id, u.role === 'EMPLOYEE' ? 'LEADER' : 'EMPLOYEE')}
                           title="Nâng/Hạ cấp"
                           className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl text-[8px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                         >
                            <i className="fas fa-exchange-alt"></i>
                         </button>
                         <button 
                           onClick={() => changeUserRole(u.id, 'ADMIN')}
                           title="Gán Admin"
                           className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl text-[8px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                         >
                            <i className="fas fa-shield-alt"></i>
                         </button>
                      </div>
                      <button 
                        onClick={() => deleteUser(u.id)}
                        className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all active:scale-95 flex items-center justify-center border border-rose-100 shadow-sm"
                      >
                         <i className="fas fa-trash-alt text-[10px]"></i>
                      </button>
                   </div>
                </div>
              ))}

              {filteredUsers.length === 0 && (
                <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                      <i className="fas fa-users-slash text-2xl"></i>
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Không tìm thấy cán bộ nào trong danh sách hiện tại</p>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
