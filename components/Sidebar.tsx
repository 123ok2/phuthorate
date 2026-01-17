
import React, { useState } from 'react';
import { Role } from '../types';

interface SidebarProps {
  role: Role;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, activeTab, setActiveTab }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', icon: 'fa-chart-pie', label: 'Tổng quan', roles: ['LEADER', 'ADMIN'] },
    { id: 'portal', icon: 'fa-user-check', label: 'Cổng ĐG', fullLabel: 'Cổng Đánh giá', roles: ['LEADER', 'EMPLOYEE'] },
    { id: 'public-board', icon: 'fa-users-viewfinder', label: 'Công khai', fullLabel: 'Bảng công khai', roles: ['LEADER', 'EMPLOYEE'] },
    { id: 'admin', icon: 'fa-cogs', label: 'Quản trị', fullLabel: 'Quản trị hệ thống', roles: ['ADMIN'] },
  ];

  return (
    <>
      {/* Sidebar for Desktop */}
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} hidden md:flex bg-slate-900 text-slate-300 flex-col transition-all duration-300 relative border-r border-slate-800`}>
        {/* Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-24 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all z-10"
        >
          <i className={`fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'} text-[10px]`}></i>
        </button>

        <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} transition-all`}>
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
            <i className="fas fa-bolt text-xl"></i>
          </div>
          {!isCollapsed && (
            <span className="text-xl font-black text-white tracking-tight uppercase whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2">
              Phú Thọ Rate
            </span>
          )}
        </div>

        <nav className="flex-1 mt-6 px-3 space-y-2">
          {menuItems
            .filter(item => item.roles.includes(role))
            .map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed ? (item.fullLabel || item.label) : ''}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 p-4'} rounded-2xl transition-all ${isCollapsed ? 'h-14' : ''} ${
                  activeTab === item.id 
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                <i className={`fas ${item.icon} w-6 text-center text-lg shrink-0`}></i>
                {!isCollapsed && (
                  <span className="font-black text-xs uppercase tracking-widest whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2">
                    {item.fullLabel || item.label}
                  </span>
                )}
              </button>
            ))}
        </nav>

        <div className={`p-6 mt-auto border-t border-slate-800 transition-all ${isCollapsed ? 'flex justify-center' : ''}`}>
          <div className={`p-4 bg-slate-800 rounded-2xl text-[10px] space-y-2 ${isCollapsed ? 'w-12 h-12 flex items-center justify-center p-0 overflow-hidden' : ''}`}>
            {isCollapsed ? (
              <i className="fas fa-headset text-blue-500 text-lg"></i>
            ) : (
              <>
                <p className="text-slate-500 font-black uppercase tracking-widest">Hỗ trợ 24/7</p>
                <p className="flex items-center gap-2 font-bold text-slate-300">
                  <i className="fas fa-phone-alt text-blue-500"></i> 0868.640.898
                </p>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Bottom Navigation for Mobile/Portrait */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-3 flex items-center justify-around z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        {menuItems
          .filter(item => item.roles.includes(role))
          .map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'text-blue-600' 
                  : 'text-slate-400'
              }`}
            >
              <i className={`fas ${item.icon} text-lg`}></i>
              <span className={`text-[9px] font-black uppercase tracking-tighter ${activeTab === item.id ? 'opacity-100' : 'opacity-60'}`}>
                {item.label}
              </span>
              {activeTab === item.id && <div className="w-1 h-1 bg-blue-600 rounded-full"></div>}
            </button>
          ))}
      </nav>
    </>
  );
};

export default Sidebar;
