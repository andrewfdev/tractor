/*{
    "name": "Then I can see the Element in the editor",
    "components": [
        {
            "name": "Element creator"
        }
    ],
    "mockData": []
}*/
module.exports = function () {
    var ElementCreator = require('../../components/Component Editor/Element creator.component.js'), elementCreator = new ElementCreator();
    this.Then(/^I can see the Element in the editor$/, function (done) {
        Promise.all([expect(elementCreator.getFirstElementName()).to.eventually.equal('Element')]).spread(function () {
            done();
        }).catch(done.fail);
    });
};