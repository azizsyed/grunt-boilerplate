var casper = require('casper').create(),
	utils = require("utils");

var options = {
	url: "http://local.aziz-syed.com/casper.html",
	basePath: "",
	screenshot: {
		'directory' : 'screenshots/',
		'extension': 'png'
	},
	xUnit: "xunit/casper-results.xml"
};

options.basePath = casper.cli.get("basePath") || "";

var saveScreenshot = function(name, context){
	var pageContext = context || "html";
	
	casper.captureSelector(options.basePath + options.screenshot.directory +  name + "." + options.screenshot.extension, pageContext);
};

casper.start(options.url);

casper.then(function(){
	var form = "form#search";
	
	saveScreenshot("form-1");
	
	this.fill(form, {
		'q': "TEST"
	}, true);
	
	saveScreenshot("form-2");
	
	this.click('input[type="submit"]');
});

casper.then(function(){
	var formOutput = this.getHTML("#message-box");
	
	this.test.assert(formOutput=="You entered: " + "TEST", "Verify sample output"); 
	
	saveScreenshot("form-3");
});

casper.then(function(){
	casper.viewport(1024, 768);
	saveScreenshot("form-4");
	this.test.assertVisible('.pull-right.links');
	casper.viewport(480, 600);
	saveScreenshot("form-5");
	this.test.assertNotVisible('.pull-right.links');
});

casper.run(function() {
    this.test.done();
    this.test.renderResults(true, 0, options.basePath + options.xUnit);
	//this.exit();
});