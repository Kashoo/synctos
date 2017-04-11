var testHelper = require('../etc/test-helper.js');
var errorFormatter = testHelper.validationErrorFormatter;

describe('Dynamic constraints', function() {
  beforeEach(function() {
    testHelper.init('build/sync-functions/test-dynamic-constraints-sync-function.js');
  });

  it('allows a doc to be created when the property constraints are satisfied', function() {
    var doc = {
      _id: 'my-doc',
      type: 'myDoc',
      dynamicReferenceId: 7,
      validationByDocProperty: 'foo-7-bar',
      validationByValueProperty: 119
    };

    testHelper.verifyDocumentCreated(doc);
  });

  it('allows a doc to be replaced when the property constraints are satisfied', function() {
    var doc = {
      _id: 'my-doc',
      type: 'myDoc',
      dynamicReferenceId: 0,
      validationByDocProperty: 'foo-0-bar',
      validationByValueProperty: -34
    };
    var oldDoc = {
      _id: 'my-doc',
      type: 'myDoc',
      dynamicReferenceId: 0,
      validationByDocProperty: 'foo-0-bar',
      validationByValueProperty: -35
    };

    testHelper.verifyDocumentReplaced(doc, oldDoc);
  });

  it('blocks a doc from being created when the property constraints are violated', function() {
    var doc = {
      _id: 'my-doc',
      type: 'myDoc',
      dynamicReferenceId: 83,
      validationByDocProperty: 'foo-38-bar',
      validationByValueProperty: -1
    };

    testHelper.verifyDocumentNotCreated(
      doc,
      doc.type,
      [
        // If the current value of validationByValueProperty is less than zero (as it is in this case), the constraint will be set to zero
        errorFormatter.minimumValueViolation('validationByValueProperty', 0),
        errorFormatter.regexPatternItemViolation('validationByDocProperty', /^foo-83-bar$/)
      ]);
  });

  it('blocks a doc from being replaced when the property constraints are violated', function() {
    var doc = {
      _id: 'my-doc',
      type: 'myDoc',
      dynamicReferenceId: 1,
      validationByDocProperty: 'foo-0-bar',
      validationByValueProperty: 20
    };
    var oldDoc = {
      _id: 'my-doc',
      type: 'myDoc',
      dynamicReferenceId: 1,
      validationByDocProperty: 'foo-1-bar',
      validationByValueProperty: 18
    };

    testHelper.verifyDocumentNotReplaced(
      doc,
      oldDoc,
      doc.type,
      [
        errorFormatter.maximumValueViolation('validationByValueProperty', 19),
        errorFormatter.regexPatternItemViolation('validationByDocProperty', /^foo-1-bar$/)
      ]);
  });
});