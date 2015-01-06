'use strict';

exports['default'] = {
  general: function(api)
  {
    return {
      plugins: [
        // this is a list of plugin names
        // plugin still need to be included in `package.json` or the path defined in `api.config.general.paths.plugin`
        '%%REPLACE%%' // Used a string here to avoid JS formatting violations
      ]
    };
  }
};