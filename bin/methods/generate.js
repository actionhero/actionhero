var fs = require('fs');

exports['generate'] = function(binary, next){

  //////// DOCUMENTS ////////

  var documents = {};

  documents.projectMap = '/\n\
  |- config\n\
  | -- config.js\n\
  | -- environments\n\
  |-- (project settings)\n\
  |\n\
  |- actions\n\
  |-- (your actions)\n\
  |\n\
  |- initializers\n\
  |-- (any additional initializers you want)\n\
  |\n\
  |- log\n\
  |-- (default location for logs)\n\
  |\n\
  |- node_modules\n\
  |-- (your modules, actionHero should be npm installed in here)\n\
  |\n\
  |- pids\n\
  |-- (pidfiles for your running servers)\n\
  |\n\
  |- public\n\
  |-- (your static assets to be served by /file)\n\
  |\n\
  |- servers\n\
  |-- (custom servers you may make)\n\
  |\n\
  |- tasks\n\
  |-- (your tasks)\n\
  |\n\
  |- tests\n\
  |-- (tests for your API)\n\
  |\n\
  readme.md\n\
  routes.js\n\
  gruntfile.js\n\
  package.json (be sure to include \'actionHero\':\'x\')\n\
  ';

  var oldFileMap = {
    config_js                     : '/config/config.js',
    config_production_js          : '/config/environments/production.js',
    config_test_js                : '/config/environments/test.js',
    package_json                  : '/package.json',
    routes_js                     : '/routes.js',
    action_status                 : '/actions/status.js',
    task_runAction                : '/tasks/runAction.js',
    gruntfile                     : '/grunt/actionHero_gruntfile.js',
    public_actionHeroWebSocket    : '/public/javascript/actionHeroWebSocket.js',
    public_actionHeroWebSocketMin : '/public/javascript/actionHeroWebSocket.min.js',
    public_index                  : '/public/index.html',
    public_chat                   : '/public/chat.html',
    public_logo                   : '/public/logo/actionHero.png',
    public_css                    : '/public/css/actionhero.css',
    example_test                  : '/test/template.js.example',
  }
  for(var name in oldFileMap){
    documents[name] = fs.readFileSync(binary.paths.actionHero_root + oldFileMap[name]);
  }

  var AHversionNumber = JSON.parse(documents.package_json).version;

  documents.package_json = '{\n\
  "author": "YOU <YOU@example.com>",\n\
  "name": "my_actionHero_project",\n\
  "description": "",\n\
  "version": "0.0.1",\n\
  "homepage": "",\n\
  "repository": {\n\
    "type": "",\n\
    "url": ""\n\
  },\n\
  "engines": {\n\
    "node": ">=0.8.0"\n\
  },\n\
  "dependencies": {\n\
    \"actionHero\": \"'+AHversionNumber+"\",\n\
    \"grunt\": \"~0.4.2\"\n\
  },\n\
  \"devDependencies\": {\n\
    \"mocha\": \"latest\",\n\
    \"should\": \"latest\"\n\
  },\n\
  \"scripts\": {\n\
    \"help\": \"actionHero help\",\n\
    \"start\": \"actionHero start\",\n\
    \"actionHero\": \"actionHero\",\n\
    \"startCluster\": \"actionHero startCluster\",\n\
    \"test\": \"mocha\"\n\
  }\n\
}\n\
";

  documents._project_js = 'exports._project = function(api, next){\n\
  // modify / append the api global variable\n\
  // I will be run as part of actionHero\'s boot process\n\
\n\
  next();\n\
}\
';

  documents.readme_md = '# My actionHero Project\nreadme';
  documents.git_ignore = 'log\npids\nnode_modules';

  //////// LOGIC ////////

  binary.log('Generating a new actionHero project...');

  // make directories
  [
    '/actions',
    '/pids',
    '/certs',
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
    '/.gitignore'                                   : 'git_ignore',
    '/config/config.js'                             : 'config_js',
    '/config/environments/production.js'            : 'config_production_js',
    '/config/environments/test.js'                  : 'config_test_js',
    '/routes.js'                                    : 'routes_js',
    '/package.json'                                 : 'package_json',
    '/actions/status.js'                            : 'action_status',
    '/tasks/runAction.js'                           : 'task_runAction',
    '/initializers/_project.js'                     : '_project_js',
    '/public/index.html'                            : 'public_index',
    '/public/chat.html'                             : 'public_chat',
    '/public/css/actionhero.css'                    : 'public_css',
    '/public/logo/actionHero.png'                   : 'public_logo',
    '/public/javascript/actionHeroWebSocket.js'     : 'public_actionHeroWebSocket',
    '/public/javascript/actionHeroWebSocket.min.js' : 'public_actionHeroWebSocketMin',
    '/readme.md'                                    : 'readme_md',
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
