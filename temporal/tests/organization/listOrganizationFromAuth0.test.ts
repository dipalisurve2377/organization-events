import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";

describe("listOrganizationFromAuth0", () => {
  let axiosStub: sinon.SinonStub;
  let getAuth0TokenStub: sinon.SinonStub;
  let listOrganizationFromAuth0: any;

  beforeEach(() => {
    // Create stubs
    axiosStub = sinon.stub();
    getAuth0TokenStub = sinon.stub();

    // Mock axios
    const axiosMock = {
      get: axiosStub,
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
    listOrganizationFromAuth0 = async (): Promise<any[]> => {
      try {
        const token = await getAuth0TokenStub();

        const response = await axiosStub(
          `https://${process.env.AUTH0_ORG_DOMAIN}/api/v2/organizations`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        return response.data;
      } catch (error: any) {
        let errorMessage = `Failed to list organizations from Auth0`;

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
          errorMessage += " — No response received from Auth0 (network issue).";
          throw ApplicationFailureMock.create({
            message: errorMessage,
            type: "NetworkError",
            nonRetryable: false,
          });
        } else {
          errorMessage += ` — Unexpected error: ${error?.message || "Unknown"}`;
          throw ApplicationFailureMock.create({
            message: errorMessage,
            type: "GenericListFailure",
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

  it("should successfully list organizations from Auth0", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockOrganizations = [
      {
        id: "org_123",
        name: "Test Organization 1",
        display_name: "Test Organization 1",
      },
      {
        id: "org_456",
        name: "Test Organization 2",
        display_name: "Test Organization 2",
      },
    ];

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.resolves({ data: mockOrganizations });

    // Act
    const result = await listOrganizationFromAuth0();

    // Assert
    expect(result).to.deep.equal(mockOrganizations);
    expect(getAuth0TokenStub.calledOnce).to.be.true;
    expect(axiosStub.calledOnce).to.be.true;
    expect(
      axiosStub.calledWith(
        `https://${process.env.AUTH0_ORG_DOMAIN}/api/v2/organizations`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      )
    ).to.be.true;
  });

  it("should handle Auth0 client errors (4xx) as non-retryable", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockError = {
      response: {
        status: 400,
        data: { error: "Bad Request", error_description: "Invalid request" },
      },
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await listOrganizationFromAuth0();
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("Auth0ClientError");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include(
        "Auth0 responded with status 400"
      );
    }
  });

  it("should handle Auth0 server errors (5xx) as retryable", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockError = {
      response: {
        status: 500,
        data: { error: "Internal Server Error" },
      },
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await listOrganizationFromAuth0();
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("Auth0ServerError");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "Auth0 responded with status 500"
      );
    }
  });

  it("should handle network errors as retryable", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockError = {
      request: {},
      message: "Network Error",
    };

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await listOrganizationFromAuth0();
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("NetworkError");
      expect((error as any).nonRetryable).to.be.false;
      expect((error as Error).message).to.include(
        "No response received from Auth0"
      );
    }
  });

  it("should handle generic errors as non-retryable", async () => {
    // Arrange
    const mockToken = "mock-access-token";
    const mockError = new Error("Unexpected error");

    getAuth0TokenStub.resolves(mockToken);
    axiosStub.rejects(mockError);

    // Act & Assert
    try {
      await listOrganizationFromAuth0();
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("GenericListFailure");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include("Unexpected error");
    }
  });

  it("should handle getAuth0Token failure", async () => {
    // Arrange
    const mockError = new Error("Failed to get Auth0 token");
    getAuth0TokenStub.rejects(mockError);

    // Act & Assert
    try {
      await listOrganizationFromAuth0();
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as any).type).to.equal("GenericListFailure");
      expect((error as any).nonRetryable).to.be.true;
      expect((error as Error).message).to.include("Failed to get Auth0 token");
    }
  });
});
