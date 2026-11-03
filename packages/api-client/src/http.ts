import axios, { type AxiosError, type AxiosRequestConfig } from "axios";

export const http = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787",
  timeout: 15000,
});
export async function apiRequest<T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> {
  const response = await http({ ...config, ...options });
  return response.data as T;
}
export type ErrorType<T> = AxiosError<T>;
export type BodyType<T> = T;
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { message?: string; fields?: Record<string, string> } }
      | undefined;
    const fields = Object.values(data?.error?.fields ?? {});
    if (fields.length) return fields.join(" · ");
    return (
      data?.error?.message ??
      "We couldn't reach the restaurant. Check your connection and try again."
    );
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
