var vows = require('vows');
var assert = require('assert');
//
var utils = require('../utils.js').utils;
var suite = vows.describe('API global Utils');
//
suite.addBatch({
   'utils.sqlDateTime default': {
        topic: utils.sqlDateTime(),
        'Should be a string': function (result) { assert.isString(result); },
        'Should be the right length': function (result) { assert.equal(result.length, 19); }
    },
    'utils.sqlDateTime specific time': {
        topic: function(){
            var now = new Date(0); 
            var now_utc = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
            return utils.sqlDateTime(now)
        },
        'Should be the right length': function (result) { assert.equal(result.length, 19); }
        // 'Should the time at 0': function (result) { assert.equal(result, "1970-01-01 00:00:00"); },
    }
});

suite.addBatch({
   'utils.randomString': {
        topic: utils.randomString(100),
        'Should be a string': function (result) { assert.isString(result); },
        'Should be the right length': function (result) { assert.equal(result.length, 17); },
        'Should be random': function (result) { 
            var i = 0;
            while(i < 1000){
                assert.notEqual(result.length, utils.randomString(100));
                i++;
            }
        }
    }
});

suite.addBatch({
   'utils.hashLength': {
        topic: utils.hashLength({ a: 1, b: 2, c: {aa: 1, bb: 2}}),
        'Should be a number': function (result) { assert.isNumber(result); },
        'Should correct top level count': function (result) { assert.equal(result, 3); },
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
        'Should be a number': function (result) { assert.isNumber(result); },
        'System should have slept for 1 second' : function(result){ 
            assert.isTrue(result > 1000); 
            assert.isTrue(result < 2000);
        },
    }
});

// export
suite.export(module);