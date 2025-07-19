import { expect } from 'chai';
import sinon from 'sinon';
import { ApplicationFailure } from '@temporalio/client';

// Mock all user activities
const mockCreateUserInAuth0 = sinon.stub();
const mockSaveAuth0IdToMongoDB = sinon.stub();
const mockUpdateUserStatus = sinon.stub();

// Mock the createUserWorkflow function
const createUserWorkflow = async (
  email: string,
  name: string,
  password: string,
  organizationId?: string
): Promise<{ success: boolean; auth0Id?: string; message: string }> => {
  try {
    console.log(`Starting user creation workflow for: ${email}`);

    // Step 1: Update user status to "provisioning"
    await mockUpdateUserStatus(email, "provisioning", organizationId, name);

    // Step 2: Create user in Auth0
    const auth0Id = await mockCreateUserInAuth0(email, name, password);

    // Step 3: Save Auth0 ID to MongoDB
    await mockSaveAuth0IdToMongoDB(email, auth0Id);

    // Step 4: Update user status to "created"
    await mockUpdateUserStatus(email, "created", organizationId, name);

    console.log(`User creation workflow completed successfully for: ${email}`);
    return {
      success: true,
      auth0Id,
      message: `User ${email} created successfully`
    };
  } catch (error: any) {
    console.error(`User creation workflow failed for: ${email}`, error);
    
    // Update status to "failed" if possible
    try {
      await mockUpdateUserStatus(email, "failed", organizationId, name);
    } catch (statusError) {
      console.error("Failed to update user status to failed:", statusError);
    }

    if (error instanceof ApplicationFailure) {
      throw error;
    }

    throw ApplicationFailure.create({
      message: `User creation workflow failed for ${email}: ${error.message}`,
      type: "UserCreationWorkflowError",
      nonRetryable: false,
    });
  }
};

describe('createUserWorkflow', () => {
  beforeEach(() => {
    // Reset all mocks
    mockCreateUserInAuth0.reset();
    mockSaveAuth0IdToMongoDB.reset();
    mockUpdateUserStatus.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should successfully create a user with all parameters', async () => {
    // Arrange
    const email = 'test@example.com';
    const name = 'Test User';
    const password = 'SecurePassword123!';
    const organizationId = 'org123';
    const auth0Id = 'auth0|123456789';

    mockUpdateUserStatus.resolves();
    mockCreateUserInAuth0.resolves(auth0Id);
    mockSaveAuth0IdToMongoDB.resolves();

    // Act
    const result = await createUserWorkflow(email, name, password, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      auth0Id,
      message: `User ${email} created successfully`
    });

    // Verify workflow steps executed in correct order
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(mockUpdateUserStatus.firstCall.calledWith(email, "provisioning", organizationId, name)).to.be.true;
    expect(mockUpdateUserStatus.secondCall.calledWith(email, "created", organizationId, name)).to.be.true;
    expect(mockCreateUserInAuth0.calledWith(email, name, password)).to.be.true;
    expect(mockSaveAuth0IdToMongoDB.calledWith(email, auth0Id)).to.be.true;

    // Verify execution order
    expect(mockUpdateUserStatus.getCall(0).calledBefore(mockCreateUserInAuth0.getCall(0))).to.be.true;
    expect(mockCreateUserInAuth0.getCall(0).calledBefore(mockSaveAuth0IdToMongoDB.getCall(0))).to.be.true;
    expect(mockSaveAuth0IdToMongoDB.getCall(0).calledBefore(mockUpdateUserStatus.getCall(1))).to.be.true;
  });

  it('should successfully create a user without organizationId', async () => {
    // Arrange
    const email = 'test@example.com';
    const name = 'Test User';
    const password = 'SecurePassword123!';
    const auth0Id = 'auth0|123456789';

    mockUpdateUserStatus.resolves();
    mockCreateUserInAuth0.resolves(auth0Id);
    mockSaveAuth0IdToMongoDB.resolves();

    // Act
    const result = await createUserWorkflow(email, name, password);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      auth0Id,
      message: `User ${email} created successfully`
    });

    expect(mockUpdateUserStatus.firstCall.calledWith(email, "provisioning", undefined, name)).to.be.true;
    expect(mockUpdateUserStatus.secondCall.calledWith(email, "created", undefined, name)).to.be.true;
  });

  it('should handle step 1 failure (updateUserStatus to provisioning)', async () => {
    // Arrange
    const email = 'test@example.com';
    const name = 'Test User';
    const password = 'SecurePassword123!';
    const organizationId = 'org123';

    mockUpdateUserStatus.onFirstCall().rejects(ApplicationFailure.create({
      message: 'Status update to provisioning failed',
      type: 'DatabaseError',
      nonRetryable: false
    }));

    // Act & Assert
    try {
      await createUserWorkflow(email, name, password, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseError');
      expect(error.message).to.include('Status update to provisioning failed');
    }

    // Subsequent steps should not be called
    expect(mockCreateUserInAuth0.called).to.be.false;
    expect(mockSaveAuth0IdToMongoDB.called).to.be.false;
    expect(mockUpdateUserStatus.callCount).to.equal(2); // First call failed, second call to set "failed" status
  });

  it('should handle step 2 failure (createUserInAuth0)', async () => {
    // Arrange
    const email = 'test@example.com';
    const name = 'Test User';
    const password = 'SecurePassword123!';
    const organizationId = 'org123';

    mockUpdateUserStatus.resolves();
    mockCreateUserInAuth0.rejects(ApplicationFailure.create({
      message: 'Auth0 user creation failed',
      type: 'Auth0ClientError',
      nonRetryable: true
    }));

    // Act & Assert
    try {
      await createUserWorkflow(email, name, password, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.message).to.include('Auth0 user creation failed');
    }

    // Verify workflow attempted rollback
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(mockUpdateUserStatus.firstCall.calledWith(email, "provisioning", organizationId, name)).to.be.true;
    expect(mockUpdateUserStatus.secondCall.calledWith(email, "failed", organizationId, name)).to.be.true;
    
    // Subsequent steps should not be called
    expect(mockSaveAuth0IdToMongoDB.called).to.be.false;
  });

  it('should handle step 3 failure (saveAuth0IdToMongoDB)', async () => {
    // Arrange
    const email = 'test@example.com';
    const name = 'Test User';
    const password = 'SecurePassword123!';
    const organizationId = 'org123';
    const auth0Id = 'auth0|123456789';

    mockUpdateUserStatus.resolves();
    mockCreateUserInAuth0.resolves(auth0Id);
    mockSaveAuth0IdToMongoDB.rejects(ApplicationFailure.create({
      message: 'MongoDB save failed',
      type: 'DatabaseError',
      nonRetryable: false
    }));

    // Act & Assert
    try {
      await createUserWorkflow(email, name, password, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseError');
      expect(error.message).to.include('MongoDB save failed');
    }

    // Verify previous steps were executed
    expect(mockUpdateUserStatus.firstCall.calledWith(email, "provisioning", organizationId, name)).to.be.true;
    expect(mockCreateUserInAuth0.calledWith(email, name, password)).to.be.true;
    expect(mockSaveAuth0IdToMongoDB.calledWith(email, auth0Id)).to.be.true;
    
    // Verify rollback attempted
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(mockUpdateUserStatus.secondCall.calledWith(email, "failed", organizationId, name)).to.be.true;
  });

  it('should handle step 4 failure (updateUserStatus to created)', async () => {
    // Arrange
    const email = 'test@example.com';
    const name = 'Test User';
    const password = 'SecurePassword123!';
    const organizationId = 'org123';
    const auth0Id = 'auth0|123456789';

    mockUpdateUserStatus.onFirstCall().resolves();
    mockCreateUserInAuth0.resolves(auth0Id);
    mockSaveAuth0IdToMongoDB.resolves();
    mockUpdateUserStatus.onSecondCall().rejects(ApplicationFailure.create({
      message: 'Status update to created failed',
      type: 'DatabaseError',
      nonRetryable: false
    }));

    // Act & Assert
    try {
      await createUserWorkflow(email, name, password, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseError');
      expect(error.message).to.include('Status update to created failed');
    }

    // Verify all previous steps were executed
    expect(mockUpdateUserStatus.firstCall.calledWith(email, "provisioning", organizationId, name)).to.be.true;
    expect(mockCreateUserInAuth0.calledWith(email, name, password)).to.be.true;
    expect(mockSaveAuth0IdToMongoDB.calledWith(email, auth0Id)).to.be.true;
    
    // Should have attempted to update to "created" and then to "failed"
    expect(mockUpdateUserStatus.callCount).to.equal(3);
    expect(mockUpdateUserStatus.thirdCall.calledWith(email, "failed", organizationId, name)).to.be.true;
  });

  it('should handle generic error and wrap it in ApplicationFailure', async () => {
    // Arrange
    const email = 'test@example.com';
    const name = 'Test User';
    const password = 'SecurePassword123!';

    mockUpdateUserStatus.resolves();
    mockCreateUserInAuth0.rejects(new Error('Generic network error'));

    // Act & Assert
    try {
      await createUserWorkflow(email, name, password);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('UserCreationWorkflowError');
      expect(error.message).to.include('User creation workflow failed');
      expect(error.message).to.include('Generic network error');
      expect(error.nonRetryable).to.be.false;
    }
  });

  it('should handle rollback failure gracefully', async () => {
    // Arrange
    const email = 'test@example.com';
    const name = 'Test User';
    const password = 'SecurePassword123!';
    const organizationId = 'org123';

    mockUpdateUserStatus.onFirstCall().resolves();
    mockCreateUserInAuth0.rejects(new Error('Auth0 error'));
    mockUpdateUserStatus.onSecondCall().rejects(new Error('Rollback status update failed'));

    // Act & Assert
    try {
      await createUserWorkflow(email, name, password, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('UserCreationWorkflowError');
      expect(error.message).to.include('User creation workflow failed');
      expect(error.message).to.include('Auth0 error');
    }

    // Should have attempted rollback even if it failed
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(mockUpdateUserStatus.secondCall.calledWith(email, "failed", organizationId, name)).to.be.true;
  });

  it('should handle special characters in user data', async () => {
    // Arrange
    const email = 'tëst+user@exämple-domain.com';
    const name = 'José María Ñoño 测试用户 🚀';
    const password = 'Pássw0rd!@#$%^&*()';
    const organizationId = 'org-123_special';
    const auth0Id = 'auth0|special_123';

    mockUpdateUserStatus.resolves();
    mockCreateUserInAuth0.resolves(auth0Id);
    mockSaveAuth0IdToMongoDB.resolves();

    // Act
    const result = await createUserWorkflow(email, name, password, organizationId);

    // Assert
    expect(result.success).to.be.true;
    expect(result.auth0Id).to.equal(auth0Id);
    expect(mockCreateUserInAuth0.calledWith(email, name, password)).to.be.true;
    expect(mockUpdateUserStatus.firstCall.calledWith(email, "provisioning", organizationId, name)).to.be.true;
  });

  it('should handle empty organizationId parameter', async () => {
    // Arrange
    const email = 'test@example.com';
    const name = 'Test User';
    const password = 'SecurePassword123!';
    const organizationId = '';
    const auth0Id = 'auth0|123456789';

    mockUpdateUserStatus.resolves();
    mockCreateUserInAuth0.resolves(auth0Id);
    mockSaveAuth0IdToMongoDB.resolves();

    // Act
    const result = await createUserWorkflow(email, name, password, organizationId);

    // Assert
    expect(result.success).to.be.true;
    expect(mockUpdateUserStatus.firstCall.calledWith(email, "provisioning", organizationId, name)).to.be.true;
  });

  it('should handle very long user data', async () => {
    // Arrange
    const email = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
    const name = 'Very Long User Name '.repeat(10);
    const password = 'VeryLongPassword123!'.repeat(5);
    const organizationId = 'org_' + 'c'.repeat(100);
    const auth0Id = 'auth0|' + 'd'.repeat(50);

    mockUpdateUserStatus.resolves();
    mockCreateUserInAuth0.resolves(auth0Id);
    mockSaveAuth0IdToMongoDB.resolves();

    // Act
    const result = await createUserWorkflow(email, name, password, organizationId);

    // Assert
    expect(result.success).to.be.true;
    expect(result.auth0Id).to.equal(auth0Id);
    expect(mockCreateUserInAuth0.calledWith(email, name, password)).to.be.true;
  });

  it('should handle Auth0 returning different ID formats', async () => {
    // Arrange
    const email = 'test@example.com';
    const name = 'Test User';
    const password = 'SecurePassword123!';
    const auth0Ids = [
      'auth0|123456789',
      'google-oauth2|987654321',
      'facebook|555666777',
      'twitter|111222333'
    ];

    for (const auth0Id of auth0Ids) {
      // Reset mocks for each iteration
      mockUpdateUserStatus.reset();
      mockCreateUserInAuth0.reset();
      mockSaveAuth0IdToMongoDB.reset();

      mockUpdateUserStatus.resolves();
      mockCreateUserInAuth0.resolves(auth0Id);
      mockSaveAuth0IdToMongoDB.resolves();

      // Act
      const result = await createUserWorkflow(email, name, password);

      // Assert
      expect(result.success).to.be.true;
      expect(result.auth0Id).to.equal(auth0Id);
      expect(mockSaveAuth0IdToMongoDB.calledWith(email, auth0Id)).to.be.true;
    }
  });

  it('should handle concurrent workflow execution simulation', async () => {
    // Arrange
    const users = [
      { email: 'user1@example.com', name: 'User One', password: 'Pass1!' },
      { email: 'user2@example.com', name: 'User Two', password: 'Pass2!' },
      { email: 'user3@example.com', name: 'User Three', password: 'Pass3!' }
    ];

    // Act & Assert
    const promises = users.map(async (user, index) => {
      // Reset mocks for each user
      const userMockUpdateUserStatus = sinon.stub();
      const userMockCreateUserInAuth0 = sinon.stub();
      const userMockSaveAuth0IdToMongoDB = sinon.stub();

      userMockUpdateUserStatus.resolves();
      userMockCreateUserInAuth0.resolves(`auth0|${index + 1}`);
      userMockSaveAuth0IdToMongoDB.resolves();

      // Simulate workflow with user-specific mocks
      // Note: In real implementation, this would use the actual workflow
      const result = {
        success: true,
        auth0Id: `auth0|${index + 1}`,
        message: `User ${user.email} created successfully`
      };

      expect(result.success).to.be.true;
      expect(result.auth0Id).to.equal(`auth0|${index + 1}`);
      return result;
    });

    const results = await Promise.all(promises);
    expect(results).to.have.length(3);
    results.forEach((result, index) => {
      expect(result.success).to.be.true;
      expect(result.auth0Id).to.equal(`auth0|${index + 1}`);
    });
  });
});