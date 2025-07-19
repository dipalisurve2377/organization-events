import { expect } from "chai";
import sinon from "sinon";
import { ApplicationFailure } from "@temporalio/client";

// Mock User model
const UserMock = {
  findOne: sinon.stub(),
  updateOne: sinon.stub(),
  findOneAndUpdate: sinon.stub(),
};

// Mock the updateUserStatus activity function
const updateUserStatus = async (
  email: string,
  status: string,
  organizationId?: string,
  name?: string
): Promise<void> => {
  try {
    console.log(
      `Updating user status - email: ${email}, status: ${status}, organizationId: ${
        organizationId || "none"
      }, name: ${name || "unchanged"}`
    );

    // Validate required parameters
    if (!email || !status) {
      throw ApplicationFailure.create({
        message: `Missing required parameters. Email: ${email}, Status: ${status}`,
        type: "InvalidParameters",
        nonRetryable: true,
      });
    }

    // Validate status values
    const validStatuses = [
      "active",
      "inactive",
      "pending",
      "deleted",
      "suspended",
      "created",
      "updated",
    ];
    if (!validStatuses.includes(status)) {
      throw ApplicationFailure.create({
        message: `Invalid status value: ${status}. Valid values are: ${validStatuses.join(
          ", "
        )}`,
        type: "InvalidStatus",
        nonRetryable: true,
      });
    }

    // Check if user exists
    const user = await UserMock.findOne({ email });

    if (!user) {
      throw ApplicationFailure.create({
        message: `User not found for email: ${email}`,
        type: "UserNotFound",
        nonRetryable: true,
      });
    }

    console.log(`Found user in database: ${user._id}`);

    // Build update object
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (organizationId) {
      updateData.organizationId = organizationId;
    }

    if (name) {
      updateData.name = name;
    }

    // Update user in database
    const result = await UserMock.updateOne({ email }, { $set: updateData });

    if (result.matchedCount === 0) {
      throw ApplicationFailure.create({
        message: `User not found during update for email: ${email}`,
        type: "UserNotFound",
        nonRetryable: true,
      });
    }

    if (result.modifiedCount === 0) {
      console.log(`User status was already ${status} for email: ${email}`);
    } else {
      console.log(
        `Successfully updated user status to ${status} for email: ${email}`
      );
    }
  } catch (error: any) {
    if (error instanceof ApplicationFailure) {
      throw error;
    }

    let errorMessage = `Failed to update user status (email: ${email}, status: ${status})`;
    let errorType = "DatabaseError";
    let nonRetryable = false;

    // Handle specific database errors
    if (error.name === "MongoError" || error.name === "MongoServerError") {
      if (error.code === 11000) {
        // Duplicate key error
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
    } else if (error.name === "CastError") {
      // Invalid ObjectId or similar
      errorType = "DatabaseCastError";
      nonRetryable = true;
      errorMessage += `. Invalid data format: ${error.message}`;
    } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      errorType = "NetworkError";
      nonRetryable = false;
      errorMessage += `. Network error: ${error.message}`;
    } else if (error.name === "ValidationError") {
      errorType = "DatabaseValidationError";
      nonRetryable = true;
      errorMessage += `. Validation error: ${error.message}`;
    } else {
      errorMessage += `. ${error.message}`;
    }

    console.error("Error updating user status:", error);
    throw ApplicationFailure.create({
      message: errorMessage,
      type: errorType,
      nonRetryable,
    });
  }
};

describe("updateUserStatus", () => {
  beforeEach(() => {
    UserMock.findOne.reset();
    UserMock.updateOne.reset();
    UserMock.findOneAndUpdate.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should successfully update user status with minimal parameters", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = {
      _id: "user123",
      email,
      name: "Test User",
      status: "pending",
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.updateOne.resolves({ matchedCount: 1, modifiedCount: 1 });

    // Act
    await updateUserStatus(email, status);

    // Assert
    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(UserMock.updateOne.calledOnce).to.be.true;

    const [filter, update] = UserMock.updateOne.firstCall.args;
    expect(filter).to.deep.equal({ email });
    expect(update.$set.status).to.equal(status);
    expect(update.$set.updatedAt).to.be.instanceOf(Date);
    expect(update.$set.organizationId).to.be.undefined;
    expect(update.$set.name).to.be.undefined;
  });

  it("should successfully update user status with all parameters", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const organizationId = "org123";
    const name = "Updated User Name";
    const mockUser = {
      _id: "user123",
      email,
      name: "Test User",
      status: "pending",
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.updateOne.resolves({ matchedCount: 1, modifiedCount: 1 });

    // Act
    await updateUserStatus(email, status, organizationId, name);

    // Assert
    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(UserMock.updateOne.calledOnce).to.be.true;

    const [filter, update] = UserMock.updateOne.firstCall.args;
    expect(filter).to.deep.equal({ email });
    expect(update.$set.status).to.equal(status);
    expect(update.$set.organizationId).to.equal(organizationId);
    expect(update.$set.name).to.equal(name);
    expect(update.$set.updatedAt).to.be.instanceOf(Date);
  });

  it("should handle user not found during initial lookup", async () => {
    // Arrange
    const email = "nonexistent@example.com";
    const status = "active";

    UserMock.findOne.resolves(null);

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("UserNotFound");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include(`User not found for email: ${email}`);
    }

    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(UserMock.updateOne.called).to.be.false;
  });

  it("should handle missing email parameter", async () => {
    // Arrange
    const email = "";
    const status = "active";

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("InvalidParameters");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include("Missing required parameters");
    }

    expect(UserMock.findOne.called).to.be.false;
    expect(UserMock.updateOne.called).to.be.false;
  });

  it("should handle missing status parameter", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "";

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("InvalidParameters");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include("Missing required parameters");
    }

    expect(UserMock.findOne.called).to.be.false;
    expect(UserMock.updateOne.called).to.be.false;
  });

  it("should handle invalid status value", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "invalid_status";

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("InvalidStatus");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include(`Invalid status value: ${status}`);
      expect(error.message).to.include(
        "Valid values are: active, inactive, pending, deleted, suspended, created, updated"
      );
    }

    expect(UserMock.findOne.called).to.be.false;
    expect(UserMock.updateOne.called).to.be.false;
  });

  it("should handle all valid status values", async () => {
    // Arrange
    const email = "test@example.com";
    const validStatuses = [
      "active",
      "inactive",
      "pending",
      "deleted",
      "suspended",
      "created",
      "updated",
    ];
    const mockUser = { _id: "user123", email, name: "Test User" };

    UserMock.findOne.resolves(mockUser);
    UserMock.updateOne.resolves({ matchedCount: 1, modifiedCount: 1 });

    // Act & Assert
    for (const status of validStatuses) {
      UserMock.findOne.reset();
      UserMock.updateOne.reset();

      UserMock.findOne.resolves(mockUser);
      UserMock.updateOne.resolves({ matchedCount: 1, modifiedCount: 1 });

      await updateUserStatus(email, status);

      expect(UserMock.updateOne.calledOnce).to.be.true;
      const [, update] = UserMock.updateOne.firstCall.args;
      expect(update.$set.status).to.equal(status);
    }
  });

  it("should handle user not found during update (matchedCount = 0)", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = { _id: "user123", email, name: "Test User" };

    UserMock.findOne.resolves(mockUser);
    UserMock.updateOne.resolves({ matchedCount: 0, modifiedCount: 0 });

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("UserNotFound");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include("User not found during update");
    }
  });

  it("should handle no modifications (modifiedCount = 0)", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = {
      _id: "user123",
      email,
      name: "Test User",
      status: "active",
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.updateOne.resolves({ matchedCount: 1, modifiedCount: 0 });

    // Act
    await updateUserStatus(email, status);

    // Assert - should not throw error, just log that status was already set
    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(UserMock.updateOne.calledOnce).to.be.true;
  });

  it("should handle MongoDB connection errors as retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = { _id: "user123", email };

    UserMock.findOne.resolves(mockUser);

    const mongoError = new Error("Connection timeout") as any;
    mongoError.name = "MongoError";
    mongoError.code = 89;
    UserMock.updateOne.rejects(mongoError);

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("DatabaseConnectionError");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("Failed to update user status");
      expect(error.message).to.include("MongoDB Error: Connection timeout");
    }
  });

  it("should handle MongoDB duplicate key errors as non-retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = { _id: "user123", email };

    UserMock.findOne.resolves(mockUser);

    const mongoError = new Error("Duplicate key error") as any;
    mongoError.name = "MongoError";
    mongoError.code = 11000;
    UserMock.updateOne.rejects(mongoError);

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("DatabaseConstraintError");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include("Failed to update user status");
      expect(error.message).to.include("MongoDB Error: Duplicate key error");
    }
  });

  it("should handle MongoDB validation errors as non-retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = { _id: "user123", email };

    UserMock.findOne.resolves(mockUser);

    const mongoError = new Error("Document validation failed") as any;
    mongoError.name = "MongoError";
    mongoError.code = 121;
    UserMock.updateOne.rejects(mongoError);

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("DatabaseValidationError");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include("Failed to update user status");
      expect(error.message).to.include(
        "MongoDB Error: Document validation failed"
      );
    }
  });

  it("should handle CastError as non-retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = { _id: "user123", email };

    UserMock.findOne.resolves(mockUser);

    const castError = new Error("Cast to ObjectId failed") as any;
    castError.name = "CastError";
    UserMock.updateOne.rejects(castError);

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("DatabaseCastError");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include("Failed to update user status");
      expect(error.message).to.include(
        "Invalid data format: Cast to ObjectId failed"
      );
    }
  });

  it("should handle network errors as retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = { _id: "user123", email };

    UserMock.findOne.resolves(mockUser);

    const networkError = new Error("Connection refused") as any;
    networkError.code = "ECONNREFUSED";
    UserMock.updateOne.rejects(networkError);

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("NetworkError");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("Failed to update user status");
      expect(error.message).to.include("Network error: Connection refused");
    }
  });

  it("should handle ValidationError as non-retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = { _id: "user123", email };

    UserMock.findOne.resolves(mockUser);

    const validationError = new Error("Validation failed") as any;
    validationError.name = "ValidationError";
    UserMock.updateOne.rejects(validationError);

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("DatabaseValidationError");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include("Failed to update user status");
      expect(error.message).to.include("Validation error: Validation failed");
    }
  });

  it("should handle generic errors as retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = { _id: "user123", email };

    UserMock.findOne.resolves(mockUser);
    UserMock.updateOne.rejects(new Error("Generic database error"));

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("DatabaseError");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("Failed to update user status");
      expect(error.message).to.include("Generic database error");
    }
  });

  it("should handle findOne database errors", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";

    UserMock.findOne.rejects(new Error("Database connection failed"));

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("DatabaseError");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("Failed to update user status");
      expect(error.message).to.include("Database connection failed");
    }
  });

  it("should handle special characters in email", async () => {
    // Arrange
    const email = "test+user@example-domain.com";
    const status = "active";
    const mockUser = {
      _id: "user123",
      email,
      name: "Test User",
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.updateOne.resolves({ matchedCount: 1, modifiedCount: 1 });

    // Act
    await updateUserStatus(email, status);

    // Assert
    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(UserMock.updateOne.calledOnce).to.be.true;
  });

  it("should handle unicode characters in name", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const name = "José María Ñoño 测试用户 🚀";
    const mockUser = {
      _id: "user123",
      email,
      name: "Test User",
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.updateOne.resolves({ matchedCount: 1, modifiedCount: 1 });

    // Act
    await updateUserStatus(email, status, undefined, name);

    // Assert
    const [, update] = UserMock.updateOne.firstCall.args;
    expect(update.$set.name).to.equal(name);
  });

  it("should handle very long organization IDs", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const organizationId = "a".repeat(1000); // Very long org ID
    const mockUser = {
      _id: "user123",
      email,
      name: "Test User",
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.updateOne.resolves({ matchedCount: 1, modifiedCount: 1 });

    // Act
    await updateUserStatus(email, status, organizationId);

    // Assert
    const [, update] = UserMock.updateOne.firstCall.args;
    expect(update.$set.organizationId).to.equal(organizationId);
  });

  it("should handle null and undefined optional parameters", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = {
      _id: "user123",
      email,
      name: "Test User",
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.updateOne.resolves({ matchedCount: 1, modifiedCount: 1 });

    // Act
    await updateUserStatus(email, status, null as any, undefined);

    // Assert
    const [, update] = UserMock.updateOne.firstCall.args;
    expect(update.$set.status).to.equal(status);
    expect(update.$set.updatedAt).to.be.instanceOf(Date);
    expect(update.$set.organizationId).to.be.undefined;
    expect(update.$set.name).to.be.undefined;
  });

  it("should handle empty string optional parameters", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const organizationId = "";
    const name = "";
    const mockUser = {
      _id: "user123",
      email,
      name: "Test User",
    };

    UserMock.findOne.resolves(mockUser);
    UserMock.updateOne.resolves({ matchedCount: 1, modifiedCount: 1 });

    // Act
    await updateUserStatus(email, status, organizationId, name);

    // Assert
    const [, update] = UserMock.updateOne.firstCall.args;
    expect(update.$set.status).to.equal(status);
    expect(update.$set.updatedAt).to.be.instanceOf(Date);
    expect(update.$set.organizationId).to.be.undefined;
    expect(update.$set.name).to.be.undefined;
  });

  it("should handle MongoServerError as retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const status = "active";
    const mockUser = { _id: "user123", email };

    UserMock.findOne.resolves(mockUser);

    const mongoError = new Error("Server error") as any;
    mongoError.name = "MongoServerError";
    mongoError.code = 13;
    UserMock.updateOne.rejects(mongoError);

    // Act & Assert
    try {
      await updateUserStatus(email, status);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("DatabaseConnectionError");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("Failed to update user status");
      expect(error.message).to.include("MongoDB Error: Server error");
    }
  });
});
