import { expect } from 'chai';
import sinon from 'sinon';
import { ApplicationFailure } from '@temporalio/client';

// Mock all user activities
const mockCreateUserInAuth0 = sinon.stub();
const mockSaveAuth0IdToMongoDB = sinon.stub();
const mockUpdateUserInAuth0 = sinon.stub();
const mockUpdateUserStatus = sinon.stub();
const mockDeleteUserFromAuth0 = sinon.stub();
const mockDeleteUserFromDB = sinon.stub();
const mockListUsersFromAuth0 = sinon.stub();

// Mock the user workflow functions
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

const updateUserWorkflow = async (
  email: string,
  updates: { name?: string; password?: string },
  organizationId?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    console.log(`Starting user update workflow for: ${email}`);

    // Step 1: Update user status to "updating"
    await mockUpdateUserStatus(email, "updating", organizationId, updates.name);

    // Step 2: Update user in Auth0
    await mockUpdateUserInAuth0(email, updates);

    // Step 3: Update user status to "updated" (this is done inside updateUserInAuth0)
    // No need to call it again here

    console.log(`User update workflow completed successfully for: ${email}`);
    return {
      success: true,
      message: `User ${email} updated successfully`
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

const deleteUserWorkflow = async (
  email: string
): Promise<{ success: boolean; message: string }> => {
  try {
    console.log(`Starting user deletion workflow for: ${email}`);

    // Step 1: Update user status to "deleting"
    await mockUpdateUserStatus(email, "deleting");

    // Step 2: Delete user from Auth0
    await mockDeleteUserFromAuth0(email);

    // Step 3: Delete user from database
    await mockDeleteUserFromDB(email);

    console.log(`User deletion workflow completed successfully for: ${email}`);
    return {
      success: true,
      message: `User ${email} deleted successfully`
    };
  } catch (error: any) {
    console.error(`User deletion workflow failed for: ${email}`, error);
    
    // Update status to "failed" if possible
    try {
      await mockUpdateUserStatus(email, "failed");
    } catch (statusError) {
      console.error("Failed to update user status to failed:", statusError);
    }

    if (error instanceof ApplicationFailure) {
      throw error;
    }

    throw ApplicationFailure.create({
      message: `User deletion workflow failed for ${email}: ${error.message}`,
      type: "UserDeletionWorkflowError",
      nonRetryable: false,
    });
  }
};

const listUsersWorkflow = async (
  page: number = 0,
  perPage: number = 50,
  query?: string
): Promise<{ users: any[], total: number, start: number, limit: number }> => {
  try {
    console.log(`Starting list users workflow - page: ${page}, perPage: ${perPage}`);

    // Call Auth0 to list users
    const result = await mockListUsersFromAuth0(page, perPage, query);

    console.log(`List users workflow completed successfully. Found ${result.users.length} users`);
    return result;
  } catch (error: any) {
    console.error(`List users workflow failed`, error);

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

describe('User Workflows', () => {
  beforeEach(() => {
    // Reset all mocks
    mockCreateUserInAuth0.reset();
    mockSaveAuth0IdToMongoDB.reset();
    mockUpdateUserInAuth0.reset();
    mockUpdateUserStatus.reset();
    mockDeleteUserFromAuth0.reset();
    mockDeleteUserFromDB.reset();
    mockListUsersFromAuth0.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createUserWorkflow', () => {
    it('should successfully create a user with all steps', async () => {
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

      expect(mockUpdateUserStatus.callCount).to.equal(2);
      expect(mockUpdateUserStatus.firstCall.calledWith(email, "provisioning", organizationId, name)).to.be.true;
      expect(mockUpdateUserStatus.secondCall.calledWith(email, "created", organizationId, name)).to.be.true;
      expect(mockCreateUserInAuth0.calledWith(email, name, password)).to.be.true;
      expect(mockSaveAuth0IdToMongoDB.calledWith(email, auth0Id)).to.be.true;
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
      expect(result.success).to.be.true;
      expect(result.auth0Id).to.equal(auth0Id);
      expect(mockUpdateUserStatus.firstCall.calledWith(email, "provisioning", undefined, name)).to.be.true;
    });

    it('should handle createUserInAuth0 failure', async () => {
      // Arrange
      const email = 'test@example.com';
      const name = 'Test User';
      const password = 'SecurePassword123!';
      const organizationId = 'org123';

      mockUpdateUserStatus.resolves();
      mockCreateUserInAuth0.rejects(ApplicationFailure.create({
        message: 'Auth0 user creation failed',
        type: 'Auth0Error',
        nonRetryable: false
      }));

      // Act & Assert
      try {
        await createUserWorkflow(email, name, password, organizationId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('Auth0Error');
      }

      // Should have tried to update status to "failed"
      expect(mockUpdateUserStatus.callCount).to.equal(2);
      expect(mockUpdateUserStatus.secondCall.calledWith(email, "failed", organizationId, name)).to.be.true;
    });

    it('should handle saveAuth0IdToMongoDB failure', async () => {
      // Arrange
      const email = 'test@example.com';
      const name = 'Test User';
      const password = 'SecurePassword123!';
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
        await createUserWorkflow(email, name, password);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('DatabaseError');
      }

      expect(mockCreateUserInAuth0.calledOnce).to.be.true;
      expect(mockSaveAuth0IdToMongoDB.calledOnce).to.be.true;
    });

    it('should handle updateUserStatus failure during workflow', async () => {
      // Arrange
      const email = 'test@example.com';
      const name = 'Test User';
      const password = 'SecurePassword123!';

      mockUpdateUserStatus.onFirstCall().rejects(ApplicationFailure.create({
        message: 'Status update failed',
        type: 'DatabaseError',
        nonRetryable: false
      }));

      // Act & Assert
      try {
        await createUserWorkflow(email, name, password);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('DatabaseError');
      }

      expect(mockCreateUserInAuth0.called).to.be.false;
      expect(mockSaveAuth0IdToMongoDB.called).to.be.false;
    });

    it('should handle generic error and wrap it', async () => {
      // Arrange
      const email = 'test@example.com';
      const name = 'Test User';
      const password = 'SecurePassword123!';

      mockUpdateUserStatus.resolves();
      mockCreateUserInAuth0.rejects(new Error('Generic error'));

      // Act & Assert
      try {
        await createUserWorkflow(email, name, password);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('UserCreationWorkflowError');
        expect(error.message).to.include('User creation workflow failed');
        expect(error.message).to.include('Generic error');
      }
    });

    it('should handle failure to update status to failed', async () => {
      // Arrange
      const email = 'test@example.com';
      const name = 'Test User';
      const password = 'SecurePassword123!';

      mockUpdateUserStatus.onFirstCall().resolves();
      mockCreateUserInAuth0.rejects(new Error('Auth0 error'));
      mockUpdateUserStatus.onSecondCall().rejects(new Error('Status update failed'));

      // Act & Assert
      try {
        await createUserWorkflow(email, name, password);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('UserCreationWorkflowError');
      }

      // Should have attempted to update status to failed
      expect(mockUpdateUserStatus.callCount).to.equal(2);
    });
  });

  describe('updateUserWorkflow', () => {
    it('should successfully update a user with name and password', async () => {
      // Arrange
      const email = 'test@example.com';
      const updates = { name: 'Updated Name', password: 'NewPassword123!' };
      const organizationId = 'org123';

      mockUpdateUserStatus.resolves();
      mockUpdateUserInAuth0.resolves();

      // Act
      const result = await updateUserWorkflow(email, updates, organizationId);

      // Assert
      expect(result).to.deep.equal({
        success: true,
        message: `User ${email} updated successfully`
      });

      expect(mockUpdateUserStatus.calledWith(email, "updating", organizationId, updates.name)).to.be.true;
      expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
    });

    it('should successfully update a user with only name', async () => {
      // Arrange
      const email = 'test@example.com';
      const updates = { name: 'Updated Name' };

      mockUpdateUserStatus.resolves();
      mockUpdateUserInAuth0.resolves();

      // Act
      const result = await updateUserWorkflow(email, updates);

      // Assert
      expect(result.success).to.be.true;
      expect(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
    });

    it('should successfully update a user with only password', async () => {
      // Arrange
      const email = 'test@example.com';
      const updates = { password: 'NewPassword123!' };

      mockUpdateUserStatus.resolves();
      mockUpdateUserInAuth0.resolves();

      // Act
      const result = await updateUserWorkflow(email, updates);

      // Assert
      expect(result.success).to.be.true;
      expect(mockUpdateUserStatus.calledWith(email, "updating", undefined, undefined)).to.be.true;
    });

    it('should handle updateUserInAuth0 failure', async () => {
      // Arrange
      const email = 'test@example.com';
      const updates = { name: 'Updated Name' };

      mockUpdateUserStatus.resolves();
      mockUpdateUserInAuth0.rejects(ApplicationFailure.create({
        message: 'Auth0 update failed',
        type: 'Auth0Error',
        nonRetryable: false
      }));

      // Act & Assert
      try {
        await updateUserWorkflow(email, updates);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('Auth0Error');
      }

      // Should have tried to update status to "failed"
      expect(mockUpdateUserStatus.callCount).to.equal(2);
      expect(mockUpdateUserStatus.secondCall.calledWith(email, "failed", undefined)).to.be.true;
    });

    it('should handle generic error and wrap it', async () => {
      // Arrange
      const email = 'test@example.com';
      const updates = { name: 'Updated Name' };

      mockUpdateUserStatus.resolves();
      mockUpdateUserInAuth0.rejects(new Error('Generic error'));

      // Act & Assert
      try {
        await updateUserWorkflow(email, updates);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('UserUpdateWorkflowError');
        expect(error.message).to.include('User update workflow failed');
        expect(error.message).to.include('Generic error');
      }
    });
  });

  describe('deleteUserWorkflow', () => {
    it('should successfully delete a user', async () => {
      // Arrange
      const email = 'test@example.com';

      mockUpdateUserStatus.resolves();
      mockDeleteUserFromAuth0.resolves();
      mockDeleteUserFromDB.resolves();

      // Act
      const result = await deleteUserWorkflow(email);

      // Assert
      expect(result).to.deep.equal({
        success: true,
        message: `User ${email} deleted successfully`
      });

      expect(mockUpdateUserStatus.calledWith(email, "deleting")).to.be.true;
      expect(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
      expect(mockDeleteUserFromDB.calledWith(email)).to.be.true;
    });

    it('should handle deleteUserFromAuth0 failure', async () => {
      // Arrange
      const email = 'test@example.com';

      mockUpdateUserStatus.resolves();
      mockDeleteUserFromAuth0.rejects(ApplicationFailure.create({
        message: 'Auth0 deletion failed',
        type: 'Auth0Error',
        nonRetryable: false
      }));

      // Act & Assert
      try {
        await deleteUserWorkflow(email);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('Auth0Error');
      }

      expect(mockDeleteUserFromDB.called).to.be.false;
      // Should have tried to update status to "failed"
      expect(mockUpdateUserStatus.callCount).to.equal(2);
      expect(mockUpdateUserStatus.secondCall.calledWith(email, "failed")).to.be.true;
    });

    it('should handle deleteUserFromDB failure', async () => {
      // Arrange
      const email = 'test@example.com';

      mockUpdateUserStatus.resolves();
      mockDeleteUserFromAuth0.resolves();
      mockDeleteUserFromDB.rejects(ApplicationFailure.create({
        message: 'Database deletion failed',
        type: 'DatabaseError',
        nonRetryable: false
      }));

      // Act & Assert
      try {
        await deleteUserWorkflow(email);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('DatabaseError');
      }

      expect(mockDeleteUserFromAuth0.calledOnce).to.be.true;
      expect(mockDeleteUserFromDB.calledOnce).to.be.true;
    });

    it('should handle generic error and wrap it', async () => {
      // Arrange
      const email = 'test@example.com';

      mockUpdateUserStatus.resolves();
      mockDeleteUserFromAuth0.rejects(new Error('Generic error'));

      // Act & Assert
      try {
        await deleteUserWorkflow(email);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('UserDeletionWorkflowError');
        expect(error.message).to.include('User deletion workflow failed');
        expect(error.message).to.include('Generic error');
      }
    });
  });

  describe('listUsersWorkflow', () => {
    it('should successfully list users with default parameters', async () => {
      // Arrange
      const mockUsers = [
        { user_id: 'auth0|123', email: 'user1@example.com', name: 'User One' },
        { user_id: 'auth0|456', email: 'user2@example.com', name: 'User Two' }
      ];
      const mockResult = {
        users: mockUsers,
        total: 2,
        start: 0,
        limit: 50
      };

      mockListUsersFromAuth0.resolves(mockResult);

      // Act
      const result = await listUsersWorkflow();

      // Assert
      expect(result).to.deep.equal(mockResult);
      expect(mockListUsersFromAuth0.calledWith(0, 50, undefined)).to.be.true;
    });

    it('should successfully list users with custom parameters', async () => {
      // Arrange
      const page = 2;
      const perPage = 25;
      const query = 'email:"*@company.com"';
      const mockResult = {
        users: [],
        total: 100,
        start: 50,
        limit: 25
      };

      mockListUsersFromAuth0.resolves(mockResult);

      // Act
      const result = await listUsersWorkflow(page, perPage, query);

      // Assert
      expect(result).to.deep.equal(mockResult);
      expect(mockListUsersFromAuth0.calledWith(page, perPage, query)).to.be.true;
    });

    it('should handle listUsersFromAuth0 failure', async () => {
      // Arrange
      mockListUsersFromAuth0.rejects(ApplicationFailure.create({
        message: 'Auth0 list failed',
        type: 'Auth0Error',
        nonRetryable: false
      }));

      // Act & Assert
      try {
        await listUsersWorkflow();
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('Auth0Error');
      }
    });

    it('should handle generic error and wrap it', async () => {
      // Arrange
      mockListUsersFromAuth0.rejects(new Error('Generic error'));

      // Act & Assert
      try {
        await listUsersWorkflow();
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(ApplicationFailure);
        expect(error.type).to.equal('ListUsersWorkflowError');
        expect(error.message).to.include('List users workflow failed');
        expect(error.message).to.include('Generic error');
      }
    });

    it('should handle empty user list', async () => {
      // Arrange
      const mockResult = {
        users: [],
        total: 0,
        start: 0,
        limit: 50
      };

      mockListUsersFromAuth0.resolves(mockResult);

      // Act
      const result = await listUsersWorkflow();

      // Assert
      expect(result).to.deep.equal(mockResult);
      expect(result.users).to.have.length(0);
    });
  });
});