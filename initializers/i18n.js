var i18n = require('i18n');

module.exports = {
  loadPriority:  2,
  initialize: function(api, next){
    api.i18n = {
      i18n: i18n,
      t: api.i18n.i18n.__, // convience method

      // simplistic determination of locale for server
      determineServerLocale: function(context){
        return 'en';
      }

      // simplistic determination of locale for connection
      determineConnectionLocale: function(connection){
        return 'en';
      }
    }

    var options = api.config.i18n
    options.directory = api.config.general.paths.locale;
    api.i18n.i18n.configure(options);

    next();
  }
}
