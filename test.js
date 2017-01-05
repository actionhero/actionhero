#!/usr/bin/env node
'use strict';

/*
I am a simple wrapper around mocha which sets various envirnment variables
I mainly exist so windows can run tests and set the NODE_ENV:/
*/

const path = require('path');
const glob = require('glob');
const spawn = require('child_process').spawn;

let testEnv = {};
for(let k in process.env){ testEnv[k] = process.env[k]; }
testEnv.NODE_ENV = 'test';

console.log('starting actionhero test suite with NODE_ENV=test');

let execeutable;
if(process.platform === 'win32'){
  execeutable = 'mocha.cmd';
}else{
  execeutable = 'mocha';
}

let testFiles = glob.sync(__dirname + '/test/**/*.js');

// shuffle the test files so we have a random test order
// testFiles.sort(function(){ return 0.5 - Math.random(); });
// console.log('\r\nTest Order:')
// testFiles.forEach((file) => {
//   console.log('  ' + file.replace(__dirname, ''));
// });

let mocha = __dirname + path.sep + 'node_modules' + path.sep + '.bin' + path.sep + execeutable;
let child = spawn(mocha, ['--reporter', 'dot'].concat(testFiles), {
  cwd: __dirname,
  env: testEnv
});

child.stdout.on('data', (s) => { process.stdout.write(String(s)); });
child.stderr.on('data', (s) => { process.stderr.write(String(s)); });

child.on('close', process.exit);
