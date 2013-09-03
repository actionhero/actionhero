exports['unknownInput'] = function(binary, next){
  binary.log("`" + binary.mainAction + "` is not a known action", "warning");
  binary.log("run `actionHero help` for more information", "warning");
  next();
}