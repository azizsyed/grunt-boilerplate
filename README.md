Grunt Boilerplate
=================

Requirements
------------
+ Node/NPM (For downloading dependencies)
+ Compass (For compiling SASS files)
+ CasperJS (For executing front end tests)
+ Web server (Apache for example)

Installation
------------
+ Install any of the required components from the "Requirements" section
+ From your command line, execute: "npm run-script install"
+ Setup your web server to serve the "deploy" folder

Grunt
-----
Several Grunt tasks have been setup for development.  JSHint validates JavaScript files, SASS/SCSS assets are compiled, front-end dependencies are loaded via Bower, and TypeScript files are compiled to vanilla JavaScript files.  Run "grunt -h" to see a full list of available tasks

Testing
-------
Testing is currently performed by 2 mechanisms.  Jasmine executes BDD style unit tests, and Casper is utilized to execute functional tests.  Executing "grunt test" or "npm test" will execute both the unit and functional tests.
