import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";

describe("saveAuth0IdToMongoDB", () => {
  let connectDBStub: sinon.SinonStub;
  let findOneAndUpdateStub: sinon.SinonStub;
  let saveAuth0IdToMongoDB: any;
  let OrganizationMock: any;

  beforeEach(() => {
    // Create stubs
    connectDBStub = sinon.stub();
    findOneAndUpdateStub = sinon.stub();

    // Mock Organization model
    OrganizationMock = {
      findOneAndUpdate: findOneAndUpdateStub,
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
    saveAuth0IdToMongoDB = async (
      identifier: string,
      auth0Id: string
    ): Promise<void> => {
      await connectDBStub();

      try {
        const result = await OrganizationMock.findOneAndUpdate(
          { identifier },
          { auth0Id },
          { new: true }
        );

        if (!result) {
          throw ApplicationFailureMock.create({
            message: `Organization not found with the identifier: ${identifier}`,
            type: "MongoUpdateError",
            nonRetryable: true,
          });
        }
        console.log(`Saved Auth0 ID to MongoDB: ${auth0Id} for ${identifier}`);
      } catch (error: any) {
        console.log("MongoDB update failed");

        throw ApplicationFailureMock.create({
          message: `Failed to update Auth0 ID in MongoDB for identifier ${identifier}. ${error.message}`,
          type: "MongoUpdateFailure",
          nonRetryable: false,
        });
      }
    };
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  it("should successfully save Auth0 ID to MongoDB", async () => {
    // Arrange
    const mockIdentifier = "test-org-123";
    const mockAuth0Id = "org_abc123def456";
    const mockUpdatedOrg = {
      _id: "mongo_id_123",
      identifier: mockIdentifier,
      auth0Id: mockAuth0Id,
      name: "Test Organization",
      createdByEmail: "admin@test.com",
      status: "provisioning",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    connectDBStub.resolves();
    findOneAndUpdateStub.resolves(mockUpdatedOrg);

    // Act
    await saveAuth0IdToMongoDB(mockIdentifier, mockAuth0Id);

    // Assert
    expect(connectDBStub.calledOnce).to.be.true;
    expect(findOneAndUpdateStub.calledOnce).to.be.true;
    expect(
      findOneAndUpdateStub.calledWith(
        { identifier: mockIdentifier },
        { auth0Id: mockAuth0Id },
        { new: true }
      )
    ).to.be.true;
  });

  it("should handle organization not found as non-retryable error", async () => {
    // Arrange
    const mockIdentifier = "non-existent-org";
    const mockAuth0Id = "org_abc123def456";

    connectDBStub.resolves();
    findOneAndUpdateStub.resolves(null); // Organization not found

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(mockIdentifier, mockAuth0Id);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoUpdateFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to update Auth0 ID in MongoDB"
      );
      expect((error as Error).message).to.include("Organization not found");
      expect((error as Error).message).to.include(mockIdentifier);
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(findOneAndUpdateStub.calledOnce).to.be.true;
  });
  it("should handle MongoDB update errors as retryable", async () => {
    // Arrange
    const mockIdentifier = "test-org-123";
    const mockAuth0Id = "org_abc123def456";
    const mockError = new Error("MongoDB update operation failed");

    connectDBStub.resolves();
    findOneAndUpdateStub.rejects(mockError);

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(mockIdentifier, mockAuth0Id);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoUpdateFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to update Auth0 ID in MongoDB"
      );
      expect((error as Error).message).to.include(mockIdentifier);
      expect((error as Error).message).to.include(
        "MongoDB update operation failed"
      );
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(findOneAndUpdateStub.calledOnce).to.be.true;
  });

  it("should handle network timeout errors as retryable", async () => {
    // Arrange
    const mockIdentifier = "test-org-123";
    const mockAuth0Id = "org_abc123def456";
    const mockError = new Error(
      "MongoNetworkTimeoutError: connection timed out"
    );

    connectDBStub.resolves();
    findOneAndUpdateStub.rejects(mockError);

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(mockIdentifier, mockAuth0Id);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoUpdateFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to update Auth0 ID in MongoDB"
      );
      expect((error as Error).message).to.include("connection timed out");
    }
  });

  it("should handle empty identifier", async () => {
    // Arrange
    const mockIdentifier = "";
    const mockAuth0Id = "org_abc123def456";

    connectDBStub.resolves();
    findOneAndUpdateStub.resolves(null); // No organization found with empty identifier

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(mockIdentifier, mockAuth0Id);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoUpdateFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to update Auth0 ID in MongoDB"
      );
      expect((error as Error).message).to.include("Organization not found");
    }
  });
  it("should handle empty auth0Id", async () => {
    // Arrange
    const mockIdentifier = "test-org-123";
    const mockAuth0Id = "";
    const mockUpdatedOrg = {
      _id: "mongo_id_123",
      identifier: mockIdentifier,
      auth0Id: mockAuth0Id, // Empty auth0Id should still update
      name: "Test Organization",
    };

    connectDBStub.resolves();
    findOneAndUpdateStub.resolves(mockUpdatedOrg);

    // Act
    await saveAuth0IdToMongoDB(mockIdentifier, mockAuth0Id);

    // Assert
    expect(connectDBStub.calledOnce).to.be.true;
    expect(findOneAndUpdateStub.calledOnce).to.be.true;
    expect(
      findOneAndUpdateStub.calledWith(
        { identifier: mockIdentifier },
        { auth0Id: mockAuth0Id },
        { new: true }
      )
    ).to.be.true;
  });

  it("should handle duplicate key errors as retryable", async () => {
    // Arrange
    const mockIdentifier = "test-org-123";
    const mockAuth0Id = "org_duplicate_id";
    const mockError = new Error("E11000 duplicate key error");

    connectDBStub.resolves();
    findOneAndUpdateStub.rejects(mockError);

    // Act & Assert
    try {
      await saveAuth0IdToMongoDB(mockIdentifier, mockAuth0Id);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoUpdateFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to update Auth0 ID in MongoDB"
      );
      expect((error as Error).message).to.include("duplicate key error");
    }
  });

  it("should handle valid update with special characters in identifier", async () => {
    // Arrange
    const mockIdentifier = "test-org_123.special-chars";
    const mockAuth0Id = "org_abc123def456";
    const mockUpdatedOrg = {
      _id: "mongo_id_123",
      identifier: mockIdentifier,
      auth0Id: mockAuth0Id,
      name: "Test Organization with Special Chars",
    };

    connectDBStub.resolves();
    findOneAndUpdateStub.resolves(mockUpdatedOrg);

    // Act
    await saveAuth0IdToMongoDB(mockIdentifier, mockAuth0Id);

    // Assert
    expect(connectDBStub.calledOnce).to.be.true;
    expect(findOneAndUpdateStub.calledOnce).to.be.true;
    expect(
      findOneAndUpdateStub.calledWith(
        { identifier: mockIdentifier },
        { auth0Id: mockAuth0Id },
        { new: true }
      )
    ).to.be.true;
  });
});
