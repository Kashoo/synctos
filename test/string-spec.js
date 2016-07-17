var testHelper = require('../etc/test-helper.js');
var errorFormatter = testHelper.validationErrorFormatter;

describe('String validation type', function() {
  beforeEach(function() {
    testHelper.init('build/sync-functions/test-string-sync-function.js');
  });

  describe('length validation', function() {
    it('can create a doc with a string that is within the minimum and maximum lengths', function() {
      var doc = {
        _id: 'stringDoc',
        lengthValidationProp: 'foo'
      };

      testHelper.verifyDocumentCreated(doc);
    });

    it('cannot create a doc with a string that is shorter than the minimum length', function() {
      var doc = {
        _id: 'stringDoc',
        lengthValidationProp: 'fo'
      };

      testHelper.verifyDocumentNotCreated(doc, 'stringDoc', errorFormatter.minimumLengthViolation('lengthValidationProp', 3));
    });

    it('cannot create a doc with a string that is longer than the maximum length', function() {
      var doc = {
        _id: 'stringDoc',
        lengthValidationProp: 'foob'
      };

      testHelper.verifyDocumentNotCreated(doc, 'stringDoc', errorFormatter.maximumLengthViolation('lengthValidationProp', 3));
    });
  });
});
