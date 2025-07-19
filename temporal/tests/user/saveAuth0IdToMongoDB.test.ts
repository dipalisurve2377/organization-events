import { expect } from "chai";
import sinon from "sinon";
import mongoose from "mongoose";
import { ApplicationFailure } from "@temporalio/client";

// Mock User model
const UserMock = {
  findOneAndUpdate: sinon.stub(),
  findOne: sinon.stub(),
  create: sinon.stub(),
};

// Mock the saveAuth0IdToMongoDB activity function
const saveAuth0IdToMongoDB = async (
  email: string,
  auth0Id: string
): Promise<void> => {
  try {
    console.log(`Attempting to save Auth0 ID for user: ${email}`);

    const result = await UserMock.findOneAndUpdate(
      { email },
      { auth0Id, status: "created" },
      { upsert: true, new: true }
    );

    if (!result) {
      throw ApplicationFailure.create({
        message: `User not found with the email: ${email}`,
        type: "MongoUserUpdateError",
        nonRetryable: true,
      });
    }

    console.log(`Saved Auth0 ID to MongoDB: ${auth0Id} for ${email}`);
  } catch (error: any) {
    console.error("MongoDB update failed");

    if (error instanceof ApplicationFailure) {
      throw error;
    }

    throw ApplicationFailure.create({
      message: `MongoDB update failed for user: ${email}. Reason: ${error.message}`,
      type: "MongoUserUpdateFailure",
      nonRetryable: false,
    });
  }
};

describe("saveAuth0IdToMongoDB", () => {
  beforeEach(() => {
    UserMock.findOneAndUpdate.reset();
    UserMock.findOne.reset();
    UserMock.create.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should successfully save Auth0 ID to MongoDB", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const mockResult = {
      _id: new mongoose.Types.ObjectId(),
      email,
      auth0Id,
      status: "created",
      name: "Test User",
    };

    UserMock.findOneAndUpdate.resolves(mockResult);

    // Act
    await saveAuth0IdToMongoDB(email, auth0Id);

    // Assert
    expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
    const [filter, update, options] = UserMock.findOneAndUpdate.firstCall.args;
    expect(filter).to.deep.equal({ email });
    expect(update).to.deep.equal({ auth0Id, status: "created" });
    expect(options).to.deep.equal({ upsert: true, new: true });
  });

  it("should handle user not found as non-retryable error", async () => {
    // Arrange
    const email = "nonexistent@example.com";
    const auth0Id = "auth0|123456789";

    UserMock.findOneAndUpdate.resolves(null);

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(email, auth0Id);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.message).to.equal(`User not found with the email: ${email}`);
      expect(error.type).to.equal("MongoUserUpdateError");
      expect(error.nonRetryable).to.be.true;
    }
  });

  it("should handle MongoDB update errors as retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";

    UserMock.findOneAndUpdate.rejects(new Error("Connection timeout"));

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(email, auth0Id);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.message).to.include(
        `MongoDB update failed for user: ${email}`
      );
      expect(error.message).to.include("Connection timeout");
      expect(error.type).to.equal("MongoUserUpdateFailure");
      expect(error.nonRetryable).to.be.false;
    }
  });

  it("should handle network timeout errors as retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";

    UserMock.findOneAndUpdate.rejects(
      new Error("MongoNetworkTimeoutError: connection timed out")
    );

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(email, auth0Id);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("MongoUserUpdateFailure");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("MongoNetworkTimeoutError");
    }
  });

  it("should handle empty email", async () => {
    // Arrange
    const email = "";
    const auth0Id = "auth0|123456789";

    UserMock.findOneAndUpdate.resolves(null);

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(email, auth0Id);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.message).to.equal("User not found with the email: ");
      expect(error.type).to.equal("MongoUserUpdateError");
      expect(error.nonRetryable).to.be.true;
    }
  });

  it("should handle empty auth0Id", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "";
    const mockResult = {
      _id: new mongoose.Types.ObjectId(),
      email,
      auth0Id,
      status: "created",
    };

    UserMock.findOneAndUpdate.resolves(mockResult);

    // Act
    await saveAuth0IdToMongoDB(email, auth0Id);

    // Assert
    expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
    const [, update] = UserMock.findOneAndUpdate.firstCall.args;
    expect(update.auth0Id).to.equal("");
  });

  it("should handle duplicate key errors as retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const duplicateError = new Error("E11000 duplicate key error");

    UserMock.findOneAndUpdate.rejects(duplicateError);

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(email, auth0Id);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("MongoUserUpdateFailure");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("E11000 duplicate key error");
    }
  });

  it("should handle valid update with special characters in email", async () => {
    // Arrange
    const email = "user+test@example-domain.com";
    const auth0Id = "auth0|special123";
    const mockResult = {
      _id: new mongoose.Types.ObjectId(),
      email,
      auth0Id,
      status: "created",
      name: "Test User",
    };

    UserMock.findOneAndUpdate.resolves(mockResult);

    // Act
    await saveAuth0IdToMongoDB(email, auth0Id);

    // Assert
    expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
    const [filter, update] = UserMock.findOneAndUpdate.firstCall.args;
    expect(filter.email).to.equal(email);
    expect(update.auth0Id).to.equal(auth0Id);
  });

  it("should handle MongoDB connection errors as retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";

    UserMock.findOneAndUpdate.rejects(
      new Error("MongooseServerSelectionError: connection failed")
    );

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(email, auth0Id);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("MongoUserUpdateFailure");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("MongooseServerSelectionError");
    }
  });

  it("should handle long email addresses", async () => {
    // Arrange
    const email =
      "very.long.email.address.with.many.dots@very-long-domain-name.example.com";
    const auth0Id = "auth0|longuser123456789";
    const mockResult = {
      _id: new mongoose.Types.ObjectId(),
      email,
      auth0Id,
      status: "created",
    };

    UserMock.findOneAndUpdate.resolves(mockResult);

    // Act
    await saveAuth0IdToMongoDB(email, auth0Id);

    // Assert
    expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
    const [filter, update] = UserMock.findOneAndUpdate.firstCall.args;
    expect(filter.email).to.equal(email);
    expect(update.auth0Id).to.equal(auth0Id);
    expect(update.status).to.equal("created");
  });

  it("should handle special characters in auth0Id", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|user-with_special.chars123";
    const mockResult = {
      _id: new mongoose.Types.ObjectId(),
      email,
      auth0Id,
      status: "created",
    };

    UserMock.findOneAndUpdate.resolves(mockResult);

    // Act
    await saveAuth0IdToMongoDB(email, auth0Id);

    // Assert
    expect(UserMock.findOneAndUpdate.calledOnce).to.be.true;
    const [, update] = UserMock.findOneAndUpdate.firstCall.args;
    expect(update.auth0Id).to.equal(auth0Id);
  });

  it("should handle database write concern errors as retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";

    UserMock.findOneAndUpdate.rejects(
      new Error("WriteConcernError: majority write concern failed")
    );

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(email, auth0Id);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("MongoUserUpdateFailure");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("WriteConcernError");
    }
  });
});
