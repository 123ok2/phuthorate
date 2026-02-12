
import React, { useState, useEffect } from 'react';
import { User, Role } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LeaderDashboard from './components/LeaderDashboard';
import EmployeePortal from './components/EmployeePortal';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import ProfileSetup from './components/ProfileSetup';
import PublicBoard from './components/PublicBoard';
import Introduction from './components/Introduction';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const App: React.FC = () => {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('portal');
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        try {
          // Thử lấy doc từ Firestore (tự động ưu tiên cache nếu offline)
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          if (userDoc.exists()) {
            const data = userDoc.data() as User;
            setCurrentUser(data);
            setNeedsOnboarding(false);
            
            if (data.role === 'ADMIN' || data.role === 'LEADER') {
               setActiveTab('dashboard');
            } else {
               setActiveTab('portal');
            }
          } else {
            setNeedsOnboarding(true);
          }
        } catch (error: any) {
          console.error("Lỗi xác thực hồ sơ:", error);
          // Nếu lỗi mạng, vẫn cho phép vào nếu đã có currentUser trong state (đang nạp dở)
          setIsOffline(true);
          // Nếu không lấy được doc mà đang offline, ta không thể làm gì hơn ngoài việc đợi mạng
          if (!currentUser) {
            setLoading(false); 
          }
        }
      } else {
        setCurrentUser(null);
        setNeedsOnboarding(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleProfileComplete = (user: User) => {
    setCurrentUser(user);
    setNeedsOnboarding(false);
    setActiveTab(user.role === 'EMPLOYEE' ? 'portal' : 'dashboard');
  };

  const renderContent = () => {
    if (!currentUser) return (
      <div className="p-20 text-center">
        <div className="animate-pulse text-[10px] font-black uppercase text-slate-400 tracking-widest">
          {isOffline ? 'ĐANG ĐỢI KẾT NỐI MẠNG ĐỂ TẢI HỒ SƠ...' : 'ĐANG NẠP HỒ SƠ NGƯỜI DÙNG...'}
        </div>
      </div>
    );

    if (activeTab === 'public-board') return <PublicBoard user={currentUser} />;
    if (activeTab === 'guide') return <Introduction user={currentUser} />;

    switch (currentUser.role) {
      case 'ADMIN':
        if (activeTab === 'admin') return <AdminPanel currentUser={currentUser} />;
        if (activeTab === 'portal') return <EmployeePortal user={currentUser} />;
        if (activeTab === 'dashboard') return <LeaderDashboard user={currentUser} />;
        return <AdminPanel currentUser={currentUser} />;
      case 'LEADER':
        if (activeTab === 'dashboard') return <LeaderDashboard user={currentUser} />;
        if (activeTab === 'portal') return <EmployeePortal user={currentUser} />;
        if (activeTab === 'public-board') return <PublicBoard user={currentUser} />;
        return <LeaderDashboard user={currentUser} />;
      case 'EMPLOYEE':
        if (activeTab === 'portal') return <EmployeePortal user={currentUser} />;
        if (activeTab === 'public-board') return <PublicBoard user={currentUser} />;
        return <EmployeePortal user={currentUser} />;
      default:
        return <div className="p-10 text-center text-slate-500 font-black uppercase text-[10px]">Vai trò không xác định</div>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-1 bg-blue-600/20 rounded-full mb-8 overflow-hidden">
            <div className="w-1/2 h-full bg-blue-600 animate-[loading_1.5s_infinite_ease-in-out]"></div>
          </div>
          <p className="text-white text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Kết nối Phú Thọ Rate</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Login onLoginSuccess={(user) => setFirebaseUser(user)} />;
  }

  if (needsOnboarding) {
    return <ProfileSetup firebaseUser={firebaseUser} onComplete={handleProfileComplete} />;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      <Sidebar 
        role={currentUser?.role || 'EMPLOYEE'} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 relative pb-20 md:pb-0">
        {isOffline && (
          <div className="bg-rose-600 text-white text-[9px] font-black uppercase py-2 text-center tracking-widest z-50">
            MẤT KẾT NỐI SERVER - HỆ THỐNG ĐANG CHẠY CHẾ ĐỘ NGOẠI TUYẾN
          </div>
        )}
        <Header 
          user={currentUser!} 
          onSwitchUser={(u) => setCurrentUser(u)} 
        />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
