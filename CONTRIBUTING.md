# Contributing

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

*Person who does not change is a monument of itself*, so, be not afraid of
improving the ruleset, but do run through the entirety of the codebase to adjust
for the changes.

NOTE: Currently, templates and actionhero client code throws few linting errors
that'd be too hacky to work around in linting ruleset.

