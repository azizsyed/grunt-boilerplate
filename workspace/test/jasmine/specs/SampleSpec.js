//'use strict';

describe("Application", function() {
  var app;

  beforeEach(function() {
	app = new Application(); 
  });

  it("should be equal to 'sample'", function() {
    expect(app.testMethod()).toEqual("sample");
  });
});