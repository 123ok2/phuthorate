
export type Role = 'ADMIN' | 'LEADER' | 'EMPLOYEE';

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

export interface Region {
  id: string;
  name: string;
}

export interface Criterion {
  id: string;
  name: string;
  description: string;
  order: number;
}

export interface RatingConfig {
  id: string;
  label: string;
  minScore: number;
  color: string;
  order: number;
}

export type EvaluationScores = Record<string, number>;

export interface Evaluation {
  id: string;
  evaluatorId: string;
  evaluateeId: string;
  cycleId: string;
  scores: EvaluationScores;
  comment: string;
  timestamp: string;
}

export interface EvaluationCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'CLOSED' | 'UPCOMING' | 'PAUSED';
  targetAgencyIds: string[];
  criteria: Criterion[]; 
  ratings: RatingConfig[]; 
}

export interface PerformanceStats {
  averageScores: EvaluationScores;
  overallAverage: number;
  ratingLabel: string;
  ratingColor: string;
  totalEvaluations: number;
}
