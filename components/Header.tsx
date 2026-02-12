
import React, { useState, useRef, useEffect, useMemo } from 'react';
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

  // Tính toán lời chào dựa trên thời gian thực
  const greetingData = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return { text: "Chào buổi sáng", icon: "fa-sun", color: "text-amber-500", sub: "Chúc đồng chí một ngày làm việc đầy năng lượng!" };
    if (hour >= 11 && hour < 14) return { text: "Chào buổi trưa", icon: "fa-cloud-sun", color: "text-orange-400", sub: "Đừng quên nghỉ ngơi và dùng bữa đúng giờ nhé." };
    if (hour >= 14 && hour < 18) return { text: "Chào buổi chiều", icon: "fa-sun-haze", color: "text-blue-400", sub: "Tiếp tục hoàn thành tốt các nhiệm vụ trong ngày." };
    if (hour >= 18 && hour < 22) return { text: "Chào buổi tối", icon: "fa-moon", color: "text-indigo-400", sub: "Hãy dành thời gian thư giãn bên gia đình." };
    return { text: "Chào buổi đêm", icon: "fa-stars", color: "text-slate-400", sub: "Đã muộn rồi, đồng chí nhớ giữ gìn sức khỏe." };
  }, []);

  const getAvatarUrl = (u: User) => {
    if (u.avatar && u.avatar.startsWith('data:image')) return u.avatar;
    const name = u.name || 'CB';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=f8fafc&bold=true&format=svg&size=128`;
  };

  useEffect(() => {
    const fetchAgency = async () => {
      if (!user) return;
      if (user.agencyId && user.agencyId !== 'all' && user.agencyId !== 'SYSTEM') {
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
    <header className="h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm transition-all duration-300">
      <div className="flex items-center gap-4 overflow-hidden animate-fade-in">
        <div className="md:hidden w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20">
          <i className="fas fa-bolt"></i>
        </div>
        <div className="hidden md:flex flex-col">
          <h2 className="text-[14px] font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-1">
            {user.role === 'LEADER' ? 'Hệ thống Lãnh đạo' : user.role === 'ADMIN' ? 'Hệ thống Quản trị' : 'Cổng thông tin Cán bộ'}
          </h2>
          <div className="flex items-center gap-2">
            <i className={`fas ${greetingData.icon} text-[10px] ${greetingData.color}`}></i>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">{greetingData.text}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right hidden sm:block animate-fade-in stagger-1">
          <p className="text-[11px] font-black text-slate-900 leading-tight uppercase truncate max-w-[150px]">{user.name}</p>
          <p className="text-[8px] text-emerald-500 font-black uppercase tracking-widest flex items-center justify-end gap-1.5">
            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
            Sẵn sàng làm việc
          </p>
        </div>
        
        <button 
          onClick={() => setShowProfile(!showProfile)}
          className="relative transition-all duration-300 hover:scale-105 active:scale-95 group"
        >
          <img 
            src={getAvatarUrl(user)} 
            alt={user.name} 
            className="w-10 h-10 md:w-11 md:h-11 rounded-2xl object-cover ring-2 ring-slate-100 shadow-sm bg-slate-100 transition-all group-hover:ring-blue-500/30"
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-lg flex items-center justify-center shadow-sm">
             <i className={`fas ${greetingData.icon} text-[8px] ${greetingData.color}`}></i>
          </div>
          {updatingAvatar && (
            <div className="absolute inset-0 bg-white/60 rounded-2xl flex items-center justify-center z-10">
              <i className="fas fa-circle-notch animate-spin text-blue-600 text-xs"></i>
            </div>
          )}
        </button>
      </div>

      {showProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowProfile(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-slate-100">
            <div className="bg-slate-900 p-8 text-white text-center relative overflow-hidden">
              <button onClick={() => setShowProfile(false)} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors z-20"><i className="fas fa-times"></i></button>
              
              {/* Background Glow */}
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl"></div>
              
              <div className="relative inline-block group z-10 animate-fade-in-up">
                <img 
                  src={getAvatarUrl(user)} 
                  className="w-24 h-24 rounded-[2rem] object-cover border-4 border-white/10 bg-slate-800 shadow-2xl" 
                  alt="" 
                />
                <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"><i className="fas fa-camera text-xl"></i></button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
              </div>
              
              <div className="relative z-10 mt-4 animate-fade-in stagger-1">
                <h3 className="text-lg font-black uppercase tracking-tight">{user.name}</h3>
                <p className="text-[9px] font-black uppercase text-blue-400 mt-1 tracking-[0.2em]">{user.role}</p>
                
                <div className="mt-4 px-4 py-2 bg-white/5 rounded-xl border border-white/10 inline-flex items-center gap-2">
                   <i className={`fas ${greetingData.icon} ${greetingData.color} text-[10px]`}></i>
                   <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{greetingData.text}</span>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center animate-fade-in stagger-2">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Thông điệp</p>
                 <p className="text-[10px] font-medium text-slate-600 italic leading-relaxed">{greetingData.sub}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 animate-fade-in stagger-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Đơn vị công tác</label>
                  <p className="font-bold text-slate-900 text-xs uppercase leading-tight truncate">{agencyName}</p>
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
              
              <div className="pt-6 border-t border-slate-100 space-y-3 animate-fade-in stagger-4">
                <button onClick={handleLogout} className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all hover:bg-rose-100">Đăng xuất hệ thống</button>
                <button onClick={() => setShowProfile(false)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all hover:bg-slate-800">Quay lại làm việc</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
