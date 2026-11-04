import axios, { type AxiosError, type AxiosRequestConfig } from "axios";

/** Share a bounded-time transport pointed at the API configured for this build. */
export const http = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787",
  timeout: 15000,
});
/** Adapt Axios to Orval: return the response body and allow per-request configuration overrides. */
export async function apiRequest<T>(
  requestConfig: AxiosRequestConfig,
  requestOptions?: AxiosRequestConfig,
): Promise<T> {
  const response = await http({ ...requestConfig, ...requestOptions });
  return response.data as T;
}
/** Supply the error shape expected by generated query and mutation hooks. */
export type ErrorType<T> = AxiosError<T>;
/** Preserve request-body inference for generated operations. */
export type BodyType<T> = T;
/** Prefer actionable field validation messages, then API errors, then a network fallback. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseBody = error.response?.data as
      | { error?: { message?: string; fields?: Record<string, string> } }
      | undefined;
    const fieldMessages = Object.values(responseBody?.error?.fields ?? {});
    if (fieldMessages.length) return fieldMessages.join(" · ");
    return (
      responseBody?.error?.message ??
      "We couldn't reach the restaurant. Check your connection and try again."
    );
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
