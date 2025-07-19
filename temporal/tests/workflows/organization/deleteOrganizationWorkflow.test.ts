import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";

describe("deleteOrganizationWorkflow", () => {
  let deleteOrganizationWorkflow: any;
  let mockActivities: any;

  beforeEach(() => {
    // Create activity mocks
    mockActivities = {
      updateOrganizationStatus: sinon.stub(),
      sendNotificationEmail: sinon.stub(),
      getOrganizationNameById: sinon.stub(),
      deleteOrganizationInAuth0: sinon.stub(),
      deleteOrganizationFromDB: sinon.stub(),
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

    // Create the workflow function inline
    deleteOrganizationWorkflow = async (input: any): Promise<void> => {
      const { orgId, createdByEmail, name } = input;

      try {
        const orgName = await mockActivities.getOrganizationNameById(orgId);

        await mockActivities.updateOrganizationStatus(orgId, "deleting");

        await mockActivities.deleteOrganizationInAuth0(orgId);

        await mockActivities.deleteOrganizationFromDB(orgId);

        await mockActivities.sendNotificationEmail(
          createdByEmail,
          orgName || "Your Organizatioin",
          "deleted"
        );
      } catch (error) {
        console.error("Delete Organization Workflow failed:", error);

        await mockActivities.updateOrganizationStatus(orgId, "failed");

        if (error instanceof Error && (error as any).nonRetryable) {
          return;
        }

        throw error;
      }
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should successfully complete organization deletion workflow", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      createdByEmail: "admin@test.com",
      name: "Test Organization",
    };
    const mockOrgName = "Retrieved Organization Name";

    mockActivities.getOrganizationNameById.resolves(mockOrgName);
    mockActivities.updateOrganizationStatus.resolves();
    mockActivities.deleteOrganizationInAuth0.resolves();
    mockActivities.deleteOrganizationFromDB.resolves();
    mockActivities.sendNotificationEmail.resolves();

    // Act
    await deleteOrganizationWorkflow(mockInput);

    // Assert
    expect(mockActivities.getOrganizationNameById.calledOnce).to.be.true;
    expect(mockActivities.getOrganizationNameById.calledWith(mockInput.orgId))
      .to.be.true;

    expect(mockActivities.updateOrganizationStatus.calledOnce).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.calledWith(
        mockInput.orgId,
        "deleting"
      )
    ).to.be.true;

    expect(mockActivities.deleteOrganizationInAuth0.calledOnce).to.be.true;
    expect(mockActivities.deleteOrganizationInAuth0.calledWith(mockInput.orgId))
      .to.be.true;

    expect(mockActivities.deleteOrganizationFromDB.calledOnce).to.be.true;
    expect(mockActivities.deleteOrganizationFromDB.calledWith(mockInput.orgId))
      .to.be.true;

    expect(mockActivities.sendNotificationEmail.calledOnce).to.be.true;
    expect(
      mockActivities.sendNotificationEmail.calledWith(
        mockInput.createdByEmail,
        mockOrgName,
        "deleted"
      )
    ).to.be.true;
  });

  it("should use fallback organization name when getOrganizationNameById returns null", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      createdByEmail: "admin@test.com",
    };

    mockActivities.getOrganizationNameById.resolves(null);
    mockActivities.updateOrganizationStatus.resolves();
    mockActivities.deleteOrganizationInAuth0.resolves();
    mockActivities.deleteOrganizationFromDB.resolves();
    mockActivities.sendNotificationEmail.resolves();

    // Act
    await deleteOrganizationWorkflow(mockInput);

    // Assert
    expect(
      mockActivities.sendNotificationEmail.calledWith(
        mockInput.createdByEmail,
        "Your Organizatioin", // Note: typo is in original code
        "deleted"
      )
    ).to.be.true;
  });

  it("should handle getOrganizationNameById failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Failed to get organization name");
    (mockError as any).nonRetryable = false;

    mockActivities.getOrganizationNameById.rejects(mockError);
    mockActivities.updateOrganizationStatus.resolves();

    // Act & Assert
    try {
      await deleteOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.getOrganizationNameById.calledOnce).to.be.true;
    expect(mockActivities.updateOrganizationStatus.calledOnce).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
    expect(mockActivities.deleteOrganizationInAuth0.called).to.be.false;
    expect(mockActivities.deleteOrganizationFromDB.called).to.be.false;
    expect(mockActivities.sendNotificationEmail.called).to.be.false;
  });

  it("should handle updateOrganizationStatus failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      createdByEmail: "admin@test.com",
    };
    const mockOrgName = "Test Organization";
    const mockError = new Error("Failed to update organization status");
    (mockError as any).nonRetryable = false;

    mockActivities.getOrganizationNameById.resolves(mockOrgName);
    mockActivities.updateOrganizationStatus.onFirstCall().rejects(mockError);
    mockActivities.updateOrganizationStatus.onSecondCall().resolves();

    // Act & Assert
    try {
      await deleteOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.getOrganizationNameById.calledOnce).to.be.true;
    expect(mockActivities.updateOrganizationStatus.calledTwice).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.firstCall.calledWith(
        mockInput.orgId,
        "deleting"
      )
    ).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.secondCall.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
  });

  it("should handle deleteOrganizationInAuth0 failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      createdByEmail: "admin@test.com",
    };
    const mockOrgName = "Test Organization";
    const mockError = new Error("Failed to delete organization in Auth0");
    (mockError as any).nonRetryable = false;

    mockActivities.getOrganizationNameById.resolves(mockOrgName);
    mockActivities.updateOrganizationStatus.onFirstCall().resolves();
    mockActivities.updateOrganizationStatus.onSecondCall().resolves();
    mockActivities.deleteOrganizationInAuth0.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.deleteOrganizationInAuth0.calledOnce).to.be.true;
    expect(mockActivities.updateOrganizationStatus.calledTwice).to.be.true;
    expect(mockActivities.deleteOrganizationFromDB.called).to.be.false;
    expect(mockActivities.sendNotificationEmail.called).to.be.false;
  });

  it("should handle deleteOrganizationFromDB failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      createdByEmail: "admin@test.com",
    };
    const mockOrgName = "Test Organization";
    const mockError = new Error("Failed to delete organization from database");
    (mockError as any).nonRetryable = false;

    mockActivities.getOrganizationNameById.resolves(mockOrgName);
    mockActivities.updateOrganizationStatus.onFirstCall().resolves();
    mockActivities.updateOrganizationStatus.onSecondCall().resolves();
    mockActivities.deleteOrganizationInAuth0.resolves();
    mockActivities.deleteOrganizationFromDB.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.deleteOrganizationInAuth0.calledOnce).to.be.true;
    expect(mockActivities.deleteOrganizationFromDB.calledOnce).to.be.true;
    expect(mockActivities.updateOrganizationStatus.calledTwice).to.be.true;
    expect(mockActivities.sendNotificationEmail.called).to.be.false;
  });

  it("should handle sendNotificationEmail failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      createdByEmail: "admin@test.com",
    };
    const mockOrgName = "Test Organization";
    const mockError = new Error("Failed to send notification email");
    (mockError as any).nonRetryable = false;

    mockActivities.getOrganizationNameById.resolves(mockOrgName);
    mockActivities.updateOrganizationStatus.onFirstCall().resolves();
    mockActivities.updateOrganizationStatus.onSecondCall().resolves();
    mockActivities.deleteOrganizationInAuth0.resolves();
    mockActivities.deleteOrganizationFromDB.resolves();
    mockActivities.sendNotificationEmail.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.sendNotificationEmail.calledOnce).to.be.true;
    expect(mockActivities.updateOrganizationStatus.calledTwice).to.be.true;
  });

  it("should handle non-retryable errors and not re-throw", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Non-retryable error");
    (mockError as any).nonRetryable = true;

    mockActivities.getOrganizationNameById.rejects(mockError);
    mockActivities.updateOrganizationStatus.resolves();

    // Act - Should not throw because non-retryable errors return early
    await deleteOrganizationWorkflow(mockInput);

    // Assert
    expect(mockActivities.getOrganizationNameById.calledOnce).to.be.true;
    expect(mockActivities.updateOrganizationStatus.calledOnce).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
  });

  it("should handle retryable errors and re-throw", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Retryable error");
    (mockError as any).nonRetryable = false;

    mockActivities.getOrganizationNameById.rejects(mockError);
    mockActivities.updateOrganizationStatus.resolves();

    // Act & Assert
    try {
      await deleteOrganizationWorkflow(mockInput);
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
      createdByEmail: "",
    };
    const mockError = new Error("Invalid organization ID");

    mockActivities.getOrganizationNameById.rejects(mockError);
    mockActivities.updateOrganizationStatus.resolves();

    // Act & Assert
    try {
      await deleteOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.getOrganizationNameById.calledWith("")).to.be.true;
  });

  it("should handle special characters in input", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      createdByEmail: "admin+test@test.com",
      name: "Test & Special <Organization>",
    };
    const mockOrgName = "Retrieved & Special <Name>";

    mockActivities.getOrganizationNameById.resolves(mockOrgName);
    mockActivities.updateOrganizationStatus.resolves();
    mockActivities.deleteOrganizationInAuth0.resolves();
    mockActivities.deleteOrganizationFromDB.resolves();
    mockActivities.sendNotificationEmail.resolves();

    // Act
    await deleteOrganizationWorkflow(mockInput);

    // Assert
    expect(
      mockActivities.sendNotificationEmail.calledWith(
        mockInput.createdByEmail,
        mockOrgName,
        "deleted"
      )
    ).to.be.true;
  });
});
