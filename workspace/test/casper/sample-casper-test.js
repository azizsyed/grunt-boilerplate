var casper = require('casper').create({
		verbose: true,
	    logLevel: 'debug'
	}),
	utils = require("utils");

var options = {
	url: "http://local.ubi-watchdogs/",
	basePath: "workspace/test/results/casper/",
	screenshot: {
		'directory' : 'screenshots/',
		'extension': 'png'
	},
	xUnit: "xunit/casper-results.xml"
};

/*
utils.dump(casper.cli.args);
utils.dump(casper.cli.options);
*/

options.basePath = casper.cli.get("basePath") || options.basePath;

var saveScreenshot = function(name, context){
	var pageContext = context || "html";
	
	casper.captureSelector(options.basePath + options.screenshot.directory +  name + "." + options.screenshot.extension, pageContext);
};

casper.start(options.url);

casper.then(function(){
	saveScreenshot("form-1");
});

casper.then(function(){
	casper.viewport(1024, 768);
	saveScreenshot("form-2");
	casper.viewport(480, 600);
	saveScreenshot("form-3");

	casper.test.assert(true, "true is so true");
});

casper.run(function() {
    this.test.done();
    this.test.renderResults(true, 0, options.basePath + options.xUnit);
	//this.exit();
});