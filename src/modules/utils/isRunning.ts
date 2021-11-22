export function isRunning(pid: number) {
  try {
    return process.kill(pid, 0);
  } catch (e) {
    return e.code === "EPERM";
  }
}
