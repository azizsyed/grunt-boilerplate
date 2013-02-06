/// <reference path="lib-interfaces/jquery/jquery.d.ts" />

module ProjectNameSpace.Forms{
	export class SearchForm {
		form: Object;
	    constructor(form: Object) {
			this.form = form;
			this.addEvents();
	    };
	    addEvents() {
			$(this.form).on("submit", this.validate);
	    };
		validate() {
			var messageContainer = $("#message-box");
			messageContainer.text("You entered: " + $("input[type=text]", this.form).val());
			return false;
		};
	}
}

