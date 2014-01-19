var fs = require('fs');

exports['generate'] = function(binary, next){

  //////// DOCUMENTS ////////

  var documents = {};

  documents.projectMap = fs.readFileSync(binary.paths.actionhero_root + '/bin/templates/projectMap.txt');

  var oldFileMap = {
    config_js                     : '/config/config.js',
    config_production_js          : '/config/environments/production.js',
    config_test_js                : '/config/environments/test.js',
    package_json                  : '/package.json',
    routes_js                     : '/routes.js',
    action_status                 : '/actions/status.js',
    task_runAction                : '/tasks/runAction.js',
    gruntfile                     : '/grunt/actionhero_gruntfile.js',
    public_actionheroClient       : '/public/javascript/actionheroClient.js',
    public_actionheroClientMin    : '/public/javascript/actionheroClient.min.js',
    public_index                  : '/public/index.html',
    public_chat                   : '/public/chat.html',
    public_logo                   : '/public/logo/actionhero.png',
    public_css                    : '/public/css/actionhero.css',
    example_test                  : '/test/template.js.example',
  }
  for(var name in oldFileMap){
    documents[name] = fs.readFileSync(binary.paths.actionhero_root + oldFileMap[name]);
  }

  var AHversionNumber = JSON.parse(documents.package_json).version;

  documents.package_json = String(fs.readFileSync(binary.paths.actionhero_root + '/bin/templates/package.json'));
  documents.package_json = documents.package_json.replace('%%versionNumber%%', AHversionNumber);
  documents.readme_md    = String(fs.readFileSync(binary.paths.actionhero_root + '/bin/templates/README.md'));

  //////// LOGIC ////////

  binary.log('Generating a new actionhero project...');

  // make directories
  [
    '/actions',
    '/pids',
    '/config',
    '/config/environments',
    '/initializers',
    '/log',
    '/servers',
    '/public',
    '/public/javascript',
    '/public/css',
    '/public/logo',
    '/tasks',
    '/test',
  ].forEach(function(dir){
    binary.utils.create_dir_safely(binary.paths.project_root + dir);
  });

  // make files
  var newFileMap = {
    '/config/config.js'                             : 'config_js',
    '/config/environments/production.js'            : 'config_production_js',
    '/config/environments/test.js'                  : 'config_test_js',
    '/routes.js'                                    : 'routes_js',
    '/package.json'                                 : 'package_json',
    '/actions/status.js'                            : 'action_status',
    '/public/index.html'                            : 'public_index',
    '/public/chat.html'                             : 'public_chat',
    '/public/css/actionhero.css'                    : 'public_css',
    '/public/logo/actionhero.png'                   : 'public_logo',
    '/public/javascript/actionheroClient.js'        : 'public_actionheroClient',
    '/public/javascript/actionheroClient.min.js'    : 'public_actionheroClientMin',
    '/README.md'                                    : 'readme_md',
    '/gruntfile.js'                                 : 'gruntfile',
    '/test/example.js'                              : 'example_test',
  }
  for(var file in newFileMap){
    binary.utils.create_file_safely(binary.paths.project_root + file, documents[newFileMap[file]]);
  }

  binary.log('');
  binary.log('Generation Complete.  Your project directory should look like this:\n' + documents.projectMap);
  binary.log('');
  binary.log('you may need to run `npm install` to install some dependancies');
  binary.log('run \'npm start\' to start your server');

  next(); 

}
