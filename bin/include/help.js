exports['help'] = function(api, next){
  var help = api.fs.readFileSync(__dirname + "/help.txt");
  api.log(help);

  next();
}