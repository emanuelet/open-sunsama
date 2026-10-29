export interface Goal {
  id: string;
  userId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  reflection: string | null;
  position: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalInput {
  title: string;
  parentId?: string | null;
  description?: string | null;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string | null;
  reflection?: string | null;
  parentId?: string | null;
}
