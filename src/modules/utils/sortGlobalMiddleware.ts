/**
 * Sorts an Array of Objects with a priority key
 */
export function sortGlobalMiddleware(
  globalMiddlewareList: Array<any>,
  middleware: {
    [key: string]: any;
  }
) {
  globalMiddlewareList.sort((a, b) => {
    if (middleware[a].priority > middleware[b].priority) {
      return 1;
    } else {
      return -1;
    }
  });
}
