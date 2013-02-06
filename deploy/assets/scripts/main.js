$LAB.setGlobalDefaults({
	'BasePath': 'assets/scripts/'
});

$LAB
	.script("modules/app.js")
	.script("modules/sample.js")
	.wait(function(){
		var application = new Application();
		application.testMethod();
		
		new ProjectNameSpace.Forms.SearchForm($("form#search"));
	})
;