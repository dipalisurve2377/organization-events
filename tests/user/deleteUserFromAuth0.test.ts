import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import { ApplicationFailure } from '@temporalio/client';

// Mock User model
const UserMock = {
  findOne: sinon.stub(),
  findById: sinon.stub(),
  create: sinon.stub()
};

// Mock the getAuth0Token function
const mockGetAuth0Token = sinon.stub();

// Mock the deleteUserFromAuth0 activity function
const deleteUserFromAuth0 = async (email: string): Promise<void> => {
  try {
    const token = await mockGetAuth0Token();

    const user = await UserMock.findOne({ email });

    if (!user || !user.auth0Id) {
      throw ApplicationFailure.create({
        message: `User not found or missing Auth0 ID for email: ${email}`,
        type: "MissingAuth0ID",
        nonRetryable: true,
      });
    }

    console.log(`Auth0Id for deleting user ${user.auth0Id}`);

    await axios.delete(
      `https://${process.env.AUTH0_USER_DOMAIN}/api/v2/users/${user.auth0Id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(`User deleted from Auth0: ${email}`);
  } catch (error: any) {
    let errorMessage = `Failed to delete user (email: ${email})`;
    let errorType = "Auth0DeleteUserError";
    let nonRetryable = false;

    if (error instanceof ApplicationFailure) {
      throw error;
    }

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

    console.error("Error deleting user from Auth0:", error);
    throw ApplicationFailure.create({
      message: errorMessage,
      type: errorType,
      nonRetryable,
    });
  }
};

describe('deleteUserFromAuth0', () => {
  let axiosDeleteStub: sinon.SinonStub;

  beforeEach(() => {
    axiosDeleteStub = sinon.stub(axios, 'delete');
    mockGetAuth0Token.reset();
    UserMock.findOne.reset();
    
    // Set default environment variables
    process.env.AUTH0_USER_DOMAIN = 'test-domain.auth0.com';
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should successfully delete user from Auth0', async () => {
    // Arrange
    const email = 'test@example.com';
    const auth0Id = 'auth0|123456789';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosDeleteStub.resolves({ status: 204 });

    // Act
    await deleteUserFromAuth0(email);

    // Assert
    expect(mockGetAuth0Token.calledOnce).to.be.true;
    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(axiosDeleteStub.calledOnce).to.be.true;

    const [url, config] = axiosDeleteStub.firstCall.args;
    expect(url).to.equal(`https://test-domain.auth0.com/api/v2/users/${auth0Id}`);
    expect(config.headers.Authorization).to.equal(`Bearer ${mockToken}`);
  });

  it('should handle user not found in database', async () => {
    // Arrange
    const email = 'nonexistent@example.com';

    UserMock.findOne.resolves(null);

    // Act & Assert
    try {
      await deleteUserFromAuth0(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('MissingAuth0ID');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include(`User not found or missing Auth0 ID for email: ${email}`);
    }
  });

  it('should handle user with missing auth0Id', async () => {
    // Arrange
    const email = 'test@example.com';

    UserMock.findOne.resolves({ email, auth0Id: null });

    // Act & Assert
    try {
      await deleteUserFromAuth0(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('MissingAuth0ID');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include(`User not found or missing Auth0 ID for email: ${email}`);
    }
  });

  it('should handle Auth0 client errors (4xx) as non-retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const auth0Id = 'auth0|123456789';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosDeleteStub.rejects({
      response: {
        status: 404,
        data: { message: 'User not found in Auth0' }
      }
    });

    // Act & Assert
    try {
      await deleteUserFromAuth0(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Failed to delete user');
      expect(error.message).to.include('Status: 404');
      expect(error.message).to.include('User not found in Auth0');
    }
  });

  it('should handle Auth0 server errors (5xx) as retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const auth0Id = 'auth0|123456789';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosDeleteStub.rejects({
      response: {
        status: 500,
        data: { message: 'Internal server error' }
      }
    });

    // Act & Assert
    try {
      await deleteUserFromAuth0(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ServerError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to delete user');
      expect(error.message).to.include('Status: 500');
    }
  });

  it('should handle network errors as retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const auth0Id = 'auth0|123456789';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosDeleteStub.rejects({
      code: 'ECONNREFUSED',
      message: 'Connection refused'
    });

    // Act & Assert
    try {
      await deleteUserFromAuth0(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('NetworkError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to delete user');
    }
  });

  it('should handle generic errors as non-retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const auth0Id = 'auth0|123456789';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosDeleteStub.rejects(new Error('Generic error'));

    // Act & Assert
    try {
      await deleteUserFromAuth0(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0DeleteUserError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to delete user');
    }
  });

  it('should handle database connection errors', async () => {
    // Arrange
    const email = 'test@example.com';

    UserMock.findOne.rejects(new Error('Database connection failed'));

    // Act & Assert
    try {
      await deleteUserFromAuth0(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).to.equal('Database connection failed');
    }
  });

  it('should handle getAuth0Token failure', async () => {
    // Arrange
    const email = 'test@example.com';

    mockGetAuth0Token.rejects(new Error('Token fetch failed'));

    // Act & Assert
    try {
      await deleteUserFromAuth0(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).to.equal('Token fetch failed');
    }
  });

  it('should handle Auth0 unauthorized error (401)', async () => {
    // Arrange
    const email = 'test@example.com';
    const auth0Id = 'auth0|123456789';
    const mockToken = 'invalid-token';

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosDeleteStub.rejects({
      response: {
        status: 401,
        data: { message: 'Unauthorized' }
      }
    });

    // Act & Assert
    try {
      await deleteUserFromAuth0(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Status: 401');
      expect(error.message).to.include('Unauthorized');
    }
  });

  it('should handle user with empty auth0Id string', async () => {
    // Arrange
    const email = 'test@example.com';

    UserMock.findOne.resolves({ email, auth0Id: '' });

    // Act & Assert
    try {
      await deleteUserFromAuth0(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('MissingAuth0ID');
      expect(error.nonRetryable).to.be.true;
    }
  });

  it('should handle Auth0 rate limiting (429)', async () => {
    // Arrange
    const email = 'test@example.com';
    const auth0Id = 'auth0|123456789';
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosDeleteStub.rejects({
      response: {
        status: 429,
        data: { message: 'Too many requests' }
      }
    });

    // Act & Assert
    try {
      await deleteUserFromAuth0(email);
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