// This module comprises the public API for synctos.

/**
 * The document-definitions-validator module. Reports violations of the document definitions schema.
 */
exports.documentDefinitionsValidator = require('./validation/document-definitions-validator');

/**
 * The sync-function-loader module. Reads sync functions from files.
 */
exports.syncFunctionLoader = require('./loading/sync-function-loader');

/**
 * The sync-function-writer module. Writes sync functions to files.
 */
exports.syncFunctionWriter = require('./saving/sync-function-writer');

/**
 * The test-fixture-maker module. Provides a number of conveniences to test the behaviour of document definitions.
 */
exports.testFixtureMaker = require('./testing/test-fixture-maker');

/**
 * DEPRECATED: The test-helper module
 */
exports.testHelper = require('./testing/test-helper');

/**
 * The validation-error-formatter module. Formats document validation error messages for use in document definition tests.
 */
exports.validationErrorFormatter = require('./testing/validation-error-formatter');
