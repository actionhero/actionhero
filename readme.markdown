# node.js DAVE API Framework

## Who is _DAVE_?
DAVE is a minimalist, multi-node, transactional API framework written in javaScript for the [node.js](http://nodejs.org) server.  It was inspired by the [DAVE PHP framework](http://github.com/evantahler/php-dave-api).

Dave contains an end-to-end API test suite for TDD, a Task model, and an Active Database Model

DAVE is an acronym that stands for Delete, Add, Edit, and View. These 4 methods make up the core functionality of many transactional web applications. The DAVE API aims to simplify and abstract may of the common tasks that these types of APIs require.  DAVE does the work for you, and he's not CRUD.  Dave was built to be both easy to use, but to be as simple as possible.  I was tired of bloated frameworks that were designed to be monolithic applications which include M's, V's, and C's together in a single running application.  As applications grow and become more 'service oriented', this is the eventual route which many applications go.  I wanted to make is as simple as possible to create a new application with this mindset, and to allow for future flexibility.

The DAVE API defines a single access point and accepts GET, POST, or COOKIE input. You define "Action's" that handle the input, such as "AddUser" or "GeoLocate". The DAVE API is NOT "RESTful", in that it does not use the normal verbs (Get, Put, etc) and uses a single /path/. This was chosen to make it as simple as possible for devices/users to access the functions, including low-level embedded devices which may have trouble with all the HTTP verbs.  To see how simple it is to handle basic actions, this package comes with a basic Actions included. Look in `api/actions/`.    You can also visit http://{baseUrl}/{action} or can configure your own router.

The DAVE API understands 2 types of security methodology. "Public" actions can be called by anyone, and then can implement optional user-based security (checking userIDs and PasswordHashes?). Optionally, certain Actions can be defined as "Private", and will require a defined developer to authenticate with every request. This requires your developers to provide an MD5 hash of their APIKey and private DeveloperID to authenticate with. You can mix private and public actions.  Of course, you can make your own actions for this as well!

Dave contains an end-to-end API test suite for TDD, a Task model, an Active Database Model, and a stand-alone development server (written in just PHP) to get you started.

## Philosophical Questions
If you have ever asked these questions of other web-frameworks, then DAVE might be the right fit for you:

* Why do we really need a controller?
* Why are linear actions so hidden in object abstraction?
* Why can't I de-couple my M's, V's and C's?
* Why can't my test suite use the real application?
* Is there an option for a non-restFUL API?
* Why isn't there an easier way to develop and test locally with PHP?
* Why are there no modern PHP API Frameworks?!

## Features
* Abstraction of basic DAVE (Delete, Add, Edit, View) actions
* Active Database Modeling on-the-fly or fixed per your requirements
* (optional) Objects for Database entities with DAVE abstraction
* Built with a Multi-Node system in mind, but works great on a single machine as well
* Developer-based authentication in tandem with user-level authentication
* Rate Limiting for client connections
* Class-based abstraction of mySQL connections
* Built-in support for multiple types of Caching (Flat File, mySQL, memcache)
* CRON processing of delayed events
* Simple error handling and input sanitization
* XML, JSON, Serialized PHP output types built in
* Task Classes to automate periodic management and to ease development
* End-to-end spec testing framework for the API including custom assertions

## Requirements
* node.js server
* npm


## Actions you can try [[?action=..]] which are included in the framework:
...

## QuickStart
...