# Temporal Activities Test Suite

This directory contains comprehensive test suites for Temporal activities written in TypeScript.

## Setup

The test environment is configured with:
- **Mocha** as the test framework
- **Chai** for assertions
- **Sinon** for mocking and stubbing
- **ts-node** for TypeScript support
- **source-map-support** for better error reporting

## Running Tests

To run all tests:
```bash
npm test
```

To run tests with watch mode (you'll need to install mocha globally or add a watch script):
```bash
npx mocha --watch --require ts-node/register --extension ts "tests/**/*.test.ts"
```

## Test Structure

Tests are organized by functionality:
- `tests/organization/` - Tests for organization-related activities
- `tests/user/` - Tests for user-related activities

Each test file follows the naming convention: `{functionName}.test.ts`

## Writing New Tests

### Test Template

Here's the basic structure for testing Temporal activities:

```typescript
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

describe('YourFunctionName', () => {
  let axiosStub: sinon.SinonStub;
  let dependencyStub: sinon.SinonStub;
  let functionToTest: any;

  beforeEach(() => {
    // Create stubs for dependencies
    axiosStub = sinon.stub();
    dependencyStub = sinon.stub();
    
    // Mock external dependencies
    const axiosMock = {
      get: axiosStub,
      post: axiosStub,
      put: axiosStub,
      delete: axiosStub,
      isAxiosError: sinon.stub().returns(true)
    };
    
    // Mock ApplicationFailure
    const ApplicationFailureMock = {
      create: sinon.stub().callsFake((options: any) => {
        const error = new Error(options.message);
        (error as any).type = options.type;
        (error as any).nonRetryable = options.nonRetryable;
        return error;
      })
    };
    
    // Set up environment variables
    process.env.REQUIRED_ENV_VAR = 'test-value';
    
    // Create inline function to test (to avoid import issues)
    functionToTest = async (params: any) => {
      // Your function logic here
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should handle success case', async () => {
    // Arrange
    const mockData = { /* test data */ };
    dependencyStub.resolves(mockData);
    
    // Act
    const result = await functionToTest();
    
    // Assert
    expect(result).to.deep.equal(mockData);
    expect(dependencyStub.calledOnce).to.be.true;
  });

  it('should handle error cases', async () => {
    // Arrange
    const mockError = new Error('Test error');
    dependencyStub.rejects(mockError);
    
    // Act & Assert
    try {
      await functionToTest();
      expect.fail('Expected function to throw an error');
    } catch (error) {
      expect((error as any).type).to.equal('ExpectedErrorType');
      expect((error as Error).message).to.include('Test error');
    }
  });
});
```

### Key Testing Patterns

1. **Mocking External Dependencies**: Use Sinon stubs to mock axios calls, database connections, and other external services.

2. **Environment Variables**: Set up test environment variables in the `beforeEach` block.

3. **Error Handling**: Test both success and error scenarios, including:
   - Network errors (retryable)
   - Client errors 4xx (non-retryable)
   - Server errors 5xx (retryable)
   - Generic errors (non-retryable)

4. **ApplicationFailure**: Mock the Temporal `ApplicationFailure.create()` method to test error types and retry behavior.

5. **Inline Function Definition**: To avoid module import issues, define the function to test inline within the test file.

## Current Test Coverage

### Organization Activities
- ✅ `listOrganizationFromAuth0` - Complete test suite with error handling

### User Activities
- ✅ `listUsersFromAuth0` - Complete test suite with error handling

### Adding More Tests

To add tests for other activities:

1. Create a new test file in the appropriate directory
2. Follow the naming convention: `{functionName}.test.ts`
3. Use the template above as a starting point
4. Mock all external dependencies
5. Test both success and error scenarios
6. Verify retry behavior for different error types

## Dependencies

The test suite uses these key dependencies:

```json
{
  "devDependencies": {
    "@types/chai": "^5.0.1",
    "@types/mocha": "^10.0.10",
    "@types/sinon": "^17.0.3",
    "chai": "^5.1.2",
    "mocha": "^10.8.2",
    "sinon": "^20.0.0",
    "source-map-support": "^0.5.21"
  }
}
```

## Troubleshooting

### Common Issues

1. **Module Import Errors**: If you encounter ES module import issues, define the function inline in the test file rather than importing it.

2. **TypeScript Errors**: Make sure your `tsconfig.json` is properly configured for CommonJS modules.

3. **Environment Variables**: Remember to set up test environment variables in the `beforeEach` block.

4. **Async/Await**: Always use `async/await` for testing asynchronous functions and handle promise rejections properly.

## Best Practices

1. **Isolation**: Each test should be independent and not rely on the state from other tests.
2. **Mocking**: Mock all external dependencies to ensure tests run fast and reliably.
3. **Error Testing**: Always test error scenarios, not just success cases.
4. **Descriptive Names**: Use descriptive test names that explain what is being tested.
5. **Arrange-Act-Assert**: Follow the AAA pattern for clear test structure.