import { asyncWaterfall } from "./asyncWaterfall";

/**
 * Returns the average delay between a tick of the node.js event loop, as measured for N calls of `process.nextTick`
 */
export async function eventLoopDelay(
  iterations: number = 10000
): Promise<number> {
  const jobs = [];

  const sleepyFunc = async () => {
    return new Promise(resolve => {
      const start = process.hrtime();
      process.nextTick(() => {
        const delta = process.hrtime(start);
        const ms = delta[0] * 1000 + delta[1] / 1000000;
        resolve(ms);
      });
    });
  };

  let i = 0;
  while (i < iterations) {
    jobs.push(sleepyFunc);
    i++;
  }

  const results = await asyncWaterfall(jobs);
  let sum = 0;
  results.forEach(t => {
    sum += t;
  });
  const avg = Math.round((sum / results.length) * 10000) / 1000;
  return avg;
}
