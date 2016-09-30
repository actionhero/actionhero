'use strict';
var fs = require('fs');
var stream = require('stream');

exports.sendBufferTest = {
  name: 'sendBufferTest',
  description: 'An API action that validates sending buffers over web.sendFile',
  outputExample: {},
  run: function(api, data, next){
    const buffer = 'Example of data buffer';
    let bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);
    data.connection.rawConnection.responseHeaders.push(['Content-Disposition', 'attachment; filename=test.csv']);
    api.servers.servers.web.sendFile(data.connection, null, bufferStream, 'text/csv', buffer.length, new Date());
    data.toRender = false;
    next();
  }

};
