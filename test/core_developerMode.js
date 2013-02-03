var versionParts = process.version.split('.');
versionParts[0] = versionParts[0].replace('v', '');
for(var i in versionParts){ versionParts[i] = parseInt(versionParts[i]); }

if(versionParts[0] >= 0 && versionParts[1] >= 7){
    describe('Core: Developer Mode', function(){

      var specHelper = require('../helpers/specHelper.js').specHelper;
      var apiObj = {};
      var should = require("should");

      var original_file = "./actions/randomNumber.js";
      var original_content = specHelper.fs.readFileSync(original_file);

      var new_file_content = "";
      new_file_content += "var action = {};";
      new_file_content += "action.name = \"randomNumber\";";
      new_file_content += "action.description = \"HACK\";";
      new_file_content += "action.inputs = { \"required\" : [], \"optional\" : [] };";
      new_file_content += "action.outputExample = {randomNumber: 123};";
      new_file_content += "action.run = function(api, connection, next){";
      new_file_content += "  connection.response.randomNumber = \"not a number!\";";
      new_file_content += "  next(connection, true);";
      new_file_content += "};";
      new_file_content += "exports.action = action;";

      before(function(done){
        specHelper.prepare(0, function(api){ 
          apiObj = specHelper.cleanAPIObject(api);
          setTimeout(function(){
            done();
          }, 1001) // allow the file to get stat'd once in the original state
        })
      });

      after(function(done){
        // ensure original file content is put back
        this.timeout(10000) // these are slow tests :(
        specHelper.fs.writeFile(original_file, String(original_content), function(err){
          setTimeout(function(){
            done();
          },1001 * 8);
        });
      });

      it('random numbers work initially', function(done){
        specHelper.apiTest.get('/randomNumber', 0, {}, function(response){
          should.not.exist(response.body.error);
          response.body.randomNumber.should.be.within(0,1);
          done();
        });
      });

      it('I can change the file and new actions will be loaded up', function(done){
        this.timeout(10000) // these are slow tests :(
          specHelper.fs.writeFile(original_file, new_file_content, function(err) {
          setTimeout(function(){
            specHelper.apiTest.get('/randomNumber', 0, {}, function(response){
              apiObj.actions.actions.randomNumber.description.should.equal("HACK");
              response.body.randomNumber.should.equal("not a number!");
              done();
            });
          }, 1001 * 8); //file read timer is 1 second; time to notice the change + 3x time to reaload API
        });
      });

    });
}else{
  console.log("\r\n\r\n ** the developer mode test can only run for node >= v0.7.0; skipping ** \r\n\r\n");
}