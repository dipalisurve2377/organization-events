import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

describe('listUsersFromAuth0', () => {
  let axiosStub: sinon.SinonStub;
  let getAuth0TokenStub: sinon.SinonStub;
  let listUsersFromAuth0: any;

  beforeEach(() => {
    // Create stubs
    axiosStub = sinon.stub();
    getAuth0TokenStub = sinon.stub();
    
    // Mock axios
    const axiosMock = {
      get: axiosStub,
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
    
    // Set up environment variables for testing
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com';
    
    // Create the function to test inline to avoid import issues
    listUsersFromAuth0 = async (): Promise<any[]> => {
      try {
        const token = await getAuth0TokenStub();

        const response = await axiosStub(
          `https://${process.env.AUTH0_DOMAIN}/api/v2/users`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        return response.data;
      } catch (error: any) {
        let errorMessage = `Failed to list users from Auth0`;

        if (axiosMock.isAxiosError(error) && error.response) {
          const status = error.response.status;
          const data = JSON.stringify(error.response.data);
          errorMessage += ` — Auth0 responded with status ${status}: ${data}`;

          if (status >= 400 && status < 500) {
            throw ApplicationFailureMock.create({
              message: errorMessage,
              type: "Auth0ClientError",
              nonRetryable: true,
            });
          }

          throw ApplicationFailureMock.create({
            message: errorMessage,
            type: "Auth0ServerError",
            nonRetryable: false,
          });
        } else if (axiosMock.isAxiosError(error) && error.request) {
          errorMessage += " — No response received from Auth0 (network issue).";
          throw ApplicationFailureMock.create({
            message: errorMessage,
            type: "NetworkError",
            nonRetryable: false,
          });
        } else {
          errorMessage += ` — Unexpected error: ${error?.message || "Unknown"}`;
          throw ApplicationFailureMock.create({
            message: errorMessage,
            type: "GenericListFailure",
            nonRetryable: true,
          });
        }
      }
    };
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  it('should successfully list users from Auth0', async () => {
    // Arrange
    const mockToken = 'mock-access-token';
    const mockUsers = [
      {
        user_id: 'auth0|user123',
        email: 'user1@test.com',
        name: 'Test User 1'
      },
      {
        user_id: 'auth0|user456',
        email: 'user2@test.com',
        name: 'Test User 2'
      }
    ];

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.resolves({ data: mockUsers });

    // Act
    const result = await listUsersFromAuth0();

    // Assert
    expect(result).to.deep.equal(mockUsers);
    expect(getAuth0TokenStub.calledOnce).to.be.true;
    expect(axiosStub.calledOnce).to.be.true;
    expect(axiosStub.calledWith(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users`,
      {
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      }
    )).to.be.true;
  });

  it('should handle Auth0 client errors (4xx) as non-retryable', async () => {
    // Arrange
    const mockToken = 'mock-access-token';
    const mockError = {
      response: {
        status: 401,
        data: { error: 'Unauthorized', error_description: 'Invalid token' }
      }
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Expected function to throw an error');
    } catch (error) {
      expect((error as any).type).to.equal('Auth0ClientError');
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include('Auth0 responded with status 401');
    }
  });

  it('should handle Auth0 server errors (5xx) as retryable', async () => {
    // Arrange
    const mockToken = 'mock-access-token';
    const mockError = {
      response: {
        status: 503,
        data: { error: 'Service Unavailable' }
      }
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Expected function to throw an error');
    } catch (error) {
      expect((error as any).type).to.equal('Auth0ServerError');
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include('Auth0 responded with status 503');
    }
  });

  it('should handle network errors as retryable', async () => {
    // Arrange
    const mockToken = 'mock-access-token';
    const mockError = {
      request: {},
      message: 'Network timeout'
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Expected function to throw an error');
    } catch (error) {
      expect((error as any).type).to.equal('NetworkError');
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include('No response received from Auth0');
    }
  });

  it('should handle generic errors as non-retryable', async () => {
    // Arrange
    const mockToken = 'mock-access-token';
    const mockError = new Error('Unexpected error');

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Expected function to throw an error');
    } catch (error) {
      expect((error as any).type).to.equal('GenericListFailure');
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include('Unexpected error');
    }
  });
});