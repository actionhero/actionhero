import * as i18n from "i18n";
import * as path from "path";
import { Connection } from "./connection";
import { config } from "./config";
import * as dotProp from "dot-prop";

const options = config.i18n;
options.directory = path.normalize(config.general.paths.locale[0]);
i18n.configure(options);
i18n.setLocale(config.i18n.defaultLocale);

// simplistic determination of locale for connection
export function determineConnectionLocale(connection: Connection) {
  // perhpas you want to look at the `accept-language` headers from a web requests
  // perhaps your API can use a certain cookie or URL to determine locale
  return config.i18n.defaultLocale;
}

export function invokeConnectionLocale(connection: Connection) {
  const cmdParts = config.i18n.determineConnectionLocale.split(".");
  // TODO
  // const method = dotProp.get(api, cmdParts.join("."));
  // const locale = method(connection);
  // i18n.setLocale(connection, locale);
}

/**
 * Return a translated string.
 */
export function localize(
  message: string | Array<string>,
  object: Connection | any = i18n
) {
  const messageArray = Array.isArray(message) ? message : [message];
  return i18n.__.apply(object, messageArray);
}
