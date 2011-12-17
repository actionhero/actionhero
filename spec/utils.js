var vows = require('vows');
var assert = require('assert');
//
var suite = vows.describe('API global Utils');
suite.addBatch({
   'math': {
        topic: function () { return (1 + 1) },
        'I am a vow': function (result) {
            assert.equal(2,result);
        }
    }
});

// export
suite.export(module);