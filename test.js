#!/usr/bin/env node
/*
I am a simple wrapper around mocha which sets various envirnment variables
I mainly exist so windows can run tests and set the NODE_ENV:/
*/

var path = require('path');
var spawn = require('child_process').spawn;

var testEnv = {};
for(var k in process.env){ testEnv[k] = process.env[k]; }
testEnv.NODE_ENV = 'test';

console.log('starting actionhero test suite with NODE_ENV=test');

var execeutable;
if(process.platform === 'win32'){
  execeutable = 'mocha.cmd';
}else{
  execeutable = 'mocha';
}

var mocha = __dirname + path.sep + 'node_modules' + path.sep + '.bin' + path.sep + execeutable;
var child = spawn(mocha, ['test', '--reporter', 'dot'], {
  cwd: __dirname,
  env: testEnv
});

child.stdout.on('data', function(s){ process.stdout.write(String(s)); });
child.stderr.on('data', function(s){ process.stderr.write(String(s)); });

child.on('close', process.exit);
