import * as I18n from "i18n";
import * as path from "path";
import { Connection } from "../classes/connection";
import { config } from "./config";
import { api } from "./../index";
import * as dotProp from "dot-prop";

const options = config.i18n;
options.directory = path.normalize(config.general.paths.locale[0]);
I18n.configure(options);
I18n.setLocale(config.i18n.defaultLocale);

export namespace i18n {
  // simplistic determination of locale for connection
  export function determineConnectionLocale(connection: Connection) {
    // perhaps you want to look at the `accept-language` headers from a web requests
    // perhaps your API can use a certain cookie or URL to determine locale
    return config.i18n.defaultLocale;
  }

  export function invokeConnectionLocale(connection: Connection) {
    const cmdParts = config.i18n.determineConnectionLocale.split(".");
    const method: Function = dotProp.get(i18n, cmdParts.join("."));
    const locale = method(connection);
    I18n.setLocale(connection, locale);
  }

  /**
   * Return a translated string.
   */
  export function localize(
    message: string | Array<string>,
    object: Connection | any = i18n
  ) {
    const messageArray = Array.isArray(message) ? message : [message];
    return I18n.__.apply(object, messageArray);
  }
}
