exports['help'] = function(binary, next){
  var help = binary.fs.readFileSync(binary.paths.actionHero_root + "/bin/include/help.txt");
  binary.log(help);
  next();
}