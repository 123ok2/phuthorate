
import React from 'react';
import { User } from '../types';

interface IntroductionProps { user: User; }

const Introduction: React.FC<IntroductionProps> = ({ user }) => {
  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <div className="bg-slate-900 rounded-[3rem] p-10 md:p-16 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-500/30">
            <i className="fas fa-bolt text-3xl"></i>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none mb-6">
            Phú Thọ Rate <br/>
            <span className="text-blue-500 text-2xl md:text-3xl">Kỷ nguyên đánh giá số</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed font-medium">
            Hệ thống đánh giá hiệu suất nhân sự liên cơ quan hiện đại nhất. 
            Giải pháp minh bạch, công bằng và toàn diện cho các tổ chức nhà nước và doanh nghiệp tại tỉnh Phú Thọ.
          </p>
        </div>
        <i className="fas fa-shield-halved absolute -bottom-10 -right-10 text-[20rem] text-white/5 rotate-12"></i>
      </div>

      {/* Roles Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Employee */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <i className="fas fa-user-edit text-xl"></i>
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase mb-4 tracking-wider">Dành cho Cán bộ</h3>
          <ul className="space-y-3 text-[10px] font-black text-slate-500 uppercase tracking-widest leading-loose">
            <li className="flex gap-3"><i className="fas fa-check text-blue-500"></i> Thực hiện đánh giá chéo đồng nghiệp trong đơn vị.</li>
            <li className="flex gap-3"><i className="fas fa-check text-blue-500"></i> Theo dõi kết quả đánh giá cá nhân theo từng đợt.</li>
            <li className="flex gap-3"><i className="fas fa-check text-blue-500"></i> Xem thứ hạng cá nhân trên Bảng Danh Vọng công khai.</li>
          </ul>
        </div>

        {/* Card 2: Leader */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <i className="fas fa-chart-line text-xl"></i>
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase mb-4 tracking-wider">Dành cho Lãnh đạo</h3>
          <ul className="space-y-3 text-[10px] font-black text-slate-500 uppercase tracking-widest leading-loose">
            <li className="flex gap-3"><i className="fas fa-check text-emerald-500"></i> Giám sát tiến độ đánh giá của toàn đơn vị.</li>
            <li className="flex gap-3"><i className="fas fa-check text-emerald-500"></i> Gửi nhắc nhở trực tiếp cho cán bộ chưa hoàn thành.</li>
            <li className="flex gap-3"><i className="fas fa-check text-emerald-500"></i> Phân tích hiệu suất nhân sự qua các đợt đánh giá.</li>
          </ul>
        </div>

        {/* Card 3: Admin */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
            <i className="fas fa-cogs text-xl"></i>
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase mb-4 tracking-wider">Dành cho Quản trị</h3>
          <ul className="space-y-3 text-[10px] font-black text-slate-500 uppercase tracking-widest leading-loose">
            <li className="flex gap-3"><i className="fas fa-check text-slate-900"></i> Thiết lập các đợt đánh giá và phạm vi áp dụng.</li>
            <li className="flex gap-3"><i className="fas fa-check text-slate-900"></i> Quản lý danh sách cơ quan và tài khoản cán bộ.</li>
            <li className="flex gap-3"><i className="fas fa-check text-slate-900"></i> Cấu hình bộ tiêu chí và thang điểm xếp loại.</li>
          </ul>
        </div>
      </div>

      {/* Usage Steps */}
      <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 uppercase mb-10 border-l-4 border-blue-600 pl-4 tracking-tight">Quy trình vận hành chuẩn</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { step: '01', title: 'Khởi tạo', desc: 'Quản trị viên phát động đợt đánh giá mới và chọn phạm vi cơ quan.' },
            { step: '02', title: 'Đánh giá', desc: 'Cán bộ đăng nhập vào Cổng ĐG để cho điểm đồng nghiệp trong đơn vị.' },
            { step: '03', title: 'Tổng hợp', desc: 'Hệ thống tự động tính toán điểm trung bình và xếp loại dựa trên thang điểm.' },
            { step: '04', title: 'Công khai', desc: 'Kết quả được cập nhật lên Bảng Danh Vọng để vinh danh các cá nhân xuất sắc.' },
          ].map((item, idx) => (
            <div key={idx} className="relative">
              <span className="text-5xl font-black text-slate-100 absolute -top-4 -left-2 z-0">{item.step}</span>
              <div className="relative z-10 space-y-2">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{item.title}</h4>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Introduction;
