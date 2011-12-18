var specHelper = require('../specHelper.js').specHelper;
//
var utils = require('../utils.js').utils;
var suite = specHelper.vows.describe('API global Utils');
//
suite.addBatch({
   'utils.sqlDateTime default': {
        topic: utils.sqlDateTime(),
        'Should be a string': function (result) { specHelper.assert.isString(result); },
        'Should be the right length': function (result) { specHelper.assert.equal(result.length, 19); }
    },
    'utils.sqlDateTime specific time': {
        topic: function(){
            var now = new Date(0); 
            var now_utc = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
            return utils.sqlDateTime(now)
        },
        'Should be the right length': function (result) { specHelper.assert.equal(result.length, 19); }
        // 'Should the time at 0': function (result) { specHelper.assert.equal(result, "1970-01-01 00:00:00"); },
    }
});

suite.addBatch({
   'utils.randomString': {
        topic: utils.randomString(100),
        'Should be a string': function (result) { specHelper.assert.isString(result); },
        'Should be the right length': function (result) { specHelper.assert.equal(result.length, 17); },
        'Should be random': function (result) { 
            var i = 0;
            while(i < 1000){
                specHelper.assert.notEqual(result.length, utils.randomString(100));
                i++;
            }
        }
    }
});

suite.addBatch({
   'utils.hashLength': {
        topic: utils.hashLength({ a: 1, b: 2, c: {aa: 1, bb: 2}}),
        'Should be a number': function (result) { specHelper.assert.isNumber(result); },
        'Should correct top level count': function (result) { specHelper.assert.equal(result, 3); },
    }
});

suite.addBatch({
   'utils.sleepSync': {
        topic: function(){ 
            var start = new Date();
            utils.sleepSync(1) 
            var end = new Date();
            return (end - start);
        },
        'Should be a number': function (result) { specHelper.assert.isNumber(result); },
        'System should have slept for 1 second' : function(result){ 
            specHelper.assert.isTrue(result > 1000); 
            specHelper.assert.isTrue(result < 2000);
        },
    }
});

suite.addBatch({
   'utils.requiredParamChecker': {
        topic: function(){ 
            var connection = {
                params:{
                    a:1,
                    b:2,
                    c:3
                },
                error: false
            };
            return connection
        },
        'all:ok': function (connection) { 
            connection.error = false;
            var required_params = ["a","b"];
            utils.requiredParamChecker({}, connection, required_params, "all");
            specHelper.assert.isFalse(connection.error); 
        },
        'all:failure': function (connection) { 
            connection.error = false;
            var required_params = ["a","b","d"];
            utils.requiredParamChecker({}, connection, required_params, "all");
            specHelper.assert.equal(connection.error,"d is a required parameter for this action"); 
        },
        'any:ok': function (connection) { 
            connection.error = false;
            var required_params = ["a","b"];
            utils.requiredParamChecker({}, connection, required_params, "all");
            specHelper.assert.isFalse(connection.error); 
        },
        'any:failure': function (connection) { 
            connection.error = false;
            var required_params = ["d"];
            utils.requiredParamChecker({}, connection, required_params, "all");
            specHelper.assert.equal(connection.error,"d is a required parameter for this action"); 
        },
    }
});

// export
suite.export(module);