import * as i18n from "i18n";
import * as path from "path";
import { api, Initializer } from "../index";
import { Connection } from "./../classes/connection";

/**
 * Translations and such.
 */
export class I18N extends Initializer {
  constructor() {
    super();
    this.name = "i18n";
    this.loadPriority = 10;
  }

  async initialize() {
    const options = api.config.i18n;
    options.directory = path.normalize(api.config.general.paths.locale[0]);
    i18n.configure(options);
    i18n.setLocale(api.config.i18n.defaultLocale);

    api.i18n = Object.assign(
      {
        // simplistic determination of locale for connection
        determineConnectionLocale: (connection: Connection) => {
          // perhpas you want to look at the `accept-language` headers from a web requests
          // perhaps your API can use a certain cookie or URL to determine locale
          return api.config.i18n.defaultLocale;
        },

        invokeConnectionLocale: (connection: Connection) => {
          const cmdParts = api.config.i18n.determineConnectionLocale.split(".");
          const cmd = cmdParts.shift();
          if (cmd !== "api") {
            throw new Error(
              "cannot operate on a method outside of the api object"
            );
          }
          const method = api.utils.dotProp.get(api, cmdParts.join("."));
          const locale = method(connection);
          api.i18n.setLocale(connection, locale);
        },

        /**
         * Return a translated string.
         */
        localize: (
          message: string | Array<string>,
          options: any = api.i18n
        ) => {
          const messageArray = Array.isArray(message) ? message : [message];
          return api.i18n.__.apply(options, messageArray);
        }
      },

      i18n
    );
  }
}
