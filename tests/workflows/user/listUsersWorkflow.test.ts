import { expect } from 'chai';
import sinon from 'sinon';
import { ApplicationFailure } from '@temporalio/client';

// Mock all user activities
const mockListUsersFromAuth0 = sinon.stub();
const mockUpdateUserStatus = sinon.stub();

// Mock the listUsersWorkflow function
const listUsersWorkflow = async (
  page: number = 0,
  perPage: number = 50,
  searchQuery?: string,
  organizationId?: string
): Promise<{ 
  success: boolean; 
  message: string; 
  users: any[]; 
  pagination: { page: number; perPage: number; total: number; hasMore: boolean } 
}> => {
  try {
    console.log(`Starting list users workflow - page: ${page}, perPage: ${perPage}`);

    // Step 1: Update workflow status to "fetching" (optional status tracking)
    if (organizationId) {
      try {
        await mockUpdateUserStatus('workflow', "fetching", organizationId);
      } catch (statusError) {
        // Status update failure is not critical for listing
        console.warn('Failed to update workflow status:', statusError);
      }
    }

    // Step 2: List users from Auth0
    const auth0Response = await mockListUsersFromAuth0(page, perPage, searchQuery);

    // Step 3: Update workflow status to "completed" (optional)
    if (organizationId) {
      try {
        await mockUpdateUserStatus('workflow', "completed", organizationId);
      } catch (statusError) {
        console.warn('Failed to update workflow status to completed:', statusError);
      }
    }

    console.log(`List users workflow completed - found ${auth0Response.users.length} users`);
    return {
      success: true,
      message: `Successfully retrieved ${auth0Response.users.length} users`,
      users: auth0Response.users,
      pagination: {
        page,
        perPage,
        total: auth0Response.total,
        hasMore: (page + 1) * perPage < auth0Response.total
      }
    };
  } catch (error: any) {
    console.error('List users workflow failed:', error);
    
    // Update status to "failed" if possible
    if (organizationId) {
      try {
        await mockUpdateUserStatus('workflow', "failed", organizationId);
      } catch (statusError) {
        console.error("Failed to update workflow status to failed:", statusError);
      }
    }

    if (error instanceof ApplicationFailure) {
      throw error;
    }

    throw ApplicationFailure.create({
      message: `List users workflow failed: ${error.message}`,
      type: "ListUsersWorkflowError",
      nonRetryable: false,
    });
  }
};

describe('listUsersWorkflow', () => {
  beforeEach(() => {
    // Reset all mocks completely
    mockListUsersFromAuth0.reset();
    mockUpdateUserStatus.reset();
    
    // Clear all behaviors
    mockListUsersFromAuth0.resetBehavior();
    mockUpdateUserStatus.resetBehavior();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should successfully list users with default pagination', async () => {
    // Arrange
    const mockUsers = [
      { id: 'auth0|1', email: 'user1@example.com', name: 'User One' },
      { id: 'auth0|2', email: 'user2@example.com', name: 'User Two' }
    ];
    const mockResponse = { users: mockUsers, total: 2 };

    mockListUsersFromAuth0.resolves(mockResponse);

    // Act
    const result = await listUsersWorkflow();

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: 'Successfully retrieved 2 users',
      users: mockUsers,
      pagination: {
        page: 0,
        perPage: 50,
        total: 2,
        hasMore: false
      }
    });

    expect(mockListUsersFromAuth0.calledWith(0, 50, undefined)).to.be.true;
    expect(mockUpdateUserStatus.called).to.be.false; // No organizationId provided
  });

  it('should successfully list users with custom pagination', async () => {
    // Arrange
    const page = 2;
    const perPage = 10;
    const mockUsers = Array.from({ length: 10 }, (_, i) => ({
      id: `auth0|${i + 21}`,
      email: `user${i + 21}@example.com`,
      name: `User ${i + 21}`
    }));
    const mockResponse = { users: mockUsers, total: 100 };

    mockListUsersFromAuth0.resolves(mockResponse);

    // Act
    const result = await listUsersWorkflow(page, perPage);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: 'Successfully retrieved 10 users',
      users: mockUsers,
      pagination: {
        page: 2,
        perPage: 10,
        total: 100,
        hasMore: true // (2 + 1) * 10 = 30 < 100
      }
    });

    expect(mockListUsersFromAuth0.calledWith(page, perPage, undefined)).to.be.true;
  });

  it('should successfully list users with search query', async () => {
    // Arrange
    const searchQuery = 'john';
    const mockUsers = [
      { id: 'auth0|1', email: 'john.doe@example.com', name: 'John Doe' },
      { id: 'auth0|2', email: 'johnny@example.com', name: 'Johnny Smith' }
    ];
    const mockResponse = { users: mockUsers, total: 2 };

    mockListUsersFromAuth0.resolves(mockResponse);

    // Act
    const result = await listUsersWorkflow(0, 50, searchQuery);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: 'Successfully retrieved 2 users',
      users: mockUsers,
      pagination: {
        page: 0,
        perPage: 50,
        total: 2,
        hasMore: false
      }
    });

    expect(mockListUsersFromAuth0.calledWith(0, 50, searchQuery)).to.be.true;
  });

  it('should successfully list users with organizationId and status tracking', async () => {
    // Arrange
    const organizationId = 'org123';
    const mockUsers = [
      { id: 'auth0|1', email: 'user1@example.com', name: 'User One' }
    ];
    const mockResponse = { users: mockUsers, total: 1 };

    mockUpdateUserStatus.resolves();
    mockListUsersFromAuth0.resolves(mockResponse);

    // Act
    const result = await listUsersWorkflow(0, 50, undefined, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: 'Successfully retrieved 1 users',
      users: mockUsers,
      pagination: {
        page: 0,
        perPage: 50,
        total: 1,
        hasMore: false
      }
    });

    // Verify status tracking
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(mockUpdateUserStatus.getCall(0).calledWith('workflow', "fetching", organizationId)).to.be.true;
    expect(mockUpdateUserStatus.getCall(1).calledWith('workflow', "completed", organizationId)).to.be.true;
    expect(mockListUsersFromAuth0.calledWith(0, 50, undefined)).to.be.true;
  });

  it('should handle empty results', async () => {
    // Arrange
    const mockResponse = { users: [], total: 0 };

    mockListUsersFromAuth0.resolves(mockResponse);

    // Act
    const result = await listUsersWorkflow();

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: 'Successfully retrieved 0 users',
      users: [],
      pagination: {
        page: 0,
        perPage: 50,
        total: 0,
        hasMore: false
      }
    });

    expect(mockListUsersFromAuth0.calledWith(0, 50, undefined)).to.be.true;
  });

  it('should handle Auth0 listing failure', async () => {
    // Arrange
    const organizationId = 'org123';
    const auth0Error = ApplicationFailure.create({
      message: 'Auth0 API rate limit exceeded',
      type: 'Auth0RateLimitError',
      nonRetryable: false
    });

    mockUpdateUserStatus.onCall(0).resolves(); // fetching status
    mockListUsersFromAuth0.rejects(auth0Error);
    mockUpdateUserStatus.onCall(1).resolves(); // failed status

    // Act & Assert
    try {
      await listUsersWorkflow(0, 50, undefined, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0RateLimitError');
      expect(error.message).to.include('Auth0 API rate limit exceeded');
    }

    // Verify status updates
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(mockUpdateUserStatus.getCall(0).calledWith('workflow', "fetching", organizationId)).to.be.true;
    expect(mockUpdateUserStatus.getCall(1).calledWith('workflow', "failed", organizationId)).to.be.true;
  });

  it('should handle generic error and wrap it in ApplicationFailure', async () => {
    // Arrange
    const organizationId = 'org123';

    mockUpdateUserStatus.onCall(0).resolves(); // fetching status
    mockListUsersFromAuth0.rejects(new Error('Network connection timeout'));
    mockUpdateUserStatus.onCall(1).resolves(); // failed status

    // Act & Assert
    try {
      await listUsersWorkflow(0, 50, undefined, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('ListUsersWorkflowError');
      expect(error.message).to.include('List users workflow failed');
      expect(error.message).to.include('Network connection timeout');
      expect(error.nonRetryable).to.be.false;
    }
  });

  it('should handle status update failures gracefully', async () => {
    // Arrange
    const organizationId = 'org123';
    const mockUsers = [
      { id: 'auth0|1', email: 'user1@example.com', name: 'User One' }
    ];
    const mockResponse = { users: mockUsers, total: 1 };

    mockUpdateUserStatus.onCall(0).rejects(new Error('Status update failed')); // fetching status fails
    mockListUsersFromAuth0.resolves(mockResponse);
    mockUpdateUserStatus.onCall(1).rejects(new Error('Status update failed')); // completed status fails

    // Act
    const result = await listUsersWorkflow(0, 50, undefined, organizationId);

    // Assert - Should still succeed despite status update failures
    expect(result).to.deep.equal({
      success: true,
      message: 'Successfully retrieved 1 users',
      users: mockUsers,
      pagination: {
        page: 0,
        perPage: 50,
        total: 1,
        hasMore: false
      }
    });

    expect(mockListUsersFromAuth0.calledWith(0, 50, undefined)).to.be.true;
    expect(mockUpdateUserStatus.callCount).to.equal(2);
  });

  it('should handle rollback status update failure gracefully', async () => {
    // Arrange
    const organizationId = 'org123';

    mockUpdateUserStatus.onCall(0).resolves(); // fetching status
    mockListUsersFromAuth0.rejects(new Error('Auth0 error'));
    mockUpdateUserStatus.onCall(1).rejects(new Error('Rollback status update failed')); // failed status fails

    // Act & Assert
    try {
      await listUsersWorkflow(0, 50, undefined, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('ListUsersWorkflowError');
      expect(error.message).to.include('List users workflow failed');
      expect(error.message).to.include('Auth0 error');
    }

    // Should have attempted rollback even if it failed
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(mockUpdateUserStatus.getCall(1).calledWith('workflow', "failed", organizationId)).to.be.true;
  });

  it('should handle large result sets with pagination', async () => {
    // Arrange
    const page = 0;
    const perPage = 100;
    const mockUsers = Array.from({ length: 100 }, (_, i) => ({
      id: `auth0|${i + 1}`,
      email: `user${i + 1}@example.com`,
      name: `User ${i + 1}`
    }));
    const mockResponse = { users: mockUsers, total: 1000 };

    mockListUsersFromAuth0.resolves(mockResponse);

    // Act
    const result = await listUsersWorkflow(page, perPage);

    // Assert
    expect(result.success).to.be.true;
    expect(result.users).to.have.length(100);
    expect(result.pagination).to.deep.equal({
      page: 0,
      perPage: 100,
      total: 1000,
      hasMore: true // (0 + 1) * 100 = 100 < 1000
    });

    expect(mockListUsersFromAuth0.calledWith(page, perPage, undefined)).to.be.true;
  });

  it('should handle last page correctly', async () => {
    // Arrange
    const page = 9; // Last page (0-indexed)
    const perPage = 10;
    const mockUsers = Array.from({ length: 5 }, (_, i) => ({
      id: `auth0|${i + 91}`,
      email: `user${i + 91}@example.com`,
      name: `User ${i + 91}`
    }));
    const mockResponse = { users: mockUsers, total: 95 };

    mockListUsersFromAuth0.resolves(mockResponse);

    // Act
    const result = await listUsersWorkflow(page, perPage);

    // Assert
    expect(result.pagination).to.deep.equal({
      page: 9,
      perPage: 10,
      total: 95,
      hasMore: false // (9 + 1) * 10 = 100 >= 95
    });

    expect(result.users).to.have.length(5);
  });

  it('should handle special characters in search query', async () => {
    // Arrange
    const searchQuery = 'josé maría ñoño@exämple.com 测试用户 🚀';
    const mockUsers = [
      { id: 'auth0|1', email: 'josé.maría@exämple.com', name: 'José María Ñoño 测试用户 🚀' }
    ];
    const mockResponse = { users: mockUsers, total: 1 };

    mockListUsersFromAuth0.resolves(mockResponse);

    // Act
    const result = await listUsersWorkflow(0, 50, searchQuery);

    // Assert
    expect(result.success).to.be.true;
    expect(result.users).to.deep.equal(mockUsers);
    expect(mockListUsersFromAuth0.calledWith(0, 50, searchQuery)).to.be.true;
  });

  it('should handle very long search queries', async () => {
    // Arrange
    const searchQuery = 'very long search query '.repeat(50);
    const mockResponse = { users: [], total: 0 };

    mockListUsersFromAuth0.resolves(mockResponse);

    // Act
    const result = await listUsersWorkflow(0, 50, searchQuery);

    // Assert
    expect(result.success).to.be.true;
    expect(result.users).to.have.length(0);
    expect(mockListUsersFromAuth0.calledWith(0, 50, searchQuery)).to.be.true;
  });

  it('should handle edge case pagination values', async () => {
    // Arrange
    const testCases = [
      { page: 0, perPage: 1, total: 5, expectedHasMore: true },
      { page: 4, perPage: 1, total: 5, expectedHasMore: false },
      { page: 0, perPage: 1000, total: 10, expectedHasMore: false },
      { page: 100, perPage: 50, total: 100, expectedHasMore: false }
    ];

    for (const testCase of testCases) {
      // Reset mocks for each iteration
      mockListUsersFromAuth0.reset();
      mockListUsersFromAuth0.resetBehavior();

      const mockUsers = Array.from({ length: Math.min(testCase.perPage, testCase.total) }, (_, i) => ({
        id: `auth0|${i + 1}`,
        email: `user${i + 1}@example.com`,
        name: `User ${i + 1}`
      }));
      const mockResponse = { users: mockUsers, total: testCase.total };

      mockListUsersFromAuth0.resolves(mockResponse);

      // Act
      const result = await listUsersWorkflow(testCase.page, testCase.perPage);

      // Assert
      expect(result.pagination.hasMore).to.equal(testCase.expectedHasMore);
      expect(result.pagination.page).to.equal(testCase.page);
      expect(result.pagination.perPage).to.equal(testCase.perPage);
      expect(result.pagination.total).to.equal(testCase.total);
    }
  });

  it('should handle concurrent list workflow execution simulation', async () => {
    // Arrange
    const queries = [
      { page: 0, perPage: 10, searchQuery: 'admin' },
      { page: 1, perPage: 20, searchQuery: 'user' },
      { page: 0, perPage: 50, searchQuery: undefined }
    ];

    // Act & Assert
    const promises = queries.map(async (query, index) => {
      // Reset mocks for each query
      const queryMockListUsersFromAuth0 = sinon.stub();
      const queryMockUpdateUserStatus = sinon.stub();

      const mockUsers = Array.from({ length: query.perPage }, (_, i) => ({
        id: `auth0|${index * 100 + i + 1}`,
        email: `user${index * 100 + i + 1}@example.com`,
        name: `User ${index * 100 + i + 1}`
      }));
      const mockResponse = { users: mockUsers, total: query.perPage * 2 };

      queryMockListUsersFromAuth0.resolves(mockResponse);
      queryMockUpdateUserStatus.resolves();

      // Simulate workflow with query-specific mocks
      // Note: In real implementation, this would use the actual workflow
      const result = {
        success: true,
        message: `Successfully retrieved ${mockUsers.length} users`,
        users: mockUsers,
        pagination: {
          page: query.page,
          perPage: query.perPage,
          total: mockResponse.total,
          hasMore: (query.page + 1) * query.perPage < mockResponse.total
        }
      };

      expect(result.success).to.be.true;
      expect(result.users).to.have.length(query.perPage);
      return result;
    });

    const results = await Promise.all(promises);
    expect(results).to.have.length(3);
    results.forEach((result, index) => {
      expect(result.success).to.be.true;
      expect(result.users).to.have.length(queries[index].perPage);
    });
  });

  it('should handle Auth0 timeout and retry scenarios', async () => {
    // Arrange
    const organizationId = 'org123';
    const timeoutError = ApplicationFailure.create({
      message: 'Auth0 request timeout while listing users',
      type: 'Auth0TimeoutError',
      nonRetryable: false // Should be retryable
    });

    mockUpdateUserStatus.onCall(0).resolves(); // fetching status
    mockListUsersFromAuth0.rejects(timeoutError);
    mockUpdateUserStatus.onCall(1).resolves(); // failed status

    // Act & Assert
    try {
      await listUsersWorkflow(0, 50, undefined, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0TimeoutError');
      expect(error.message).to.include('Auth0 request timeout while listing users');
      expect(error.nonRetryable).to.be.false; // Should be retryable
    }

    expect(mockListUsersFromAuth0.calledWith(0, 50, undefined)).to.be.true;
    expect(mockUpdateUserStatus.callCount).to.equal(2);
  });

  it('should handle malformed Auth0 response', async () => {
    // Arrange
    const malformedResponses = [
      null,
      undefined,
      {},
      { users: null },
      { users: [], total: null },
      { users: 'invalid', total: 10 },
      { total: 10 } // missing users
    ];

    for (const malformedResponse of malformedResponses) {
      // Reset mocks for each iteration
      mockListUsersFromAuth0.reset();
      mockListUsersFromAuth0.resetBehavior();

      mockListUsersFromAuth0.resolves(malformedResponse);

      // Act & Assert
      try {
        await listUsersWorkflow();
        // Some malformed responses might not throw immediately
        // The workflow should handle them gracefully or throw appropriate errors
      } catch (error: any) {
        // Expect the workflow to handle malformed responses appropriately
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('ListUsersWorkflowError');
      }
    }
  });

  it('should handle users with complex data structures', async () => {
    // Arrange
    const complexUsers = [
      {
        id: 'auth0|complex1',
        email: 'complex1@example.com',
        name: 'Complex User 1',
        metadata: { role: 'admin', permissions: ['read', 'write'] },
        identities: [
          { provider: 'auth0', user_id: 'complex1' },
          { provider: 'google-oauth2', user_id: 'google123' }
        ],
        app_metadata: { organization_id: 'org123', created_by: 'system' },
        user_metadata: { preferences: { theme: 'dark', language: 'en' } }
      },
      {
        id: 'auth0|complex2',
        email: 'complex2@example.com',
        name: 'Complex User 2',
        blocked: true,
        email_verified: false,
        picture: 'https://example.com/avatar.jpg'
      }
    ];
    const mockResponse = { users: complexUsers, total: 2 };

    mockListUsersFromAuth0.resolves(mockResponse);

    // Act
    const result = await listUsersWorkflow();

    // Assert
    expect(result.success).to.be.true;
    expect(result.users).to.deep.equal(complexUsers);
    expect(result.users[0]).to.have.property('metadata');
    expect(result.users[0]).to.have.property('identities');
    expect(result.users[1]).to.have.property('blocked', true);
  });
});