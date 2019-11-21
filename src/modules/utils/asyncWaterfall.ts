/**
 * In series, run an array of `async` functions
 *
 * without arguments
 * ```js
 * let sleepyFunc = async () => {
 *   await new Promise((resolve) => { setTimeout(resolve, 100) })
 *   return (new Date()).getTime()
 * }
 * let jobs = [sleepyFunc, sleepyFunc, sleepyFunc]
 * let responses = await api.utils.asyncWaterfall(jobs)
 * // responses = [1506536188356, 1506536188456, 1506536188456]
 * ```
 *
 * with arguments
 * ```js
 * let sleepyFunc = async (response) => {
 *   await new Promise((resolve) => { setTimeout(resolve, 100) })
 *   return response
 * }
 * let jobs = [
 *   {method: sleepyFunc, args: ['a']},
 *   {method: sleepyFunc, args: ['b']},
 *   {method: sleepyFunc, args: ['c']}
 * ]
 * let responses = await api.utils.asyncWaterfall(jobs)
 * // responses = ['a', 'b', 'c']
 * ```
 */
export async function asyncWaterfall(
  jobs: Array<Function | { method: Function; args: Array<any> }>
): Promise<Array<any>> {
  const results = [];
  while (jobs.length > 0) {
    const collection = jobs.shift();
    let job;
    let args;
    if (typeof collection === "function") {
      job = collection;
      args = [];
    } else {
      job = collection.method;
      args = collection.args;
    }

    const value = await job.apply(this, args);
    results.push(value);
  }

  if (results.length === 0) {
    return null;
  }
  if (results.length === 1) {
    return results[0];
  }
  return results;
}
