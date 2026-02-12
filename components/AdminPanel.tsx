
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp, query, orderBy, deleteDoc, writeBatch } from 'firebase/firestore';
import { User, Agency, EvaluationCycle, Criterion, RatingConfig } from '../types';

interface AdminPanelProps { currentUser: User; }

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'cycles' | 'accounts'>('cycles');
  const [users, setUsers] = useState<User[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [cycles, setCycles] = useState<EvaluationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

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
      { id: 'r1', label: 'XUẤT SẮC', minScore: 9.0, color: '#10b981', order: 0 },
      { id: 'r2', label: 'TỐT', minScore: 8.0, color: '#3b82f6', order: 1 },
      { id: 'r3', label: 'KHÁ', minScore: 6.5, color: '#f59e0b', order: 2 },
      { id: 'r4', label: 'TRUNG BÌNH', minScore: 5.0, color: '#64748b', order: 3 },
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

  const updateStatus = async (cycleId: string, status: EvaluationCycle['status']) => {
    setProcessing(true);
    try {
      await updateDoc(doc(db, "cycles", cycleId), { status });
      await fetchData();
    } catch (err: any) { 
      console.error(err);
      if (err.code === 'permission-denied') {
        alert("BẠN KHÔNG CÓ QUYỀN THỰC HIỆN THAO TÁC NÀY (HỆ THỐNG TỪ CHỐI).");
      }
    } finally { setProcessing(false); }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (userToDelete.id === currentUser.id) {
      alert("BẠN KHÔNG THỂ TỰ XÓA TÀI KHOẢN ĐANG SỬ DỤNG.");
      return;
    }
    
    if (window.confirm(`XÁC NHẬN XÓA TÀI KHOẢN CỦA: ${userToDelete.name.toUpperCase()}?`)) {
      setProcessing(true);
      try {
        await deleteDoc(doc(db, "users", userToDelete.id));
        alert("ĐÃ XÓA TÀI KHOẢN THÀNH CÔNG.");
        await fetchData();
      } catch (err: any) { 
        console.error(err); 
        alert("LỖI KHI XÓA: " + err.message);
      } finally { setProcessing(false); }
    }
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCycle.name) { alert("VUI LÒNG NHẬP TÊN ĐỢT"); return; }
    if (!newCycle.targetAgencyIds || newCycle.targetAgencyIds.length === 0) {
        alert("VUI LÒNG CHỌN ÍT NHẤT MỘT CƠ QUAN HOẶC 'TOÀN HỆ THỐNG' ĐỂ ÁP DỤNG.");
        return;
    }
    
    setProcessing(true);
    try {
      await addDoc(collection(db, "cycles"), {
        ...newCycle,
        status: 'ACTIVE',
        createdAt: serverTimestamp()
      });
      alert("ĐÃ PHÁT ĐỘNG ĐỢT ĐÁNH GIÁ THÀNH CÔNG!");
      fetchData();
      setNewCycle(prev => ({ ...prev, name: '', startDate: '', endDate: '', targetAgencyIds: ['all'] }));
    } catch (err) { console.error(err); }
    finally { setProcessing(false); }
  };

  // --- LOGIC CẬP NHẬT (EDIT) ---
  const handleUpdateCycle = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingCycle) return;
      
      setProcessing(true);
      try {
          const cycleRef = doc(db, "cycles", editingCycle.id);
          // Loại bỏ field id ra khỏi object trước khi update
          const { id, ...updateData } = editingCycle;
          await updateDoc(cycleRef, updateData);
          alert("ĐÃ CẬP NHẬT THÔNG TIN ĐỢT ĐÁNH GIÁ!");
          setEditingCycle(null);
          fetchData();
      } catch (err: any) {
          console.error(err);
          alert("LỖI CẬP NHẬT: " + err.message);
      } finally {
          setProcessing(false);
      }
  };

  // --- LOGIC HELPER CHO FORM TẠO MỚI ---
  const updateCriterion = (id: string, field: keyof Criterion, value: string) => {
    setNewCycle(prev => ({
      ...prev,
      criteria: (prev.criteria || []).map(c => c.id === id ? { ...c, [field]: value.toUpperCase() } : c)
    }));
  };
  const addCycleCriterion = () => {
    const newCrit: Criterion = { id: `crit_${Date.now()}`, name: 'TIÊU CHÍ MỚI', description: 'MÔ TẢ', order: newCycle.criteria.length };
    setNewCycle(prev => ({ ...prev, criteria: [...prev.criteria, newCrit] }));
  };
  const removeCycleCriterion = (id: string) => {
    if (newCycle.criteria.length <= 1) return;
    setNewCycle(prev => ({ ...prev, criteria: prev.criteria.filter(c => c.id !== id) }));
  };
  const updateRatingValue = (id: string, field: keyof RatingConfig, value: any) => {
    setNewCycle(prev => {
      const updated = prev.ratings.map(r => r.id === id ? { ...r, [field]: field === 'label' ? value.toUpperCase() : value } : r);
      if (field === 'minScore') {
        return { ...prev, ratings: updated.sort((a, b) => b.minScore - a.minScore) };
      }
      return { ...prev, ratings: updated };
    });
  };
  const addCycleRating = () => {
    const newRate: RatingConfig = { id: `rate_${Date.now()}`, label: 'XẾP LOẠI MỚI', minScore: 0, color: '#64748b', order: newCycle.ratings.length };
    setNewCycle(prev => ({ ...prev, ratings: [...prev.ratings, newRate].sort((a, b) => b.minScore - a.minScore) }));
  };
  const removeCycleRating = (id: string) => {
    if (newCycle.ratings.length <= 1) return;
    setNewCycle(prev => ({ ...prev, ratings: prev.ratings.filter(r => r.id !== id) }));
  };
  const toggleAgencySelection = (agencyId: string) => {
    setNewCycle(prev => {
        let currentIds = [...prev.targetAgencyIds];
        if (agencyId === 'all') {
            return { ...prev, targetAgencyIds: ['all'] };
        } else {
            if (currentIds.includes('all')) currentIds = [agencyId];
            else if (currentIds.includes(agencyId)) currentIds = currentIds.filter(id => id !== agencyId);
            else currentIds.push(agencyId);
            return { ...prev, targetAgencyIds: currentIds };
        }
    });
  };

  // --- LOGIC HELPER CHO FORM CHỈNH SỬA (EDIT) ---
  const toggleEditAgency = (agencyId: string) => {
      if (!editingCycle) return;
      setEditingCycle(prev => {
          if(!prev) return null;
          let currentIds = [...(prev.targetAgencyIds || [])];
          if (agencyId === 'all') {
              return { ...prev, targetAgencyIds: ['all'] };
          } else {
              if (currentIds.includes('all')) currentIds = [agencyId];
              else if (currentIds.includes(agencyId)) currentIds = currentIds.filter(id => id !== agencyId);
              else currentIds.push(agencyId);
              return { ...prev, targetAgencyIds: currentIds };
          }
      });
  };
  const updateEditCriterion = (id: string, field: keyof Criterion, value: string) => {
      setEditingCycle(prev => prev ? ({
          ...prev,
          criteria: prev.criteria.map(c => c.id === id ? { ...c, [field]: value.toUpperCase() } : c)
      }) : null);
  };
  const addEditCriterion = () => {
    setEditingCycle(prev => {
        if(!prev) return null;
        const newCrit: Criterion = { id: `crit_edit_${Date.now()}`, name: 'TIÊU CHÍ', description: 'MÔ TẢ', order: prev.criteria.length };
        return { ...prev, criteria: [...prev.criteria, newCrit] };
    });
  };
  const removeEditCriterion = (id: string) => {
    setEditingCycle(prev => prev ? ({ ...prev, criteria: prev.criteria.filter(c => c.id !== id) }) : null);
  };
  const updateEditRating = (id: string, field: keyof RatingConfig, value: any) => {
      setEditingCycle(prev => {
          if(!prev) return null;
          const updated = prev.ratings.map(r => r.id === id ? { ...r, [field]: field === 'label' ? value.toUpperCase() : value } : r);
          if (field === 'minScore') updated.sort((a, b) => b.minScore - a.minScore);
          return { ...prev, ratings: updated };
      });
  };
  const addEditRating = () => {
      setEditingCycle(prev => {
          if(!prev) return null;
          const newRate: RatingConfig = { id: `rate_edit_${Date.now()}`, label: 'XẾP LOẠI', minScore: 0, color: '#64748b', order: prev.ratings.length };
          return { ...prev, ratings: [...prev.ratings, newRate].sort((a, b) => b.minScore - a.minScore) };
      });
  };
  const removeEditRating = (id: string) => {
      setEditingCycle(prev => prev ? ({ ...prev, ratings: prev.ratings.filter(r => r.id !== id) }) : null);
  };


  if (loading) return <div className="p-20 text-center animate-pulse text-[10px] font-black uppercase text-slate-400 tracking-widest">Đang kết nối hệ thống...</div>;

  return (
    <div className="space-y-8 pb-24 relative">
      {processing && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-[2px] z-[100] flex items-center justify-center">
           <div className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <i className="fas fa-circle-notch animate-spin"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">Đang cập nhật dữ liệu...</span>
           </div>
        </div>
      )}

      {/* MODAL CHỈNH SỬA ĐỢT ĐÁNH GIÁ */}
      {editingCycle && (
         <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
                <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase">Cập nhật đợt đánh giá</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">ID: {editingCycle.id}</p>
                    </div>
                    <button onClick={() => setEditingCycle(null)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm hover:text-rose-600 transition-colors"><i className="fas fa-times"></i></button>
                </div>
                
                <div className="overflow-y-auto p-8 space-y-10 custom-scrollbar">
                     <form id="edit-cycle-form" onSubmit={handleUpdateCycle} className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-2 md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên đợt</label>
                                <input required value={editingCycle.name} onChange={e => setEditingCycle({...editingCycle, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase focus:border-blue-500 outline-none transition-all" />
                             </div>
                             <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Từ ngày</label>
                                  <input required type="date" value={editingCycle.startDate} onChange={e => setEditingCycle({...editingCycle, startDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold" />
                             </div>
                             <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đến ngày</label>
                                  <input required type="date" value={editingCycle.endDate} onChange={e => setEditingCycle({...editingCycle, endDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold" />
                             </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest border-l-2 border-slate-300 pl-2">Phạm vi áp dụng</label>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-[200px] overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${editingCycle.targetAgencyIds?.includes('all') ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                        <input type="checkbox" className="hidden" checked={editingCycle.targetAgencyIds?.includes('all')} onChange={() => toggleEditAgency('all')} />
                                        <span className="text-[10px] font-black uppercase">Toàn hệ thống (Tất cả)</span>
                                    </label>
                                    {agencies.map(agency => (
                                        <label key={agency.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${editingCycle.targetAgencyIds?.includes(agency.id) ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-white border-slate-200'}`}>
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${editingCycle.targetAgencyIds?.includes(agency.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                                {editingCycle.targetAgencyIds?.includes(agency.id) && <i className="fas fa-check text-[8px] text-white"></i>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={editingCycle.targetAgencyIds?.includes(agency.id) || false} onChange={() => toggleEditAgency(agency.id)} />
                                            <span className={`text-[10px] font-black uppercase truncate ${editingCycle.targetAgencyIds?.includes(agency.id) ? 'text-blue-700' : 'text-slate-700'}`}>{agency.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                             <div className="flex items-center justify-between">
                                <label className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Bộ tiêu chí</label>
                                <button type="button" onClick={addEditCriterion} className="text-[9px] font-black uppercase text-blue-600 hover:underline">+ Thêm</button>
                             </div>
                             <div className="grid grid-cols-1 gap-3">
                                {editingCycle.criteria?.map((c) => (
                                  <div key={c.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex gap-3">
                                     <div className="flex-1 space-y-2">
                                         <input value={c.name} onChange={e => updateEditCriterion(c.id, 'name', e.target.value)} className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-[10px] font-black uppercase" placeholder="Tên tiêu chí" />
                                         <input value={c.description} onChange={e => updateEditCriterion(c.id, 'description', e.target.value)} className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-[9px] uppercase" placeholder="Mô tả" />
                                     </div>
                                     <button type="button" onClick={() => removeEditCriterion(c.id)} className="w-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg"><i className="fas fa-trash-alt"></i></button>
                                  </div>
                                ))}
                             </div>
                        </div>

                        <div className="space-y-4">
                             <div className="flex items-center justify-between">
                                <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Thang điểm</label>
                                <button type="button" onClick={addEditRating} className="text-[9px] font-black uppercase text-emerald-600 hover:underline">+ Thêm</button>
                             </div>
                             <div className="grid grid-cols-1 gap-3">
                                {editingCycle.ratings?.map((r) => (
                                  <div key={r.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                     <input type="color" value={r.color} onChange={e => updateEditRating(r.id, 'color', e.target.value)} className="w-6 h-6 rounded border-none p-0 cursor-pointer" />
                                     <input value={r.label} onChange={e => updateEditRating(r.id, 'label', e.target.value)} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg text-[10px] font-black uppercase" />
                                     <input type="number" step="0.1" value={r.minScore} onChange={e => updateEditRating(r.id, 'minScore', parseFloat(e.target.value))} className="w-16 bg-white border border-slate-200 px-2 py-2 rounded-lg text-[10px] font-black text-center" />
                                     <button type="button" onClick={() => removeEditRating(r.id)} className="w-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg"><i className="fas fa-trash-alt"></i></button>
                                  </div>
                                ))}
                             </div>
                        </div>
                     </form>
                </div>

                <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex gap-4 shrink-0">
                    <button onClick={() => setEditingCycle(null)} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Hủy bỏ</button>
                    <button type="submit" form="edit-cycle-form" disabled={processing} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all">
                        {processing ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </div>
         </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Trung tâm Quản trị</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Cấp quyền: {currentUser.name}</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => setActiveSubTab('cycles')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'cycles' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Đợt đánh giá</button>
          <button onClick={() => setActiveSubTab('accounts')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'accounts' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Cán bộ</button>
        </div>
      </div>

      {activeSubTab === 'cycles' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 space-y-8">
            <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-10 border-l-4 border-blue-600 pl-4">Thiết lập Đợt Đánh giá</h3>
               <form onSubmit={handleCreateCycle} className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên đợt đánh giá</label>
                        <input required value={newCycle.name} onChange={e => setNewCycle({...newCycle, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase focus:border-blue-500 outline-none transition-all" placeholder="VD: ĐÁNH GIÁ THÁNG 02/2026" />
                     </div>
                     <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Từ ngày</label>
                          <input required type="date" value={newCycle.startDate} onChange={e => setNewCycle({...newCycle, startDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold" />
                     </div>
                     <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đến ngày</label>
                          <input required type="date" value={newCycle.endDate} onChange={e => setNewCycle({...newCycle, endDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold" />
                     </div>
                  </div>

                  {/* KHU VỰC CHỌN PHẠM VI CƠ QUAN */}
                  <div className="space-y-3 animate-in slide-in-from-left-2">
                      <div className="flex items-center justify-between">
                         <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest border-l-2 border-slate-300 pl-2">Phạm vi áp dụng</label>
                         <span className="text-[9px] font-bold text-slate-400 italic">
                             {newCycle.targetAgencyIds.includes('all') ? 'Đang chọn: Toàn bộ hệ thống' : `Đang chọn: ${newCycle.targetAgencyIds.length} cơ quan cụ thể`}
                         </span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-[300px] overflow-y-auto custom-scrollbar">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Option All */}
                              <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${newCycle.targetAgencyIds.includes('all') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'}`}>
                                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${newCycle.targetAgencyIds.includes('all') ? 'bg-white border-white' : 'border-slate-300'}`}>
                                      {newCycle.targetAgencyIds.includes('all') && <i className="fas fa-check text-xs text-blue-600"></i>}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={newCycle.targetAgencyIds.includes('all')} onChange={() => toggleAgencySelection('all')} />
                                  <span className="text-[10px] font-black uppercase tracking-wider">Toàn hệ thống (Tất cả)</span>
                              </label>

                              {/* Agencies List */}
                              {agencies.map(agency => {
                                  const isSelected = newCycle.targetAgencyIds.includes(agency.id);
                                  return (
                                    <label key={agency.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                            {isSelected && <i className="fas fa-check text-xs text-white"></i>}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggleAgencySelection(agency.id)} />
                                        <div className="min-w-0">
                                            <p className={`text-[10px] font-black uppercase truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{agency.name}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">{agency.employeeCount || 0} nhân sự</p>
                                        </div>
                                    </label>
                                  );
                              })}
                          </div>
                      </div>
                  </div>
                  
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Bộ tiêu chí đánh giá</label>
                        <button type="button" onClick={addCycleCriterion} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:scale-105 transition-transform">+ Thêm tiêu chí</button>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {newCycle.criteria.map((c) => (
                          <div key={c.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 group relative">
                             <input value={c.name} onChange={e => updateCriterion(c.id, 'name', e.target.value)} className="w-full bg-transparent border-none text-[11px] font-black text-slate-900 uppercase p-0 mb-1 outline-none" placeholder="Tên tiêu chí" />
                             <textarea value={c.description} onChange={e => updateCriterion(c.id, 'description', e.target.value)} className="w-full bg-transparent border-none text-[9px] text-slate-400 font-bold uppercase p-0 outline-none" placeholder="Mô tả tiêu chí" rows={1} />
                             <button type="button" onClick={() => removeCycleCriterion(c.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-rose-500 transition-opacity p-2"><i className="fas fa-times"></i></button>
                          </div>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Thang điểm Xếp loại</label>
                        <button type="button" onClick={addCycleRating} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:scale-105 transition-transform">+ Thêm bậc xếp loại</button>
                     </div>
                     <div className="grid grid-cols-1 gap-3">
                        {newCycle.ratings.map((r) => (
                          <div key={r.id} className="flex flex-wrap md:flex-nowrap items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 group">
                             <div className="flex items-center gap-3 flex-1 min-w-[150px]">
                                <input type="color" value={r.color} onChange={e => updateRatingValue(r.id, 'color', e.target.value)} className="w-8 h-8 rounded-lg overflow-hidden border-none p-0 cursor-pointer" />
                                <input value={r.label} onChange={e => updateRatingValue(r.id, 'label', e.target.value)} className="bg-transparent border-none text-[11px] font-black text-slate-900 uppercase p-0 outline-none w-full" placeholder="VD: XUẤT SẮC" />
                             </div>
                             <div className="flex items-center gap-4 shrink-0">
                                <div className="flex flex-col">
                                   <label className="text-[7px] font-black text-slate-400 uppercase mb-1">Điểm sàn (Min)</label>
                                   <input type="number" step="0.1" value={r.minScore} onChange={e => updateRatingValue(r.id, 'minScore', parseFloat(e.target.value))} className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-black text-center" />
                                </div>
                                <button type="button" onClick={() => removeCycleRating(r.id)} className="w-8 h-8 flex items-center justify-center text-rose-400 hover:text-rose-600 transition-colors">
                                   <i className="fas fa-trash-alt text-xs"></i>
                                </button>
                             </div>
                          </div>
                        ))}
                     </div>
                  </div>

                  <button disabled={processing} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50 hover:bg-blue-600">
                     {processing ? 'HỆ THỐNG ĐANG XỬ LÝ...' : 'KÍCH HOẠT HỆ THỐNG ĐÁNH GIÁ'}
                  </button>
               </form>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Lịch sử vận hành</h3>
             <div className="space-y-4">
                {cycles.map(c => (
                  <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm group">
                     <div className="flex items-start justify-between mb-4">
                        <div className="min-w-0 flex-1 pr-2">
                           <div className="flex items-center gap-2 mb-1">
                               <h4 className="text-[11px] font-black text-slate-900 uppercase truncate">{c.name}</h4>
                               <button onClick={() => setEditingCycle(c)} className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors uppercase shrink-0"><i className="fas fa-edit mr-1"></i>Sửa</button>
                           </div>
                           <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">{c.startDate} → {c.endDate}</p>
                           <p className="text-[8px] text-blue-500 font-bold uppercase mt-2 leading-relaxed">
                              Phạm vi: {c.targetAgencyIds?.includes('all') 
                                ? 'TOÀN HỆ THỐNG' 
                                : c.targetAgencyIds?.map(id => agencies.find(a => a.id === id)?.name).filter(Boolean).join(', ')}
                           </p>
                        </div>
                        <div className="shrink-0">
                          {c.status === 'ACTIVE' && <span className="px-2 py-1 rounded-lg text-[7px] font-black bg-emerald-50 text-emerald-600 uppercase">Đang mở</span>}
                          {c.status === 'PAUSED' && <span className="px-2 py-1 rounded-lg text-[7px] font-black bg-amber-50 text-amber-600 uppercase">Tạm dừng</span>}
                          {c.status === 'CLOSED' && <span className="px-2 py-1 rounded-lg text-[7px] font-black bg-rose-50 text-rose-600 uppercase">Đã đóng</span>}
                        </div>
                     </div>
                     <div className="mt-3">
                        {c.status === 'PAUSED' ? (
                          <button onClick={() => updateStatus(c.id, 'ACTIVE')} className="w-full bg-emerald-50 text-emerald-600 py-3 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all">Mở lại hoạt động</button>
                        ) : c.status === 'ACTIVE' ? (
                          <button onClick={() => updateStatus(c.id, 'PAUSED')} className="w-full bg-amber-50 text-amber-600 py-3 rounded-xl text-[9px] font-black uppercase hover:bg-amber-600 hover:text-white transition-all">Tạm dừng đánh giá</button>
                        ) : (
                          <div className="w-full bg-slate-50 text-slate-400 py-3 rounded-xl text-[9px] font-black uppercase text-center border border-slate-100">Đã đóng</div>
                        )}
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {activeSubTab === 'accounts' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
           <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Cán bộ toàn hệ thống</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase">Tổng cộng: {users.length}</p>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                   <tr>
                      <th className="px-10 py-6">Định danh Cán bộ</th>
                      <th className="px-10 py-6">Đơn vị & Chức vụ</th>
                      <th className="px-10 py-6 text-right">Tác vụ Quản trị</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {users.map(u => (
                     <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-10 py-6">
                           <div className="flex items-center gap-4">
                              <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}`} className="w-12 h-12 rounded-2xl object-cover bg-slate-100 border border-slate-200" />
                              <div>
                                 <p className="text-[12px] font-black text-slate-900 uppercase leading-none mb-1">{u.name}</p>
                                 <p className="text-[9px] text-slate-400 font-bold">{u.email}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-10 py-6">
                           <p className="text-[10px] font-black text-slate-600 uppercase leading-tight">{agencies.find(a => a.id === u.agencyId)?.name || 'QUẢN TRỊ'}</p>
                           <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{u.position}</p>
                        </td>
                        <td className="px-10 py-6 text-right">
                           {u.id !== currentUser.id && (
                             <button onClick={() => handleDeleteUser(u)} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all flex items-center gap-2 ml-auto">
                                <i className="fas fa-user-minus"></i> Xóa tài khoản
                             </button>
                           )}
                        </td>
                     </tr>
                   ))}
                </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
