
export type Role = 'ADMIN' | 'LEADER' | 'EMPLOYEE';

export interface Region {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  role: Role;
  agencyId: string;
  department: string;
  position: string;
  email: string;
}

export interface Agency {
  id: string;
  name: string;
  description: string;
  employeeCount: number;
  regionId: string;
}

export interface EvaluationCriteria {
  professionalism: number; // Chuyên môn
  productivity: number; // Hiệu suất
  collaboration: number; // Hợp tác
  innovation: number; // Đổi mới
  discipline: number; // Kỷ luật
}

export interface Evaluation {
  id: string;
  evaluatorId: string;
  evaluateeId: string;
  cycleId: string;
  scores: EvaluationCriteria;
  comment: string;
  timestamp: string;
}

export interface EvaluationCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'CLOSED' | 'UPCOMING';
}

export interface PerformanceStats {
  averageScores: EvaluationCriteria;
  overallAverage: number;
  rating: 'Xuất sắc' | 'Tốt' | 'Khá' | 'Trung bình' | 'Yếu';
  totalEvaluations: number;
  rankInAgency: number;
}

/**
 * Added AIAnalysis interface to fix the module export error.
 */
export interface AIAnalysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}
