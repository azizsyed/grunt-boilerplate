var ProjectNameSpace;
(function (ProjectNameSpace) {
    (function (Forms) {
        var SearchForm = (function () {
            function SearchForm(form) {
                this.form = form;
                this.addEvents();
            }
            SearchForm.prototype.addEvents = function () {
                $(this.form).on("submit", this.validate);
            };
            SearchForm.prototype.validate = function () {
                var messageContainer = $("#message-box");
                messageContainer.text("You entered: " + $("input[type=text]", this.form).val());
                return false;
            };
            return SearchForm;
        })();
        Forms.SearchForm = SearchForm;        
    })(ProjectNameSpace.Forms || (ProjectNameSpace.Forms = {}));
    var Forms = ProjectNameSpace.Forms;
})(ProjectNameSpace || (ProjectNameSpace = {}));
