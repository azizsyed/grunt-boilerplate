describe("Sample Module", function() {
	var object = obj();

    it("should multiply", function() {
        expect(object.multiply(1,1)).toEqual(1);
    });

    it("should multiply", function() {
        expect(object.multiply(2,2)).toEqual(4);
    });

    it("should add", function() {
        expect(object.add(3,3)).toEqual(6);
    });

    it("should subtract", function() {
        expect(object.subtract(4,4)).toEqual(0);
    });
});