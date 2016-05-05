'use strict';


exports.task = {
    name: 'test',
    description: 'test',
    frequency: 10000,
    queue: 'default',
    plugins: [],
    pluginOptions: {},

    migrate: function(api, params, cb) {
        //Check if params are older then current task version
        //Migrate the params
        api.log("I'm migrating yo", 'info', params);
        cb(params);
    },

    run: function(api, oldParams, next) {
        // your logic here');
        api.log("This is: ", 'info', oldParams);

        api.log("Change");

        next();
    }
};
