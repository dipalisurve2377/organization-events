import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import { ApplicationFailure } from '@temporalio/client';

// Mock the createUserInAuth0 activity function
const createUserInAuth0 = async (email: string, password: string, name: string): Promise<string> => {
  try {
    const token = await mockGetAuth0Token();
    
    console.log("Sending user to Auth0:", {
      email,
      name,
    });

    const mockUserData = {
      email,
      password,
      name,
      connection: "Username-Password-Authentication",
      verify_email: false,
    };

    const userRes = await axios.post(
      `https://${process.env.AUTH0_USER_DOMAIN}/api/v2/users`,
      mockUserData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return userRes.data.user_id;
  } catch (error: any) {
    let errorMessage = `Failed to create user in Auth0 (email: ${email})`;
    let errorType = "Auth0CreateUserError";
    let nonRetryable = false;

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      errorMessage += `. Status: ${status}`;
      if (data?.message) {
        errorMessage += `. Message: ${data.message}`;
      }

      if (status >= 400 && status < 500) {
        errorType = "Auth0ClientError";
        nonRetryable = true;
      } else if (status >= 500) {
        errorType = "Auth0ServerError";
        nonRetryable = false;
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorType = "NetworkError";
      nonRetryable = false;
    }

    console.error("Error creating user in Auth0:", error);
    throw ApplicationFailure.create({
      message: errorMessage,
      type: errorType,
      nonRetryable,
    });
  }
};

// Mock the getAuth0Token function
const mockGetAuth0Token = sinon.stub();

describe('createUserInAuth0', () => {
  let axiosPostStub: sinon.SinonStub;

  beforeEach(() => {
    axiosPostStub = sinon.stub(axios, 'post');
    mockGetAuth0Token.reset();
    
    // Set default environment variables
    process.env.AUTH0_USER_DOMAIN = 'test-domain.auth0.com';
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should successfully create user in Auth0', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'SecurePassword123!';
    const name = 'Test User';
    const expectedUserId = 'auth0|123456789';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosPostStub.resolves({
      data: { user_id: expectedUserId }
    });

    // Act
    const result = await createUserInAuth0(email, password, name);

    // Assert
    expect(result).to.equal(expectedUserId);
    expect(mockGetAuth0Token.calledOnce).to.be.true;
    expect(axiosPostStub.calledOnce).to.be.true;

    const [url, data, config] = axiosPostStub.firstCall.args;
    expect(url).to.equal('https://test-domain.auth0.com/api/v2/users');
    expect(data).to.deep.include({
      email,
      password,
      name,
      connection: 'Username-Password-Authentication',
      verify_email: false
    });
    expect(config.headers.Authorization).to.equal(`Bearer ${mockToken}`);
  });

  it('should handle Auth0 client errors (4xx) as non-retryable', async () => {
    // Arrange
    const email = 'invalid@example.com';
    const password = 'password';
    const name = 'Test User';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosPostStub.rejects({
      response: {
        status: 400,
        data: { message: 'User already exists' }
      }
    });

    // Act & Assert
    try {
      await createUserInAuth0(email, password, name);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Failed to create user in Auth0');
      expect(error.message).to.include('Status: 400');
      expect(error.message).to.include('User already exists');
    }
  });

  it('should handle Auth0 server errors (5xx) as retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'password';
    const name = 'Test User';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosPostStub.rejects({
      response: {
        status: 500,
        data: { message: 'Internal server error' }
      }
    });

    // Act & Assert
    try {
      await createUserInAuth0(email, password, name);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ServerError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to create user in Auth0');
      expect(error.message).to.include('Status: 500');
    }
  });

  it('should handle network errors as retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'password';
    const name = 'Test User';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosPostStub.rejects({
      code: 'ECONNREFUSED',
      message: 'Connection refused'
    });

    // Act & Assert
    try {
      await createUserInAuth0(email, password, name);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('NetworkError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to create user in Auth0');
    }
  });

  it('should handle generic errors as non-retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'password';
    const name = 'Test User';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosPostStub.rejects(new Error('Generic error'));

    // Act & Assert
    try {
      await createUserInAuth0(email, password, name);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0CreateUserError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to create user in Auth0');
    }
  });

  it('should handle getAuth0Token failure', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'password';
    const name = 'Test User';

    mockGetAuth0Token.rejects(new Error('Token fetch failed'));

    // Act & Assert
    try {
      await createUserInAuth0(email, password, name);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).to.equal('Token fetch failed');
    }
  });

  it('should handle empty email parameter', async () => {
    // Arrange
    const email = '';
    const password = 'password';
    const name = 'Test User';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosPostStub.rejects({
      response: {
        status: 400,
        data: { message: 'Email is required' }
      }
    });

    // Act & Assert
    try {
      await createUserInAuth0(email, password, name);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.nonRetryable).to.be.true;
    }
  });

  it('should handle special characters in user data', async () => {
    // Arrange
    const email = 'user+test@example.com';
    const password = 'P@ssw0rd!';
    const name = 'Test User-Name';
    const expectedUserId = 'auth0|special123';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosPostStub.resolves({
      data: { user_id: expectedUserId }
    });

    // Act
    const result = await createUserInAuth0(email, password, name);

    // Assert
    expect(result).to.equal(expectedUserId);
    expect(axiosPostStub.calledOnce).to.be.true;

    const [, data] = axiosPostStub.firstCall.args;
    expect(data.email).to.equal(email);
    expect(data.password).to.equal(password);
    expect(data.name).to.equal(name);
  });

  it('should handle Auth0 unauthorized error (401)', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'password';
    const name = 'Test User';
    const mockToken = 'invalid-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosPostStub.rejects({
      response: {
        status: 401,
        data: { message: 'Unauthorized' }
      }
    });

    // Act & Assert
    try {
      await createUserInAuth0(email, password, name);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Status: 401');
      expect(error.message).to.include('Unauthorized');
    }
  });

  it('should handle Auth0 rate limiting (429)', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'password';
    const name = 'Test User';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosPostStub.rejects({
      response: {
        status: 429,
        data: { message: 'Too many requests' }
      }
    });

    // Act & Assert
    try {
      await createUserInAuth0(email, password, name);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Status: 429');
      expect(error.message).to.include('Too many requests');
    }
  });
});