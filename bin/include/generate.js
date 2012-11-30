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

  if(binary.globally != true){

    // test that actionHero is installed
    binary.utils.dir_exists("node_modules", null, function(){
      binary.log(" ! node_modules doesn't exist.  `npm install actionHero` first".red);
      process.exit();
    });
    binary.utils.dir_exists("node_modules/actionHero", null, function(){
      binary.log(" ! node_modules/actionHero doesn't exist.  `npm install actionHero` first".red);
      process.exit();
    });

    documents.config_js = binary.fs.readFileSync(binary.project_root + "/node_modules/actionHero/config.js");
    documents.routes_js = binary.fs.readFileSync(binary.project_root + "/node_modules/actionHero/routes.js");
    documents.cert_pem = binary.fs.readFileSync(binary.project_root + "/node_modules/actionHero/certs/server-cert.pem");
    documents.key_pem = binary.fs.readFileSync(binary.project_root + "/node_modules/actionHero/certs/server-key.pem");
    documents.action_actions_view = binary.fs.readFileSync(binary.project_root + "/node_modules/actionHero/actions/actionsView.js");
    documents.action_file = binary.fs.readFileSync(binary.project_root + "/node_modules/actionHero/actions/file.js");
    documents.action_status = binary.fs.readFileSync(binary.project_root + "/node_modules/actionHero/actions/status.js");
    documents.action_chat = binary.fs.readFileSync(binary.project_root + "/node_modules/actionHero/actions/chat.js");
    documents.task_runAction = binary.fs.readFileSync(binary.project_root + "/node_modules/actionHero/tasks/runAction.js");
    documents.public_actionHeroWebSocket = binary.fs.readFileSync(binary.project_root + "/node_modules/actionHero/public/javascripts/actionHeroWebSocket.js");
  }else{
    var modules_path = process.cwd() + "/node_modules";
    try{
      stats = binary.fs.lstatSync(modules_path);
      if(!stats.isDirectory()){
        binary.fs.mkdirSync(modules_path);
      }
    }catch(e){
      binary.fs.mkdirSync(modules_path);
    }
    documents.config_js = binary.fs.readFileSync(__dirname + "/../../config.js");
    documents.routes_js = binary.fs.readFileSync(__dirname + "/../../routes.js");
    documents.cert_pem = binary.fs.readFileSync(__dirname + "/../../certs/server-cert.pem");
    documents.key_pem = binary.fs.readFileSync(__dirname + "/../../certs/server-key.pem");
    documents.action_actions_view = binary.fs.readFileSync(__dirname + "/../../actions/actionsView.js");
    documents.action_file = binary.fs.readFileSync(__dirname + "/../../actions/file.js");
    documents.action_status = binary.fs.readFileSync(__dirname + "/../../actions/status.js");
    documents.action_chat = binary.fs.readFileSync(__dirname + "/../../actions/chat.js");
    documents.task_runAction = binary.fs.readFileSync(__dirname + "/../../tasks/runAction.js");
    documents.public_actionHeroWebSocket = binary.fs.readFileSync(__dirname + "/../../public/javascripts/actionHeroWebSocket.js");
  }

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
      \"start\": \"node ./node_modules/actionHero/bin/actionHero start\",\r\n\
      \"startCluster\": \"node ./node_modules/actionHero/bin/actionHero startCluster\",\r\n\
      \"help\": \"node ./node_modules/actionHero/bin/actionHero help\"\r\n\
    }\r\n\
  }\r\n\
  ";

  documents.readme_md = "# My actionHero Project\r\nreadme"; 

  documents.index_html = "<h1>Hello from actionHero!</h1>\r\n\
  <p>If you are reading this, your actionHero project is working.</p>\r\n\
  <p><strong>Good Job!</strong></p>\r\n\
  ";

  //////// LOGIC ////////

  binary.log("Generating a new actionHero project...");

  // make directories
  binary.utils.create_dir_safely("actions");
  binary.utils.create_dir_safely("pids");
  binary.utils.create_dir_safely("certs");
  binary.utils.create_dir_safely("initializers");
  binary.utils.create_dir_safely("log");
  binary.utils.create_dir_safely("public");
  binary.utils.create_dir_safely("public/javascripts");
  binary.utils.create_dir_safely("tasks");

  // make files
  binary.utils.create_file_safely('config.js', documents.config_js);
  binary.utils.create_file_safely('routes.js', documents.routes_js);
  binary.utils.create_file_safely('package.json', documents.package_json);
  binary.utils.create_file_safely('certs/server-cert.pem', documents.cert_pem);
  binary.utils.create_file_safely('certs/server-key.pem', documents.key_pem);
  binary.utils.create_file_safely('actions/actionsView.js', documents.action_actions_view);
  binary.utils.create_file_safely('actions/file.js', documents.action_file);
  binary.utils.create_file_safely('actions/status.js', documents.action_status);
  binary.utils.create_file_safely('actions/chat.js', documents.action_chat);
  binary.utils.create_file_safely('tasks/runAction.js', documents.task_runAction);
  binary.utils.create_file_safely('public/index.html', documents.index_html);
  binary.utils.create_file_safely('public/javascripts/actionHeroWebSocket.js', documents.public_actionHeroWebSocket);
  binary.utils.create_file_safely('readme.md', documents.readme_md);

  binary.log("");
  binary.log("Generation Complete.  Your project directory should look like this:\r\n" + documents.projectMap.blue);
  binary.log("");
  binary.log("run `./node_modules/.bin/actionHero start` to start your server");

  next();

}