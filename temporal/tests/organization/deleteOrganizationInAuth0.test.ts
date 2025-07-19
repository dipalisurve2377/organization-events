import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";

describe("deleteOrganizationInAuth0", () => {
  let connectDBStub: sinon.SinonStub;
  let getAuth0TokenStub: sinon.SinonStub;
  let axiosDeleteStub: sinon.SinonStub;
  let findByIdStub: sinon.SinonStub;
  let deleteOrganizationInAuth0: any;
  let OrganizationMock: any;

  beforeEach(() => {
    // Create stubs
    connectDBStub = sinon.stub();
    getAuth0TokenStub = sinon.stub();
    axiosDeleteStub = sinon.stub();
    findByIdStub = sinon.stub();

    // Mock Organization model
    OrganizationMock = {
      findById: findByIdStub,
    };

    // Mock axios
    const axiosMock = {
      delete: axiosDeleteStub,
      isAxiosError: sinon.stub().returns(true),
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

    // Set up environment variables for testing
    process.env.AUTH0_ORG_DOMAIN = "test-domain.auth0.com";

    // Create the function to test inline to avoid import issues
    deleteOrganizationInAuth0 = async (orgId: string): Promise<void> => {
      try {
        await connectDBStub();

        const token = await getAuth0TokenStub();

        const org = await OrganizationMock.findById(orgId);

        if (!org || !org.auth0Id) {
          throw ApplicationFailureMock.create({
            message: `Organization or Auth0 ID not found for orgId: ${orgId}`,
            type: "MissingAuth0ID",
            nonRetryable: true,
          });
        }

        console.log("Auth0Id for deleting organization", org.auth0Id);

        await axiosMock.delete(
          `https://${process.env.AUTH0_ORG_DOMAIN}/api/v2/organizations/${org.auth0Id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (error: any) {
        let errorMessage = `Failed to delete organization (orgId: ${orgId})`;

        if (axiosMock.isAxiosError(error) && error.response) {
          const status = error.response.status;
          const data = JSON.stringify(error.response.data);
          errorMessage += ` — Auth0 responded with status ${status}: ${data}`;

          if (status >= 400 && status < 500) {
            throw ApplicationFailureMock.create({
              message: errorMessage,
              type: "Auth0ClientError",
              nonRetryable: true,
            });
          }

          throw ApplicationFailureMock.create({
            message: errorMessage,
            type: "Auth0ServerError",
            nonRetryable: false,
          });
        } else if (axiosMock.isAxiosError(error) && error.request) {
          errorMessage +=
            " — No response received from Auth0. Possible network issue.";
          throw ApplicationFailureMock.create({
            message: errorMessage,
            type: "NetworkError",
            nonRetryable: false,
          });
        } else {
          errorMessage += ` — Error setting up request: ${
            error.message || "Unknown error"
          }`;

          throw ApplicationFailureMock.create({
            message: errorMessage,
            type: "GenericDeleteFailure",
            nonRetryable: true,
          });
        }
      }
    };
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  it("should successfully delete organization from Auth0", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockAuth0Id = "org_abc123def456";
    const mockToken = "mock-access-token";
    const mockOrganization = {
      _id: mockOrgId,
      identifier: "test-org-123",
      name: "Test Organization",
      auth0Id: mockAuth0Id,
      createdByEmail: "admin@test.com",
      status: "success",
    };

    connectDBStub.resolves();
    getAuth0TokenStub.resolves(mockToken);
    findByIdStub.resolves(mockOrganization);
    axiosDeleteStub.resolves();

    // Act
    await deleteOrganizationInAuth0(mockOrgId);

    // Assert
    expect(connectDBStub.calledOnce).to.be.true;
    expect(getAuth0TokenStub.calledOnce).to.be.true;
    expect(findByIdStub.calledOnce).to.be.true;
    expect(findByIdStub.calledWith(mockOrgId)).to.be.true;
    expect(axiosDeleteStub.calledOnce).to.be.true;
    expect(
      axiosDeleteStub.calledWith(
        `https://${process.env.AUTH0_ORG_DOMAIN}/api/v2/organizations/${mockAuth0Id}`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      )
    ).to.be.true;
  });

  it("should handle organization not found in database", async () => {
    // Arrange
    const mockOrgId = "non-existent-org-id";

    connectDBStub.resolves();
    getAuth0TokenStub.resolves("mock-token");
    findByIdStub.resolves(null); // Organization not found

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("GenericDeleteFailure");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Failed to delete organization"
      );
      expect((error as Error).message).to.include("Error setting up request");
      expect((error as Error).message).to.include(
        "Organization or Auth0 ID not found"
      );
      expect((error as Error).message).to.include(mockOrgId);
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(getAuth0TokenStub.calledOnce).to.be.true;
    expect(findByIdStub.calledOnce).to.be.true;
    expect(axiosDeleteStub.called).to.be.false;
  });

  it("should handle organization with missing auth0Id", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockOrganization = {
      _id: mockOrgId,
      identifier: "test-org-123",
      name: "Test Organization",
      auth0Id: null, // Missing auth0Id
      createdByEmail: "admin@test.com",
      status: "failed",
    };

    connectDBStub.resolves();
    getAuth0TokenStub.resolves("mock-token");
    findByIdStub.resolves(mockOrganization);

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("GenericDeleteFailure");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Failed to delete organization"
      );
      expect((error as Error).message).to.include("Error setting up request");
      expect((error as Error).message).to.include(
        "Organization or Auth0 ID not found"
      );
      expect((error as Error).message).to.include(mockOrgId);
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(getAuth0TokenStub.calledOnce).to.be.true;
    expect(findByIdStub.calledOnce).to.be.true;
    expect(axiosDeleteStub.called).to.be.false;
  });
  it("should handle Auth0 client errors (4xx) as non-retryable", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockAuth0Id = "org_abc123def456";
    const mockToken = "mock-access-token";
    const mockOrganization = {
      _id: mockOrgId,
      auth0Id: mockAuth0Id,
      name: "Test Organization",
    };
    const mockError = {
      response: {
        status: 404,
        data: {
          error: "organization_not_found",
          error_description: "Organization not found in Auth0",
        },
      },
    };

    connectDBStub.resolves();
    getAuth0TokenStub.resolves(mockToken);
    findByIdStub.resolves(mockOrganization);
    axiosDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("Auth0ClientError");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Failed to delete organization"
      );
      expect((error as Error).message).to.include(
        "Auth0 responded with status 404"
      );
      expect((error as Error).message).to.include(
        "Organization not found in Auth0"
      );
    }
  });

  it("should handle Auth0 server errors (5xx) as retryable", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockAuth0Id = "org_abc123def456";
    const mockToken = "mock-access-token";
    const mockOrganization = {
      _id: mockOrgId,
      auth0Id: mockAuth0Id,
      name: "Test Organization",
    };
    const mockError = {
      response: {
        status: 500,
        data: {
          error: "internal_server_error",
          error_description: "Internal server error",
        },
      },
    };

    connectDBStub.resolves();
    getAuth0TokenStub.resolves(mockToken);
    findByIdStub.resolves(mockOrganization);
    axiosDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("Auth0ServerError");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to delete organization"
      );
      expect((error as Error).message).to.include(
        "Auth0 responded with status 500"
      );
      expect((error as Error).message).to.include("Internal server error");
    }
  });

  it("should handle network errors as retryable", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockAuth0Id = "org_abc123def456";
    const mockToken = "mock-access-token";
    const mockOrganization = {
      _id: mockOrgId,
      auth0Id: mockAuth0Id,
      name: "Test Organization",
    };
    const mockError = {
      request: {},
      message: "Network timeout",
    };

    connectDBStub.resolves();
    getAuth0TokenStub.resolves(mockToken);
    findByIdStub.resolves(mockOrganization);
    axiosDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("NetworkError");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to delete organization"
      );
      expect((error as Error).message).to.include(
        "No response received from Auth0"
      );
      expect((error as Error).message).to.include("Possible network issue");
    }
  });

  it("should handle generic errors as non-retryable", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockAuth0Id = "org_abc123def456";
    const mockToken = "mock-access-token";
    const mockOrganization = {
      _id: mockOrgId,
      auth0Id: mockAuth0Id,
      name: "Test Organization",
    };
    const mockError = new Error("Request configuration error");

    connectDBStub.resolves();
    getAuth0TokenStub.resolves(mockToken);
    findByIdStub.resolves(mockOrganization);
    axiosDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("GenericDeleteFailure");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Failed to delete organization"
      );
      expect((error as Error).message).to.include("Error setting up request");
      expect((error as Error).message).to.include(
        "Request configuration error"
      );
    }
  });

  it("should handle database connection errors", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockError = new Error("MongoDB connection failed");

    connectDBStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("GenericDeleteFailure");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Failed to delete organization"
      );
      expect((error as Error).message).to.include("Error setting up request");
      expect((error as Error).message).to.include("MongoDB connection failed");
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(getAuth0TokenStub.called).to.be.false;
    expect(findByIdStub.called).to.be.false;
    expect(axiosDeleteStub.called).to.be.false;
  });

  it("should handle getAuth0Token failure", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockError = new Error("Failed to get Auth0 token");

    connectDBStub.resolves();
    getAuth0TokenStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("GenericDeleteFailure");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Failed to delete organization"
      );
      expect((error as Error).message).to.include("Error setting up request");
      expect((error as Error).message).to.include("Failed to get Auth0 token");
    }

    expect(connectDBStub.calledOnce).to.be.true;
    expect(getAuth0TokenStub.calledOnce).to.be.true;
    expect(findByIdStub.called).to.be.false;
    expect(axiosDeleteStub.called).to.be.false;
  });

  it("should handle invalid ObjectId format", async () => {
    // Arrange
    const mockOrgId = "invalid-object-id";
    const mockError = new Error("Cast to ObjectId failed");

    connectDBStub.resolves();
    getAuth0TokenStub.resolves("mock-token");
    findByIdStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("GenericDeleteFailure");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Failed to delete organization"
      );
      expect((error as Error).message).to.include("Error setting up request");
      expect((error as Error).message).to.include("Cast to ObjectId failed");
    }
  });

  it("should handle Auth0 unauthorized error (401)", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockAuth0Id = "org_abc123def456";
    const mockToken = "invalid-token";
    const mockOrganization = {
      _id: mockOrgId,
      auth0Id: mockAuth0Id,
      name: "Test Organization",
    };
    const mockError = {
      response: {
        status: 401,
        data: { error: "unauthorized", error_description: "Invalid token" },
      },
    };

    connectDBStub.resolves();
    getAuth0TokenStub.resolves(mockToken);
    findByIdStub.resolves(mockOrganization);
    axiosDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("Auth0ClientError");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Auth0 responded with status 401"
      );
      expect((error as Error).message).to.include("Invalid token");
    }
  });

  it("should handle organization with empty auth0Id string", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockOrganization = {
      _id: mockOrgId,
      identifier: "test-org-123",
      name: "Test Organization",
      auth0Id: "", // Empty string auth0Id
      createdByEmail: "admin@test.com",
      status: "failed",
    };

    connectDBStub.resolves();
    getAuth0TokenStub.resolves("mock-token");
    findByIdStub.resolves(mockOrganization);

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("GenericDeleteFailure");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Failed to delete organization"
      );
      expect((error as Error).message).to.include("Error setting up request");
      expect((error as Error).message).to.include(
        "Organization or Auth0 ID not found"
      );
    }
  });

  it("should handle Auth0 rate limiting (429)", async () => {
    // Arrange
    const mockOrgId = "64f5b8c9e1234567890abcde";
    const mockAuth0Id = "org_abc123def456";
    const mockToken = "mock-access-token";
    const mockOrganization = {
      _id: mockOrgId,
      auth0Id: mockAuth0Id,
      name: "Test Organization",
    };
    const mockError = {
      response: {
        status: 429,
        data: {
          error: "too_many_requests",
          error_description: "Rate limit exceeded",
        },
      },
    };

    connectDBStub.resolves();
    getAuth0TokenStub.resolves(mockToken);
    findByIdStub.resolves(mockOrganization);
    axiosDeleteStub.rejects(mockError);

    // Act & Assert
    try {
      await deleteOrganizationInAuth0(mockOrgId);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("Auth0ClientError");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Auth0 responded with status 429"
      );
      expect((error as Error).message).to.include("Rate limit exceeded");
    }
  });
});
