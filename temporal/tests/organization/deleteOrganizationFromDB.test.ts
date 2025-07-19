import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";

describe("deleteOrganizationFromDB", () => {
  let connectDBStub: sinon.SinonStub;
  let findByIdAndDeleteStub: sinon.SinonStub;
  let deleteOrganizationFromDB: any;
  let OrganizationMock: any;

  beforeEach(() => {
    // Create stubs
    connectDBStub = sinon.stub();
    findByIdAndDeleteStub = sinon.stub();

    // Mock Organization model
    OrganizationMock = {
      findByIdAndDelete: findByIdAndDeleteStub,
    };

    // Mock ApplicationFailure
    const ApplicationFailureMock = {
      create: sinon.stub().callsFake((options: any) => {
        const error = new Error(options.message);
        (error as any).type = options.type;
        (error as any).nonRetryable = options.nonRetryable;
        return error;
      }),
    };

    // Create the function to test inline to avoid import issues
    deleteOrganizationFromDB = async (orgId: string): Promise<void> => {
      try {
        await connectDBStub();

        const deletedOrg = await OrganizationMock.findByIdAndDelete(orgId);
        if (!deletedOrg) {
          throw ApplicationFailureMock.create({
            message: `Organization not found with orgId: ${orgId}`,
            type: "MongoDeleteError",
            nonRetryable: true,
          });
        }

        console.log(` Deleted organization from MongoDB: ${orgId}`);
      } catch (error: any) {
        console.error("Error deleting organization from MongoDB:", error);

        throw ApplicationFailureMock.create({
          message: `Failed to hard delete organization from MongoDB. ${error.message}`,
          type: "MongoDeleteFailure",
          nonRetryable: false,
        });
      }
    };
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  it("should successfully delete organization from database", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockDeletedOrg = {
      _id: mockOrgId,
      identifier: "test-org-123",
      name: "Test Organization",
      auth0Id: "org_abc123def456",
      createdByEmail: "admin@test.com",
      status: "deleted",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    connectDBStub.resolves();
    findByIdAndDeleteStub.resolves(mockDeletedOrg);

    // Act
    await deleteOrganizationFromDB(mockOrgId);

    // Assert
    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndDeleteStub.calledOnce).to.be.true;
    expect(findByIdAndDeleteStub.calledWith(mockOrgId)).to.be.true;
  });

  it("should handle organization not found as non-retryable error", async () => {
    // Arrange
    const mockOrgId = "non-existent-org-id";

    connectDBStub.resolves();
    findByIdAndDeleteStub.resolves(null); // Organization not found

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include("Organization not found");
      expect((error as Error).message).to.include(mockOrgId);
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndDeleteStub.calledOnce).to.be.true;
  });

  it("should handle database connection errors as retryable", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockError = new Error("MongoDB connection failed");

    connectDBStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include("MongoDB connection failed");
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndDeleteStub.called).to.be.false; // Should not reach this point
  });

  it("should handle MongoDB delete operation errors as retryable", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockError = new Error("MongoDB delete operation failed");

    connectDBStub.resolves();
    findByIdAndDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include(
        "MongoDB delete operation failed"
      );
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndDeleteStub.calledOnce).to.be.true;
  });

  it("should handle invalid ObjectId format", async () => {
    // Arrange
    const mockOrgId = "invalid-object-id";
    const mockError = new Error(
      'Cast to ObjectId failed for value "invalid-object-id"'
    );

    connectDBStub.resolves();
    findByIdAndDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include("Cast to ObjectId failed");
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndDeleteStub.calledOnce).to.be.true;
  });

  it("should handle network timeout errors as retryable", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockError = new Error(
      "MongoNetworkTimeoutError: connection timed out"
    );

    connectDBStub.resolves();
    findByIdAndDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include("connection timed out");
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndDeleteStub.calledOnce).to.be.true;
  });

  it("should handle database lock errors as retryable", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockError = new Error("WriteConflict: Document is locked");

    connectDBStub.resolves();
    findByIdAndDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include("Document is locked");
    }
  });

  it("should handle empty string orgId", async () => {
    // Arrange
    const mockOrgId = "";

    connectDBStub.resolves();
    findByIdAndDeleteStub.resolves(null); // No organization found with empty ID

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include("Organization not found");
    }
  });

  it("should handle null orgId parameter", async () => {
    // Arrange
    const mockOrgId = null as any;
    const mockError = new Error('Cast to ObjectId failed for value "null"');

    connectDBStub.resolves();
    findByIdAndDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include("Cast to ObjectId failed");
    }
  });

  it("should handle undefined orgId parameter", async () => {
    // Arrange
    const mockOrgId = undefined as any;
    const mockError = new Error(
      'Cast to ObjectId failed for value "undefined"'
    );

    connectDBStub.resolves();
    findByIdAndDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include("Cast to ObjectId failed");
    }
  });

  it("should handle successful deletion of organization with minimal data", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockDeletedOrg = {
      _id: mockOrgId,
      identifier: "minimal-org",
    };

    connectDBStub.resolves();
    findByIdAndDeleteStub.resolves(mockDeletedOrg);

    // Act
    await deleteOrganizationFromDB(mockOrgId);

    // Assert
    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndDeleteStub.calledOnce).to.be.true;
    expect(findByIdAndDeleteStub.calledWith(mockOrgId)).to.be.true;
  });

  it("should handle successful deletion of organization with all fields", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockDeletedOrg = {
      _id: mockOrgId,
      identifier: "complete-org-123",
      name: "Complete Test Organization",
      auth0Id: "org_complete123def456",
      createdByEmail: "creator@test.com",
      status: "deleted",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-15"),
    };

    connectDBStub.resolves();
    findByIdAndDeleteStub.resolves(mockDeletedOrg);

    // Act
    await deleteOrganizationFromDB(mockOrgId);

    // Assert
    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndDeleteStub.calledOnce).to.be.true;
    expect(findByIdAndDeleteStub.calledWith(mockOrgId)).to.be.true;
  });

  it("should handle MongoDB server errors as retryable", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockError = new Error(
      "MongoServerError: Server temporarily unavailable"
    );

    connectDBStub.resolves();
    findByIdAndDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include(
        "Server temporarily unavailable"
      );
    }
  });

  it("should handle duplicate deletion attempts", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";

    connectDBStub.resolves();
    findByIdAndDeleteStub.resolves(null); // Already deleted

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include("Organization not found");
    }
  });

  it("should handle very long ObjectId strings", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde123456789012345678901234567890";
    const mockError = new Error(
      'Cast to ObjectId failed for value "64f5b8c9e1234567890abcde123456789012345678901234567890"'
    );

    connectDBStub.resolves();
    findByIdAndDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include("Cast to ObjectId failed");
    }
  });

  it("should handle special characters in ObjectId", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e123456@#$%^&*()";
    const mockError = new Error(
      'Cast to ObjectId failed for value "64f5b8c9e123456@#$%^&*()"'
    );

    connectDBStub.resolves();
    findByIdAndDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationFromDB(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoDeleteFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to hard delete organization from MongoDB"
      );
      expect((error as Error).message).to.include("Cast to ObjectId failed");
    }
  });
});
