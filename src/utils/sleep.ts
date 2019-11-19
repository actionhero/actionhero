/**
    Sleep with a Promise
    */
export function sleep(time: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}
