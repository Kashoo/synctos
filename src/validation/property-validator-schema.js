var joi = require('joi');
var makeConstraintSchemaDynamic = require('./dynamic-constraint-schema-maker');

var integerSchema = joi.number().integer();
var datetimeSchema = joi.any().when(
  joi.string(),
  {
    then: joi.string().regex(/^(([0-9]{4})(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?)?)(T([01][0-9]|2[0-3])(:[0-5][0-9])(:[0-5][0-9](\.[0-9]{1,3})?)?(Z|([\+-])([01][0-9]|2[0-3]):?([0-5][0-9]))?)?$/),
    otherwise: joi.date().options({ convert: false })
  });
var dateOnlySchema = joi.any().when(
  joi.string(),
  {
    then: joi.string().regex(/^(([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))$/),
    otherwise: joi.date().options({ convert: false })
  });
var uuidSchema = joi.string().uuid();
var regexSchema = joi.object().type(RegExp);

var typeComparisonSchemas = {
  string: joi.string(),
  integer: integerSchema,
  float: joi.number(),
  boolean: joi.boolean(),
  datetime: datetimeSchema,
  date: dateOnlySchema,
  enum: joi.alternatives().try([ joi.string(), integerSchema ]),
  uuid: uuidSchema,
  attachmentReference: joi.string(),
  array: joi.array(),
  object: joi.object().unknown(),
  hashtable: joi.object().unknown()
};

var validPropertyTypes = Object.keys(typeComparisonSchemas).map(function(key) { return key; });

var schema = joi.object().keys({
  type: dynamicConstraintSchema(joi.string().only(validPropertyTypes)).required()
})
  .when(
    joi.object().unknown().keys({ type: 'string' }),
    { then: makeTypeConstraintsSchema('string') })
  .when(
    joi.object().unknown().keys({ type: 'integer' }),
    { then: makeTypeConstraintsSchema('integer') })
  .when(
    joi.object().unknown().keys({ type: 'float' }),
    { then: makeTypeConstraintsSchema('float') })
  .when(
    joi.object().unknown().keys({ type: 'boolean' }),
    { then: makeTypeConstraintsSchema('boolean') })
  .when(
    joi.object().unknown().keys({ type: 'datetime' }),
    { then: makeTypeConstraintsSchema('datetime') })
  .when(
    joi.object().unknown().keys({ type: 'date' }),
    { then: makeTypeConstraintsSchema('date') })
  .when(
    joi.object().unknown().keys({ type: 'enum' }),
    { then: makeTypeConstraintsSchema('enum') })
  .when(
    joi.object().unknown().keys({ type: 'uuid' }),
    { then: makeTypeConstraintsSchema('uuid') })
  .when(
    joi.object().unknown().keys({ type: 'attachmentReference' }),
    { then: makeTypeConstraintsSchema('attachmentReference') })
  .when(
    joi.object().unknown().keys({ type: 'array' }),
    { then: makeTypeConstraintsSchema('array') })
  .when(
    joi.object().unknown().keys({ type: 'object' }),
    { then: makeTypeConstraintsSchema('object') })
  .when(
    joi.object().unknown().keys({ type: 'hashtable' }),
    { then: makeTypeConstraintsSchema('hashtable') })
  .when(
    joi.object().unknown().keys({ type: joi.func() }),
    { then: joi.object().unknown() });

/**
 * A partial schema for a single entry in a "propertyValidators" object at either the top level of a document definition
 * or nested within an "object" validator.
 */
module.exports = exports = schema;

// Defined as a function rather than a plain object because it contains lazy references that result in recursive
// references between the complex types (e.g. "array", "object", "hashtable") and the main "propertyValidators" schema
function typeSpecificConstraintSchemas() {
  return {
    string: {
      mustNotBeEmpty: dynamicConstraintSchema(joi.boolean()),
      regexPattern: dynamicConstraintSchema(regexSchema),
      minimumLength: dynamicConstraintSchema(integerSchema.min(0)),
      maximumLength: maximumSizeConstraintSchema('minimumLength'),
      minimumValue: dynamicConstraintSchema(joi.string()),
      minimumValueExclusive: dynamicConstraintSchema(joi.string()),
      maximumValue: dynamicConstraintSchema(joi.string()),
      maximumValueExclusive: dynamicConstraintSchema(joi.string())
    },
    integer: {
      minimumValue: dynamicConstraintSchema(integerSchema),
      minimumValueExclusive: dynamicConstraintSchema(integerSchema),
      maximumValue: maximumValueInclusiveNumberConstraintSchema(integerSchema),
      maximumValueExclusive: maximumValueExclusiveNumberConstraintSchema(integerSchema)
    },
    float: {
      minimumValue: dynamicConstraintSchema(joi.number()),
      minimumValueExclusive: dynamicConstraintSchema(joi.number()),
      maximumValue: maximumValueInclusiveNumberConstraintSchema(joi.number()),
      maximumValueExclusive: maximumValueExclusiveNumberConstraintSchema(joi.number())
    },
    boolean: { },
    datetime: {
      minimumValue: dynamicConstraintSchema(datetimeSchema),
      minimumValueExclusive: dynamicConstraintSchema(datetimeSchema),
      maximumValue: dynamicConstraintSchema(datetimeSchema),
      maximumValueExclusive: dynamicConstraintSchema(datetimeSchema)
    },
    date: {
      minimumValue: dynamicConstraintSchema(dateOnlySchema),
      minimumValueExclusive: dynamicConstraintSchema(dateOnlySchema),
      maximumValue: dynamicConstraintSchema(dateOnlySchema),
      maximumValueExclusive: dynamicConstraintSchema(dateOnlySchema)
    },
    enum: {
      predefinedValues: dynamicConstraintSchema(joi.array().required().min(1).items([ integerSchema, joi.string() ]))
    },
    uuid: {
      minimumValue: dynamicConstraintSchema(uuidSchema),
      minimumValueExclusive: dynamicConstraintSchema(uuidSchema),
      maximumValue: dynamicConstraintSchema(uuidSchema),
      maximumValueExclusive: dynamicConstraintSchema(uuidSchema)
    },
    attachmentReference: {
      maximumSize: dynamicConstraintSchema(integerSchema.min(1).max(20971520)),
      supportedExtensions: dynamicConstraintSchema(joi.array().min(1).items(joi.string())),
      supportedContentTypes: dynamicConstraintSchema(joi.array().min(1).items(joi.string().min(1)))
    },
    array: {
      mustNotBeEmpty: dynamicConstraintSchema(joi.boolean()),
      minimumLength: dynamicConstraintSchema(integerSchema.min(0)),
      maximumLength: maximumSizeConstraintSchema('minimumLength'),
      arrayElementsValidator: dynamicConstraintSchema(joi.lazy(function() { return schema; }))
    },
    object: {
      allowUnknownProperties: dynamicConstraintSchema(joi.boolean()),
      propertyValidators: dynamicConstraintSchema(joi.object().min(1).pattern(/^.+$/, joi.lazy(function() { return schema; })))
    },
    hashtable: {
      minimumSize: dynamicConstraintSchema(integerSchema.min(0)),
      maximumSize: maximumSizeConstraintSchema('minimumSize'),
      hashtableKeysValidator: dynamicConstraintSchema(joi.object().keys({
        mustNotBeEmpty: dynamicConstraintSchema(joi.boolean()),
        regexPattern: dynamicConstraintSchema(regexSchema)
      })),
      hashtableValuesValidator: dynamicConstraintSchema(joi.lazy(function() { return schema; }))
    }
  };
}

// Creates a validation schema for the constraints of the specified type
function makeTypeConstraintsSchema(typeName) {
  var allTypeConstraints = typeSpecificConstraintSchemas();
  var constraints = Object.assign({ }, universalConstraintSchemas(typeComparisonSchemas[typeName]), allTypeConstraints[typeName]);

  return joi.object().keys(constraints)
    // Prevent the use of more than one constraint from the "required value" category
    .without('required', [ 'mustNotBeMissing', 'mustNotBeNull' ])
    .without('mustNotBeMissing', [ 'required', 'mustNotBeNull' ])
    .without('mustNotBeNull', [ 'required', 'mustNotBeMissing' ])

    // Prevent the use of more than one constraint from the "equality" category
    .without('mustEqual', [ 'mustEqualStrict' ])

    // Prevent the use of more than one constraint from the "minimum value" category
    .without('minimumValue', [ 'minimumValueExclusive', 'mustEqual', 'mustEqualStrict' ])
    .without('minimumValueExclusive', [ 'minimumValue', 'mustEqual', 'mustEqualStrict' ])

    // Prevent the use of more than one constraint from the "maximum value" category
    .without('maximumValue', [ 'maximumValueExclusive', 'mustEqualStrict', 'mustEqual' ])
    .without('maximumValueExclusive', [ 'maximumValue', 'mustEqualStrict', 'mustEqual' ])

    // Prevent the use of more than one constraint from the "immutability" category
    .without('immutable', [ 'immutableStrict', 'immutableWhenSet', 'immutableWhenSetStrict' ])
    .without('immutableStrict', [ 'immutable', 'immutableWhenSet', 'immutableWhenSetStrict' ])
    .without('immutableWhenSet', [ 'immutable', 'immutableStrict', 'immutableWhenSetStrict' ])
    .without('immutableWhenSetStrict', [ 'immutable', 'immutableStrict', 'immutableWhenSet' ]);
}

function mustEqualConstraintSchema(comparisonSchema) {
  return joi.any().when(joi.any().only(null), { otherwise: comparisonSchema });
}

function universalConstraintSchemas(comparisonSchema) {
  return {
    type: dynamicConstraintSchema(joi.string()).required(),
    required: dynamicConstraintSchema(joi.boolean()),
    mustNotBeMissing: dynamicConstraintSchema(joi.boolean()),
    mustNotBeNull: dynamicConstraintSchema(joi.boolean()),
    immutable: dynamicConstraintSchema(joi.boolean()),
    immutableStrict: dynamicConstraintSchema(joi.boolean()),
    immutableWhenSet: dynamicConstraintSchema(joi.boolean()),
    immutableWhenSetStrict: dynamicConstraintSchema(joi.boolean()),
    mustEqual: dynamicConstraintSchema(mustEqualConstraintSchema(comparisonSchema)),
    mustEqualStrict: dynamicConstraintSchema(mustEqualConstraintSchema(comparisonSchema)),
    customValidation: joi.func().maxArity(4) // Function parameters: doc, oldDoc, currentItemElement, validationItemStack
  };
}

function maximumSizeConstraintSchema(minimumSizePropertyName) {
  return joi.any().when(
    minimumSizePropertyName,
    {
      is: joi.number().exist(),
      then: dynamicConstraintSchema(integerSchema.min(joi.ref(minimumSizePropertyName))),
      otherwise: dynamicConstraintSchema(integerSchema.min(0))
    });
}

function maximumValueInclusiveNumberConstraintSchema(numberType) {
  return joi.any().when(
    'minimumValue',
    {
      is: joi.number().exist(),
      then: dynamicConstraintSchema(numberType.min(joi.ref('minimumValue'))),
      otherwise: joi.any().when(
        'minimumValueExclusive',
        {
          is: joi.number().exist(),
          then: dynamicConstraintSchema(numberType.greater(joi.ref('minimumValueExclusive'))),
          otherwise: dynamicConstraintSchema(numberType)
        })
    });
}

function maximumValueExclusiveNumberConstraintSchema(numberType) {
  return joi.any().when(
    'minimumValue',
    {
      is: joi.number().exist(),
      then: dynamicConstraintSchema(numberType.greater(joi.ref('minimumValue'))),
      otherwise: joi.any().when(
        'minimumValueExclusive',
        {
          is: joi.number().exist(),
          then: dynamicConstraintSchema(numberType.greater(joi.ref('minimumValueExclusive'))),
          otherwise: dynamicConstraintSchema(numberType)
        })
    });
}

// Generates a schema that can be used for property validator constraints
function dynamicConstraintSchema(wrappedSchema) {
  // The function schema this creates will support no more than four parameters (doc, oldDoc, value, oldValue)
  return makeConstraintSchemaDynamic(wrappedSchema, 4);
}
