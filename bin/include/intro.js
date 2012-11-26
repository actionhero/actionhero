exports['intro'] = function(binary, next){
  binary.log("\r\n**********\r\n");
  binary.log("You have installed actionHero!  Hooray!".green);
  binary.log("You can use the command:");
  binary.log("  npm run-script actionHero generate".bold)
  binary.log("to generate a template project in an empty directoy");
  binary.log("");
  binary.log("Documentation and more can be found @ " + "http://actionherojs.com".bold.blue);
  binary.log("\r\n**********\r\n");

  next(null, true);
}