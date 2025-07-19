import { expect } from 'chai';
import sinon from 'sinon';
import { ApplicationFailure } from '@temporalio/client';

// Mock User model
const UserMock = {
  findOne: sinon.stub(),
  deleteOne: sinon.stub(),
  findOneAndDelete: sinon.stub()
};

// Mock the deleteUserFromDB activity function
const deleteUserFromDB = async (email: string): Promise<void> => {
  try {
    console.log(`Attempting to delete user from database: ${email}`);

    const user = await UserMock.findOne({ email });

    if (!user) {
      throw ApplicationFailure.create({
        message: `User not found in database for email: ${email}`,
        type: "UserNotFound",
        nonRetryable: true,
      });
    }

    console.log(`Found user in database: ${user._id}`);

    const result = await UserMock.deleteOne({ email });

    if (result.deletedCount === 0) {
      throw ApplicationFailure.create({
        message: `Failed to delete user from database (email: ${email}). No documents were deleted.`,
        type: "DatabaseDeleteError",
        nonRetryable: false,
      });
    }

    console.log(`Successfully deleted user from database: ${email}`);
  } catch (error: any) {
    if (error instanceof ApplicationFailure) {
      throw error;
    }

    let errorMessage = `Failed to delete user from database (email: ${email})`;
    let errorType = "DatabaseError";
    let nonRetryable = false;

    // Handle specific database errors
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      if (error.code === 11000) {
        // Duplicate key error (shouldn't happen in delete, but just in case)
        errorType = "DatabaseConstraintError";
        nonRetryable = true;
      } else if (error.code === 121) {
        // Document validation error
        errorType = "DatabaseValidationError";
        nonRetryable = true;
      } else {
        errorType = "DatabaseConnectionError";
        nonRetryable = false;
      }
      errorMessage += `. MongoDB Error: ${error.message}`;
    } else if (error.name === 'CastError') {
      // Invalid ObjectId or similar
      errorType = "DatabaseCastError";
      nonRetryable = true;
      errorMessage += `. Invalid data format: ${error.message}`;
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorType = "NetworkError";
      nonRetryable = false;
      errorMessage += `. Network error: ${error.message}`;
    } else if (error.name === 'ValidationError') {
      errorType = "DatabaseValidationError";
      nonRetryable = true;
      errorMessage += `. Validation error: ${error.message}`;
    } else {
      errorMessage += `. ${error.message}`;
    }

    console.error("Error deleting user from database:", error);
    throw ApplicationFailure.create({
      message: errorMessage,
      type: errorType,
      nonRetryable,
    });
  }
};

describe('deleteUserFromDB', () => {
  beforeEach(() => {
    UserMock.findOne.reset();
    UserMock.deleteOne.reset();
    UserMock.findOneAndDelete.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should successfully delete user from database', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { 
      _id: 'user123', 
      email, 
      name: 'Test User',
      auth0Id: 'auth0|123456789'
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.deleteOne.resolves({ deletedCount: 1 });

    // Act
    await deleteUserFromDB(email);

    // Assert
    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(UserMock.deleteOne.calledWith({ email })).to.be.true;
  });

  it('should handle user not found in database', async () => {
    // Arrange
    const email = 'nonexistent@example.com';

    UserMock.findOne.resolves(null);

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('UserNotFound');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include(`User not found in database for email: ${email}`);
    }

    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(UserMock.deleteOne.called).to.be.false;
  });

  it('should handle deleteOne returning zero deleted count', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { 
      _id: 'user123', 
      email, 
      name: 'Test User'
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.deleteOne.resolves({ deletedCount: 0 });

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseDeleteError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to delete user from database');
      expect(error.message).to.include('No documents were deleted');
    }
  });

  it('should handle MongoDB connection errors as retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { _id: 'user123', email };

    UserMock.findOne.resolves(mockUser);
    
    const mongoError = new Error('Connection timeout');
    mongoError.name = 'MongoError';
    mongoError.code = 89; // Connection timeout
    UserMock.deleteOne.rejects(mongoError);

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseConnectionError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to delete user from database');
      expect(error.message).to.include('MongoDB Error: Connection timeout');
    }
  });

  it('should handle MongoDB duplicate key errors as non-retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { _id: 'user123', email };

    UserMock.findOne.resolves(mockUser);
    
    const mongoError = new Error('Duplicate key error');
    mongoError.name = 'MongoError';
    mongoError.code = 11000;
    UserMock.deleteOne.rejects(mongoError);

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseConstraintError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Failed to delete user from database');
      expect(error.message).to.include('MongoDB Error: Duplicate key error');
    }
  });

  it('should handle MongoDB validation errors as non-retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { _id: 'user123', email };

    UserMock.findOne.resolves(mockUser);
    
    const mongoError = new Error('Document validation failed');
    mongoError.name = 'MongoError';
    mongoError.code = 121;
    UserMock.deleteOne.rejects(mongoError);

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseValidationError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Failed to delete user from database');
      expect(error.message).to.include('MongoDB Error: Document validation failed');
    }
  });

  it('should handle CastError as non-retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { _id: 'user123', email };

    UserMock.findOne.resolves(mockUser);
    
    const castError = new Error('Cast to ObjectId failed');
    castError.name = 'CastError';
    UserMock.deleteOne.rejects(castError);

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseCastError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Failed to delete user from database');
      expect(error.message).to.include('Invalid data format: Cast to ObjectId failed');
    }
  });

  it('should handle network errors as retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { _id: 'user123', email };

    UserMock.findOne.resolves(mockUser);
    
    const networkError = new Error('Connection refused');
    networkError.code = 'ECONNREFUSED';
    UserMock.deleteOne.rejects(networkError);

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('NetworkError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to delete user from database');
      expect(error.message).to.include('Network error: Connection refused');
    }
  });

  it('should handle ValidationError as non-retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { _id: 'user123', email };

    UserMock.findOne.resolves(mockUser);
    
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';
    UserMock.deleteOne.rejects(validationError);

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseValidationError');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('Failed to delete user from database');
      expect(error.message).to.include('Validation error: Validation failed');
    }
  });

  it('should handle generic errors as retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { _id: 'user123', email };

    UserMock.findOne.resolves(mockUser);
    UserMock.deleteOne.rejects(new Error('Generic database error'));

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to delete user from database');
      expect(error.message).to.include('Generic database error');
    }
  });

  it('should handle findOne database errors', async () => {
    // Arrange
    const email = 'test@example.com';

    UserMock.findOne.rejects(new Error('Database connection failed'));

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to delete user from database');
      expect(error.message).to.include('Database connection failed');
    }
  });

  it('should handle special characters in email', async () => {
    // Arrange
    const email = 'test+user@example-domain.com';
    const mockUser = { 
      _id: 'user123', 
      email, 
      name: 'Test User'
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.deleteOne.resolves({ deletedCount: 1 });

    // Act
    await deleteUserFromDB(email);

    // Assert
    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(UserMock.deleteOne.calledWith({ email })).to.be.true;
  });

  it('should handle unicode characters in email', async () => {
    // Arrange
    const email = 'tëst@exämple.com';
    const mockUser = { 
      _id: 'user123', 
      email, 
      name: 'Tëst Üser'
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.deleteOne.resolves({ deletedCount: 1 });

    // Act
    await deleteUserFromDB(email);

    // Assert
    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(UserMock.deleteOne.calledWith({ email })).to.be.true;
  });

  it('should handle empty email string', async () => {
    // Arrange
    const email = '';

    UserMock.findOne.resolves(null);

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('UserNotFound');
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include('User not found in database for email: ');
    }
  });

  it('should handle ENOTFOUND network error', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { _id: 'user123', email };

    UserMock.findOne.resolves(mockUser);
    
    const networkError = new Error('Domain not found');
    networkError.code = 'ENOTFOUND';
    UserMock.deleteOne.rejects(networkError);

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('NetworkError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to delete user from database');
      expect(error.message).to.include('Network error: Domain not found');
    }
  });

  it('should handle MongoServerError as retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { _id: 'user123', email };

    UserMock.findOne.resolves(mockUser);
    
    const mongoError = new Error('Server error');
    mongoError.name = 'MongoServerError';
    mongoError.code = 13; // Unauthorized
    UserMock.deleteOne.rejects(mongoError);

    // Act & Assert
    try {
      await deleteUserFromDB(email);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('DatabaseConnectionError');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('Failed to delete user from database');
      expect(error.message).to.include('MongoDB Error: Server error');
    }
  });

  it('should handle user with complex data structure', async () => {
    // Arrange
    const email = 'test@example.com';
    const mockUser = { 
      _id: 'user123', 
      email,
      name: 'Test User',
      auth0Id: 'auth0|123456789',
      profile: {
        firstName: 'Test',
        lastName: 'User',
        preferences: {
          theme: 'dark',
          notifications: true
        }
      },
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-12-01'),
      roles: ['user', 'admin']
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.deleteOne.resolves({ deletedCount: 1 });

    // Act
    await deleteUserFromDB(email);

    // Assert
    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(UserMock.deleteOne.calledWith({ email })).to.be.true;
  });

  it('should handle very long email addresses', async () => {
    // Arrange
    const longEmail = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com';
    const mockUser = { 
      _id: 'user123', 
      email: longEmail,
      name: 'Test User'
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.deleteOne.resolves({ deletedCount: 1 });

    // Act
    await deleteUserFromDB(longEmail);

    // Assert
    expect(UserMock.findOne.calledWith({ email: longEmail })).to.be.true;
    expect(UserMock.deleteOne.calledWith({ email: longEmail })).to.be.true;
  });
});