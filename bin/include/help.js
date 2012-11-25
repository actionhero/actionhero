exports['help'] = function(api, next){
  var help = api.fs.readFileSync(process.cwd() + "/bin/help.txt");
  api.log(help);

  next();
}