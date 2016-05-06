'use strict';
const spawn = require('child_process').spawn;

var bluebird;

exports.action = {
  name:                   'npm',
  description:            'npm',
  blockedConnectionTypes: [],
  outputExample:          {},
  matchExtensionMimeType: false,
  version:                1.0,
  toDocument:             true,
  middleware:             [],

  inputs: {
    "package": {
      required: true
    }
  },

  run: function(api, data, next) {
    let error = null;

    api.log("Attemping to npm install " + data.params.package, "info");
    const install = spawn('npm', ['install', '--save', data.params.package]);

    install.stdout.on('data', (data) => {
      api.log("stdout: ", "info", data.toString('ascii'));
    });

    install.stderr.on('data', (data) => {
      api.log("stderr: ", "error", data.toString('ascii'));
    });

    install.on('close', (code) => {
      api.log("Child process exited with code " + code, "info");
      next(error);
    });

  }
};
