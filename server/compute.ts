import { parentPort } from 'node:worker_threads';
import { executeApi } from '../src/lib/api/response';
parentPort!.on('message', ({url, now}: {url: string; now: number}) => {
  parentPort!.postMessage(executeApi(url, now));
});
