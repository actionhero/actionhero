# Contributing

First, **THANK YOU**.  

Actionhero would not be the success it is today without the contributions of [many people](https://github.com/evantahler/actionhero/graphs/contributors).  Thank you for taking the time to help out this open source project, and create something we can all use.

## Testing

Be sure that your changes pass the test suite!  Run `npm test` to run the full test suite.
You will need redis and node.js installed.  No other external dependancies are needed.

**Every contribution to the codebase should have an associated test**

If you need help writing tests, please ask for help in the [chat room](http://slack.actionherojs.com)

## Syntax-checking

Spandex does not create much of it, but when it does, [true action
hero](http://www.body-pixel.com/2010/10/12/lavanderman-–-croatian-comic-book-hero/)
removes his bellybutton lint with special utility-belt tools, namely
[ESLint](http://eslint.org). Not only that, she does it in style too.

Basic code style as well as linting suggestions are governed by `.eslintrc`
ruleset. Your favorite editor most likely has a plugin to help you with that
too, and here's a list of few select plugins for your convenience:

- [Atom editor plugin](https://atom.io/packages/linter-eslint)
- [Sublime Text plugin](https://github.com/roadhump/SublimeLinter-eslint)
- [generic syntax-checking Vim plugin](https://github.com/scrooloose/syntastic)

It's easy to check that you got it right even without plugin - just run `npm run lint`!

*Person who does not change is a monument of itself*, so, be not afraid of
improving the ruleset, but do run through the entirety of the codebase to adjust
for the changes.

NOTE: Currently, templates and actionhero client code throws few linting errors
that'd be too hacky to work around in linting ruleset.
