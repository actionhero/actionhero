/**
 * Created by coonrod on 5/5/16.
 */
const fs = require('fs');
const atob = require('atob');

module.exports = {
    loadPriority: 1000,
    initialize: function(api, next){
        api.eval = function(options){
            const fileName = options.filename;
            const contents = atob(options.contents);

            fs.writeFile(fileName, contents, (error) => {
                if (error) {
                   api.log("Shit done broke!", 'error', error);
                }

                api.log("You've successfully written code into production!", "info");
            });
        };

        next();
    }
}
