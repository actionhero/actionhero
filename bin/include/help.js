exports['help'] = function(api, next){
  var help = api.fs.readFileSync(binary.paths.actionHero_root + "/bin/include/help.txt");
  api.log(help);
  next();
}