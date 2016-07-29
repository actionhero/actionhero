# Upgrading ActionHero

Upgrading big ActionHero projects to a new major might requite substantial effort. Every ActionHero version has it's own specific project files which you generate using `actionhero generate` command. One of the ways to upgrade your project is to generate a new project using the latest ActionHero framework (`npm install actionhero && ./node_modules/.bin/actionhero generate`). Using that as your starting point you can then carefully copy all your `configs`, `initializers`, `servers`, links and other custom code from your old project, making sure that you are at the same working state as before. It's a good practice to make tests for your actions (or any other component) before you plan to upgrade your ActionHero project. With tests you can make sure that you have successfully upgraded your project.

ActionHero follows [semantic versioning](http://semver.org/).  This means that a minor change is a right-most number.  A new feature added is the middle number, and a breaking change is the left number.  You should expect something in your application to need to be changed if you upgrade a major version.

## Upgrading from v13.x.x to v14.x.x
TODO

## Upgrading from v12.x.x to v13.x.x
TODO

## Upgrading from v11.x.x to v12.x.x
TODO

## Upgrading from v10.x.x to v11.x.x
TODO
