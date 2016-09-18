# Localization

Starting in ActionHero `v13.0.0`, you can now use the [i18n](https://github.com/mashpie/i18n-node) module to customize all aspects of ActionHero.

## Locale files
- When running ActionHero with `api.config.i18n.updateFiles = true`, you will see ActionHero generate a 'locales' folder at the top level of your project which will contain translations of all strings in your project with are passed though the new localization system.  This includes all uses of `api.i18n.localize`, `connection.localize` and `api.log`.  
  - be sure to use sprintf-style string interpolation for variables!
- From here, it is an easy matter to change the strings, per locale, to how you would like them presented back in your application.  The next time you restart the server, the values you've updated in your locale strings file will be used.
- disable `api.config.i18n.updateFiles` if you do not want this behavior.

## Determining connection locales
Since every ActionHero implementation is unique, we cannot ship with a "guess" about how to determine a given connection's locale. Perhaps you have an HTTP server and you can trust your client's `accept-language` headers.  Or perhaps you run your API under a number of different host names and you can presume locale based on them.   Whatever the case, you need to create a synchronous method in an initializer which will be called when each connection connects to return its locale.  

For example, I may have an initializer in my project like this:

```js
module.exports = {
  initialize: function(api, next){
    api.customLocalization = {
      lookup: function(connection){
        var locale = 'en';
        if(connection.type === 'web'){
          if(connection.rawConnection.req.headers.host === 'usa.site.com'){ locale = 'en-US'; }
          if(connection.rawConnection.req.headers.host === 'uk.site.com'){  locale = 'en-GB'; }
          if(connection.rawConnection.req.headers.host === 'es.site.com'){  locale = 'es-ES'; }
          if(connection.rawConnection.req.headers.host === 'mx.site.com'){  locale = 'es-MX'; }
        }

        return locale;
      }
    }


    next();
  }
}
```

To tell the i18n to use this method with a new connection, set `api.config.i18n.determineConnectionLocale = 'api.customLocalization.lookup'`

## Connection Methods
- `connection.localize(string)` or `connection.localize([string-with-interpolation, value])`
  - Allows you to interpolate a string based on the connection's current locale.  For example, say in an action you wanted to respond with `data.response.message = connection.localize('the count was %s', 4);` In your locale files, you would define `the count was %s` in every language you cared about, and not need to modify the action itself at all.

## Localizing the Logger
- Just like connections, the ActionHero logger itself now has localization interpolation built in.  Note how in the new settings you set which locale you want the server's logs to be expressed in.  Using that, you can now use sprintf-style string interpolation as the first argument of `api.log()`
  - You might want to log the message `api.log(['The time is %s', new Date()], 'alert')`.  
  - Changing the translation of the string `The time is %s` in your locale files would apply to the logger as well!
  - You can of course continue to log plain strings as we have been with the logger as well.

## Localizing other strings
- To localize strings that are not used in methods mentioned above you can use `api.i18n.localize(string, options)` or `api.i18n.localize([string-with-interpolation, value], options)`.
  - Allows you to interpolate a string.
  - Just as the other localize methods above, the input string will be in your locale files for you to change it anytime you want.
  - The second `options` optional argument (default value is `api.i18n`) allows you to [configure](https://github.com/mashpie/i18n-node#list-of-all-configuration-options) i18n. Note that you will use this argument only in very few special cases, It is recommended to edit the global `api.config.i18n` settings to suit your localization needs.
