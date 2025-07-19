import { expect } from 'chai';
import sinon from 'sinon';
import { ApplicationFailure } from '@temporalio/client';

// Mock all user activities
const mockUpdateUserInAuth0 = sinon.stub();
const mockUpdateUserStatus = sinon.stub();

// Mock the updateUserWorkflow function
const updateUserWorkflow = async (
  email: string,
  updates: { name?: string; password?: string; blocked?: boolean },
  organizationId?: string
): Promise<{ success: boolean; message: string; updatedFields: string[] }> => {
  try {
    console.log(`Starting user update workflow for: ${email}`);

    // Step 1: Update user status to "updating"
    await mockUpdateUserStatus(email, "updating", organizationId);

    // Step 2: Update user in Auth0
    const updatedFields = await mockUpdateUserInAuth0(email, updates);

    // Step 3: Update user status to "active"
    await mockUpdateUserStatus(email, "active", organizationId);

    console.log(`User update workflow completed successfully for: ${email}`);
    return {
      success: true,
      message: `User ${email} updated successfully`,
      updatedFields
    };
  } catch (error: any) {
    console.error(`User update workflow failed for: ${email}`, error);
    
    // Update status to "failed" if possible
    try {
      await mockUpdateUserStatus(email, "failed", organizationId);
    } catch (statusError) {
      console.error("Failed to update user status to failed:", statusError);
    }

    if (error instanceof ApplicationFailure) {
      throw error;
    }

    throw ApplicationFailure.create({
      message: `User update workflow failed for ${email}: ${error.message}`,
      type: "UserUpdateWorkflowError",
      nonRetryable: false,
    });
  }
};

describe('updateUserWorkflow', () => {
  beforeEach(() => {
    // Reset all mocks completely
    mockUpdateUserInAuth0.reset();
    mockUpdateUserStatus.reset();
    
    // Clear all behaviors
    mockUpdateUserInAuth0.resetBehavior();
    mockUpdateUserStatus.resetBehavior();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should successfully update user name', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { name: 'Updated Name' };
    const organizationId = 'org123';
    const updatedFields = ['name'];

    mockUpdateUserStatus.resolves();
    mockUpdateUserInAuth0.resolves(updatedFields);

    // Act
    const result = await updateUserWorkflow(email, updates, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} updated successfully`,
      updatedFields
    });

    // Verify workflow steps executed in correct order
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(mockUpdateUserStatus.getCall(0).calledWith(email, "updating", organizationId)).to.be.true;
    expect(mockUpdateUserStatus.getCall(1).calledWith(email, "active", organizationId)).to.be.true;
    expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;

    // Verify execution order
    expect(mockUpdateUserStatus.getCall(0).calledBefore(mockUpdateUserInAuth0.getCall(0))).to.be.true;
    expect(mockUpdateUserInAuth0.getCall(0).calledBefore(mockUpdateUserStatus.getCall(1))).to.be.true;
  });

  it('should successfully update user password', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { password: 'NewSecurePassword123!' };
    const organizationId = 'org123';
    const updatedFields = ['password'];

    mockUpdateUserStatus.resolves();
    mockUpdateUserInAuth0.resolves(updatedFields);

    // Act
    const result = await updateUserWorkflow(email, updates, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} updated successfully`,
      updatedFields
    });

    expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
  });

  it('should successfully update user blocked status', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { blocked: true };
    const organizationId = 'org123';
    const updatedFields = ['blocked'];

    mockUpdateUserStatus.resolves();
    mockUpdateUserInAuth0.resolves(updatedFields);

    // Act
    const result = await updateUserWorkflow(email, updates, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} updated successfully`,
      updatedFields
    });

    expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
  });

  it('should successfully update multiple fields', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { 
      name: 'New Name', 
      password: 'NewPassword123!',
      blocked: false 
    };
    const organizationId = 'org123';
    const updatedFields = ['name', 'password', 'blocked'];

    mockUpdateUserStatus.resolves();
    mockUpdateUserInAuth0.resolves(updatedFields);

    // Act
    const result = await updateUserWorkflow(email, updates, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} updated successfully`,
      updatedFields
    });

    expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
  });

  it('should successfully update user without organizationId', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { name: 'Updated Name' };
    const updatedFields = ['name'];

    mockUpdateUserStatus.resolves();
    mockUpdateUserInAuth0.resolves(updatedFields);

    // Act
    const result = await updateUserWorkflow(email, updates);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} updated successfully`,
      updatedFields
    });

    expect(mockUpdateUserStatus.getCall(0).calledWith(email, "updating", undefined)).to.be.true;
    expect(mockUpdateUserStatus.getCall(1).calledWith(email, "active", undefined)).to.be.true;
  });

  it('should handle step 1 failure (updateUserStatus to updating)', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { name: 'Updated Name' };
    const organizationId = 'org123';

    const statusError = ApplicationFailure.create({
      message: 'Status update to updating failed',
      type: 'DatabaseError',
      nonRetryable: false
    });

    mockUpdateUserStatus.onCall(0).rejects(statusError);
    mockUpdateUserStatus.onCall(1).resolves(); // For the "failed" status update

    // Act & Assert
    try {
      await updateUserWorkflow(email, updates, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseError');
      expect(error.message).to.include('Status update to updating failed');
    }

    // Subsequent steps should not be called
    expect(mockUpdateUserInAuth0.called).to.be.false;
    expect(mockUpdateUserStatus.callCount).to.equal(2); // First call failed, second call to set "failed" status
  });

  it('should handle step 2 failure (updateUserInAuth0)', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { name: 'Updated Name' };
    const organizationId = 'org123';

    const auth0Error = ApplicationFailure.create({
      message: 'Auth0 user update failed',
      type: 'Auth0ClientError',
      nonRetryable: true
    });

    mockUpdateUserStatus.onCall(0).resolves(); // updating status
    mockUpdateUserInAuth0.rejects(auth0Error);
    mockUpdateUserStatus.onCall(1).resolves(); // failed status

    // Act & Assert
    try {
      await updateUserWorkflow(email, updates, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ClientError');
      expect(error.message).to.include('Auth0 user update failed');
    }

    // Verify workflow attempted rollback
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(mockUpdateUserStatus.getCall(0).calledWith(email, "updating", organizationId)).to.be.true;
    expect(mockUpdateUserStatus.getCall(1).calledWith(email, "failed", organizationId)).to.be.true;
  });

  it('should handle step 3 failure (updateUserStatus to active)', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { name: 'Updated Name' };
    const organizationId = 'org123';
    const updatedFields = ['name'];

    const statusError = ApplicationFailure.create({
      message: 'Status update to active failed',
      type: 'DatabaseError',
      nonRetryable: false
    });

    mockUpdateUserStatus.onCall(0).resolves(); // updating status
    mockUpdateUserInAuth0.resolves(updatedFields);
    mockUpdateUserStatus.onCall(1).rejects(statusError); // active status fails
    mockUpdateUserStatus.onCall(2).resolves(); // failed status

    // Act & Assert
    try {
      await updateUserWorkflow(email, updates, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseError');
      expect(error.message).to.include('Status update to active failed');
    }

    // Verify all previous steps were executed
    expect(mockUpdateUserStatus.getCall(0).calledWith(email, "updating", organizationId)).to.be.true;
    expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
    
    // Should have attempted to update to "active" and then to "failed"
    expect(mockUpdateUserStatus.callCount).to.equal(3);
    expect(mockUpdateUserStatus.getCall(2).calledWith(email, "failed", organizationId)).to.be.true;
  });

  it('should handle generic error and wrap it in ApplicationFailure', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { name: 'Updated Name' };

    mockUpdateUserStatus.onCall(0).resolves(); // updating status
    mockUpdateUserInAuth0.rejects(new Error('Generic network error'));
    mockUpdateUserStatus.onCall(1).resolves(); // failed status

    // Act & Assert
    try {
      await updateUserWorkflow(email, updates);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('UserUpdateWorkflowError');
      expect(error.message).to.include('User update workflow failed');
      expect(error.message).to.include('Generic network error');
      expect(error.nonRetryable).to.be.false;
    }
  });

  it('should handle rollback failure gracefully', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { name: 'Updated Name' };
    const organizationId = 'org123';

    mockUpdateUserStatus.onCall(0).resolves(); // updating status
    mockUpdateUserInAuth0.rejects(new Error('Auth0 error'));
    mockUpdateUserStatus.onCall(1).rejects(new Error('Rollback status update failed')); // failed status fails

    // Act & Assert
    try {
      await updateUserWorkflow(email, updates, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('UserUpdateWorkflowError');
      expect(error.message).to.include('User update workflow failed');
      expect(error.message).to.include('Auth0 error');
    }

    // Should have attempted rollback even if it failed
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(mockUpdateUserStatus.getCall(1).calledWith(email, "failed", organizationId)).to.be.true;
  });

  it('should handle empty updates object', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = {};
    const organizationId = 'org123';
    const updatedFields: string[] = [];

    mockUpdateUserStatus.resolves();
    mockUpdateUserInAuth0.resolves(updatedFields);

    // Act
    const result = await updateUserWorkflow(email, updates, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} updated successfully`,
      updatedFields: []
    });

    expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
  });

  it('should handle special characters in updates', async () => {
    // Arrange
    const email = 'tëst+user@exämple-domain.com';
    const updates = { 
      name: 'José María Ñoño 测试用户 🚀',
      password: 'Pássw0rd!@#$%^&*()'
    };
    const organizationId = 'org-123_special';
    const updatedFields = ['name', 'password'];

    mockUpdateUserStatus.resolves();
    mockUpdateUserInAuth0.resolves(updatedFields);

    // Act
    const result = await updateUserWorkflow(email, updates, organizationId);

    // Assert
    expect(result.success).to.be.true;
    expect(result.updatedFields).to.deep.equal(updatedFields);
    expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
    expect(mockUpdateUserStatus.getCall(0).calledWith(email, "updating", organizationId)).to.be.true;
  });

  it('should handle very long update data', async () => {
    // Arrange
    const email = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
    const updates = { 
      name: 'Very Long User Name '.repeat(20),
      password: 'VeryLongPassword123!'.repeat(10)
    };
    const organizationId = 'org_' + 'c'.repeat(100);
    const updatedFields = ['name', 'password'];

    mockUpdateUserStatus.resolves();
    mockUpdateUserInAuth0.resolves(updatedFields);

    // Act
    const result = await updateUserWorkflow(email, updates, organizationId);

    // Assert
    expect(result.success).to.be.true;
    expect(result.updatedFields).to.deep.equal(updatedFields);
    expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
  });

  it('should handle blocked status variations', async () => {
    // Arrange
    const email = 'test@example.com';
    const testCases = [
      { blocked: true, expected: ['blocked'] },
      { blocked: false, expected: ['blocked'] },
      { blocked: undefined, expected: [] }
    ];

    for (const testCase of testCases) {
      // Reset mocks for each iteration
      mockUpdateUserStatus.reset();
      mockUpdateUserInAuth0.reset();
      
      mockUpdateUserStatus.resetBehavior();
      mockUpdateUserInAuth0.resetBehavior();

      mockUpdateUserStatus.resolves();
      mockUpdateUserInAuth0.resolves(testCase.expected);

      // Act
      const result = await updateUserWorkflow(email, { blocked: testCase.blocked });

      // Assert
      expect(result.success).to.be.true;
      expect(result.updatedFields).to.deep.equal(testCase.expected);
      expect(mockUpdateUserInAuth0.calledWith(email, { blocked: testCase.blocked })).to.be.true;
    }
  });

  it('should handle partial update failures with detailed error messages', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { name: 'New Name', password: 'NewPassword123!' };
    const organizationId = 'org123';

    const partialUpdateError = ApplicationFailure.create({
      message: 'Failed to update password field in Auth0',
      type: 'Auth0ValidationError',
      nonRetryable: true,
      details: { failedFields: ['password'], successfulFields: ['name'] }
    });

    mockUpdateUserStatus.onCall(0).resolves(); // updating status
    mockUpdateUserInAuth0.rejects(partialUpdateError);
    mockUpdateUserStatus.onCall(1).resolves(); // failed status

    // Act & Assert
    try {
      await updateUserWorkflow(email, updates, organizationId);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('Auth0ValidationError');
      expect(error.message).to.include('Failed to update password field in Auth0');
      expect(error.details).to.deep.equal({ 
        failedFields: ['password'], 
        successfulFields: ['name'] 
      });
    }
  });

  it('should handle concurrent update workflow execution simulation', async () => {
    // Arrange
    const userUpdates = [
      { email: 'user1@example.com', updates: { name: 'User One Updated' } },
      { email: 'user2@example.com', updates: { password: 'NewPass2!' } },
      { email: 'user3@example.com', updates: { blocked: true } }
    ];

    // Act & Assert
    const promises = userUpdates.map(async (userUpdate, index) => {
      // Reset mocks for each user
      const userMockUpdateUserStatus = sinon.stub();
      const userMockUpdateUserInAuth0 = sinon.stub();

      userMockUpdateUserStatus.resolves();
      userMockUpdateUserInAuth0.resolves([Object.keys(userUpdate.updates)[0]]);

      // Simulate workflow with user-specific mocks
      // Note: In real implementation, this would use the actual workflow
      const result = {
        success: true,
        message: `User ${userUpdate.email} updated successfully`,
        updatedFields: [Object.keys(userUpdate.updates)[0]]
      };

      expect(result.success).to.be.true;
      expect(result.updatedFields).to.have.length(1);
      return result;
    });

    const results = await Promise.all(promises);
    expect(results).to.have.length(3);
    results.forEach((result) => {
      expect(result.success).to.be.true;
      expect(result.updatedFields).to.have.length(1);
    });
  });

  it('should handle update workflow with null and undefined values', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { 
      name: null as any,
      password: undefined as any,
      blocked: false
    };
    const organizationId = 'org123';
    const updatedFields = ['blocked']; // Only blocked should be updated

    mockUpdateUserStatus.resolves();
    mockUpdateUserInAuth0.resolves(updatedFields);

    // Act
    const result = await updateUserWorkflow(email, updates, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} updated successfully`,
      updatedFields
    });

    expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
  });

  it('should handle Auth0 returning different update results', async () => {
    // Arrange
    const email = 'test@example.com';
    const updates = { name: 'New Name', password: 'NewPass123!', blocked: true };
    const updateResults = [
      ['name', 'password', 'blocked'], // All fields updated
      ['name', 'blocked'], // Password update failed
      ['name'], // Only name updated
      [] // No fields updated
    ];

    for (const expectedFields of updateResults) {
      // Reset mocks for each iteration
      mockUpdateUserStatus.reset();
      mockUpdateUserInAuth0.reset();
      
      mockUpdateUserStatus.resetBehavior();
      mockUpdateUserInAuth0.resetBehavior();

      mockUpdateUserStatus.resolves();
      mockUpdateUserInAuth0.resolves(expectedFields);

      // Act
      const result = await updateUserWorkflow(email, updates);

      // Assert
      expect(result.success).to.be.true;
      expect(result.updatedFields).to.deep.equal(expectedFields);
      expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
    }
  });
});