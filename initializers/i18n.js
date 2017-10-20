'use strict'

const i18n = require('i18n')
const path = require('path')

/**
 * Translations.
 *
 * @namespace api.i18n
 */

module.exports = {
  loadPriority: 10,
  initialize: function (api, next) {
    const options = api.config.i18n
    options.directory = path.normalize(api.config.general.paths.locale[0])
    i18n.configure(options)
    i18n.setLocale(api.config.i18n.defaultLocale)

    api.i18n = Object.assign({
      // simplistic determination of locale for connection
      determineConnectionLocale: function (connection) {
        // perhpas you want to look at the `accept-language` headers from a web requests
        // perhaps your API can use a certain cookie or URL to determine locale
        return api.config.i18n.defaultLocale
      },
      invokeConnectionLocale: function (connection) {
        let cmdParts = api.config.i18n.determineConnectionLocale.split('.')
        let cmd = cmdParts.shift()
        if (cmd !== 'api') { throw new Error('cannot operate on a method outside of the api object') }
        let method = api.utils.dotProp.get(api, cmdParts.join('.'))
        let locale = method(connection)
        api.i18n.setLocale(connection, locale)
      },

      /**
       * Return a translated string.
       *
       * @memberof api.i18n
       * @param  {string} message The string to translate
       * @param  {Object} options (optional)
       * @return {string}         Translated string
       */
      localize: function (message, options) {
        if (!Array.isArray(message)) { message = [message] }
        if (!options) { options = api.i18n }
        return api.i18n.__.apply(options, message)
      }
    }, i18n)

    next()
  }
}
