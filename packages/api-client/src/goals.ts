import type {
  Goal,
  CreateGoalInput,
  UpdateGoalInput,
  Task,
} from "@open-sunsama/types";
import type { OpenSunsamaClient, RequestOptions } from "./client.js";

type Response<T> = { data: T };

export function createGoalsApi(client: OpenSunsamaClient) {
  return {
    async list(
      filter?: { archived?: boolean },
      options?: RequestOptions
    ): Promise<Goal[]> {
      const res = await client.get<Response<Goal[]>>("goals", {
        ...options,
        searchParams: {
          ...options?.searchParams,
          ...(filter?.archived !== undefined
            ? { archived: String(filter.archived) }
            : {}),
        },
      });
      return res.data;
    },
    async get(id: string, options?: RequestOptions): Promise<Goal> {
      return (await client.get<Response<Goal>>(`goals/${id}`, options)).data;
    },
    async create(
      input: CreateGoalInput,
      options?: RequestOptions
    ): Promise<Goal> {
      return (await client.post<Response<Goal>>("goals", input, options)).data;
    },
    async update(
      id: string,
      input: UpdateGoalInput,
      options?: RequestOptions
    ): Promise<Goal> {
      return (await client.patch<Response<Goal>>(`goals/${id}`, input, options))
        .data;
    },
    async archive(id: string, options?: RequestOptions): Promise<Goal> {
      return (
        await client.post<Response<Goal>>(`goals/${id}/archive`, {}, options)
      ).data;
    },
    async restore(id: string, options?: RequestOptions): Promise<Goal> {
      return (
        await client.post<Response<Goal>>(`goals/${id}/restore`, {}, options)
      ).data;
    },
    async reorder(
      input: { parentId: string | null; goalIds: string[] },
      options?: RequestOptions
    ): Promise<Goal[]> {
      return (
        await client.post<Response<Goal[]>>("goals/reorder", input, options)
      ).data;
    },
    async tasks(id: string, options?: RequestOptions): Promise<Task[]> {
      return (await client.get<Response<Task[]>>(`goals/${id}/tasks`, options))
        .data;
    },
  };
}
export type GoalsApi = ReturnType<typeof createGoalsApi>;
