'use strict';
const assert = require('assert');

exports.task = {
  name: 'testNew',
  description: 'test',
  frequency: 0,
  queue: 'default',
  plugins: [],
  pluginOptions: {},

  migrate: function(api, params, cb) {
    //Check if params are older then current task version
    //Migrate the params
    api.log("I'm migrating yo", 'info', params);
    // format fone numbers

    params.phoneNumbers.forEach(function (item) {
      item.value = item.value.replace(/-/g, '.');
    });

    cb(params);
  },

  run: function(api, params, next) {
    assert(params.phoneNumbers);

    var arrayIndx = Object.keys(params.phoneNumbers);

    arrayIndx.forEach(function (indx) {
      var thePhoneNumber = params.phoneNumbers[indx].value;
      var res = thePhoneNumber.split(".", 3);
      assert(res.length === 3)
    });

    next();
  }
};
