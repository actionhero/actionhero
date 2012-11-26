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
  | config.js\r\n\
  | package.json (be sure to include 'actionHero':'x')\r\n\
  ";

  documents.config_js = fs.readFileSync(project_root + "/node_modules/actionHero/config.js");
  documents.routes_js = fs.readFileSync(project_root + "/node_modules/actionHero/routes.js");

  documents.cert_pem = fs.readFileSync(project_root + "/node_modules/actionHero/certs/server-cert.pem");
  documents.key_pem = fs.readFileSync(project_root + "/node_modules/actionHero/certs/server-key.pem");

  documents.action_actions_view = fs.readFileSync(project_root + "/node_modules/actionHero/actions/actionsView.js");
  documents.action_file = fs.readFileSync(project_root + "/node_modules/actionHero/actions/file.js");
  documents.action_random_number = fs.readFileSync(project_root + "/node_modules/actionHero/actions/randomNumber.js");
  documents.action_status = fs.readFileSync(project_root + "/node_modules/actionHero/actions/status.js");
  documents.action_chat = fs.readFileSync(project_root + "/node_modules/actionHero/actions/chat.js");

  documents.task_runAction = fs.readFileSync(project_root + "/node_modules/actionHero/tasks/runAction.js");

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
      \"actionHero\": \"x\"\r\n\
    },\r\n\
    \"devDependencies\": {},\r\n\
    \"scripts\": {\r\n\
      \"start\": \"./node_modules/actionHero/bin/actionHero start\"\r\n\
      \"startCluster\": \"./node_modules/actionHero/bin/actionHero startCluster\"\r\n\
      \"help\": \"./node_modules/actionHero/bin/actionHero help\"\r\n\
    }\r\n\
  }\r\n\
  ";

  documents.readme_md = "# My actionHero Project\r\nreadme"; 

  documents.index_html = "<h1>Hello from actionHero!</h1>\r\n\
  <p>If you are reading this, your actionHero project is working.</p>\r\n\
  <p><strong>Good Job!</strong></p>\r\n\
  ";

  //////// LOGIC ////////

  binary.log("\r\n**********\r\n");
  binary.log("Generating a new actionHero project...");

  // test that actionHero is installed
  dir_exists("node_modules", null, function(){
  	binary.log(" ! node_modules doesn't exist.  `npm install actionHero` first".red);
  	process.exit();
  });
  dir_exists("node_modules/actionHero", null, function(){
  	binary.log(" ! node_modules/actionHero doesn't exist.  `npm install actionHero` first".red);
  	process.exit();
  });

  // make directories
  create_dir_safely("actions");
  create_dir_safely("pids");
  create_dir_safely("certs");
  create_dir_safely("initializers");
  create_dir_safely("log");
  create_dir_safely("public");
  create_dir_safely("tasks");

  // make files
  create_file_safely('config.js', documents.config_js);
  create_file_safely('routes.js', documents.routes_js);
  create_file_safely('package.json', documents.package_json);
  create_file_safely('/certs/server-cert.pem', documents.cert_pem);
  create_file_safely('/certs/server-key.pem', documents.key_pem);
  create_file_safely('/actions/actionsView.js', documents.action_actions_view);
  create_file_safely('/actions/file.js', documents.action_file);
  create_file_safely('/actions/randomNumber.js', documents.action_random_number);
  create_file_safely('/actions/status.js', documents.action_status);
  create_file_safely('/actions/chat.js', documents.action_chat);
  create_file_safely('/tasks/runAction.js', documents.task_runAction);
  create_file_safely('/public/index.html', documents.index_html);
  create_file_safely('/readme.md', documents.readme_md);

  binary.log("");
  binary.log("Generation Complete.  Your project directory should look like this:");
  binary.log(documents.projectMap.blue)

  binary.log("");

  binary.log("run `npm start` to start your server");

  binary.log("\r\n**********\r\n");

  next();

}