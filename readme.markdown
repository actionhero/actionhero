# node.js DAVE API Framework

## Who is _DAVE_?
DAVE is a minimalist, multi-node, transactional API framework written in javaScript for the [node.js](http://nodejs.org) server.  It was inspired by the [DAVE PHP framework](http://github.com/evantahler/php-dave-api).

DAVE is an acronym that stands for Delete, Add, Edit, and View. These 4 methods make up the core functionality of many transactional web applications. The DAVE API aims to simplify and abstract may of the common tasks that these types of APIs require.  DAVE does the work for you, and he's not CRUD.  Dave was built to be both easy to use, but to be as simple as possible.  I was tired of bloated frameworks that were designed to be monolithic applications which include M's, V's, and C's together in a single running application.  As applications grow and become more 'service oriented', this is the eventual route which many applications go.  I wanted to make is as simple as possible to create a new application with this mindset, and to allow for future flexibility.

The DAVE API defines a single access point and accepts GET, POST, or COOKIE input. You define "Action's" that handle the input, such as "AddUser" or "GeoLocate". The DAVE API is NOT "RESTful", in that it does not use the normal verbs (Get, Put, etc) and uses a single path/endpoint. This was chosen to make it as simple as possible for devices/users to access the functions, including low-level embedded devices which may have trouble with all the HTTP verbs.  To see how simple it is to handle basic actions, this package comes with a basic Actions included. Look in `api/actions/`.    You can also visit `http://{baseUrl}/{action}` or can configure your own router.

Dave will serve up flat files (html, images, etc) as well from your api/public folder.  This is acomplished via a `file` action. `http://{baseUrl}/file/{pathToFile}` is equivelent to `http://{baseUrl}?action=file&fileName={pathToFile}`

Dave also includes methods to run periodic tasks within your server (think built in cron tasks) which can process within the same appliaction which processes incomming events.  Hooray for the event queue!

## Requirements
* node.js server
* npm


## Actions you can try [[?action=..]] which are included in the framework:
...

## QuickStart
* brew install node
* curl http://npmjs.org/install.sh | sudo sh
* npm update