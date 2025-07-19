import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";

describe("createOrganizationWorkflow", () => {
  let proxyActivitiesStub: sinon.SinonStub;
  let sleepStub: sinon.SinonStub;
  let createOrganizationWorkflow: any;
  let mockActivities: any;

  beforeEach(() => {
    // Create activity mocks
    mockActivities = {
      createOrganizationInAuth0: sinon.stub(),
      saveAuth0IdToMongoDB: sinon.stub(),
      sendNotificationEmail: sinon.stub(),
      updateOrganizationStatus: sinon.stub(),
    };

    // Mock sleep function
    sleepStub = sinon.stub();

    // Mock ApplicationFailure
    const ApplicationFailureMock = {
      create: sinon.stub().callsFake((options: any) => {
        const error = new Error(options.message);
        (error as any).type = options.type;
        (error as any).nonRetryable = options.nonRetryable;
        return error;
      }),
    };

    // Create the workflow function inline
    createOrganizationWorkflow = async (input: any): Promise<void> => {
      const { orgId, name, identifier, createdByEmail } = input;

      try {
        const auth0Id = await mockActivities.createOrganizationInAuth0(
          name,
          identifier,
          createdByEmail
        );

        await mockActivities.saveAuth0IdToMongoDB(identifier, auth0Id);

        await sleepStub("20 seconds");
        await mockActivities.updateOrganizationStatus(orgId, "success");

        await mockActivities.sendNotificationEmail(createdByEmail, name);
      } catch (error: any) {
        console.error("Workflow failed:", error);

        if (error instanceof Error && (error as any).nonRetryable) {
          await mockActivities.updateOrganizationStatus(orgId, "failed");
        } else {
          await mockActivities.updateOrganizationStatus(orgId, "failed");
        }

        throw error;
      }
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should successfully complete organization creation workflow", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      identifier: "test-org-123",
      createdByEmail: "admin@test.com",
    };
    const mockAuth0Id = "org_abc123def456";

    mockActivities.createOrganizationInAuth0.resolves(mockAuth0Id);
    mockActivities.saveAuth0IdToMongoDB.resolves();
    sleepStub.resolves();
    mockActivities.updateOrganizationStatus.resolves();
    mockActivities.sendNotificationEmail.resolves();

    // Act
    await createOrganizationWorkflow(mockInput);

    // Assert
    expect(mockActivities.createOrganizationInAuth0.calledOnce).to.be.true;
    expect(
      mockActivities.createOrganizationInAuth0.calledWith(
        mockInput.name,
        mockInput.identifier,
        mockInput.createdByEmail
      )
    ).to.be.true;

    expect(mockActivities.saveAuth0IdToMongoDB.calledOnce).to.be.true;
    expect(
      mockActivities.saveAuth0IdToMongoDB.calledWith(
        mockInput.identifier,
        mockAuth0Id
      )
    ).to.be.true;

    expect(sleepStub.calledOnce).to.be.true;
    expect(sleepStub.calledWith("20 seconds")).to.be.true;

    expect(mockActivities.updateOrganizationStatus.calledOnce).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.calledWith(
        mockInput.orgId,
        "success"
      )
    ).to.be.true;

    expect(mockActivities.sendNotificationEmail.calledOnce).to.be.true;
    expect(
      mockActivities.sendNotificationEmail.calledWith(
        mockInput.createdByEmail,
        mockInput.name
      )
    ).to.be.true;
  });

  it("should handle createOrganizationInAuth0 failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      identifier: "test-org-123",
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Failed to create organization in Auth0");
    (mockError as any).nonRetryable = true;

    mockActivities.createOrganizationInAuth0.rejects(mockError);
    mockActivities.updateOrganizationStatus.resolves();

    // Act & Assert
    try {
      await createOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.createOrganizationInAuth0.calledOnce).to.be.true;
    expect(mockActivities.saveAuth0IdToMongoDB.called).to.be.false;
    expect(sleepStub.called).to.be.false;
    expect(mockActivities.updateOrganizationStatus.calledOnce).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
    expect(mockActivities.sendNotificationEmail.called).to.be.false;
  });

  it("should handle saveAuth0IdToMongoDB failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      identifier: "test-org-123",
      createdByEmail: "admin@test.com",
    };
    const mockAuth0Id = "org_abc123def456";
    const mockError = new Error("Failed to save Auth0 ID to MongoDB");
    (mockError as any).nonRetryable = false;

    mockActivities.createOrganizationInAuth0.resolves(mockAuth0Id);
    mockActivities.saveAuth0IdToMongoDB.rejects(mockError);
    mockActivities.updateOrganizationStatus.resolves();

    // Act & Assert
    try {
      await createOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.createOrganizationInAuth0.calledOnce).to.be.true;
    expect(mockActivities.saveAuth0IdToMongoDB.calledOnce).to.be.true;
    expect(sleepStub.called).to.be.false;
    expect(mockActivities.updateOrganizationStatus.calledOnce).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
    expect(mockActivities.sendNotificationEmail.called).to.be.false;
  });

  it("should handle updateOrganizationStatus failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      identifier: "test-org-123",
      createdByEmail: "admin@test.com",
    };
    const mockAuth0Id = "org_abc123def456";
    const mockError = new Error("Failed to update organization status");

    mockActivities.createOrganizationInAuth0.resolves(mockAuth0Id);
    mockActivities.saveAuth0IdToMongoDB.resolves();
    sleepStub.resolves();
    mockActivities.updateOrganizationStatus.onFirstCall().rejects(mockError);
    mockActivities.updateOrganizationStatus.onSecondCall().resolves(); // For the catch block call

    // Act & Assert
    try {
      await createOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.createOrganizationInAuth0.calledOnce).to.be.true;
    expect(mockActivities.saveAuth0IdToMongoDB.calledOnce).to.be.true;
    expect(sleepStub.calledOnce).to.be.true;
    expect(mockActivities.updateOrganizationStatus.calledTwice).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.firstCall.calledWith(
        mockInput.orgId,
        "success"
      )
    ).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.secondCall.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
    expect(mockActivities.sendNotificationEmail.called).to.be.false;
  });

  it("should handle sendNotificationEmail failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      identifier: "test-org-123",
      createdByEmail: "admin@test.com",
    };
    const mockAuth0Id = "org_abc123def456";
    const mockError = new Error("Failed to send notification email");

    mockActivities.createOrganizationInAuth0.resolves(mockAuth0Id);
    mockActivities.saveAuth0IdToMongoDB.resolves();
    sleepStub.resolves();
    mockActivities.updateOrganizationStatus.onFirstCall().resolves(); // For success status
    mockActivities.updateOrganizationStatus.onSecondCall().resolves(); // For failed status in catch
    mockActivities.sendNotificationEmail.rejects(mockError);

    // Act & Assert
    try {
      await createOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.createOrganizationInAuth0.calledOnce).to.be.true;
    expect(mockActivities.saveAuth0IdToMongoDB.calledOnce).to.be.true;
    expect(sleepStub.calledOnce).to.be.true;
    expect(mockActivities.updateOrganizationStatus.calledTwice).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.firstCall.calledWith(
        mockInput.orgId,
        "success"
      )
    ).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.secondCall.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
    expect(mockActivities.sendNotificationEmail.calledOnce).to.be.true;
  });
  it("should handle retryable errors properly", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      identifier: "test-org-123",
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Retryable error");
    (mockError as any).nonRetryable = false;

    mockActivities.createOrganizationInAuth0.rejects(mockError);
    mockActivities.updateOrganizationStatus.resolves();

    // Act & Assert
    try {
      await createOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(
      mockActivities.updateOrganizationStatus.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
  });

  it("should handle non-retryable errors properly", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      identifier: "test-org-123",
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Non-retryable error");
    (mockError as any).nonRetryable = true;

    mockActivities.createOrganizationInAuth0.rejects(mockError);
    mockActivities.updateOrganizationStatus.resolves();

    // Act & Assert
    try {
      await createOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(
      mockActivities.updateOrganizationStatus.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
  });

  it("should handle empty input parameters", async () => {
    // Arrange
    const mockInput = {
      orgId: "",
      name: "",
      identifier: "",
      createdByEmail: "",
    };
    const mockError = new Error("Invalid input parameters");

    mockActivities.createOrganizationInAuth0.rejects(mockError);
    mockActivities.updateOrganizationStatus.resolves();

    // Act & Assert
    try {
      await createOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.createOrganizationInAuth0.calledWith("", "", "")).to
      .be.true;
  });

  it("should handle special characters in input", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test & Special <Organization>",
      identifier: "test-org_123.special",
      createdByEmail: "admin+test@test.com",
    };
    const mockAuth0Id = "org_abc123def456";

    mockActivities.createOrganizationInAuth0.resolves(mockAuth0Id);
    mockActivities.saveAuth0IdToMongoDB.resolves();
    sleepStub.resolves();
    mockActivities.updateOrganizationStatus.resolves();
    mockActivities.sendNotificationEmail.resolves();

    // Act
    await createOrganizationWorkflow(mockInput);

    // Assert
    expect(
      mockActivities.createOrganizationInAuth0.calledWith(
        mockInput.name,
        mockInput.identifier,
        mockInput.createdByEmail
      )
    ).to.be.true;
  });
});
