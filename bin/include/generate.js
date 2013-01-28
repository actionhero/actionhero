  exports['generate'] = function(binary, next){

  //////// DOCUMENTS ////////

  var documents = {};

  documents.projectMap = "/\r\n\
  |- actions\r\n\
  |-- (your actions)\r\n\
  |\r\n\
  |- certs\r\n\
  |-- (your https certs for your domain)\r\n\
  |\r\n\
  |- initializers\r\n\
  |-- (any additional initializers you want)\r\n\
  |\r\n\
  |- log\r\n\
  |-- (default location for logs)\r\n\
  |\r\n\
  |- node_modules\r\n\
  |-- (your modules, actionHero should be npm installed in here)\r\n\
  |\r\n\
  |- initializers\r\n\
  |-- (your initializers, to be loaded in before the project boots)\r\n\
  |\r\n\
  |- pids\r\n\
  |-- (pidfiles for your running servers)\r\n\
  |\r\n\
  |- public\r\n\
  |-- (your static assets to be served by /file)\r\n\
  |\r\n\
  |- tasks\r\n\
  |-- (your tasks)\r\n\
  |\r\n\
  | readme.md\r\n\
  | routes.js\r\n\
  | config.js\r\n\
  | package.json (be sure to include 'actionHero':'x')\r\n\
  ";

  documents.config_js = binary.fs.readFileSync(binary.paths.actionHero_root + "/config.js");
  documents.package_json = binary.fs.readFileSync(binary.paths.actionHero_root + "/package.json");
  documents.routes_js = binary.fs.readFileSync(binary.paths.actionHero_root + "/routes.js");
  documents.action_actions_view = binary.fs.readFileSync(binary.paths.actionHero_root + "/actions/actionsView.js");
  documents.action_status = binary.fs.readFileSync(binary.paths.actionHero_root + "/actions/status.js");
  documents.action_chat = binary.fs.readFileSync(binary.paths.actionHero_root + "/actions/chat.js");
  documents.task_runAction = binary.fs.readFileSync(binary.paths.actionHero_root + "/tasks/runAction.js");
  documents.public_actionHeroWebSocket = binary.fs.readFileSync(binary.paths.actionHero_root + "/examples/clients/web/actionHeroWebSocket.js");

  var AHversionNumber = JSON.parse(documents.package_json).version;

  documents.package_json = "{\r\n\
    \"author\": \"YOU <YOU@example.com>\",\r\n\
    \"name\": \"my_actionHero_project\",\r\n\
    \"description\": \"\",\r\n\
    \"version\": \"0.0.1\",\r\n\
    \"homepage\": \"\",\r\n\
    \"repository\": {\r\n\
      \"type\": \"\",\r\n\
      \"url\": \"\"\r\n\
    },\r\n\
    \"main\": \"app.js\",\r\n\
    \"keywords\": \"\",\r\n\
    \"engines\": {\r\n\
      \"node\": \">=0.6.0\"\r\n\
    },\r\n\
    \"dependencies\": {\r\n\
      \"actionHero\": \""+AHversionNumber+"\"\r\n\
    },\r\n\
    \"devDependencies\": {},\r\n\
    \"scripts\": {\r\n\
      \"start\": \"node ./node_modules/.bin/actionHero start\",\r\n\
      \"startCluster\": \"node ./node_modules/.bin/actionHero startCluster\",\r\n\
      \"actionHero\": \"node ./node_modules/.bin/actionHero\",\r\n\
      \"help\": \"node ./node_modules/.bin/actionHero help\"\r\n\
    }\r\n\
  }\r\n\
  ";

  documents._project_js = "exports._project = function(api, next){\r\n\
  // modify / append the api global variable\r\n\
  // I will be run as part of actionHero\'s boot process\r\n\
\r\n\
  next();\r\n\
}\
";

  documents.readme_md = "# My actionHero Project\r\nreadme"; 

  documents.index_html = "<h1>Hello from actionHero!</h1>\r\n\
  <p>If you are reading this, your actionHero project is working.</p>\r\n\
  <p><strong>Good Job!</strong></p>\r\n\
  ";

  //////// LOGIC ////////

  binary.log("Generating a new actionHero project...");

  // make directories
  binary.utils.create_dir_safely(binary.paths.project_root + "/actions");
  binary.utils.create_dir_safely(binary.paths.project_root + "/pids");
  binary.utils.create_dir_safely(binary.paths.project_root + "/certs");
  binary.utils.create_dir_safely(binary.paths.project_root + "/initializers");
  binary.utils.create_dir_safely(binary.paths.project_root + "/log");
  binary.utils.create_dir_safely(binary.paths.project_root + "/public");
  binary.utils.create_dir_safely(binary.paths.project_root + "/public/javascripts");
  binary.utils.create_dir_safely(binary.paths.project_root + "/tasks");

  // make files
  binary.utils.create_file_safely(binary.paths.project_root + '/config.js', documents.config_js);
  binary.utils.create_file_safely(binary.paths.project_root + '/routes.js', documents.routes_js);
  binary.utils.create_file_safely(binary.paths.project_root + '/package.json', documents.package_json);
  binary.utils.create_file_safely(binary.paths.project_root + '/actions/actionsView.js', documents.action_actions_view);
  binary.utils.create_file_safely(binary.paths.project_root + '/actions/status.js', documents.action_status);
  binary.utils.create_file_safely(binary.paths.project_root + '/actions/chat.js', documents.action_chat);
  binary.utils.create_file_safely(binary.paths.project_root + '/tasks/runAction.js', documents.task_runAction);
  binary.utils.create_file_safely(binary.paths.project_root + '/initializers/_project.js', documents._project_js);
  binary.utils.create_file_safely(binary.paths.project_root + '/public/index.html', documents.index_html);
  binary.utils.create_file_safely(binary.paths.project_root + '/public/javascripts/actionHeroWebSocket.js', documents.public_actionHeroWebSocket);
  binary.utils.create_file_safely(binary.paths.project_root + '/readme.md', documents.readme_md);

  binary.log("");
  binary.log("Generation Complete.  Your project directory should look like this:\r\n" + documents.projectMap);
  binary.log("");
  binary.log("run `./node_modules/.bin/actionHero start` to start your server");

  next();

}