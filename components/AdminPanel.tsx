
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp, query, orderBy, deleteDoc } from 'firebase/firestore';
import { User, Agency, EvaluationCycle } from '../types';

interface AdminPanelProps {
  currentUser: User;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'cycles' | 'accounts'>('accounts');
  const [users, setUsers] = useState<User[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [cycles, setCycles] = useState<EvaluationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Xác định quyền tối cao
  const isSuperAdmin = currentUser.email === 'duyhanh@thucuc.com';

  const [newCycle, setNewCycle] = useState({ name: '', startDate: '', endDate: '', status: 'ACTIVE' as const });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userSnap, agencySnap, cycleSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "agencies")),
        getDocs(query(collection(db, "cycles"), orderBy("startDate", "desc")))
      ]);
      
      const usersList = userSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));
      setUsers(usersList);
      
      const agenciesData = agencySnap.docs.map(d => ({ id: d.id, ...d.data() } as Agency));
      setAgencies(agenciesData);
      setCycles(cycleSnap.docs.map(d => ({ id: d.id, ...d.data() } as EvaluationCycle)));
    } catch (error) {
      console.error("Lỗi nạp dữ liệu Admin:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const deleteAccount = async (id: string, name: string) => {
    console.log("Đang yêu cầu xóa ID:", id);
    
    if (id === currentUser.id) {
      alert("KHÔNG THỂ TỰ XÓA TÀI KHOẢN CỦA CHÍNH MÌNH!");
      return;
    }
    
    const confirmed = window.confirm(`CẢNH BÁO: HÀNH ĐỘNG NÀY KHÔNG THỂ KHÔI PHỤC.\nXÁC NHẬN XÓA TÀI KHOẢN: ${name.toUpperCase()}?`);
    
    if (confirmed) {
      setDeletingId(id);
      try {
        await deleteDoc(doc(db, "users", id));
        alert("ĐÃ XÓA TÀI KHOẢN KHỎI HỆ THỐNG!");
        setUsers(prev => prev.filter(u => u.id !== id));
      } catch (err) {
        console.error("Lỗi Firestore khi xóa:", err);
        alert("LỖI: HỆ THỐNG TỪ CHỐI QUYỀN TRUY CẬP!");
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      await addDoc(collection(db, "cycles"), {
        ...newCycle,
        createdAt: serverTimestamp()
      });
      alert("ĐÃ KHỞI TẠO ĐỢT BÌNH CHỌN!");
      fetchData();
    } catch (err) { console.error(err); }
    finally { setProcessing(false); }
  };

  const setPresetCycle = (type: 'month' | 'quarter') => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (type === 'month') {
      setNewCycle({
        name: `ĐÁNH GIÁ THÁNG ${now.getMonth() + 1}/${now.getFullYear()}`,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        status: 'ACTIVE'
      });
    } else {
      const quarter = Math.floor(now.getMonth() / 3) + 1;
      const qStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
      const qEnd = new Date(now.getFullYear(), quarter * 3, 0);
      setNewCycle({
        name: `ĐÁNH GIÁ QUÝ ${quarter}/${now.getFullYear()}`,
        startDate: qStart.toISOString().split('T')[0],
        endDate: qEnd.toISOString().split('T')[0],
        status: 'ACTIVE'
      });
    }
  };

  const toggleCycleStatus = async (cycleId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
    try {
      await updateDoc(doc(db, "cycles", cycleId), { status: newStatus });
      fetchData();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-black uppercase text-[10px]">Đang nạp dữ liệu quản trị...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase">Quản trị Hệ thống Phú Thọ Rate</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Hồ sơ quản trị: {currentUser.email}</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => setActiveSubTab('accounts')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'accounts' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Nhân sự</button>
          <button onClick={() => setActiveSubTab('cycles')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'cycles' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Đợt đánh giá</button>
        </div>
      </div>

      {activeSubTab === 'accounts' && (
        <div className="animate-in fade-in">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Danh sách cán bộ hệ thống</h3>
              <span className="bg-slate-200 text-slate-600 text-[9px] font-black px-3 py-1 rounded-full uppercase">{users.length} Hồ sơ</span>
            </div>
            <div className="overflow-y-auto max-h-[600px]">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-900 uppercase leading-none mb-1">{u.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold">{u.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[10px] font-black text-slate-600 uppercase">
                          {agencies.find(a => a.id === u.agencyId)?.name || 'HỆ THỐNG'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={(e) => { e.preventDefault(); deleteAccount(u.id, u.name); }} 
                          disabled={deletingId === u.id || u.id === currentUser.id}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${u.id === currentUser.id ? 'opacity-0 pointer-events-none' : 'text-slate-300 hover:bg-rose-50 hover:text-rose-600 active:scale-90'}`}
                          title="Xóa tài khoản"
                        >
                          {deletingId === u.id ? (
                            <i className="fas fa-circle-notch animate-spin text-rose-500"></i>
                          ) : (
                            <i className="fas fa-trash-alt"></i>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px]">Hệ thống rỗng</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'cycles' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-right-4">
           <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl">
              <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-8 border-l-4 border-emerald-500 pl-4">Thiết lập đợt đánh giá</h3>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <button onClick={() => setPresetCycle('month')} className="bg-blue-50 text-blue-700 py-4 rounded-xl font-black text-[10px] uppercase border-2 border-transparent hover:border-blue-200 transition-all">THÁNG HIỆN TẠI</button>
                <button onClick={() => setPresetCycle('quarter')} className="bg-emerald-50 text-emerald-700 py-4 rounded-xl font-black text-[10px] uppercase border-2 border-transparent hover:border-emerald-200 transition-all">QUÝ HIỆN TẠI</button>
              </div>
              <form onSubmit={handleCreateCycle} className="space-y-6">
                <input required value={newCycle.name} onChange={e => setNewCycle({...newCycle, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-6 py-4 text-xs font-black uppercase" placeholder="TÊN ĐỢT BÌNH CHỌN" />
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Bắt đầu</label>
                    <input required type="date" value={newCycle.startDate} onChange={e => setNewCycle({...newCycle, startDate: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Kết thúc</label>
                    <input required type="date" value={newCycle.endDate} onChange={e => setNewCycle({...newCycle, endDate: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold" />
                  </div>
                </div>
                <button disabled={processing} className="w-full bg-slate-900 text-white py-5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                   {processing ? 'ĐANG KHỞI TẠO...' : 'PHÁT ĐỘNG BÌNH CHỌN'}
                </button>
              </form>
           </div>

           <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lịch sử đợt bình chọn</h3>
              {cycles.map(c => (
                <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">{c.name}</h4>
                    <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">{c.startDate} ĐẾN {c.endDate}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleCycleStatus(c.id, c.status)} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>
                      {c.status === 'ACTIVE' ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                    </button>
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
