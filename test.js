#!/usr/bin/env node
/*
I am a simple wrapper around mocha which sets various envirnment variables
I mainly exist so windows can run tests and set the NODE_ENV:/
*/

var testEnv = {};
for(var k in process.env){ testEnv[k] = process.env[k]; }
testEnv.NODE_ENV = 'test';

console.log('starting actionhero test suite with NODE_ENV=test');

var path = require('path');
var spawn = require('child_process').spawn;
var command = 'node_modules' + path.sep + '.bin' + path.sep + 'mocha';
var child = spawn(command, [], {
  cwd: __dirname,
  env: testEnv
});

child.stdout.on('data', function(s){ process.stdout.write( s.toString() ); });
child.stderr.on('data', function(s){ process.stderr.write( s.toString() ); });
child.on('close', process.exit);
