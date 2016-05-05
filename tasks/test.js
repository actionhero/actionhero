'use strict';
const assert = require('assert');

exports.task = {
    name: 'test',
    description: 'test',
    frequency: 0,
    queue: 'default',
    plugins: [],
    pluginOptions: {},

    migrate: function(api, params, cb) {
        //Check if params are older then current task version
        //Migrate the params
        api.log("I'm migrating yo", 'info', params);
        cb(params);
    },

    run: function(api, params, next) {
        assert(params.phoneNumbers);

        var arrayIndx = Object.keys(params.phoneNumbers);

        // for (var key = 0, len = totallen; key < len; key++) {
        arrayIndx.forEach(function (indx) {
            var thePhoneNumber = params.phoneNumbers[indx].value;
            var res = thePhoneNumber.split("-", 3);
            assert(res.length === 3)
        });

        next();
    }
};



