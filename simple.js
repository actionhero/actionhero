require('heapdump');

var ActionheroPrototype = require(__dirname + '/actionhero.js').actionheroPrototype;
var actionhero = new ActionheroPrototype();
var api;

actionhero.start(function(err, apiFromCallback){
  if(err){ console.log(err); }
  api = apiFromCallback;
});