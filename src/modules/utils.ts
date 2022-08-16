import { argv } from "./utils/argv";
import { arrayStartingMatch } from "./utils/arrayStartingMatch";
import { arrayUnique } from "./utils/arrayUnique";
import { collapseObjectToArray } from "./utils/collapseObjectToArray";
import { deepCopy } from "./utils/deepCopy";
import { ensureNoTsHeaderFiles } from "./utils/ensureNoTsHeaderFiles";
import { eventLoopDelay } from "./utils/eventLoopDelay";
import { filterObjectForLogging } from "./utils/filterObjectForLogging";
import { filterResponseForLogging } from "./utils/filterResponseForLogging";
import { getExternalIPAddress } from "./utils/getExternalIPAddress";
import { hashMerge } from "./utils/hashMerge";
import { isPlainObject } from "./utils/isPlainObject";
import { parseHeadersForClientAddress } from "./utils/parseHeadersForClientAddress";
import { parseCookies } from "./utils/parseCookies";
import { parseIPv6URI } from "./utils/parseIPv6URI";
import { replaceDistWithSrc } from "./utils/replaceDistWithSrc";
import { sleep } from "./utils/sleep";
import { sortGlobalMiddleware } from "./utils/sortGlobalMiddleware";
import { sourceRelativeLinkPath } from "./utils/sourceRelativeLinkPath";
import {
  dirExists,
  fileExists,
  createDirSafely,
  createFileSafely,
  createLinkfileSafely,
  removeLinkfileSafely,
  createSymlinkSafely,
} from "./utils/fileUtils";
import { isRunning } from "./utils/isRunning";

/**
 * Utility functions for Actionhero
 */
export const utils = {
  argv,
  arrayStartingMatch,
  arrayUnique,
  collapseObjectToArray,
  deepCopy,
  ensureNoTsHeaderFiles,
  eventLoopDelay,
  filterObjectForLogging,
  filterResponseForLogging,
  getExternalIPAddress,
  hashMerge,
  isPlainObject,
  parseHeadersForClientAddress,
  parseCookies,
  parseIPv6URI,
  replaceDistWithSrc,
  sleep,
  sortGlobalMiddleware,
  sourceRelativeLinkPath,
  fileUtils: {
    dirExists,
    fileExists,
    createDirSafely,
    createFileSafely,
    createLinkfileSafely,
    removeLinkfileSafely,
    createSymlinkSafely,
  },
  isRunning,
};
