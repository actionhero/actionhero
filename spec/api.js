var vows = require('vows');
var assert = require('assert');
var http = require('http');
//
var suite = vows.describe('API general application');
var api = {};
//
var apiThread = require('child_process').exec('cd .. && node api.js test',function (error, stdout, stderr) {
    doTest();
});

function doTest(){
    suite.addBatch({
       'api should be a website': {
            topic: function() {
                var options = {
                  host: 'localhost',
                  port: 8081,
                  path: '/',
                  method: 'GET'
                };

                var req = http.request(options, function(res) {
                  console.log('STATUS: ' + res.statusCode);
                  console.log('HEADERS: ' + JSON.stringify(res.headers));
                  res.setEncoding('utf8');
                  res.on('data', function (chunk) {
                    console.log('BODY: ' + chunk);
                  });
                });

                req.write('data\n');
                req.end();
            },
            'Should be an object': function (result) { assert.isObject(api); },
        },
    });

    // export
    suite.export(module);
}