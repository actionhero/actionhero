// You can also use the openSSL client directly
// openssl s_client -connect 127.0.0.1:5000

var tls = require('tls');
var fs = require('fs');

var options = {
  key: fs.readFileSync('../../../certs/server-key.pem'),
  cert: fs.readFileSync('../../../certs/server-cert.pem')
};

var cleartextStream = tls.connect(5000, options, function() {
  console.log('client connected', cleartextStream.authorized ? 'authorized' : 'unauthorized');
  process.stdin.pipe(cleartextStream);
  process.stdin.resume();
});
cleartextStream.setEncoding('utf8');
cleartextStream.on('data', function(data) {
  console.log(data);
});