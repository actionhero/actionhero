namespace("actionHero", function(){
  namespace("cache", function(){

    desc("This will clear actionHero's cache");
    task("cacheClear", ["actionHero:envrionment"], {async: true}, function(){
      console.log(api)
    });

    desc("This will clear actionHero's cache");
    task("cacheClearInvoke", {async: true}, function(){
      var env = jake.Task["actionHero:envrionment"];
      env.addListener('complete', function(a,b,c){
        console.log(a, b, c)
      });
      env.invoke();
    });

  });
});