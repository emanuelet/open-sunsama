import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateGoalInput,
  Goal,
  UpdateGoalInput,
} from "@open-sunsama/types";
import { getApi } from "@/lib/api";
import { goalKeys, taskKeys } from "@/lib/query-keys";
import { toast } from "@/hooks/use-toast";

export function useGoals(archived = false) {
  return useQuery({
    queryKey: goalKeys.list(archived),
    queryFn: () => getApi().goals.list({ archived }),
  });
}

export function useGoalTasks(id: string | undefined) {
  return useQuery({
    queryKey: goalKeys.taskList(id ?? ""),
    queryFn: () => getApi().goals.tasks(id!),
    enabled: !!id,
  });
}

export function useGoalActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: goalKeys.all });
    void qc.invalidateQueries({ queryKey: taskKeys.all });
  };
  const error = () =>
    toast({
      title: "Could not save goal",
      description: "Please try again.",
      variant: "destructive",
    });
  return {
    create: useMutation({
      mutationFn: (data: CreateGoalInput) => getApi().goals.create(data),
      onSuccess: refresh,
      onError: error,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: UpdateGoalInput }) =>
        getApi().goals.update(id, data),
      onSuccess: refresh,
      onError: error,
    }),
    archive: useMutation({
      mutationFn: (id: string) => getApi().goals.archive(id),
      onSuccess: refresh,
      onError: error,
    }),
    restore: useMutation({
      mutationFn: (id: string) => getApi().goals.restore(id),
      onSuccess: refresh,
      onError: error,
    }),
    reorder: useMutation({
      mutationFn: (data: { parentId: string | null; goalIds: string[] }) =>
        getApi().goals.reorder(data),
      onSuccess: refresh,
      onError: error,
    }),
  };
}

export function goalPath(goal: Goal, goals: Goal[]): string {
  const parts = [goal.title];
  const seen = new Set([goal.id]);
  let parentId = goal.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = goals.find((item) => item.id === parentId);
    if (!parent) break;
    parts.unshift(parent.title);
    parentId = parent.parentId;
  }
  return parts.join(" / ");
}
