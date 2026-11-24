import { parentPort } from 'node:worker_threads';
import { queryApi, ApiError } from '../src/lib/api/moment';
parentPort!.on('message', ({url, now}: {url: string; now: number}) => {
  try { parentPort!.postMessage({status: 200, body: queryApi(new URL(url), () => now)}); }
  catch (error) {
    parentPort!.postMessage(error instanceof ApiError ? {status: error.status, body: {error: {code: error.code, message: error.message}}}
      : {status: 500, body: {error: {code: 'internal_error', message: 'Unable to calculate the requested state.'}}});
  }
});
