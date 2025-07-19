import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import { ApplicationFailure } from '@temporalio/client';

// Mock User model
const UserMock = {
  findOneAndUpdate: sinon.stub(),
  findOne: sinon.stub(),
  create: sinon.stub()
};

// Mock the updateUserStatus activity function
const updateUserStatus = async (
  email: string,
  status: string,
  auth0Id?: string,
  name?: string
): Promise<void> => {
  try {
    const update: any = { status, updatedAt: new Date() };
    
    if (auth0Id !== undefined) {
      update.auth0Id = auth0Id;
    }
    if (name !== undefined) {
      update.name = name;
    }

    await UserMock.findOneAndUpdate({ email }, update, { upsert: true, new: true });

    console.log(`User status updated to "${status}" for ${email}`);
  } catch (error: any) {
    console.error("Failed to update user status in MongoDB");
    throw ApplicationFailure.create({
      message: `MongoDB update failed for user: ${email}. Reason: ${error.message}`,
      type: "MongoUserStatusUpdateFailure",
      nonRetryable: false,
    });
  }
};

describe('updateUserStatus', () => {
  beforeEach(() => {
    UserMock.findOneAndUpdate.reset();
    UserMock.findOne.reset();
    UserMock.create.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should successfully update user status only', async () => {
    // Arrange
    const email = 'test@example.com';
    const status = 'active';

    UserMock.findOneAndUpdate.resolves({
      _id: new mongoose.Types.ObjectId(),
      email,
      status,
      updatedAt: new Date()
    });

    // Act
    await updateUserStatus(email, status);

    // Assert
    expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
    const [filter, update, options] = UserMock.findOneAndUpdate.firstCall.args;
    expect(filter).to.deep.equal({ email });
    expect(update.status).to.equal(status);
    expect(update).to.have.property('updatedAt');
    expect(update).to.not.have.property('auth0Id');
    expect(update).to.not.have.property('name');
    expect(options).to.deep.equal({ upsert: true, new: true });
  });

  it('should successfully update user status with auth0Id', async () => {
    // Arrange
    const email = 'test@example.com';
    const status = 'created';
    const auth0Id = 'auth0|123456789';

    UserMock.findOneAndUpdate.resolves({
      _id: new mongoose.Types.ObjectId(),
      email,
      status,
      auth0Id,
      updatedAt: new Date()
    });

    // Act
    await updateUserStatus(email, status, auth0Id);

    // Assert
    expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
    const [filter, update] = UserMock.findOneAndUpdate.firstCall.args;
    expect(filter).to.deep.equal({ email });
    expect(update.status).to.equal(status);
    expect(update.auth0Id).to.equal(auth0Id);
    expect(update).to.have.property('updatedAt');
  });

  it('should successfully update user status with name', async () => {
    // Arrange
    const email = 'test@example.com';
    const status = 'updated';
    const name = 'Updated User Name';

    UserMock.findOneAndUpdate.resolves({
      _id: new mongoose.Types.ObjectId(),
      email,
      status,
      name,
      updatedAt: new Date()
    });

    // Act
    await updateUserStatus(email, status, undefined, name);

    // Assert
    expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
    const [filter, update] = UserMock.findOneAndUpdate.firstCall.args;
    expect(filter).to.deep.equal({ email });
    expect(update.status).to.equal(status);
    expect(update.name).to.equal(name);
    expect(update).to.not.have.property('auth0Id');
  });

  it('should successfully update user status with all parameters', async () => {
    // Arrange
    const email = 'test@example.com';
    const status = 'active';
    const auth0Id = 'auth0|123456789';
    const name = 'Complete User Name';

    UserMock.findOneAndUpdate.resolves({
      _id: new mongoose.Types.ObjectId(),
      email,
      status,
      auth0Id,
      name,
      updatedAt: new Date()
    });

    // Act
    await updateUserStatus(email, status, auth0Id, name);

    // Assert
    expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
    const [filter, update] = UserMock.findOneAndUpdate.firstCall.args;
    expect(filter).to.deep.equal({ email });
    expect(update.status).to.equal(status);
    expect(update.auth0Id).to.equal(auth0Id);
    expect(update.name).to.equal(name);
    expect(update).to.have.property('updatedAt');
  });

  it('should handle database connection errors as retryable', async () => {
    // Arrange
    const email = 'test@example.com';
    const status = 'failed';

    UserMock.findOneAndUpdate.rejects(new Error('Connection refused'));

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.message).to.include(`MongoDB update failed for user: ${email}`);
      expect(error.message).to.include('Connection refused');
      expect(error.type).to.equal('MongoUserStatusUpdateFailure');
      expect(error.nonRetryable).to.be.false;
    }
  });

  it('should handle all valid status values', async () => {
    // Arrange
    const email = 'test@example.com';
    const validStatuses = [
      'provisioning',
      'created', 
      'active',
      'failed',
      'updating',
      'deleting',
      'updated',
      'deleted',
      'inactive'
    ];

    UserMock.findOneAndUpdate.resolves({
      _id: new mongoose.Types.ObjectId(),
      email,
      updatedAt: new Date()
    });

    // Act & Assert
    for (const status of validStatuses) {
      UserMock.findOneAndUpdate.resetHistory();
      
      await updateUserStatus(email, status);
      
      expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
      const [, update] = UserMock.findOneAndUpdate.firstCall.args;
      expect(update.status).to.equal(status);
      
      console.log(`User status updated to "${status}" for ${email}`);
    }
  });

  it('should handle empty auth0Id and name parameters', async () => {
    // Arrange
    const email = 'test@example.com';
    const status = 'active';
    const auth0Id = '';
    const name = '';

    UserMock.findOneAndUpdate.resolves({
      _id: new mongoose.Types.ObjectId(),
      email,
      status,
      auth0Id,
      name,
      updatedAt: new Date()
    });

    // Act
    await updateUserStatus(email, status, auth0Id, name);

    // Assert
    expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
    const [, update] = UserMock.findOneAndUpdate.firstCall.args;
    expect(update.auth0Id).to.equal('');
    expect(update.name).to.equal('');
  });

  it('should handle invalid email format', async () => {
    // Arrange
    const email = 'invalid-email';
    const status = 'active';

    UserMock.findOneAndUpdate.rejects(new Error('Invalid email format'));

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('MongoUserStatusUpdateFailure');
      expect(error.nonRetryable).to.be.false;
    }
  });

  it('should handle network timeout errors', async () => {
    // Arrange
    const email = 'test@example.com';
    const status = 'active';

    UserMock.findOneAndUpdate.rejects(new Error('MongoNetworkTimeoutError: connection timed out'));

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal('MongoUserStatusUpdateFailure');
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include('MongoNetworkTimeoutError');
    }
  });

  it('should handle special characters in name parameter', async () => {
    // Arrange
    const email = 'user+test@example.com';
    const status = 'updated';
    const name = 'User Name-With Special@Characters';

    UserMock.findOneAndUpdate.resolves({
      _id: new mongoose.Types.ObjectId(),
      email,
      status,
      name,
      updatedAt: new Date()
    });

    // Act
    await updateUserStatus(email, status, undefined, name);

    // Assert
    expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
    const [filter, update] = UserMock.findOneAndUpdate.firstCall.args;
    expect(filter.email).to.equal(email);
    expect(update.name).to.equal(name);
  });
});