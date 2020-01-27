import { arrayStartingMatch } from "./utils/arrayStartingMatch";
import { arrayUnique } from "./utils/arrayUnique";
import { asyncWaterfall } from "./utils/asyncWaterfall";
import { collapseObjectToArray } from "./utils/collapseObjectToArray";
import { ensureNoTsHeaderFiles } from "./utils/ensureNoTsHeaderFiles";
import { eventLoopDelay } from "./utils/eventLoopDelay";
import { filterObjectForLogging } from "./utils/filterObjectForLogging";
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
  createSymlinkSafely
} from "./utils/fileUtils";

/**
 * Utility functions for Actionhero
 */
export const utils = {
  arrayStartingMatch,
  arrayUnique,
  asyncWaterfall,
  collapseObjectToArray,
  ensureNoTsHeaderFiles,
  eventLoopDelay,
  filterObjectForLogging,
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
    createSymlinkSafely
  }
};
