// This sync function for Couchbase Sync Gateway was generated by synctos: https://github.com/Kashoo/synctos
// More info on sync functions: http://developer.couchbase.com/mobile/develop/guides/sync-gateway/sync-function-api-guide/index.html
function(doc, oldDoc) {
  // Determine if a given value is an integer. Exists as a failsafe because Number.isInteger is not guaranteed to exist in all environments.
  var isInteger = Number.isInteger || function(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
  };

  // Check that a given value is a valid ISO 8601 format date string with optional time and time zone components
  function isIso8601DateTimeString(value) {
    var regex = new RegExp('^(([\\+-]?[0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))([T ]([01][0-9]|2[0-4])(:[0-5][0-9])?(:[0-5][0-9])?([\\.,][0-9]{1,3})?)?([zZ]|([\\+-])([01][0-9]|2[0-3]):?([0-5][0-9])?)$');

    return regex.test(value);
  }

  // Check that a given value is a valid ISO 8601 date string without time and time zone components
  function isIso8601DateString(value) {
    var regex = new RegExp('^(([\\+-]?[0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))$');

    return regex.test(value);
  }

  // A document definition may define its channels for each operation (view, add, replace, delete) as either a string or an array of
  // strings. In either case, add them to the list if they are not already present.
  function appendToChannelList(allChannels, channelsToAdd) {
    if (channelsToAdd instanceof Array) {
      for (var i = 0; i < channelsToAdd.length; i++) {
        var channel = channelsToAdd[i];
        if (allChannels.indexOf(channel) < 0) {
          allChannels.push(channel);
        }
      }
    } else if (allChannels.indexOf(channelsToAdd) < 0) {
      allChannels.push(channelsToAdd);
    }
  }

  // A document definition may define its channels as either a function or an object/hashtable
  function getDocChannelMap(doc, oldDoc, docDefinition) {
    if (typeof(docDefinition.channels) === 'function') {
      return docDefinition.channels(doc, oldDoc);
    } else {
      return docDefinition.channels;
    }
  }

  // Retrieves a list of channels the document belongs to based on its specified type
  function getAllDocChannels(doc, oldDoc, docDefinition) {
    var docChannelMap = getDocChannelMap(doc, oldDoc, docDefinition);

    var allChannels = [ ];
    appendToChannelList(allChannels, docChannelMap.view);
    appendToChannelList(allChannels, docChannelMap.add);
    appendToChannelList(allChannels, docChannelMap.replace);
    appendToChannelList(allChannels, docChannelMap.remove);

    return allChannels;
  }

  // Ensures the user is authorized to create/replace/delete this document
  function authorize(doc, oldDoc, docDefinition) {
    var docChannelMap = getDocChannelMap(doc, oldDoc, docDefinition);

    var requiredChannels;
    if (doc._deleted) {
      requiredChannels = docChannelMap.remove;
    } else if (oldDoc) {
      requiredChannels = docChannelMap.replace;
    } else {
      requiredChannels = docChannelMap.add;
    }

    requireAccess(requiredChannels);
  }

  // Ensures the document structure and content are valid
  function validateDoc(doc, oldDoc, docDefinition, docType) {
    var validationErrors = [ ];

    if (!(docDefinition.allowAttachments) && doc._attachments) {
      for (var attachment in doc._attachments) {
        validationErrors.push('document type does not support attachments');

        break;
      }
    }

    var itemStack = [
      {
        itemValue: doc,
        oldItemValue: oldDoc,
        itemName: null,
        fullItemPath: null
      }
    ];

    // Execute each of the document's property validator functions
    validateProperties(doc, oldDoc, docDefinition.propertyValidators, itemStack, validationErrors, true);

    if (validationErrors.length > 0) {
      throw { forbidden: 'Invalid ' + docType + ' document: ' + validationErrors.join('; ') };
    }
  }

  function validateProperties(doc, oldDoc, propertyValidators, itemStack, validationErrors, useWhitelist) {
    var currentItemEntry = itemStack[itemStack.length - 1];
    var objectValue = currentItemEntry.itemValue;
    var oldObjectValue = currentItemEntry.oldItemValue;
    var objectPath = currentItemEntry.fullItemPath;

    var supportedProperties = [ ];
    for (var validatorIndex = 0; validatorIndex < propertyValidators.length; validatorIndex++) {
      var validator = propertyValidators[validatorIndex];
      var fullPropertyPath = objectPath ? objectPath + '.' + validator.propertyName : validator.propertyName;
      var propertyName = validator.propertyName;
      var propertyValue = objectValue[propertyName];

      var oldPropertyValue;
      if (typeof(oldObjectValue) !== 'undefined' && oldObjectValue !== null) {
        oldPropertyValue = oldObjectValue[propertyName];
      }

      supportedProperties.push(propertyName);

      itemStack.push({
        itemValue: propertyValue,
        oldItemValue: oldPropertyValue,
        itemName: propertyName,
        fullItemPath: fullPropertyPath
      });

      validateItemValue(doc, oldDoc, validator, itemStack, validationErrors);

      itemStack.pop();
    }

    // Verify there are no unsupported properties in the object
    var whitelistedProperties = [ '_id', '_rev', '_deleted', '_revisions', '_attachments' ];
    for (var propertyName in objectValue) {
      if (useWhitelist && whitelistedProperties.indexOf(propertyName) >= 0) {
        // These properties are special cases that should always be allowed - generally only applied at the top level of the document
        continue;
      }

      if (supportedProperties.indexOf(propertyName) < 0) {
        var fullPropertyPath = objectPath ? objectPath + '.' + propertyName : propertyName;
        validationErrors.push('property "' + fullPropertyPath + '" is not supported');
      }
    }
  }

  function validateItemValue(doc, oldDoc, validator, itemStack, validationErrors) {
    var currentItemEntry = itemStack[itemStack.length - 1];
    var itemPath = currentItemEntry.fullItemPath;
    var itemValue = currentItemEntry.itemValue;
    var oldItemValue = currentItemEntry.oldItemValue;

    if (validator.customValidation) {
      validator.customValidation(validationErrors, doc, oldDoc, itemStack);
    }

    if (validator.immutable && oldDoc && !(oldDoc._deleted) && oldItemValue !== itemValue) {
      validationErrors.push('property "' + itemPath + '" may not be updated')
    }

    if (typeof itemValue !== 'undefined' && itemValue !== null) {
      if (validator.mustNotBeEmpty && itemValue.length < 1) {
        validationErrors.push('property "' + itemPath + '" must not be empty');
      }

      if (typeof(validator.minimumValue) !== 'undefined' && validator.minimumValue !== null && itemValue < validator.minimumValue) {
        validationErrors.push('property "' + itemPath + '" must not be less than ' + validator.minimumValue);
      }

      if (typeof(validator.maximumValue) !== 'undefined' && validator.maximumValue !== null && itemValue > validator.maximumValue) {
        validationErrors.push('property "' + itemPath + '" must not be greater than ' + validator.maximumValue);
      }

      switch (validator.type) {
        case 'string':
          if (typeof itemValue !== 'string') {
            validationErrors.push('property "' + itemPath + '" must be a string');
          } else if (validator.regexPattern && !(validator.regexPattern.test(itemValue))) {
            validationErrors.push('property "' + itemPath + '" must conform to expected format');
          }
          break;
        case 'integer':
          if (!isInteger(itemValue)) {
            validationErrors.push('property "' + itemPath + '" must be an integer');
          }
          break;
        case 'float':
          if (typeof itemValue !== 'number') {
            validationErrors.push('property "' + itemPath + '" must be a floating point number');
          }
          break;
        case 'boolean':
          if (typeof itemValue !== 'boolean') {
            validationErrors.push('property "' + itemPath + '" must be a boolean');
          }
          break;
        case 'datetime':
          if (typeof itemValue !== 'string' || !isIso8601DateTimeString(itemValue)) {
            validationErrors.push('property "' + itemPath + '" must be an ISO 8601 date/time string');
          }
          break;
        case 'date':
          if (typeof itemValue !== 'string' || !isIso8601DateString(itemValue)) {
            validationErrors.push('property "' + itemPath + '" must be an ISO 8601 date-only string');
          }
          break;
        case 'object':
          if (typeof itemValue !== 'object') {
            validationErrors.push('property "' + itemPath + '" must be an object');
          } else if (validator.propertyValidators) {
            validateProperties(doc, oldDoc, validator.propertyValidators, itemStack, validationErrors);
          }
          break;
        case 'array':
          validateArray(doc, oldDoc, validator.arrayElementsValidator, itemStack, validationErrors);
          break;
        case 'hashtable':
          validateHashtable(
            doc,
            oldDoc,
            validator.hashtableKeysValidator,
            validator.hashtableValuesValidator,
            itemStack,
            validationErrors);
          break;
        case 'attachmentReference':
          validateAttachmentRef(doc, oldDoc, validator, itemStack, validationErrors);
          break;
        default:
          // This is not a document validation error; the property validator is configured incorrectly and must be fixed
          throw({ forbidden: 'No data type defined for validator of property "' + itemPath + '"' });
          break;
      }
    } else if (validator.required) {
      // The property has no value (either it's null or undefined), but the validator indicates it is required
      validationErrors.push('required property "' + itemPath + '" is missing');
    }
  }

  function validateArray(doc, oldDoc, elementValidator, itemStack, validationErrors) {
    var currentItemEntry = itemStack[itemStack.length - 1];
    var itemPath = currentItemEntry.fullItemPath;
    var itemValue = currentItemEntry.itemValue;
    var oldItemValue = currentItemEntry.oldItemValue;

    if (!(itemValue instanceof Array)) {
      validationErrors.push('property "' + itemPath + '" must be an array');
    } else if (elementValidator) {
      // Validate each element in the array
      for (var elementIndex = 0; elementIndex < itemValue.length; elementIndex++) {
        var elementName = '[' + elementIndex + ']';
        var elementPath = itemPath ? itemPath + elementName : elementName;
        var elementValue = itemValue[elementIndex];

        var oldElementValue;
        if (typeof(oldItemValue) !== 'undefined' && oldItemValue !== null && elementIndex < oldItemValue.length) {
          oldElementValue = oldItemValue[elementIndex];
        }

        itemStack.push({
          itemName: elementName,
          fullItemPath: elementPath,
          itemValue: elementValue,
          oldItemValue: oldElementValue
        });

        validateItemValue(
          doc,
          oldDoc,
          elementValidator,
          itemStack,
          validationErrors);

        itemStack.pop();
      }
    }
  }

  function validateHashtable(doc, oldDoc, keyValidator, valueValidator, itemStack, validationErrors) {
    var currentItemEntry = itemStack[itemStack.length - 1];
    var itemPath = currentItemEntry.fullItemPath;
    var itemValue = currentItemEntry.itemValue;
    var oldItemValue = currentItemEntry.oldItemValue;

    if (typeof itemValue !== 'object') {
      validationErrors.push('property "' + itemPath + '" must be an object/hashtable');
    } else {
      for (var hashtableKey in itemValue) {
        var elementValue = itemValue[hashtableKey];

        var elementName = '[' + hashtableKey + ']';
        var elementPath = itemPath ? itemPath + elementName : elementName;
        if (keyValidator) {
          if (typeof hashtableKey !== 'string') {
            validationErrors.push('hashtable key "' + elementPath + '" is not a string');
          } else {
            if (keyValidator.mustNotBeEmpty && hashtableKey.length < 1) {
              validationErrors.push('empty hashtable key in property "' + itemPath + '" is not allowed');
            }
            if (keyValidator.regexPattern) {
              if (!(keyValidator.regexPattern.test(hashtableKey))) {
                validationErrors.push('hashtable key "' + elementPath + '" does not conform to expected format');
              }
            }
          }
        }

        if (valueValidator) {
          var oldElementValue;
          if (typeof(oldItemValue) !== 'undefined' && oldItemValue !== null) {
            oldElementValue = oldItemValue[hashtableKey];
          }

          itemStack.push({
            itemName: elementName,
            fullItemPath: elementPath,
            itemValue: elementValue,
            oldItemValue: oldElementValue
          });

          validateItemValue(
            doc,
            oldDoc,
            valueValidator,
            itemStack,
            validationErrors);

          itemStack.pop();
        }
      }
    }
  }

  function validateAttachmentRef(doc, oldDoc, validator, itemStack, validationErrors) {
    var currentItemEntry = itemStack[itemStack.length - 1];
    var itemPath = currentItemEntry.fullItemPath;
    var itemValue = currentItemEntry.itemValue;

    if (typeof itemValue !== 'string') {
      validationErrors.push('attachment property "' + itemPath + '" must be a string');
    } else {
      if (validator.supportedExtensions) {
        var extRegex = new RegExp('\\.(' + validator.supportedExtensions.join('|') + ')$', 'i');
        if (!extRegex.test(itemValue)) {
          validationErrors.push('attachment property "' + itemPath + '" must have a supported file extension (' + validator.supportedExtensions.join(',') + ')');
        }
      }

      // Because the addition of an attachment is typically a separate operation from the creation/update of the associated document, we
      // can't guarantee that the attachment is present when the attachment reference property is created/updated for it, so only
      // validate it if it's present. The good news is that, because adding an attachment is a two part operation (create/update the
      // document and add the attachment), the sync function will be run once for each part, thus ensuring the content is verified once
      // both parts have been synced.
      if (doc._attachments && doc._attachments[itemValue]) {
        var attachment = doc._attachments[itemValue];

        if (validator.supportedContentTypes && validator.supportedContentTypes.indexOf(attachment.content_type) < 0) {
            validationErrors.push('attachment property "' + itemPath + '" must have a supported content type (' + validator.supportedContentTypes.join(',') + ')');
        }

        if (typeof(validator.maximumSize) !== 'undefined' && validator.maximumSize !== null && attachment.length > validator.maximumSize) {
          validationErrors.push('attachment property "' + itemPath + '" must not be larger than ' + validator.maximumSize + ' bytes');
        }
      }
    }
  }

  var rawDocDefinitions = %SYNC_DOCUMENT_DEFINITIONS%;

  var docDefinitions;
  if (typeof rawDocDefinitions === 'function') {
    docDefinitions = rawDocDefinitions();
  } else {
    docDefinitions = rawDocDefinitions;
  }


  function getDocumentType(doc, oldDoc) {
    for (var docType in docDefinitions) {
      var docDefn = docDefinitions[docType];
      if (docDefn.typeFilter(doc, oldDoc)) {
        return docType;
      }
    }

    // The document type does not exist
    return null;
  }


  // Now put the pieces together
  var theDocType = getDocumentType(doc, oldDoc);

  if (theDocType == null) {
    throw({ forbidden: 'Unknown document type' });
  }

  var theDocDefinition = docDefinitions[theDocType];

  authorize(doc, oldDoc, theDocDefinition);

  // There's nothing to validate if the doc is being deleted
  if (!doc._deleted) {
    validateDoc(doc, oldDoc, theDocDefinition, theDocType);
  }

  // Getting here means the document write is authorized and valid, and the appropriate channels should now be assigned
  channel(getAllDocChannels(doc, oldDoc, theDocDefinition));
}
