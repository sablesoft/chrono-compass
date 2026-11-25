import { queryApi, ApiError } from './moment';

/** Adapt the shared pure API to transport-neutral JSON responses. */
export function executeApi(url: string, now: number): { status: number; body: unknown } {
  try { return {status: 200, body: queryApi(new URL(url), () => now)}; }
  catch (error) {
    return error instanceof ApiError ? {status: error.status, body: {error: {code: error.code, message: error.message}}}
      : {status: 500, body: {error: {code: 'internal_error', message: 'Unable to calculate the requested state.'}}};
  }
}
