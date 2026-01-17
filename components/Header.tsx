
import React, { useState, useRef, useEffect } from 'react';
import { User, Agency } from '../types';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

interface HeaderProps {
  user: User;
  onSwitchUser: (user: User) => void;
}

const Header: React.FC<HeaderProps> = ({ user, onSwitchUser }) => {
  const [showProfile, setShowProfile] = useState(false);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [agencyName, setAgencyName] = useState<string>('ĐANG TẢI...');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Thống nhất logic lấy ảnh đại diện
  const getAvatarUrl = (u: User) => {
    return u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=3b82f6&color=fff&bold=true`;
  };

  useEffect(() => {
    const fetchAgency = async () => {
      if (!user) return;
      if (user.agencyId && user.agencyId !== 'all') {
        try {
          const agencyDoc = await getDoc(doc(db, "agencies", user.agencyId));
          if (agencyDoc.exists()) {
            setAgencyName(agencyDoc.data().name);
          } else {
            setAgencyName('CƠ QUAN KHÔNG XÁC ĐỊNH');
          }
        } catch (error) {
          console.error("Lỗi lấy tên cơ quan:", error);
          setAgencyName('LỖI KẾT NỐI');
        }
      } else {
        setAgencyName('HỆ THỐNG QUẢN TRỊ');
      }
    };
    if (showProfile && user) fetchAgency();
  }, [showProfile, user?.agencyId, user]);

  const handleLogout = async () => {
    try { await signOut(auth); } catch (err) { console.error(err); }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      if (file.size > 1024 * 1024) { alert("ẢNH QUÁ LỚN (TỐI ĐA 1MB)"); return; }
      setUpdatingAvatar(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          await updateDoc(doc(db, "users", user.id), { avatar: base64 });
          onSwitchUser({ ...user, avatar: base64 });
        } catch (err) { console.error(err); alert("LỖI CẬP NHẬT!"); }
        finally { setUpdatingAvatar(false); }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!user) return null;

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="md:hidden w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
          <i className="fas fa-bolt"></i>
        </div>
        <h2 className="text-sm md:text-xl font-black text-slate-800 uppercase truncate">
          {user.role === 'LEADER' ? 'Lãnh đạo' : user.role === 'ADMIN' ? 'Quản trị' : 'Cán bộ'}
        </h2>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden md:block">
          <p className="text-[11px] font-black text-slate-900 leading-tight uppercase truncate max-w-[150px]">{user.name}</p>
          <p className="text-[8px] text-blue-600 font-black uppercase tracking-widest">Trực tuyến</p>
        </div>
        <button 
          onClick={() => setShowProfile(!showProfile)}
          className="relative transition-transform active:scale-90"
        >
          <img 
            src={getAvatarUrl(user)} 
            alt={user.name} 
            className="w-10 h-10 md:w-11 md:h-11 rounded-2xl object-cover ring-2 ring-slate-100 shadow-sm"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3b82f6&color=fff&bold=true` }}
          />
          {updatingAvatar && (
            <div className="absolute inset-0 bg-white/60 rounded-2xl flex items-center justify-center">
              <i className="fas fa-circle-notch animate-spin text-blue-600 text-xs"></i>
            </div>
          )}
        </button>
      </div>

      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowProfile(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-slate-100">
            <div className="bg-slate-900 p-8 text-white text-center">
              <button onClick={() => setShowProfile(false)} className="absolute top-6 right-6 text-white/50"><i className="fas fa-times"></i></button>
              <div className="relative inline-block group">
                <img 
                  src={getAvatarUrl(user)} 
                  className="w-24 h-24 rounded-[2rem] object-cover border-4 border-white/10" 
                  alt="" 
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3b82f6&color=fff&bold=true` }}
                />
                <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 rounded-[2rem] opacity-0 group-hover:opacity-100 flex items-center justify-center"><i className="fas fa-camera"></i></button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight mt-4">{user.name}</h3>
              <p className="text-[9px] font-black uppercase text-blue-400 mt-1 tracking-[0.2em]">{user.role}</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Đơn vị công tác</label>
                  <p className="font-bold text-slate-900 text-xs uppercase leading-tight">{agencyName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Chức vụ</label>
                    <p className="font-bold text-slate-900 text-[10px] uppercase truncate">{user.position}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Phòng ban</label>
                    <p className="font-bold text-slate-900 text-[10px] uppercase truncate">{user.department}</p>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t border-slate-100 space-y-3">
                <button onClick={handleLogout} className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:bg-rose-100 transition-colors">Đăng xuất</button>
                <button onClick={() => setShowProfile(false)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:bg-slate-800 transition-colors">Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
