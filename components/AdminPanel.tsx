
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
      } catch (err: any) {
          console.error(err);
          alert("LỖI CẬP NHẬT: " + err.message);
      } finally {
          setProcessing(false);
      }
  };

  const updateCriterion = (id: string, field: keyof Criterion, value: string) => {
    setNewCycle(prev => ({
      ...prev,
      criteria: (prev.criteria || []).map(c => c.id === id ? { ...c, [field]: value.toUpperCase() } : c)
    }));
  };
  const addCycleCriterion = () => {
    const newCrit: Criterion = { id: `crit_${Date.now()}`, name: 'TIÊU CHÍ MỚI', description: 'NHẬP MÔ TẢ CHI TIẾT CĂN CỨ ĐÁNH GIÁ TẠI ĐÂY...', order: newCycle.criteria.length };
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
        const newCrit: Criterion = { id: `crit_edit_${Date.now()}`, name: 'TIÊU CHÍ', description: 'NHẬP MÔ TẢ...', order: prev.criteria.length };
        return { ...prev, criteria: [...prev.criteria, newCrit] };
    });
  };
  const removeEditCriterion = (id: string) => {
    setEditingCycle(prev => prev ? ({ ...prev, criteria: prev.criteria.filter(c => c.id !== id) }) : null);
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-[10px] md:text-xs font-black uppercase text-slate-400 tracking-widest">Đang kết nối hệ thống...</div>;

  return (
    <div className="space-y-6 md:space-y-8 pb-24 relative">
      {processing && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-[2px] z-[100] flex items-center justify-center">
           <div className="bg-slate-900 text-white px-6 md:px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <i className="fas fa-circle-notch animate-spin text-sm md:text-base"></i>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Đang cập nhật...</span>
           </div>
        </div>
      )}

      {/* MODAL EDIT - RESPONSIVE UI */}
      {editingCycle && (
         <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
            <div className="bg-white w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
                <div className="bg-slate-50 px-6 md:px-8 py-4 md:py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="min-w-0">
                        <h3 className="text-base md:text-lg font-black text-slate-900 uppercase truncate">Cập nhật đợt</h3>
                        <p className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest">ID: {editingCycle.id.slice(0, 8)}</p>
                    </div>
                    <button onClick={() => setEditingCycle(null)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white rounded-xl shadow-sm hover:text-rose-600 transition-colors"><i className="fas fa-times text-sm"></i></button>
                </div>
                
                <div className="overflow-y-auto p-6 md:p-8 space-y-8 md:space-y-10 custom-scrollbar flex-1">
                     <form id="edit-cycle-form" onSubmit={handleUpdateCycle} className="space-y-8 md:space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                             <div className="space-y-2 md:col-span-2">
                                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên đợt</label>
                                <input required value={editingCycle.name} onChange={e => setEditingCycle({...editingCycle, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-black uppercase focus:border-blue-500 outline-none transition-all" />
                             </div>
                             <div className="space-y-2">
                                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Từ ngày</label>
                                  <input required type="date" value={editingCycle.startDate} onChange={e => setEditingCycle({...editingCycle, startDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl px-4 py-3 text-xs font-bold" />
                             </div>
                             <div className="space-y-2">
                                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đến ngày</label>
                                  <input required type="date" value={editingCycle.endDate} onChange={e => setEditingCycle({...editingCycle, endDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl px-4 py-3 text-xs font-bold" />
                             </div>
                        </div>

                        <div className="space-y-4">
                             <div className="flex items-center justify-between">
                                <label className="text-[10px] md:text-[11px] font-black text-blue-600 uppercase tracking-widest">Bộ tiêu chí</label>
                                <button type="button" onClick={addEditCriterion} className="text-[8px] md:text-[9px] font-black uppercase text-blue-600 hover:underline">+ Thêm</button>
                             </div>
                             <div className="grid grid-cols-1 gap-4">
                                {editingCycle.criteria?.map((c) => (
                                  <div key={c.id} className="bg-slate-50 p-4 md:p-5 rounded-xl md:rounded-2xl border border-slate-100 flex flex-col gap-3">
                                     <div className="flex-1 space-y-3">
                                         <input value={c.name} onChange={e => updateEditCriterion(c.id, 'name', e.target.value)} className="w-full bg-white border border-slate-200 px-3 md:px-4 py-2 md:py-3 rounded-lg text-[10px] md:text-[11px] font-black uppercase outline-none focus:border-blue-400" placeholder="Tên tiêu chí" />
                                         <textarea value={c.description} rows={5} onChange={e => updateEditCriterion(c.id, 'description', e.target.value)} className="w-full bg-white border border-slate-200 px-3 md:px-4 py-2 md:py-3 rounded-lg text-[9px] md:text-[10px] font-medium leading-relaxed outline-none focus:border-blue-400 min-h-[120px]" placeholder="Mô tả căn cứ chi tiết..." />
                                     </div>
                                     <button type="button" onClick={() => removeEditCriterion(c.id)} className="self-end px-3 py-1.5 text-[8px] md:text-[9px] font-black uppercase text-rose-500 hover:bg-rose-50 rounded-lg flex items-center gap-2"><i className="fas fa-trash-alt"></i> Xóa</button>
                                  </div>
                                ))}
                             </div>
                        </div>
                     </form>
                </div>

                <div className="bg-slate-50 px-6 md:px-8 py-4 md:py-6 border-t border-slate-100 flex gap-3 md:gap-4 shrink-0">
                    <button onClick={() => setEditingCycle(null)} className="flex-1 py-3 md:py-4 bg-white border border-slate-200 text-slate-600 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-slate-100">Hủy</button>
                    <button type="submit" form="edit-cycle-form" disabled={processing} className="flex-1 py-3 md:py-4 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20">
                        {processing ? 'Lưu...' : 'Cập nhật'}
                    </button>
                </div>
            </div>
         </div>
      )}

      {/* HEADER QUẢN TRỊ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Trung tâm Quản trị</h1>
          <p className="text-slate-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest mt-1">Hệ thống Phú Thọ Rate</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
          <button onClick={() => setActiveSubTab('cycles')} className={`flex-1 md:flex-none px-4 md:px-6 py-2 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase transition-all ${activeSubTab === 'cycles' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Đợt ĐG</button>
          <button onClick={() => setActiveSubTab('accounts')} className={`flex-1 md:flex-none px-4 md:px-6 py-2 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase transition-all ${activeSubTab === 'accounts' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Cán bộ</button>
        </div>
      </div>

      {activeSubTab === 'cycles' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">
          <div className="xl:col-span-8 space-y-6 md:space-y-8">
            <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-xl">
               <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-widest mb-6 md:mb-10 border-l-4 border-blue-600 pl-4">Thiết lập Đợt Đánh giá mới</h3>
               <form onSubmit={handleCreateCycle} className="space-y-8 md:space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                     <div className="space-y-2 md:col-span-2">
                        <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên đợt đánh giá</label>
                        <input required value={newCycle.name} onChange={e => setNewCycle({...newCycle, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-black uppercase focus:border-blue-500 outline-none" placeholder="VD: THÁNG 02/2026" />
                     </div>
                  </div>
                  
                  <div className="space-y-4 md:space-y-6">
                     <div className="flex items-center justify-between">
                        <label className="text-[10px] md:text-[11px] font-black text-blue-600 uppercase tracking-widest">Tiêu chí (Thang điểm 100)</label>
                        <button type="button" onClick={addCycleCriterion} className="bg-blue-600 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase hover:scale-105">+ Thêm</button>
                     </div>
                     <div className="grid grid-cols-1 gap-4 md:gap-6">
                        {newCycle.criteria.map((c) => (
                          <div key={c.id} className="bg-slate-50 p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 group relative space-y-3 md:space-y-4 transition-all hover:bg-white hover:border-blue-200">
                             <input value={c.name} onChange={e => updateCriterion(c.id, 'name', e.target.value)} className="w-full bg-transparent border-none text-[11px] font-black text-slate-900 uppercase p-0 outline-none" placeholder="Tên tiêu chí" />
                             <textarea value={c.description} rows={4} onChange={e => updateCriterion(c.id, 'description', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-[9px] md:text-[10px] text-slate-600 font-medium uppercase outline-none focus:border-blue-400 min-h-[100px]" placeholder="Căn cứ chấm điểm chi tiết..." />
                             <button type="button" onClick={() => removeCycleCriterion(c.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-rose-500 p-2"><i className="fas fa-times text-sm"></i></button>
                          </div>
                        ))}
                     </div>
                  </div>

                  <button disabled={processing} className="w-full bg-slate-900 text-white py-5 md:py-7 rounded-[1.5rem] md:rounded-[2.5rem] font-black text-[10px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.4em] shadow-2xl disabled:opacity-50 hover:bg-blue-600">
                     {processing ? 'ĐANG XỬ LÝ...' : 'PHÁT ĐỘNG ĐỢT ĐÁNH GIÁ'}
                  </button>
               </form>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-4 md:space-y-6">
             <h3 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Lịch sử hoạt động</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
                {cycles.map(c => (
                  <div key={c.id} className="bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between">
                     <div className="mb-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                           <h4 className="text-[10px] md:text-[11px] font-black text-slate-900 uppercase truncate pr-4">{c.name}</h4>
                           <button onClick={() => setEditingCycle(c)} className="w-8 h-8 flex items-center justify-center text-blue-600 bg-blue-50 rounded-lg shrink-0"><i className="fas fa-edit text-xs"></i></button>
                        </div>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">{c.startDate} → {c.endDate}</p>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                           {c.status === 'ACTIVE' ? 'Đang mở' : 'Đã dừng'}
                        </span>
                        <button onClick={() => updateStatus(c.id, c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')} className="text-[8px] font-black text-slate-500 uppercase hover:text-blue-600 transition-colors">
                           {c.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}
                        </button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {activeSubTab === 'accounts' && (
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
           <div className="p-5 md:p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
              <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-widest">Danh sách Cán bộ</h3>
              <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase">Tổng: {users.length}</p>
           </div>
           <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
              <table className="w-full text-left min-w-[500px]">
                <thead className="bg-white text-[8px] md:text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 sticky top-0 z-10">
                   <tr>
                      <th className="px-6 md:px-10 py-4 md:py-6">Họ tên & Email</th>
                      <th className="px-6 md:px-10 py-4 md:py-6">Đơn vị & Chức vụ</th>
                      <th className="px-6 md:px-10 py-4 md:py-6 text-right">Tác vụ</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {users.map(u => (
                     <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 md:px-10 py-4 md:py-6">
                           <div className="flex items-center gap-3 md:gap-4">
                              <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}`} className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover border border-slate-200" />
                              <div className="min-w-0">
                                 <p className="text-[10px] md:text-[12px] font-black text-slate-900 uppercase truncate max-w-[150px]">{u.name}</p>
                                 <p className="text-[7px] md:text-[8px] text-slate-400 font-bold truncate">{u.email}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 md:px-10 py-4 md:py-6">
                           <p className="text-[8px] md:text-[10px] font-black text-slate-600 uppercase truncate max-w-[150px]">{agencies.find(a => a.id === u.agencyId)?.name || 'N/A'}</p>
                           <p className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase mt-1">{u.position}</p>
                        </td>
                        <td className="px-6 md:px-10 py-4 md:py-6 text-right">
                           {u.id !== currentUser.id && (
                             <button onClick={() => handleDeleteUser(u)} className="p-2 md:px-4 md:py-2 text-rose-500 md:bg-rose-50 md:rounded-xl text-[10px] hover:md:bg-rose-600 hover:md:text-white transition-all">
                                <i className="fas fa-user-minus"></i> <span className="hidden md:inline font-black uppercase text-[8px] ml-1">Xóa</span>
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
