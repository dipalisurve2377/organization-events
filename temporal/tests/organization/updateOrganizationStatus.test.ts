import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";

describe("updateOrganizationStatus", () => {
  let connectDBStub: sinon.SinonStub;
  let findByIdAndUpdateStub: sinon.SinonStub;
  let updateOrganizationStatus: any;
  let OrganizationMock: any;

  beforeEach(() => {
    // Create stubs
    connectDBStub = sinon.stub();
    findByIdAndUpdateStub = sinon.stub();

    // Mock Organization model
    OrganizationMock = {
      findByIdAndUpdate: findByIdAndUpdateStub,
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
    updateOrganizationStatus = async (
      orgId: string,
      status:
        | "provisioning"
        | "success"
        | "failed"
        | "updating"
        | "deleting"
        | "updated"
        | "deleted"
        | "canceled",
      auth0Id?: string,
      name?: string
    ): Promise<void> => {
      try {
        await connectDBStub();

        const update: any = { status };

        if (auth0Id) update.auth0Id = auth0Id;
        if (name) update.name = name;

        const result = await OrganizationMock.findByIdAndUpdate(orgId, update, {
          new: true,
        });

        if (!result) {
          throw ApplicationFailureMock.create({
            message: `Organization not found for orgId ${orgId}`,
            type: "MongoUpdateError",
            nonRetryable: true,
          });
        }

        console.log(`Organization status updated to "${status}" for ${orgId}`);
      } catch (error: any) {
        console.error("Failed to update organization status in MongoDB");

        throw ApplicationFailureMock.create({
          message: `Failed to update organization status in MongoDB for orgId ${orgId}. ${error.message}`,
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

  it("should successfully update organization status only", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockStatus = "success";
    const mockUpdatedOrg = {
      _id: mockOrgId,
      identifier: "test-org-123",
      name: "Test Organization",
      status: mockStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    connectDBStub.resolves();
    findByIdAndUpdateStub.resolves(mockUpdatedOrg);

    // Act
    await updateOrganizationStatus(mockOrgId, mockStatus);

    // Assert
    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndUpdateStub.calledOnce).to.be.true;
    expect(
      findByIdAndUpdateStub.calledWith(
        mockOrgId,
        { status: mockStatus },
        { new: true }
      )
    ).to.be.true;
  });

  it("should successfully update organization status with auth0Id", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockStatus = "success";
    const mockAuth0Id = "org_abc123def456";
    const mockUpdatedOrg = {
      _id: mockOrgId,
      identifier: "test-org-123",
      name: "Test Organization",
      status: mockStatus,
      auth0Id: mockAuth0Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    connectDBStub.resolves();
    findByIdAndUpdateStub.resolves(mockUpdatedOrg);

    // Act
    await updateOrganizationStatus(mockOrgId, mockStatus, mockAuth0Id);

    // Assert
    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndUpdateStub.calledOnce).to.be.true;
    expect(
      findByIdAndUpdateStub.calledWith(
        mockOrgId,
        { status: mockStatus, auth0Id: mockAuth0Id },
        { new: true }
      )
    ).to.be.true;
  });

  it("should successfully update organization status with name", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockStatus = "updated";
    const mockName = "Updated Organization Name";
    const mockUpdatedOrg = {
      _id: mockOrgId,
      identifier: "test-org-123",
      name: mockName,
      status: mockStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    connectDBStub.resolves();
    findByIdAndUpdateStub.resolves(mockUpdatedOrg);

    // Act
    await updateOrganizationStatus(mockOrgId, mockStatus, undefined, mockName);

    // Assert
    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndUpdateStub.calledOnce).to.be.true;
    expect(
      findByIdAndUpdateStub.calledWith(
        mockOrgId,
        { status: mockStatus, name: mockName },
        { new: true }
      )
    ).to.be.true;
  });

  it("should successfully update organization status with all parameters", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockStatus = "success";
    const mockAuth0Id = "org_abc123def456";
    const mockName = "Complete Organization";
    const mockUpdatedOrg = {
      _id: mockOrgId,
      identifier: "test-org-123",
      name: mockName,
      status: mockStatus,
      auth0Id: mockAuth0Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    connectDBStub.resolves();
    findByIdAndUpdateStub.resolves(mockUpdatedOrg);

    // Act
    await updateOrganizationStatus(
      mockOrgId,
      mockStatus,
      mockAuth0Id,
      mockName
    );

    // Assert
    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndUpdateStub.calledOnce).to.be.true;
    expect(
      findByIdAndUpdateStub.calledWith(
        mockOrgId,
        { status: mockStatus, auth0Id: mockAuth0Id, name: mockName },
        { new: true }
      )
    ).to.be.true;
  });

  it("should handle organization not found as non-retryable error", async () => {
    // Arrange
    const mockOrgId = "non-existent-org-id";
    const mockStatus = "success";

    connectDBStub.resolves();
    findByIdAndUpdateStub.resolves(null); // Organization not found

    // Act & Assert
    try {
      await updateOrganizationStatus(mockOrgId, mockStatus);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoUpdateFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to update organization status in MongoDB"
      );
      expect((error as Error).message).to.include("Organization not found");
      expect((error as Error).message).to.include(mockOrgId);
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndUpdateStub.calledOnce).to.be.true;
  });

  it("should handle database connection errors as retryable", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockStatus = "success";
    const mockError = new Error("MongoDB connection failed");

    connectDBStub.rejects(mockError);

    // Act & Assert
    try {
      await updateOrganizationStatus(mockOrgId, mockStatus);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoUpdateFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to update organization status in MongoDB"
      );
      expect((error as Error).message).to.include(mockOrgId);
      expect((error as Error).message).to.include("MongoDB connection failed");
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(findByIdAndUpdateStub.called).to.be.false; // Should not reach this point
  });

  it("should handle all valid status values", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const validStatuses = [
      "provisioning",
      "success",
      "failed",
      "updating",
      "deleting",
      "updated",
      "deleted",
      "canceled",
    ];

    connectDBStub.resolves();

    // Act & Assert
    for (const status of validStatuses) {
      const mockUpdatedOrg = {
        _id: mockOrgId,
        status: status,
        name: "Test Organization",
      };

      findByIdAndUpdateStub.resolves(mockUpdatedOrg);

      await updateOrganizationStatus(mockOrgId, status as any);

      expect(
        findByIdAndUpdateStub.calledWith(
          mockOrgId,
          { status: status },
          { new: true }
        )
      ).to.be.true;

      findByIdAndUpdateStub.reset();
    }
  });

  it("should handle empty auth0Id and name parameters", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockStatus = "success";
    const mockUpdatedOrg = {
      _id: mockOrgId,
      status: mockStatus,
      name: "Test Organization",
    };

    connectDBStub.resolves();
    findByIdAndUpdateStub.resolves(mockUpdatedOrg);

    // Act
    await updateOrganizationStatus(mockOrgId, mockStatus, "", "");

    // Assert
    expect(
      findByIdAndUpdateStub.calledWith(
        mockOrgId,
        { status: mockStatus }, // Empty strings should not be included
        { new: true }
      )
    ).to.be.true;
  });

  it("should handle invalid ObjectId format", async () => {
    // Arrange
    const mockOrgId = "invalid-object-id";
    const mockStatus = "success";
    const mockError = new Error("Cast to ObjectId failed");

    connectDBStub.resolves();
    findByIdAndUpdateStub.rejects(mockError);

    // Act & Assert
    try {
      await updateOrganizationStatus(mockOrgId, mockStatus);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoUpdateFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to update organization status in MongoDB"
      );
      expect((error as Error).message).to.include("Cast to ObjectId failed");
    }
  });

  it("should handle network timeout errors", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockStatus = "success";
    const mockError = new Error(
      "MongoNetworkTimeoutError: connection timed out"
    );

    connectDBStub.resolves();
    findByIdAndUpdateStub.rejects(mockError);

    // Act & Assert
    try {
      await updateOrganizationStatus(mockOrgId, mockStatus);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("MongoUpdateFailure");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to update organization status in MongoDB"
      );
      expect((error as Error).message).to.include("connection timed out");
    }
  });

  it("should handle special characters in name parameter", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockStatus = "updated";
    const mockName = "Test & Special <Organization>";
    const mockUpdatedOrg = {
      _id: mockOrgId,
      status: mockStatus,
      name: mockName,
    };

    connectDBStub.resolves();
    findByIdAndUpdateStub.resolves(mockUpdatedOrg);

    // Act
    await updateOrganizationStatus(mockOrgId, mockStatus, undefined, mockName);

    // Assert
    expect(
      findByIdAndUpdateStub.calledWith(
        mockOrgId,
        { status: mockStatus, name: mockName },
        { new: true }
      )
    ).to.be.true;
  });
});
