
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
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const App: React.FC = () => {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('portal');
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          // Kiểm tra đặc quyền Admin cho email cụ thể
          const isAdminEmail = user.email === 'duyhanh@thucuc.com';
          
          if (userDoc.exists()) {
            let data = userDoc.data() as User;
            
            // Nếu là email admin nhưng role chưa phải admin thì cập nhật lại
            if (isAdminEmail && data.role !== 'ADMIN') {
              data = { ...data, role: 'ADMIN' };
              await setDoc(doc(db, "users", user.uid), data, { merge: true });
            }
            
            setCurrentUser(data);
            setNeedsOnboarding(false);
            if (data.role === 'ADMIN' || data.role === 'LEADER') {
               setActiveTab('admin');
            }
          } else {
            // Nếu là tài khoản Admin mới tinh chưa có profile
            if (isAdminEmail) {
              const adminUser: User = {
                id: user.uid,
                name: "ADMIN TỔNG",
                email: user.email,
                avatar: "",
                role: 'ADMIN',
                agencyId: 'SYSTEM',
                department: 'QUẢN TRỊ',
                position: 'QUẢN TRỊ VIÊN'
              };
              await setDoc(doc(db, "users", user.uid), adminUser);
              setCurrentUser(adminUser);
              setActiveTab('admin');
            } else {
              setNeedsOnboarding(true);
            }
          }
        } catch (error: any) {
          console.error("Lỗi xác thực Firestore:", error);
          setNeedsOnboarding(true);
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
    setActiveTab(user.role === 'EMPLOYEE' ? 'portal' : 'admin');
  };

  const renderContent = () => {
    if (!currentUser) return <div className="p-10 text-center text-slate-400 uppercase text-[10px] font-black animate-pulse">Đang nạp hồ sơ...</div>;

    if (activeTab === 'public-board') return <PublicBoard user={currentUser} />;

    switch (currentUser.role) {
      case 'ADMIN':
        if (activeTab === 'admin') return <AdminPanel currentUser={currentUser} />;
        if (activeTab === 'portal') return <EmployeePortal user={currentUser} />;
        return <AdminPanel currentUser={currentUser} />;
      case 'LEADER':
        if (activeTab === 'dashboard') return <LeaderDashboard user={currentUser} />;
        if (activeTab === 'portal') return <EmployeePortal user={currentUser} />;
        return <LeaderDashboard user={currentUser} />;
      case 'EMPLOYEE':
        return <EmployeePortal user={currentUser} />;
      default:
        return <div className="p-10 text-center text-slate-500 font-medium uppercase text-xs">Vai trò không xác định</div>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-[9px] font-black uppercase tracking-[0.3em]">Khởi động Phú Thọ Rate...</p>
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
