const joi = require('../../lib/joi/joi.bundle');
const propertyValidatorSchema = require('./property-validator-schema');
const makeConstraintSchemaDynamic = require('./dynamic-constraint-schema-maker');

const integerSchema = joi.number().integer();
const nonEmptyStringSchema = joi.string().min(1);
const customActionEventSchema = joi.func().maxArity(3); // Function parameters: doc, oldDoc, customActionMetadata
const authorizationSchema = dynamicConstraintSchema(
  joi.object().min(1).keys(
    {
      add: arrayOrSingleItemSchema(nonEmptyStringSchema),
      replace: arrayOrSingleItemSchema(nonEmptyStringSchema),
      remove: arrayOrSingleItemSchema(nonEmptyStringSchema),
      write: arrayOrSingleItemSchema(nonEmptyStringSchema)
    }));
const accessAssignmentEntryPropertySchema = dynamicConstraintSchema(arrayOrSingleItemSchema(nonEmptyStringSchema, 1));

// The regular expression for expiry dates is considerably more restrictive than it is for other property constraints
const expiryDateStringSchema = joi.string()
 .regex(/^\d{4}-(((0[13578]|1[02])-(0[1-9]|[12]\d|3[01]))|((0[469]|11)-(0[1-9]|[12]\d|30))|(02-(0[1-9]|[12]\d)))T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/);

/**
 * The full schema for a single document definition object.
 */
module.exports = exports = joi.object().options({ convert: false }).keys({
  typeFilter: joi.func().required().maxArity(3), // Function parameters: doc, oldDoc, docType
  allowUnknownProperties: dynamicConstraintSchema(joi.boolean()),
  immutable: dynamicConstraintSchema(joi.boolean()),
  cannotReplace: dynamicConstraintSchema(joi.boolean()),
  cannotDelete: dynamicConstraintSchema(joi.boolean()),
  documentIdRegexPattern: makeConstraintSchemaDynamic(joi.object().type(RegExp), 1), // Only one function parameter: doc

  allowAttachments: joi.any().when(
    // This property must be true or a function if "attachmentConstraints" is defined
    'attachmentConstraints',
    {
      is: joi.any().exist(),
      then: dynamicConstraintSchema(joi.boolean().only(true)).required(),
      otherwise: dynamicConstraintSchema(joi.boolean())
    }),
  attachmentConstraints: dynamicConstraintSchema(
    joi.object().min(1).keys(
      {
        requireAttachmentReferences: dynamicConstraintSchema(joi.boolean()),
        maximumAttachmentCount: dynamicConstraintSchema(integerSchema.min(1)),
        maximumIndividualSize: dynamicConstraintSchema(integerSchema.min(1).max(20971520)),
        maximumTotalSize: dynamicConstraintSchema(
          integerSchema.when(
            // This property must be greater or equal to "maximumIndividualSize" if it's defined
            'maximumIndividualSize',
            {
              is: integerSchema.exist(),
              then: integerSchema.min(joi.ref('maximumIndividualSize')),
              otherwise: integerSchema.min(1)
            })),
        supportedExtensions: dynamicConstraintSchema(joi.array().min(1).items(joi.string())),
        supportedContentTypes: dynamicConstraintSchema(joi.array().min(1).items(nonEmptyStringSchema)),
        filenameRegexPattern: dynamicConstraintSchema(joi.object().type(RegExp))
      })),

  channels: dynamicConstraintSchema(
    joi.object().min(1).keys(
      {
        view: arrayOrSingleItemSchema(nonEmptyStringSchema), // The other auth types deliberately omit this permission type
        add: arrayOrSingleItemSchema(nonEmptyStringSchema),
        replace: arrayOrSingleItemSchema(nonEmptyStringSchema),
        remove: arrayOrSingleItemSchema(nonEmptyStringSchema),
        write: arrayOrSingleItemSchema(nonEmptyStringSchema)
      })),
  authorizedRoles: authorizationSchema,
  authorizedUsers: authorizationSchema,

  accessAssignments: dynamicConstraintSchema(joi.array().items(
    joi.object().keys({ type: joi.string().only([ 'channel', 'role', null ]) })
      // Each access assignment may be either a role assignment
      .when(
        joi.object().unknown().keys({ type: joi.string().required().only('role') }),
        {
          then: joi.object().keys({
            type: joi.string(),
            roles: accessAssignmentEntryPropertySchema.required(),
            users: accessAssignmentEntryPropertySchema.required()
          })
        })

      // ... or a channel assignment
      .when(
        joi.object().unknown().keys({ type: joi.string().optional().only([ 'channel', null ]) }),
        {
          then: joi.object().keys({
            type: joi.string(),
            channels: accessAssignmentEntryPropertySchema.required(),
            roles: accessAssignmentEntryPropertySchema,
            users: accessAssignmentEntryPropertySchema
          }).or('roles', 'users') // At least one of "roles" or "users" must be provided
        }))),

  expiry: dynamicConstraintSchema(joi.any().when(
    joi.string(),
    {
      then: expiryDateStringSchema,
      otherwise: joi.any().when(
        joi.number(),
        {
          then: joi.number().integer().min(0),
          otherwise: joi.date().options({ convert: false })
        }
      )
    }
  )),

  customActions: joi.object().min(1).keys({
    onTypeIdentificationSucceeded: customActionEventSchema,
    onAuthorizationSucceeded: customActionEventSchema,
    onValidationSucceeded: customActionEventSchema,
    onAccessAssignmentsSucceeded: customActionEventSchema,
    onExpiryAssignmentSucceeded: customActionEventSchema,
    onDocumentChannelAssignmentSucceeded: customActionEventSchema
  }),

  propertyValidators: dynamicConstraintSchema(
    joi.object().pattern(
      /^[^_].*$/, // Sync Gateway does not allow top-level document property names to start with an underscore
      propertyValidatorSchema)).required()
})
  // At least one of "channels", "authorizedRoles" or "authorizedUsers" must be defined
  .or('channels', 'authorizedRoles', 'authorizedUsers')
  // It makes no sense to set "immutable" with either of "cannotReplace" or "cannotDelete"
  .without('immutable', [ 'cannotReplace', 'cannotDelete' ]);

function arrayOrSingleItemSchema(singleItemSchema, minimumLength) {
  return joi.any().when(
    joi.array(),
    {
      then: joi.array().min(minimumLength || 0).items(singleItemSchema),
      otherwise: singleItemSchema
    });
}

// Generates a schema that can be used for top-level document definition property constraints
function dynamicConstraintSchema(wrappedSchema) {
  // The function schema this creates will support no more than two parameters (doc, oldDoc)
  return makeConstraintSchemaDynamic(wrappedSchema, 2);
}
