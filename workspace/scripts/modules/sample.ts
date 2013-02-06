/// <reference path="../lib-interfaces/jquery/jquery.d.ts" />

var SearchForm = function(form: number){
	var self = this;
	
    self.form = form;
	
    self.validate = function () {
        var messageContainer = $("#message-box");
        messageContainer.text("You entered: " + $("input[type=text]", this).val());
        return false;
    };

    self.addEvents = function () {
        $(self.form).on("submit", self.validate);
    };

    self.addEvents();
	return self;
};
