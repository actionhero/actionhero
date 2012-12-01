exports['unknownInput'] = function(binary, next){
  binary.log("`" + binary.mainAction + "` is not a known action", ["red", "bold"]);
  binary.log("run `" + "actionHero help".green +  "` for more information");
  next();
}