Watchdogs.com
=============

https://extranet.akqa.com/collaboration/display/intUbisoft/UBI013005WD+-+Watch+Dogs+Product+Site


## Requirements

You will need the following:
* [node.js](http://nodejs.org/) v0.8 - To get the right version, [Node Version Manager](https://github.com/creationix/nvm) can be used to install the required version
* [CasperJS](http://casperjs.org/)
* [Grunt CLI](http://gruntjs.com/getting-started)
* [Compass](http://compass-style.org/install/)

## Installation

```
sudo npm run-script build
```
This will install the required Node modules (via NPM) and execute the build task (via Grunt).  It also sets the correct file permissions to the deploy and .sass-cache folders to allow Grunt's watch command to execute properly.

## Deployment

The site can function via Apache, or via Node/Connect (which is part of the buid & installation process).

### Apache

To run this site under Apache, add a virtual host entry that serves the deploy folder.  Below is an example configuration setup.
```
<VirtualHost *:80 *:81>
	DocumentRoot /Library/WebServer/Documents/local.ubi-watchdogs/deploy
	ServerName local.ubi-watchdogs
</VirtualHost>
```

In your browser, visit [http://local.ubi-watchdogs] or whatever you have specified as the _ServerName_. *Don't forget to update your hosts file!*


### Connect

The project contains a plugin for Live Reload functionality.  This setup runs the site locally through Connect.  To enable this, execute the following command in the terminal:
```
grunt live-reload
```
Then in your browser go to [http://localhost:9001/](http://localhost:9001/).  This will start the live reload tasks as well as add file listeners for a variety of files.  Any time a file is changed, the window in the browser will refresh.  No additional watch tasks are necessary, as the live reload handles it all.

## Source Files

### Styles

Compass is used as the CSS Preprocessor.  The source files reside under workspace/styles. For development, the output is expanded.  For staging & uat, a compressed output will be used.

### Scripts

JavaScript files are located under workspace/scripts. The build process will copy files from this directory into the deploy folder.  UglifyJS is present to minify and mangle for staging & uat builds.

### HTML

Handlebar templates are used to logically separate out markup.  The generated pages are contained within a "layout" file, and comprised of many "partials".  Dynamic data can be faked by created static content/data files.  The file name of the data/content file is used as a namespace identifier.

See the setup under the "build" branch for examples on this usage.

## Grunt Tasks

* __build__: Runs the full development build suite, including CSS, JavaScript, and HTML generation tasks
* __build-prod__: Similar to "build", but optimized for production
* ___default___: Runs the "build" task by default
* __lint__: Runs jshint for the files under workspace/scripts
* __live-reload__: Opens a Connect instance with live reload capability
* __compass:dev__: Build css for development
* __compass:prod__: Build css for production
* __watch:jshint__: Run jshint on JavaScript files when updated
* __watch:compass__: Run compass:dev on scss file changes
* __watch:templates__: Build the HTML files upon changes to the Handlebars templates or data files
* __watch:scripts__: Run jshint and copy JavaScript files to deploy
* __ghost__: Run the CasperJS test suite
* __test__: Alias for __ghost__
