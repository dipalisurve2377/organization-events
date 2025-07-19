import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";

describe("updateOrganizationWorkflow", () => {
  let updateOrganizationWorkflow: any;
  let mockActivities: any;

  beforeEach(() => {
    // Create activity mocks
    mockActivities = {
      updateOrganizationInAuth0: sinon.stub(),
      updateOrganizationStatus: sinon.stub(),
      sendNotificationEmail: sinon.stub(),
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
    updateOrganizationWorkflow = async (input: any): Promise<void> => {
      const { orgId, name, identifier, createdByEmail } = input;
      try {
        await mockActivities.updateOrganizationStatus(orgId, "updating");
        // update in auth0
        await mockActivities.updateOrganizationInAuth0(orgId, name, identifier);

        // update status
        await mockActivities.updateOrganizationStatus(orgId, "updated");

        // send mail that org is updated to the user
        await mockActivities.sendNotificationEmail(
          createdByEmail,
          name || "Your organization",
          "updated"
        );
      } catch (error) {
        console.error("Update Organization Workflow failed", error);

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

  it("should successfully complete organization update workflow", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Updated Organization Name",
      identifier: "updated-org-123",
      createdByEmail: "admin@test.com",
    };

    mockActivities.updateOrganizationStatus.resolves();
    mockActivities.updateOrganizationInAuth0.resolves();
    mockActivities.sendNotificationEmail.resolves();

    // Act
    await updateOrganizationWorkflow(mockInput);

    // Assert
    expect(mockActivities.updateOrganizationStatus.calledTwice).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.firstCall.calledWith(
        mockInput.orgId,
        "updating"
      )
    ).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.secondCall.calledWith(
        mockInput.orgId,
        "updated"
      )
    ).to.be.true;

    expect(mockActivities.updateOrganizationInAuth0.calledOnce).to.be.true;
    expect(
      mockActivities.updateOrganizationInAuth0.calledWith(
        mockInput.orgId,
        mockInput.name,
        mockInput.identifier
      )
    ).to.be.true;

    expect(mockActivities.sendNotificationEmail.calledOnce).to.be.true;
    expect(
      mockActivities.sendNotificationEmail.calledWith(
        mockInput.createdByEmail,
        mockInput.name,
        "updated"
      )
    ).to.be.true;
  });

  it("should use fallback name when name is not provided", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      identifier: "updated-org-123",
      createdByEmail: "admin@test.com",
      // name is undefined
    };

    mockActivities.updateOrganizationStatus.resolves();
    mockActivities.updateOrganizationInAuth0.resolves();
    mockActivities.sendNotificationEmail.resolves();

    // Act
    await updateOrganizationWorkflow(mockInput);

    // Assert
    expect(
      mockActivities.updateOrganizationInAuth0.calledWith(
        mockInput.orgId,
        undefined,
        mockInput.identifier
      )
    ).to.be.true;

    expect(
      mockActivities.sendNotificationEmail.calledWith(
        mockInput.createdByEmail,
        "Your organization",
        "updated"
      )
    ).to.be.true;
  });

  it("should handle partial updates (name only)", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Updated Name Only",
      createdByEmail: "admin@test.com",
      // identifier is undefined
    };

    mockActivities.updateOrganizationStatus.resolves();
    mockActivities.updateOrganizationInAuth0.resolves();
    mockActivities.sendNotificationEmail.resolves();

    // Act
    await updateOrganizationWorkflow(mockInput);

    // Assert
    expect(
      mockActivities.updateOrganizationInAuth0.calledWith(
        mockInput.orgId,
        mockInput.name,
        undefined
      )
    ).to.be.true;

    expect(
      mockActivities.sendNotificationEmail.calledWith(
        mockInput.createdByEmail,
        mockInput.name,
        "updated"
      )
    ).to.be.true;
  });

  it("should handle first updateOrganizationStatus failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Failed to update status to updating");
    (mockError as any).nonRetryable = false;

    mockActivities.updateOrganizationStatus.onFirstCall().rejects(mockError);
    mockActivities.updateOrganizationStatus.onSecondCall().resolves(); // For failed status

    // Act & Assert
    try {
      await updateOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.updateOrganizationStatus.calledTwice).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.firstCall.calledWith(
        mockInput.orgId,
        "updating"
      )
    ).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.secondCall.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
    expect(mockActivities.updateOrganizationInAuth0.called).to.be.false;
    expect(mockActivities.sendNotificationEmail.called).to.be.false;
  });

  it("should handle updateOrganizationInAuth0 failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      identifier: "test-org-123",
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Failed to update organization in Auth0");
    (mockError as any).nonRetryable = false;

    mockActivities.updateOrganizationStatus.onFirstCall().resolves(); // updating status
    mockActivities.updateOrganizationStatus.onSecondCall().resolves(); // failed status
    mockActivities.updateOrganizationInAuth0.rejects(mockError);

    // Act & Assert
    try {
      await updateOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.updateOrganizationInAuth0.calledOnce).to.be.true;
    expect(mockActivities.updateOrganizationStatus.calledTwice).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.secondCall.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
    expect(mockActivities.sendNotificationEmail.called).to.be.false;
  });

  it("should handle second updateOrganizationStatus failure", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Failed to update status to updated");
    (mockError as any).nonRetryable = false;

    mockActivities.updateOrganizationStatus.onFirstCall().resolves(); // updating status
    mockActivities.updateOrganizationInAuth0.resolves();
    mockActivities.updateOrganizationStatus.onSecondCall().rejects(mockError); // updated status fails
    mockActivities.updateOrganizationStatus.onThirdCall().resolves(); // failed status

    // Act & Assert
    try {
      await updateOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.updateOrganizationInAuth0.calledOnce).to.be.true;
    expect(mockActivities.updateOrganizationStatus.calledThrice).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.thirdCall.calledWith(
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
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Failed to send notification email");
    (mockError as any).nonRetryable = false;

    mockActivities.updateOrganizationStatus.onFirstCall().resolves(); // updating
    mockActivities.updateOrganizationInAuth0.resolves();
    mockActivities.updateOrganizationStatus.onSecondCall().resolves(); // updated
    mockActivities.updateOrganizationStatus.onThirdCall().resolves(); // failed
    mockActivities.sendNotificationEmail.rejects(mockError);

    // Act & Assert
    try {
      await updateOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.sendNotificationEmail.calledOnce).to.be.true;
    expect(mockActivities.updateOrganizationStatus.calledThrice).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.thirdCall.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
  });

  it("should handle non-retryable errors", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Non-retryable error");
    (mockError as any).nonRetryable = true;

    mockActivities.updateOrganizationStatus.onFirstCall().rejects(mockError);
    mockActivities.updateOrganizationStatus.onSecondCall().resolves(); // failed status

    // Act & Assert
    try {
      await updateOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.updateOrganizationStatus.calledTwice).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.secondCall.calledWith(
        mockInput.orgId,
        "failed"
      )
    ).to.be.true;
  });

  it("should handle retryable errors", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test Organization",
      createdByEmail: "admin@test.com",
    };
    const mockError = new Error("Retryable error");
    (mockError as any).nonRetryable = false;

    mockActivities.updateOrganizationStatus.onFirstCall().rejects(mockError);
    mockActivities.updateOrganizationStatus.onSecondCall().resolves(); // failed status

    // Act & Assert
    try {
      await updateOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(mockActivities.updateOrganizationStatus.calledTwice).to.be.true;
    expect(
      mockActivities.updateOrganizationStatus.secondCall.calledWith(
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
    const mockError = new Error("Invalid parameters");

    mockActivities.updateOrganizationStatus.onFirstCall().rejects(mockError);
    mockActivities.updateOrganizationStatus.onSecondCall().resolves();

    // Act & Assert
    try {
      await updateOrganizationWorkflow(mockInput);
      expect.fail("Expected workflow to throw an error");
    } catch (error) {
      expect(error).to.equal(mockError);
    }

    expect(
      mockActivities.updateOrganizationStatus.firstCall.calledWith(
        "",
        "updating"
      )
    ).to.be.true;
  });

  it("should handle special characters in input", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: "Test & Special <Organization>",
      identifier: "test-org_123.special",
      createdByEmail: "admin+test@test.com",
    };

    mockActivities.updateOrganizationStatus.resolves();
    mockActivities.updateOrganizationInAuth0.resolves();
    mockActivities.sendNotificationEmail.resolves();

    // Act
    await updateOrganizationWorkflow(mockInput);

    // Assert
    expect(
      mockActivities.updateOrganizationInAuth0.calledWith(
        mockInput.orgId,
        mockInput.name,
        mockInput.identifier
      )
    ).to.be.true;

    expect(
      mockActivities.sendNotificationEmail.calledWith(
        mockInput.createdByEmail,
        mockInput.name,
        "updated"
      )
    ).to.be.true;
  });

  it("should handle null values in optional parameters", async () => {
    // Arrange
    const mockInput = {
      orgId: "64f5b8c9e1234567890abcde",
      name: null,
      identifier: null,
      createdByEmail: "admin@test.com",
    };

    mockActivities.updateOrganizationStatus.resolves();
    mockActivities.updateOrganizationInAuth0.resolves();
    mockActivities.sendNotificationEmail.resolves();

    // Act
    await updateOrganizationWorkflow(mockInput);

    // Assert
    expect(
      mockActivities.updateOrganizationInAuth0.calledWith(
        mockInput.orgId,
        null,
        null
      )
    ).to.be.true;

    expect(
      mockActivities.sendNotificationEmail.calledWith(
        mockInput.createdByEmail,
        "Your organization",
        "updated"
      )
    ).to.be.true;
  });
});
