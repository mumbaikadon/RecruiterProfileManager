# Secure Logging Practices for RecruiterProfileManager

This document outlines the secure logging practices implemented in the RecruiterProfileManager application to ensure sensitive data is properly handled and not exposed in logs.

## Sensitive Data Handling

### Types of Sensitive Data

The following types of data are considered sensitive and should never be logged in full:

1. **User Authentication Data**
   - Passwords
   - Authentication tokens
   - Session IDs

2. **Personal Identifiable Information (PII)**
   - Social Security Numbers (SSN)
   - Date of birth
   - Full addresses
   - Phone numbers
   - Email addresses (in some contexts)

3. **System Security Information**
   - API keys
   - Secret keys
   - Content hashes (used for duplicate detection)
   - Database credentials

4. **Document Content**
   - Full resume text
   - Extracted text from documents
   - File content in any binary or base64 format

### Implemented Safeguards

1. **Automatic Data Sanitization**
   - The logging system automatically sanitizes sensitive fields before they are logged
   - Fields are identified by name patterns (e.g., "password", "token", "hash")
   - Sensitive data is replaced with redacted placeholders that preserve type information

2. **Dedicated Logging Functions**
   - Specific logging functions for sensitive operations (e.g., `contentHashGenerated`)
   - These functions ensure only safe metadata is logged (e.g., file size, text length)
   - No sensitive content is included in the logs

3. **Metadata-Only Logging**
   - For sensitive operations, only metadata about the operation is logged
   - Example: "Content hash generated for duplicate detection" with filename and text length
   - The actual hash value is never logged

## Best Practices for Developers

When adding new code to the application, follow these guidelines:

1. **Never log sensitive data directly**
   ```typescript
   // DON'T do this:
   logger.debug(`Generated hash: ${contentHash}`);
   
   // DO this instead:
   profileLogger.contentHashGenerated(filename, textLength);
   ```

2. **Use the sanitizeLogData function when needed**
   ```typescript
   // If you need to log an object that might contain sensitive data:
   const sanitizedData = sanitizeLogData(dataObject);
   logger.info('Operation completed', sanitizedData);
   ```

3. **Add new sensitive field patterns when needed**
   - If you introduce new types of sensitive data, add their field name patterns to the `sensitiveFields` array in `logger.ts`

4. **Use appropriate log levels**
   - `error`: For errors that need immediate attention
   - `warn`: For potentially problematic situations
   - `info`: For important events that should be tracked in production
   - `debug`: For detailed information useful during development
   - `trace`: For very detailed debugging information

5. **Audit your logging statements**
   - Regularly review logging statements in code reviews
   - Check log files periodically to ensure no sensitive data is being exposed

## Monitoring and Compliance

1. **Log Rotation**
   - Logs are automatically rotated when they reach 5MB
   - A maximum of 5 log files are kept for each log type

2. **Exception Handling**
   - Uncaught exceptions and unhandled promise rejections are logged to separate files
   - These logs follow the same sanitization rules as regular logs

## Adding New Logging Functions

When adding new logging functionality:

1. Add a new function to the `profileLogger` object in `logger.ts`
2. Ensure it only logs safe metadata, not sensitive values
3. Use descriptive operation names for easier log analysis
4. Document the new function in this guide

By following these practices, we ensure that our application logs provide valuable debugging information while protecting sensitive data from exposure.
