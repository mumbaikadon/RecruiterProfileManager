import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<Response> {
  // Check if data is FormData - important for file uploads
  const isFormData = data instanceof FormData;
  
  return fetch(url, {
    method,
    // Don't set Content-Type for FormData - browser will set it with boundary
    headers: data && !isFormData ? { "Content-Type": "application/json" } : {},
    // Don't stringify FormData
    body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
    credentials: "include",
  });
}

export async function apiRequestWithJson<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<T> {
  const res = await apiRequest(method, url, data);
  await throwIfResNotOk(res);
  return await res.json() as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
