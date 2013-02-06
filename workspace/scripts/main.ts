/// <reference path="custom-interfaces/labjs/labjs.d.ts" />
/// <reference path="modules/app.ts" />
/// <reference path="modules/sample.ts" />

$LAB.setGlobalDefaults({
	'BasePath': 'assets/scripts/'
});

$LAB
	.script("modules/app.js")
	.script("modules/sample.js")
	.wait(function(){
		var application = new Application();
		application.testMethod();
		
		new SearchForm($("form#search"));
	})
;