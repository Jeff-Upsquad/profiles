export interface DashboardStats {
  total_talent_users: number;
  total_business_users: number;
  total_profiles: number;
  profiles_by_status: Record<string, number>;
  profiles_by_category: { category_name: string; count: number }[];
  pending_reviews: number;
}

export interface ReviewAction {
  action: 'approve' | 'reject';
  rejection_reason?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
