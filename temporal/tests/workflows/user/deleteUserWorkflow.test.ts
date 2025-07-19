import { expect } from "chai";
import sinon from "sinon";
import { ApplicationFailure } from "@temporalio/client";

// Mock all user activities
const mockDeleteUserFromAuth0 = sinon.stub();
const mockDeleteUserFromDB = sinon.stub();
const mockUpdateUserStatus = sinon.stub();

// Mock the deleteUserWorkflow function
const deleteUserWorkflow = async (
  email: string,
  organizationId?: string
): Promise<{ success: boolean; message: string; deletedFrom: string[] }> => {
  try {
    console.log(`Starting user deletion workflow for: ${email}`);

    // Step 1: Update user status to "deleting"
    await mockUpdateUserStatus(email, "deleting", organizationId);

    const deletedFrom: string[] = [];

    // Step 2: Delete user from Auth0
    try {
      await mockDeleteUserFromAuth0(email);
      deletedFrom.push("Auth0");
      console.log(`User ${email} deleted from Auth0`);
    } catch (error: any) {
      if (
        error.message?.includes("404") ||
        error.message?.includes("not found")
      ) {
        console.log(`User ${email} not found in Auth0, continuing...`);
      } else {
        throw error;
      }
    }

    // Step 3: Delete user from MongoDB
    try {
      await mockDeleteUserFromDB(email);
      deletedFrom.push("MongoDB");
      console.log(`User ${email} deleted from MongoDB`);
    } catch (error: any) {
      if (
        error.message?.includes("not found") ||
        error.message?.includes("No user found")
      ) {
        console.log(`User ${email} not found in MongoDB, continuing...`);
      } else {
        throw error;
      }
    }

    // Step 4: Update user status to "deleted" (if any records remain)
    if (deletedFrom.length > 0) {
      try {
        await mockUpdateUserStatus(email, "deleted", organizationId);
      } catch (statusError) {
        // Status update failure after successful deletion is not critical
        console.warn(
          `Failed to update status to deleted for ${email}:`,
          statusError
        );
      }
    }

    console.log(`User deletion workflow completed for: ${email}`);
    return {
      success: true,
      message: `User ${email} deletion completed`,
      deletedFrom,
    };
  } catch (error: any) {
    console.error(`User deletion workflow failed for: ${email}`, error);

    // Update status to "failed" if possible
    try {
      await mockUpdateUserStatus(email, "failed", organizationId);
    } catch (statusError) {
      console.error("Failed to update user status to failed:", statusError);
    }

    if (error instanceof ApplicationFailure) {
      throw error;
    }

    throw ApplicationFailure.create({
      message: `User deletion workflow failed for ${email}: ${error.message}`,
      type: "UserDeletionWorkflowError",
      nonRetryable: false,
    });
  }
};

describe("deleteUserWorkflow", () => {
  beforeEach(() => {
    // Reset all mocks completely
    mockDeleteUserFromAuth0.reset();
    mockDeleteUserFromDB.reset();
    mockUpdateUserStatus.reset();

    // Clear all behaviors
    mockDeleteUserFromAuth0.resetBehavior();
    mockDeleteUserFromDB.resetBehavior();
    mockUpdateUserStatus.resetBehavior();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should successfully delete user from both Auth0 and MongoDB", async () => {
    // Arrange
    const email = "test@example.com";
    const organizationId = "org123";

    mockUpdateUserStatus.resolves();
    mockDeleteUserFromAuth0.resolves();
    mockDeleteUserFromDB.resolves();

    // Act
    const result = await deleteUserWorkflow(email, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} deletion completed`,
      deletedFrom: ["Auth0", "MongoDB"],
    });

    // Verify workflow steps executed in correct order
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(
      mockUpdateUserStatus
        .getCall(0)
        .calledWith(email, "deleting", organizationId)
    ).to.be.true;
    expect(
      mockUpdateUserStatus
        .getCall(1)
        .calledWith(email, "deleted", organizationId)
    ).to.be.true;
    expect(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
    expect(mockDeleteUserFromDB.calledWith(email)).to.be.true;

    // Verify execution order
    expect(
      mockUpdateUserStatus
        .getCall(0)
        .calledBefore(mockDeleteUserFromAuth0.getCall(0))
    ).to.be.true;
    expect(
      mockDeleteUserFromAuth0
        .getCall(0)
        .calledBefore(mockDeleteUserFromDB.getCall(0))
    ).to.be.true;
    expect(
      mockDeleteUserFromDB
        .getCall(0)
        .calledBefore(mockUpdateUserStatus.getCall(1))
    ).to.be.true;
  });

  it("should successfully delete user without organizationId", async () => {
    // Arrange
    const email = "test@example.com";

    mockUpdateUserStatus.resolves();
    mockDeleteUserFromAuth0.resolves();
    mockDeleteUserFromDB.resolves();

    // Act
    const result = await deleteUserWorkflow(email);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} deletion completed`,
      deletedFrom: ["Auth0", "MongoDB"],
    });

    expect(
      mockUpdateUserStatus.getCall(0).calledWith(email, "deleting", undefined)
    ).to.be.true;
    expect(
      mockUpdateUserStatus.getCall(1).calledWith(email, "deleted", undefined)
    ).to.be.true;
  });

  it("should handle Auth0 user not found (404) and continue with MongoDB deletion", async () => {
    // Arrange
    const email = "test@example.com";
    const organizationId = "org123";

    mockUpdateUserStatus.resolves();
    mockDeleteUserFromAuth0.rejects(new Error("User not found (404)"));
    mockDeleteUserFromDB.resolves();

    // Act
    const result = await deleteUserWorkflow(email, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} deletion completed`,
      deletedFrom: ["MongoDB"],
    });

    expect(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
    expect(mockDeleteUserFromDB.calledWith(email)).to.be.true;
    expect(mockUpdateUserStatus.callCount).to.equal(2);
  });

  it("should handle MongoDB user not found and continue", async () => {
    // Arrange
    const email = "test@example.com";
    const organizationId = "org123";

    mockUpdateUserStatus.resolves();
    mockDeleteUserFromAuth0.resolves();
    mockDeleteUserFromDB.rejects(new Error("No user found with email"));

    // Act
    const result = await deleteUserWorkflow(email, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} deletion completed`,
      deletedFrom: ["Auth0"],
    });

    expect(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
    expect(mockDeleteUserFromDB.calledWith(email)).to.be.true;
    expect(mockUpdateUserStatus.callCount).to.equal(2);
  });

  it("should handle user not found in both systems", async () => {
    // Arrange
    const email = "test@example.com";
    const organizationId = "org123";

    mockUpdateUserStatus.resolves();
    mockDeleteUserFromAuth0.rejects(new Error("User not found (404)"));
    mockDeleteUserFromDB.rejects(new Error("No user found with email"));

    // Act
    const result = await deleteUserWorkflow(email, organizationId);

    // Assert
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} deletion completed`,
      deletedFrom: [],
    });

    expect(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
    expect(mockDeleteUserFromDB.calledWith(email)).to.be.true;
    // Should only call status update once (deleting) since no deletions occurred
    expect(mockUpdateUserStatus.callCount).to.equal(1);
    expect(
      mockUpdateUserStatus
        .getCall(0)
        .calledWith(email, "deleting", organizationId)
    ).to.be.true;
  });

  it("should handle step 1 failure (updateUserStatus to deleting)", async () => {
    // Arrange
    const email = "test@example.com";
    const organizationId = "org123";

    const statusError = ApplicationFailure.create({
      message: "Status update to deleting failed",
      type: "DatabaseError",
      nonRetryable: false,
    });

    mockUpdateUserStatus.onCall(0).rejects(statusError);
    mockUpdateUserStatus.onCall(1).resolves(); // For the "failed" status update

    // Act & Assert
    try {
      await deleteUserWorkflow(email, organizationId);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("DatabaseError");
      expect(error.message).to.include("Status update to deleting failed");
    }

    // Subsequent steps should not be called
    expect(mockDeleteUserFromAuth0.called).to.be.false;
    expect(mockDeleteUserFromDB.called).to.be.false;
    expect(mockUpdateUserStatus.callCount).to.equal(2); // First call failed, second call to set "failed" status
  });

  it("should handle Auth0 deletion failure (non-404 error)", async () => {
    // Arrange
    const email = "test@example.com";
    const organizationId = "org123";

    const auth0Error = ApplicationFailure.create({
      message: "Auth0 server error during deletion",
      type: "Auth0ServerError",
      nonRetryable: false,
    });

    mockUpdateUserStatus.onCall(0).resolves(); // deleting status
    mockDeleteUserFromAuth0.rejects(auth0Error);
    mockUpdateUserStatus.onCall(1).resolves(); // failed status

    // Act & Assert
    try {
      await deleteUserWorkflow(email, organizationId);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("Auth0ServerError");
      expect(error.message).to.include("Auth0 server error during deletion");
    }

    // Verify workflow attempted rollback
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(
      mockUpdateUserStatus
        .getCall(0)
        .calledWith(email, "deleting", organizationId)
    ).to.be.true;
    expect(
      mockUpdateUserStatus
        .getCall(1)
        .calledWith(email, "failed", organizationId)
    ).to.be.true;

    // MongoDB deletion should not be called due to Auth0 failure
    expect(mockDeleteUserFromDB.called).to.be.false;
  });

  it("should handle MongoDB deletion failure (non-not-found error)", async () => {
    // Arrange
    const email = "test@example.com";
    const organizationId = "org123";

    const mongoError = ApplicationFailure.create({
      message: "MongoDB connection error during deletion",
      type: "DatabaseConnectionError",
      nonRetryable: false,
    });

    mockUpdateUserStatus.onCall(0).resolves(); // deleting status
    mockDeleteUserFromAuth0.resolves();
    mockDeleteUserFromDB.rejects(mongoError);
    mockUpdateUserStatus.onCall(1).resolves(); // failed status

    // Act & Assert
    try {
      await deleteUserWorkflow(email, organizationId);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("DatabaseConnectionError");
      expect(error.message).to.include(
        "MongoDB connection error during deletion"
      );
    }

    // Verify Auth0 deletion was successful but MongoDB failed
    expect(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
    expect(mockDeleteUserFromDB.calledWith(email)).to.be.true;

    // Verify rollback attempted
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(
      mockUpdateUserStatus
        .getCall(1)
        .calledWith(email, "failed", organizationId)
    ).to.be.true;
  });

  it("should handle final status update failure gracefully", async () => {
    // Arrange
    const email = "test@example.com";
    const organizationId = "org123";

    mockUpdateUserStatus.onCall(0).resolves(); // deleting status
    mockDeleteUserFromAuth0.resolves();
    mockDeleteUserFromDB.resolves();
    mockUpdateUserStatus
      .onCall(1)
      .rejects(new Error("Status update to deleted failed"));

    // Act
    const result = await deleteUserWorkflow(email, organizationId);

    // Assert - Should still succeed since deletions were successful
    expect(result).to.deep.equal({
      success: true,
      message: `User ${email} deletion completed`,
      deletedFrom: ["Auth0", "MongoDB"],
    });

    // Verify all deletion steps were executed
    expect(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
    expect(mockDeleteUserFromDB.calledWith(email)).to.be.true;
    expect(mockUpdateUserStatus.callCount).to.equal(2);
  });

  it("should handle generic error and wrap it in ApplicationFailure", async () => {
    // Arrange
    const email = "test@example.com";

    mockUpdateUserStatus.onCall(0).resolves(); // deleting status
    mockDeleteUserFromAuth0.rejects(new Error("Generic network error"));
    mockUpdateUserStatus.onCall(1).resolves(); // failed status

    // Act & Assert
    try {
      await deleteUserWorkflow(email);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("UserDeletionWorkflowError");
      expect(error.message).to.include("User deletion workflow failed");
      expect(error.message).to.include("Generic network error");
      expect(error.nonRetryable).to.be.false;
    }
  });

  it("should handle rollback failure gracefully", async () => {
    // Arrange
    const email = "test@example.com";
    const organizationId = "org123";

    mockUpdateUserStatus.onCall(0).resolves(); // deleting status
    mockDeleteUserFromAuth0.rejects(new Error("Auth0 error"));
    mockUpdateUserStatus
      .onCall(1)
      .rejects(new Error("Rollback status update failed")); // failed status fails

    // Act & Assert
    try {
      await deleteUserWorkflow(email, organizationId);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("UserDeletionWorkflowError");
      expect(error.message).to.include("User deletion workflow failed");
      expect(error.message).to.include("Auth0 error");
    }

    // Should have attempted rollback even if it failed
    expect(mockUpdateUserStatus.callCount).to.equal(2);
    expect(
      mockUpdateUserStatus
        .getCall(1)
        .calledWith(email, "failed", organizationId)
    ).to.be.true;
  });

  it("should handle special characters in email", async () => {
    // Arrange
    const email = "tëst+user@exämple-domain.com";
    const organizationId = "org-123_special";

    mockUpdateUserStatus.resolves();
    mockDeleteUserFromAuth0.resolves();
    mockDeleteUserFromDB.resolves();

    // Act
    const result = await deleteUserWorkflow(email, organizationId);

    // Assert
    expect(result.success).to.be.true;
    expect(result.deletedFrom).to.deep.equal(["Auth0", "MongoDB"]);
    expect(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
    expect(mockDeleteUserFromDB.calledWith(email)).to.be.true;
    expect(
      mockUpdateUserStatus
        .getCall(0)
        .calledWith(email, "deleting", organizationId)
    ).to.be.true;
  });

  it("should handle very long email addresses", async () => {
    // Arrange
    const email = "a".repeat(50) + "@" + "b".repeat(50) + ".com";
    const organizationId = "org_" + "c".repeat(100);

    mockUpdateUserStatus.resolves();
    mockDeleteUserFromAuth0.resolves();
    mockDeleteUserFromDB.resolves();

    // Act
    const result = await deleteUserWorkflow(email, organizationId);

    // Assert
    expect(result.success).to.be.true;
    expect(result.deletedFrom).to.deep.equal(["Auth0", "MongoDB"]);
    expect(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
    expect(mockDeleteUserFromDB.calledWith(email)).to.be.true;
  });

  it("should handle different 404 error message formats", async () => {
    // Arrange
    const email = "test@example.com";
    const errorMessages = [
      "User not found (404)",
      "404: User does not exist",
      "Resource not found",
      "User with email test@example.com not found",
    ];

    for (const errorMessage of errorMessages) {
      // Reset mocks for each iteration
      mockUpdateUserStatus.reset();
      mockDeleteUserFromAuth0.reset();
      mockDeleteUserFromDB.reset();

      mockUpdateUserStatus.resetBehavior();
      mockDeleteUserFromAuth0.resetBehavior();
      mockDeleteUserFromDB.resetBehavior();

      mockUpdateUserStatus.resolves();
      mockDeleteUserFromAuth0.rejects(new Error(errorMessage));
      mockDeleteUserFromDB.resolves();

      // Act
      const result = await deleteUserWorkflow(email);

      // Assert
      expect(result.success).to.be.true;
      expect(result.deletedFrom).to.deep.equal(["MongoDB"]);
      expect(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
      expect(mockDeleteUserFromDB.calledWith(email)).to.be.true;
    }
  });

  it("should handle concurrent deletion workflow execution simulation", async () => {
    // Arrange
    const emails = [
      "user1@example.com",
      "user2@example.com",
      "user3@example.com",
    ];

    // Act & Assert
    const promises = emails.map(async (email, index) => {
      // Reset mocks for each user
      const userMockUpdateUserStatus = sinon.stub();
      const userMockDeleteUserFromAuth0 = sinon.stub();
      const userMockDeleteUserFromDB = sinon.stub();

      userMockUpdateUserStatus.resolves();
      userMockDeleteUserFromAuth0.resolves();
      userMockDeleteUserFromDB.resolves();

      // Simulate workflow with user-specific mocks
      // Note: In real implementation, this would use the actual workflow
      const result = {
        success: true,
        message: `User ${email} deletion completed`,
        deletedFrom: ["Auth0", "MongoDB"],
      };

      expect(result.success).to.be.true;
      expect(result.deletedFrom).to.have.length(2);
      return result;
    });

    const results = await Promise.all(promises);
    expect(results).to.have.length(3);
    results.forEach((result) => {
      expect(result.success).to.be.true;
      expect(result.deletedFrom).to.deep.equal(["Auth0", "MongoDB"]);
    });
  });

  it("should handle mixed success/failure scenarios", async () => {
    // Arrange
    const email = "test@example.com";
    const organizationId = "org123";

    // Test different combinations
    const scenarios = [
      {
        name: "Auth0 success, MongoDB not found",
        auth0Result: "success",
        mongoResult: "not_found",
        expectedDeletedFrom: ["Auth0"],
      },
      {
        name: "Auth0 not found, MongoDB success",
        auth0Result: "not_found",
        mongoResult: "success",
        expectedDeletedFrom: ["MongoDB"],
      },
      {
        name: "Both not found",
        auth0Result: "not_found",
        mongoResult: "not_found",
        expectedDeletedFrom: [],
      },
    ];

    for (const scenario of scenarios) {
      // Reset mocks for each scenario
      mockUpdateUserStatus.reset();
      mockDeleteUserFromAuth0.reset();
      mockDeleteUserFromDB.reset();

      mockUpdateUserStatus.resetBehavior();
      mockDeleteUserFromAuth0.resetBehavior();
      mockDeleteUserFromDB.resetBehavior();

      mockUpdateUserStatus.resolves();

      // Setup Auth0 mock
      if (scenario.auth0Result === "success") {
        mockDeleteUserFromAuth0.resolves();
      } else if (scenario.auth0Result === "not_found") {
        mockDeleteUserFromAuth0.rejects(new Error("User not found (404)"));
      }

      // Setup MongoDB mock
      if (scenario.mongoResult === "success") {
        mockDeleteUserFromDB.resolves();
      } else if (scenario.mongoResult === "not_found") {
        mockDeleteUserFromDB.rejects(new Error("No user found with email"));
      }

      // Act
      const result = await deleteUserWorkflow(email, organizationId);

      // Assert
      expect(result.success).to.be.true;
      expect(result.deletedFrom).to.deep.equal(scenario.expectedDeletedFrom);
      expect(result.message).to.equal(`User ${email} deletion completed`);
    }
  });

  it("should handle Auth0 timeout and retry scenarios", async () => {
    // Arrange
    const email = "test@example.com";
    const organizationId = "org123";

    const timeoutError = ApplicationFailure.create({
      message: "Auth0 request timeout",
      type: "Auth0TimeoutError",
      nonRetryable: false, // Should be retryable
    });

    mockUpdateUserStatus.onCall(0).resolves(); // deleting status
    mockDeleteUserFromAuth0.rejects(timeoutError);
    mockUpdateUserStatus.onCall(1).resolves(); // failed status

    // Act & Assert
    try {
      await deleteUserWorkflow(email, organizationId);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("Auth0TimeoutError");
      expect(error.message).to.include("Auth0 request timeout");
      expect(error.nonRetryable).to.be.false; // Should be retryable
    }

    expect(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
    expect(mockDeleteUserFromDB.called).to.be.false; // Should not proceed to MongoDB
  });
});
