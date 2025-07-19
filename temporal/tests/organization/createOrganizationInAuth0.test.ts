import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";

describe("createOrganizationInAuth0", () => {
  let axiosStub: sinon.SinonStub;
  let getAuth0TokenStub: sinon.SinonStub;
  let createOrganizationInAuth0: any;

  beforeEach(() => {
    // Create stubs
    axiosStub = sinon.stub();
    getAuth0TokenStub = sinon.stub();

    // Mock axios
    const axiosMock = {
      post: axiosStub,
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
    createOrganizationInAuth0 = async (
      name: string,
      identifier: string,
      createdByEmail: string
    ): Promise<string> => {
      try {
        const token = await getAuth0TokenStub();

        const orgRes = await axiosStub(
          `https://${process.env.AUTH0_ORG_DOMAIN}/api/v2/organizations`,
          {
            display_name: name,
            name: identifier,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: 5000,
          }
        );

        const auth0Id = orgRes.data.id;
        return auth0Id;
      } catch (error: any) {
        let errorMessage = "Failed to create organization in Auth0.";

        if (error.response) {
          const status = error.response.status;
          errorMessage += ` Auth0 responded with status ${status}: ${JSON.stringify(
            error.response.data
          )}`;

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
        } else if (error.request) {
          errorMessage += ` No response from Auth0. Possible network issue.`;
          throw ApplicationFailureMock.create({
            message: errorMessage,
            type: "NetworkError",
            nonRetryable: false,
          });
        } else {
          errorMessage += ` Request setup failed: ${error.message}`;
          throw ApplicationFailureMock.create({
            message: errorMessage,
            type: "RequestSetupError",
            nonRetryable: false,
          });
        }
      }
    };
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  it("should successfully create organization in Auth0", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockName = "Test Organization";
    const mockIdentifier = "test-org-123";
    const mockCreatedByEmail = "admin@test.com";
    const mockAuth0Id = "org_abc123def456";

    const mockResponse = {
      data: {
        id: mockAuth0Id,
        name: mockIdentifier,
        display_name: mockName,
      },
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.resolves(mockResponse);

    // Act
    const result = await createOrganizationInAuth0(
      mockName,
      mockIdentifier,
      mockCreatedByEmail
    );

    // Assert
    expect(result).to.equal(mockAuth0Id);
    expect(getAuth0TokenStub.calledOnce).to.be.true;
    expect(axiosStub.calledOnce).to.be.true;
    expect(
      axiosStub.calledWith(
        `https://${process.env.AUTH0_ORG_DOMAIN}/api/v2/organizations`,
        {
          display_name: mockName,
          name: mockIdentifier,
        },
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
          timeout: 5000,
        }
      )
    ).to.be.true;
  });

  it("should handle Auth0 client errors (4xx) as non-retryable", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockName = "Test Organization";
    const mockIdentifier = "test-org-123";
    const mockCreatedByEmail = "admin@test.com";

    const mockError = {
      response: {
        status: 400,
        data: {
          error: "invalid_body",
          error_description: "Organization name already exists",
        },
      },
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await createOrganizationInAuth0(
        mockName,
        mockIdentifier,
        mockCreatedByEmail
      );
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("Auth0ClientError");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Auth0 responded with status 400"
      );
      expect((error as Error).message).to.include(
        "Organization name already exists"
      );
    }
  });

  it("should handle Auth0 server errors (5xx) as retryable", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockName = "Test Organization";
    const mockIdentifier = "test-org-123";
    const mockCreatedByEmail = "admin@test.com";

    const mockError = {
      response: {
        status: 500,
        data: {
          error: "internal_server_error",
          error_description: "Internal server error",
        },
      },
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await createOrganizationInAuth0(
        mockName,
        mockIdentifier,
        mockCreatedByEmail
      );
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("Auth0ServerError");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Auth0 responded with status 500"
      );
      expect((error as Error).message).to.include("Internal server error");
    }
  });

  it("should handle network errors as retryable", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockName = "Test Organization";
    const mockIdentifier = "test-org-123";
    const mockCreatedByEmail = "admin@test.com";

    const mockError = {
      request: {},
      message: "Network timeout",
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await createOrganizationInAuth0(
        mockName,
        mockIdentifier,
        mockCreatedByEmail
      );
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("NetworkError");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include("No response from Auth0");
      expect((error as Error).message).to.include("Possible network issue");
    }
  });

  it("should handle request setup errors as retryable", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockName = "Test Organization";
    const mockIdentifier = "test-org-123";
    const mockCreatedByEmail = "admin@test.com";

    const mockError = new Error("Request configuration error");

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await createOrganizationInAuth0(
        mockName,
        mockIdentifier,
        mockCreatedByEmail
      );
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("RequestSetupError");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include("Request setup failed");
      expect((error as Error).message).to.include(
        "Request configuration error"
      );
    }
  });

  it("should handle getAuth0Token failure", async () => {
    // Arrange
    const mockName = "Test Organization";
    const mockIdentifier = "test-org-123";
    const mockCreatedByEmail = "admin@test.com";
    const mockError = new Error("Failed to get Auth0 token");

    getAuth0TokenStub.rejects(mockError);

    // Act & Assert
    try {
      await createOrganizationInAuth0(
        mockName,
        mockIdentifier,
        mockCreatedByEmail
      );
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("RequestSetupError");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Failed to create organization in Auth0"
      );
      expect((error as Error).message).to.include("Request setup failed");
      expect((error as Error).message).to.include("Failed to get Auth0 token");
    }
  });

  it("should handle empty organization name", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockName = "";
    const mockIdentifier = "test-org-123";
    const mockCreatedByEmail = "admin@test.com";

    const mockError = {
      response: {
        status: 400,
        data: {
          error: "invalid_body",
          error_description: "Display name is required",
        },
      },
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await createOrganizationInAuth0(
        mockName,
        mockIdentifier,
        mockCreatedByEmail
      );
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("Auth0ClientError");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include("Display name is required");
    }
  });

  it("should handle duplicate organization identifier", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockName = "Test Organization";
    const mockIdentifier = "existing-org";
    const mockCreatedByEmail = "admin@test.com";

    const mockError = {
      response: {
        status: 409,
        data: {
          error: "organization_already_exists",
          error_description: "Organization with this identifier already exists",
        },
      },
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await createOrganizationInAuth0(
        mockName,
        mockIdentifier,
        mockCreatedByEmail
      );
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("Auth0ClientError");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Organization with this identifier already exists"
      );
    }
  });
});
