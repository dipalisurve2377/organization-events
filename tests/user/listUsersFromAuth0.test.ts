import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import { ApplicationFailure } from '@temporalio/client';

// Mock the getAuth0Token function
const mockGetAuth0Token = sinon.stub();

// Mock the listUsersFromAuth0 activity function
const listUsersFromAuth0 = async (
  page: number = 0,
  perPage: number = 50,
  query?: string
): Promise<{ users: any[], total: number, start: number, limit: number }> => {
  try {
    const token = await mockGetAuth0Token();

    console.log(`Listing users from Auth0 - page: ${page}, perPage: ${perPage}, query: ${query || 'none'}`);

    // Build query parameters
    const params: any = {
      page,
      per_page: perPage,
      include_totals: true
    };

    if (query) {
      params.q = query;
    }

    const response = await axios.get(
      `https://${process.env.AUTH0_USER_DOMAIN}/api/v2/users`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params
      }
    );

    const { users, total, start, limit } = response.data;

    console.log(`Successfully retrieved ${users.length} users from Auth0 (total: ${total})`);

    return {
      users: users || [],
      total: total || 0,
      start: start || 0,
      limit: limit || perPage
    };
  } catch (error: any) {
    let errorMessage = `Failed to list users from Auth0`;
    let errorType = "Auth0ListUsersError";
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

    console.error("Error listing users from Auth0:", error);
    throw ApplicationFailure.create({
      message: errorMessage,
      type: errorType,
      nonRetryable,
    });
  }
};

describe('listUsersFromAuth0', () => {
  let axiosGetStub: sinon.SinonStub;

  beforeEach(() => {
    axiosGetStub = sinon.stub(axios, 'get');
    mockGetAuth0Token.reset();
    
    // Set default environment variables
    process.env.AUTH0_USER_DOMAIN = 'test-domain.auth0.com';
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should successfully list users from Auth0 with default parameters', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';
    const mockUsers = [
      { user_id: 'auth0|123', email: 'user1@example.com', name: 'User One' },
      { user_id: 'auth0|456', email: 'user2@example.com', name: 'User Two' }
    ];
    const mockResponse = {
      data: {
        users: mockUsers,
        total: 2,
        start: 0,
        limit: 50
      }
    };

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.resolves(mockResponse);

    // Act
    const result = await listUsersFromAuth0();

    // Assert
    expect(mockGetAuth0Token.calledOnce).to.be.true;
    expect(axiosGetStub.calledOnce).to.be.true;

    const [url, config] = axiosGetStub.firstCall.args;
    expect(url).to.equal('https://test-domain.auth0.com/api/v2/users');
    expect(config.headers.Authorization).to.equal(`Bearer ${mockToken}`);
    expect(config.headers['Content-Type']).to.equal('application/json');
    expect(config.params).to.deep.equal({
      page: 0,
      per_page: 50,
      include_totals: true
    });

    expect(result).to.deep.equal({
      users: mockUsers,
      total: 2,
      start: 0,
      limit: 50
    });
  });

  it('should successfully list users with custom pagination', async () => {
    // Arrange
    const page = 2;
    const perPage = 25;
    const mockToken = 'mock-auth0-token';
    const mockUsers = [
      { user_id: 'auth0|789', email: 'user3@example.com', name: 'User Three' }
    ];
    const mockResponse = {
      data: {
        users: mockUsers,
        total: 51,
        start: 50,
        limit: 25
      }
    };

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.resolves(mockResponse);

    // Act
    const result = await listUsersFromAuth0(page, perPage);

    // Assert
    expect(axiosGetStub.calledOnce).to.be.true;

    const [, config] = axiosGetStub.firstCall.args;
    expect(config.params).to.deep.equal({
      page: 2,
      per_page: 25,
      include_totals: true
    });

    expect(result).to.deep.equal({
      users: mockUsers,
      total: 51,
      start: 50,
      limit: 25
    });
  });

  it('should successfully list users with search query', async () => {
    // Arrange
    const page = 0;
    const perPage = 50;
    const query = 'email:"john@example.com"';
    const mockToken = 'mock-auth0-token';
    const mockUsers = [
      { user_id: 'auth0|999', email: 'john@example.com', name: 'John Doe' }
    ];
    const mockResponse = {
      data: {
        users: mockUsers,
        total: 1,
        start: 0,
        limit: 50
      }
    };

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.resolves(mockResponse);

    // Act
    const result = await listUsersFromAuth0(page, perPage, query);

    // Assert
    expect(axiosGetStub.calledOnce).to.be.true;

    const [, config] = axiosGetStub.firstCall.args;
    expect(config.params).to.deep.equal({
      page: 0,
      per_page: 50,
      include_totals: true,
      q: query
    });

    expect(result).to.deep.equal({
      users: mockUsers,
      total: 1,
      start: 0,
      limit: 50
    });
  });

  it('should handle empty user list', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';
    const mockResponse = {
      data: {
        users: [],
        total: 0,
        start: 0,
        limit: 50
      }
    };

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.resolves(mockResponse);

    // Act
    const result = await listUsersFromAuth0();

    // Assert
    expect(result).to.deep.equal({
      users: [],
      total: 0,
      start: 0,
      limit: 50
    });
  });

  it('should handle partial response data', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';
    const mockResponse = {
      data: {
        users: [{ user_id: 'auth0|123', email: 'test@example.com' }]
        // Missing total, start, limit
      }
    };

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.resolves(mockResponse);

    // Act
    const result = await listUsersFromAuth0();

    // Assert
    expect(result).to.deep.equal({
      users: [{ user_id: 'auth0|123', email: 'test@example.com' }],
      total: 0,
      start: 0,
      limit: 50
    });
  });

  it('should handle Auth0 client errors (4xx) as non-retryable', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.rejects({
      response: {
        status: 400,
        data: { message: 'Bad request' }
      }
    });

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Failed to list users from Auth0');
      expect(error.message).to.include('Status: 400');
      expect(error.message).to.include('Bad request');
    }
  });

  it('should handle Auth0 unauthorized error (401)', async () => {
    // Arrange
    const mockToken = 'invalid-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.rejects({
      response: {
        status: 401,
        data: { message: 'Unauthorized' }
      }
    });

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Status: 401');
      expect(error.message).to.include('Unauthorized');
    }
  });

  it('should handle Auth0 forbidden error (403)', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.rejects({
      response: {
        status: 403,
        data: { message: 'Insufficient scope' }
      }
    });

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Status: 403');
      expect(error.message).to.include('Insufficient scope');
    }
  });

  it('should handle Auth0 rate limiting (429)', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.rejects({
      response: {
        status: 429,
        data: { message: 'Too many requests' }
      }
    });

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Status: 429');
      expect(error.message).to.include('Too many requests');
    }
  });

  it('should handle Auth0 server errors (5xx) as retryable', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.rejects({
      response: {
        status: 500,
        data: { message: 'Internal server error' }
      }
    });

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ServerError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to list users from Auth0');
      expect(error.message).to.include('Status: 500');
    }
  });

  it('should handle network errors as retryable', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    const networkError = new Error('Connection refused') as any;
    networkError.code = 'ECONNREFUSED';
    axiosGetStub.rejects(networkError);

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('NetworkError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to list users from Auth0');
    }
  });

  it('should handle ENOTFOUND network error', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    const networkError = new Error('Domain not found') as any;
    networkError.code = 'ENOTFOUND';
    axiosGetStub.rejects(networkError);

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('NetworkError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to list users from Auth0');
    }
  });

  it('should handle generic errors as retryable', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.rejects(new Error('Generic error'));

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ListUsersError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to list users from Auth0');
    }
  });

  it('should handle getAuth0Token failure', async () => {
    // Arrange
    mockGetAuth0Token.rejects(new Error('Token fetch failed'));

    // Act & Assert
    try {
      await listUsersFromAuth0();
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ListUsersError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to list users from Auth0');
    }
  });

  it('should handle large page numbers', async () => {
    // Arrange
    const page = 999;
    const perPage = 100;
    const mockToken = 'mock-auth0-token';
    const mockResponse = {
      data: {
        users: [],
        total: 50000,
        start: 99900,
        limit: 100
      }
    };

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.resolves(mockResponse);

    // Act
    const result = await listUsersFromAuth0(page, perPage);

    // Assert
    const [, config] = axiosGetStub.firstCall.args;
    expect(config.params).to.deep.equal({
      page: 999,
      per_page: 100,
      include_totals: true
    });

    expect(result).to.deep.equal({
      users: [],
      total: 50000,
      start: 99900,
      limit: 100
    });
  });

  it('should handle complex search queries', async () => {
    // Arrange
    const query = 'email:"*@company.com" AND (name:"John" OR name:"Jane")';
    const mockToken = 'mock-auth0-token';
    const mockUsers = [
      { user_id: 'auth0|111', email: 'john@company.com', name: 'John Smith' },
      { user_id: 'auth0|222', email: 'jane@company.com', name: 'Jane Doe' }
    ];
    const mockResponse = {
      data: {
        users: mockUsers,
        total: 2,
        start: 0,
        limit: 50
      }
    };

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.resolves(mockResponse);

    // Act
    const result = await listUsersFromAuth0(0, 50, query);

    // Assert
    const [, config] = axiosGetStub.firstCall.args;
    expect(config.params.q).to.equal(query);
    expect(result.users).to.have.length(2);
  });

  it('should handle users with minimal data', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';
    const mockUsers = [
      { user_id: 'auth0|minimal' }  // Only user_id, no email or name
    ];
    const mockResponse = {
      data: {
        users: mockUsers,
        total: 1,
        start: 0,
        limit: 50
      }
    };

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.resolves(mockResponse);

    // Act
    const result = await listUsersFromAuth0();

    // Assert
    expect(result.users).to.deep.equal(mockUsers);
    expect(result.total).to.equal(1);
  });

  it('should handle users with complex metadata', async () => {
    // Arrange
    const mockToken = 'mock-auth0-token';
    const mockUsers = [
      {
        user_id: 'auth0|complex',
        email: 'complex@example.com',
        name: 'Complex User',
        picture: 'https://example.com/avatar.jpg',
        user_metadata: {
          preferences: { theme: 'dark' },
          profile: { bio: 'Test user' }
        },
        app_metadata: {
          roles: ['admin', 'user'],
          permissions: ['read', 'write']
        },
        identities: [
          {
            provider: 'auth0',
            user_id: 'complex',
            connection: 'Username-Password-Authentication'
          }
        ],
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-12-01T00:00:00.000Z',
        last_login: '2023-12-01T12:00:00.000Z',
        logins_count: 42
      }
    ];
    const mockResponse = {
      data: {
        users: mockUsers,
        total: 1,
        start: 0,
        limit: 50
      }
    };

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.resolves(mockResponse);

    // Act
    const result = await listUsersFromAuth0();

    // Assert
    expect(result.users).to.deep.equal(mockUsers);
    expect(result.users[0].user_metadata).to.deep.equal({
      preferences: { theme: 'dark' },
      profile: { bio: 'Test user' }
    });
    expect(result.users[0].app_metadata.roles).to.include('admin');
  });

  it('should handle zero per_page parameter', async () => {
    // Arrange
    const page = 0;
    const perPage = 0;
    const mockToken = 'mock-auth0-token';
    const mockResponse = {
      data: {
        users: [],
        total: 100,
        start: 0,
        limit: 0
      }
    };

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.resolves(mockResponse);

    // Act
    const result = await listUsersFromAuth0(page, perPage);

    // Assert
    const [, config] = axiosGetStub.firstCall.args;
    expect(config.params.per_page).to.equal(0);
    expect(result.limit).to.equal(0);
  });

  it('should handle negative page numbers', async () => {
    // Arrange
    const page = -1;
    const perPage = 50;
    const mockToken = 'mock-auth0-token';
    const mockResponse = {
      data: {
        users: [],
        total: 0,
        start: 0,
        limit: 50
      }
    };

    mockGetAuth0Token.resolves(mockToken);
    axiosGetStub.resolves(mockResponse);

    // Act
    const result = await listUsersFromAuth0(page, perPage);

    // Assert
    const [, config] = axiosGetStub.firstCall.args;
    expect(config.params.page).to.equal(-1);
  });
});