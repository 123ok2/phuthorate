
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, addDoc } from 'firebase/firestore';
import { Agency, User, Role } from '../types';

interface ProfileSetupProps {
  firebaseUser: any;
  onComplete: (user: User) => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ firebaseUser, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [fetchingAgencies, setFetchingAgencies] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agenciesList, setAgenciesList] = useState<Agency[]>([]);
  const [isCreatingNewAgency, setIsCreatingNewAgency] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: (firebaseUser.displayName || '').toUpperCase(),
    agencyId: '',
    newAgencyName: '',
    department: '',
    position: '',
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=3b82f6&color=fff&bold=true`
  });

  const refreshAgencies = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "agencies"));
      const agencies = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agency));
      setAgenciesList(agencies);
      
      if (agencies.length > 0) {
        setFormData(prev => ({ ...prev, agencyId: agencies[0].id }));
        setIsCreatingNewAgency(false);
      } else {
        setIsCreatingNewAgency(true);
        setFormData(prev => ({ ...prev, agencyId: 'NEW' }));
      }
    } catch (err) {
      console.error("Lỗi tải danh sách cơ quan:", err);
      setIsCreatingNewAgency(true);
    } finally {
      setFetchingAgencies(false);
    }
  };

  useEffect(() => {
    refreshAgencies();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value.toUpperCase() }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // Giới hạn 1MB cho base64 storage
        setError("DUNG LƯỢNG ẢNH QUÁ LỚN (TỐI ĐA 1MB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let finalAgencyId = formData.agencyId;

      if (isCreatingNewAgency || formData.agencyId === 'NEW') {
        const agencyNameFormatted = formData.newAgencyName.trim().toUpperCase();
        if (!agencyNameFormatted) {
          throw new Error("VUI LÒNG NHẬP TÊN CƠ QUAN MỚI");
        }
        
        const agencyData = {
          name: agencyNameFormatted,
          regionId: 'REGION_DEFAULT',
          employeeCount: 1,
          description: `ĐƠN VỊ ĐƯỢC KHỞI TẠO BỞI CÁN BỘ: ${formData.name}`
        };

        const agencyRef = await addDoc(collection(db, "agencies"), agencyData);
        finalAgencyId = agencyRef.id;
      }

      if (!finalAgencyId || finalAgencyId === 'NEW') {
        throw new Error("VUI LÒNG CHỌN HOẶC NHẬP CƠ QUAN CÔNG TÁC");
      }

      const newUser: User = {
        id: firebaseUser.uid,
        name: formData.name.trim().toUpperCase(),
        email: (firebaseUser.email || '').toLowerCase(),
        avatar: formData.avatar,
        role: 'EMPLOYEE' as Role,
        agencyId: finalAgencyId,
        department: formData.department.trim().toUpperCase(),
        position: formData.position.trim().toUpperCase(),
      };

      await setDoc(doc(db, "users", firebaseUser.uid), newUser);
      onComplete(newUser);
    } catch (err: any) {
      console.error("Lỗi lưu hồ sơ:", err);
      let errorMsg = "KHÔNG THỂ LƯU HỒ SƠ. ";
      if (err.code === 'permission-denied') {
        errorMsg += "LỖI QUYỀN TRUY CẬP FIRESTORE.";
      } else {
        errorMsg += (err.message || "VUI LÒNG THỬ LẠI.").toUpperCase();
      }
      setError(errorMsg);
      setLoading(false);
    }
  };

  if (fetchingAgencies) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-[10px] font-black tracking-[0.3em] uppercase">Đang kết nối Fire...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-4xl w-full">
        <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100">
          <div className="md:flex">
            <div className="md:w-2/5 bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
              <div className="relative z-10">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-10 shadow-xl shadow-blue-500/20">
                  <i className="fas fa-fingerprint text-3xl"></i>
                </div>
                <h2 className="text-4xl font-black mb-6 leading-tight uppercase tracking-tight">Định danh cán bộ</h2>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                  Hoàn tất hồ sơ để bắt đầu quá trình đánh giá. Bạn có thể tải lên ảnh chân dung để hiển thị trên hệ thống.
                </p>
              </div>
              <i className="fas fa-fire absolute -bottom-16 -right-16 text-[20rem] text-white/5 rotate-12"></i>
            </div>
            
            <div className="md:w-3/5 p-12 md:p-16">
              <form onSubmit={handleSubmit} className="space-y-8">
                {error && (
                  <div className="bg-rose-50 text-rose-600 p-5 rounded-2xl text-[10px] font-black border border-rose-100 uppercase tracking-wider leading-relaxed">
                    <i className="fas fa-triangle-exclamation mr-2 text-sm"></i>{error}
                  </div>
                )}
                
                <div className="flex flex-col items-center gap-4 mb-8">
                  <div className="relative group">
                    <img 
                      src={formData.avatar} 
                      className="w-32 h-32 rounded-[2.5rem] object-cover border-4 border-slate-50 shadow-xl" 
                      alt="Avatar Preview"
                    />
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      <i className="fas fa-camera text-2xl"></i>
                    </button>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ảnh đại diện</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-blue-600 uppercase tracking-[0.25em]">Đơn vị công tác</label>
                    <select
                      required
                      value={isCreatingNewAgency ? 'NEW' : formData.agencyId}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'NEW') {
                          setIsCreatingNewAgency(true);
                          setFormData(prev => ({ ...prev, agencyId: 'NEW' }));
                        } else {
                          setIsCreatingNewAgency(false);
                          setFormData(prev => ({ ...prev, agencyId: val }));
                        }
                      }}
                      className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none bg-slate-50/50 font-black text-slate-800 uppercase text-sm"
                    >
                      {agenciesList.length > 0 ? (
                        <>
                          {agenciesList.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                          <option value="NEW" className="text-blue-600">+ THÊM CƠ QUAN MỚI</option>
                        </>
                      ) : (
                        <option value="NEW">TẠO CƠ QUAN ĐẦU TIÊN</option>
                      )}
                    </select>
                  </div>

                  {(isCreatingNewAgency || agenciesList.length === 0) && (
                    <div className="space-y-2 animate-in slide-in-from-top-4">
                      <label className="block text-[11px] font-black text-emerald-600 uppercase tracking-[0.25em]">Tên cơ quan mới</label>
                      <input
                        required
                        type="text"
                        value={formData.newAgencyName}
                        onChange={(e) => handleInputChange('newAgencyName', e.target.value)}
                        className="w-full px-6 py-4 rounded-2xl border-2 border-emerald-100 focus:border-emerald-500 outline-none bg-emerald-50/20 font-black uppercase text-sm"
                        placeholder="NHẬP TÊN CƠ QUAN"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Họ và Tên cán bộ</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none bg-slate-50/50 font-black uppercase text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Phòng ban</label>
                      <input
                        required
                        type="text"
                        value={formData.department}
                        onChange={(e) => handleInputChange('department', e.target.value)}
                        className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none bg-slate-50/50 font-black uppercase text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Chức vụ</label>
                      <input
                        required
                        type="text"
                        value={formData.position}
                        onChange={(e) => handleInputChange('position', e.target.value)}
                        className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none bg-slate-50/50 font-black uppercase text-sm"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] hover:bg-blue-600 transition-all shadow-2xl flex items-center justify-center gap-4 disabled:opacity-70"
                >
                  {loading ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-id-badge"></i>}
                  Lưu hồ sơ và truy cập
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
