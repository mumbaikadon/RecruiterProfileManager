# Manual Test Cases for Optional Fields Implementation

## Test Cases to Verify

### 1. Form Validation Tests
- ✅ Form accepts submission with all optional fields empty
- ✅ Form accepts submission with only birth month provided
- ✅ Form accepts submission with only birth day provided  
- ✅ Form accepts submission with only SSN4 provided
- ✅ Form rejects invalid birth month (0, 13, negative)
- ✅ Form rejects invalid birth day (0, 32, negative)
- ✅ Form rejects invalid SSN4 (not 4 digits, non-numeric)

### 2. Database Storage Tests
- ✅ Candidate records stored with NULL values for missing optional fields
- ✅ Query operations handle NULL values correctly
- ✅ Duplicate checking works with partial identity information

### 3. Backend API Tests
- ✅ API accepts candidate data with missing optional fields
- ✅ getCandidateByIdentity returns undefined when no identifying info provided
- ✅ getCandidateByIdentity searches correctly with partial information
- ✅ Null coalescing (??) properly converts null to undefined for API calls

### 4. UI/UX Tests
- ✅ Optional fields clearly labeled with "(Optional)" indicator
- ✅ Form fields accept empty values without validation errors
- ✅ Submission works with combination of filled and empty optional fields

## Verification Steps

1. **Database Schema Check**: Confirmed fields are nullable
2. **Type Safety**: Fixed null coalescing in routes to prevent type errors
3. **Form Schema**: Updated Zod validation to accept optional values
4. **Backend Logic**: Updated identity checking to handle partial data
5. **UI Labels**: Added "(Optional)" indicators to sensitive fields

## Security Benefits

- Reduces collection of sensitive personal information
- Maintains candidate uniqueness checking where possible
- Allows flexibility for candidates who don't want to provide sensitive data
- Complies with data minimization principles