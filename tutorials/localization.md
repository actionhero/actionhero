![](localization.svg)

## Overview

ActionHero uses the [i18n](https://github.com/mashpie/i18n-node) module to localize responses to clients.

## Locale Files

*   When running ActionHero with `api.config.i18n.updateFiles = true`, you will see ActionHero generate a 'locales' folder at the top level of your project which will contain translations of all strings in your project with are passed though the new localization system. This includes all uses of `api.i18n.localize` and `connection.localize`.
    *   We use mustache-style localization
*   From here, it is an easy matter to change the strings, per locale, to how you would like them presented back in your application. The next time you restart the server, the values you've updated in your locale strings file will be used.
*   disable `api.config.i18n.updateFiles` if you do not want this behavior.

## Connection Locale

Since every ActionHero implementation is unique, we do not ship with a "guess" about how to determine a given connection's locale. Perhaps you have an HTTP server and you can trust your client's `accept-language` headers. Or perhaps you run your API under a number of different host names and you can presume locale based on them. Whatever the case, you need to create a async method in an initializer which will be called when each connection connects to return its locale.

For example, I may have an initializer in my project like this:

```js
const {Initializer} = require('actionhero')

module.exports = class DetermineConnectionLocale extends Initializer {
  constructor () {
    super()
    this.name = 'determineConnectionLocale'
  }

  initialize () {
    api.customLocalization = {
      lookup: (connection) => {
        let locale = 'en';

        if(connection.type === 'web'){
          const host = connection.rawConnection.req.headers.host
          if(host === 'usa.site.com'){ locale = 'en-US'; }
          if(host === 'uk.site.com'){  locale = 'en-GB'; }
          if(host === 'es.site.com'){  locale = 'es-ES'; }
          if(host === 'mx.site.com'){  locale = 'es-MX'; }
        }

        return locale
      }
    }
  }
}
```
To tell i18n to use this method with a new connection, set `api.config.i18n.determineConnectionLocale = 'api.customLocalization.lookup'`.  Now you can localize responses in actions, based on which hostname a connection uses.

```js
const {Action} = require('actionhero')

module.exports = class RandomNumber extends Action {
  constructor () {
    super()
    this.name = 'randomNumber'
    this.description = 'I am an API method which will generate a random number, returning both the number and a localized string'
    this.outputExample = {
      number: 0.234,
      localizedResponse: 'Your random number is 0.234'
    }
  }

  async run ({connection, response}) {
    const number = Math.random()
    const localizedResponse = connection.localize(['Your random number is {{number}}', {number: number}])
    response.message = localizedResponse
    response.number = number
  }
}
```

## Connection Methods

* `connection.localize(string)` or `connection.localize([string-with-interpolation, values])`
    * Allows you to interpolate a string based on the connection's current locale. For example, say in an action you wanted to respond with `{CountExample}` In your locale files, you would define `the count was {{count}}` in every language you cared about, and not need to modify the action itself at all.

## Other Strings

* To localize strings that are not used in methods mentioned above you can use `api.i18n.localize(string, options)`.
    * Allows you to interpolate a string.
    * Just as the other localize methods above, the input string will be in your locale files for you to change it anytime you want.
    * The second `options` optional argument (default value is `api.i18n`) allows you to [configure](https://github.com/mashpie/i18n-node#list-of-all-configuration-options) i18n. Note that you will use this argument only in very few special cases, It is recommended to edit the global `api.config.i18n` settings to suit your localization needs.
