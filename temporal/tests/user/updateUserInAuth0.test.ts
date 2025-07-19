import { expect } from "chai";
import sinon from "sinon";
import axios from "axios";
import { ApplicationFailure } from "@temporalio/client";

// Mock User model
const UserMock = {
  findOne: sinon.stub(),
  findById: sinon.stub(),
  create: sinon.stub(),
};

// Mock the getAuth0Token function
const mockGetAuth0Token = sinon.stub();

// Mock the updateUserStatus function
const mockUpdateUserStatus = sinon.stub();

// Mock the updateUserInAuth0 activity function
const updateUserInAuth0 = async (
  email: string,
  updates: { name?: string; password?: string }
): Promise<void> => {
  try {
    const token = await mockGetAuth0Token();

    const user = await UserMock.findOne({ email });

    if (!user || !user.auth0Id) {
      throw ApplicationFailure.create({
        message: `User or Auth0 ID not found for email: ${email}`,
        type: "MissingAuth0ID",
        nonRetryable: true,
      });
    }

    console.log(`Auth0Id for updating user ${user.auth0Id}`);

    const payload: any = {};
    if (updates.name) payload.name = updates.name;
    if (updates.password) payload.password = updates.password;
    payload.connection = "Username-Password-Authentication";

    await axios.patch(
      `https://${process.env.AUTH0_USER_DOMAIN}/api/v2/users/${user.auth0Id}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Update user status and name in MongoDB
    await mockUpdateUserStatus(email, "updated", undefined, updates.name);

    console.log(`User updated in Auth0: ${email}`);
  } catch (error: any) {
    let errorMessage = `Failed to update user (email: ${email})`;
    let errorType = "Auth0UpdateUserError";
    let nonRetryable = false;

    if (error instanceof ApplicationFailure) {
      throw error;
    }

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      errorMessage += `. Status: ${status}`;
      if (data?.message) {
        errorMessage += `. Message: ${data.message}`;
      }

      if (status >= 400 && status < 500) {
        errorType = "Auth0ClientError";
        nonRetryable = true;
      } else if (status >= 500) {
        errorType = "Auth0ServerError";
        nonRetryable = false;
      }
    } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      errorType = "NetworkError";
      nonRetryable = false;
    }

    console.error("Error updating user in Auth0:", error);
    throw ApplicationFailure.create({
      message: errorMessage,
      type: errorType,
      nonRetryable,
    });
  }
};

describe("updateUserInAuth0", () => {
  let axiosPatchStub: sinon.SinonStub;

  beforeEach(() => {
    axiosPatchStub = sinon.stub(axios, "patch");
    mockGetAuth0Token.reset();
    mockUpdateUserStatus.reset();
    UserMock.findOne.reset();

    // Set default environment variables
    process.env.AUTH0_USER_DOMAIN = "test-domain.auth0.com";
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should successfully update user in Auth0 with name only", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = { name: "Updated User Name" };
    const mockToken = "mock-auth0-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.resolves({ status: 200 });
    mockUpdateUserStatus.resolves();

    // Act
    await updateUserInAuth0(email, updates);

    // Assert
    expect(mockGetAuth0Token.calledOnce).to.be.true;
    expect(UserMock.findOne.calledWith({ email })).to.be.true;
    expect(axiosPatchStub.calledOnce).to.be.true;
    expect(
      mockUpdateUserStatus.calledWith(email, "updated", undefined, updates.name)
    ).to.be.true;

    const [url, payload, config] = axiosPatchStub.firstCall.args;
    expect(url).to.equal(
      `https://test-domain.auth0.com/api/v2/users/${auth0Id}`
    );
    expect(payload).to.deep.equal({
      name: updates.name,
      connection: "Username-Password-Authentication",
    });
    expect(config.headers.Authorization).to.equal(`Bearer ${mockToken}`);
  });

  it("should successfully update user in Auth0 with password only", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = { password: "NewSecurePassword123!" };
    const mockToken = "mock-auth0-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.resolves({ status: 200 });
    mockUpdateUserStatus.resolves();

    // Act
    await updateUserInAuth0(email, updates);

    // Assert
    expect(axiosPatchStub.calledOnce).to.be.true;
    expect(
      mockUpdateUserStatus.calledWith(email, "updated", undefined, undefined)
    ).to.be.true;

    const [, payload] = axiosPatchStub.firstCall.args;
    expect(payload).to.deep.equal({
      password: updates.password,
      connection: "Username-Password-Authentication",
    });
  });

  it("should successfully update user in Auth0 with both name and password", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = {
      name: "Updated User Name",
      password: "NewSecurePassword123!",
    };
    const mockToken = "mock-auth0-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.resolves({ status: 200 });
    mockUpdateUserStatus.resolves();

    // Act
    await updateUserInAuth0(email, updates);

    // Assert
    expect(axiosPatchStub.calledOnce).to.be.true;
    expect(
      mockUpdateUserStatus.calledWith(email, "updated", undefined, updates.name)
    ).to.be.true;

    const [, payload] = axiosPatchStub.firstCall.args;
    expect(payload).to.deep.equal({
      name: updates.name,
      password: updates.password,
      connection: "Username-Password-Authentication",
    });
  });

  it("should handle user not found in database", async () => {
    // Arrange
    const email = "nonexistent@example.com";
    const updates = { name: "Updated Name" };

    UserMock.findOne.resolves(null);

    // Act & Assert
    try {
      await updateUserInAuth0(email, updates);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("MissingAuth0ID");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include(
        `User or Auth0 ID not found for email: ${email}`
      );
    }
  });

  it("should handle user with missing auth0Id", async () => {
    // Arrange
    const email = "test@example.com";
    const updates = { name: "Updated Name" };

    UserMock.findOne.resolves({ email, auth0Id: null });

    // Act & Assert
    try {
      await updateUserInAuth0(email, updates);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("MissingAuth0ID");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include(
        `User or Auth0 ID not found for email: ${email}`
      );
    }
  });

  it("should handle Auth0 client errors (4xx) as non-retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = { name: "Updated Name" };
    const mockToken = "mock-auth0-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.rejects({
      response: {
        status: 400,
        data: { message: "Invalid user data" },
      },
    });

    // Act & Assert
    try {
      await updateUserInAuth0(email, updates);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("Auth0ClientError");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include("Failed to update user");
      expect(error.message).to.include("Status: 400");
      expect(error.message).to.include("Invalid user data");
    }
  });

  it("should handle Auth0 server errors (5xx) as retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = { name: "Updated Name" };
    const mockToken = "mock-auth0-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.rejects({
      response: {
        status: 500,
        data: { message: "Internal server error" },
      },
    });

    // Act & Assert
    try {
      await updateUserInAuth0(email, updates);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("Auth0ServerError");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("Failed to update user");
      expect(error.message).to.include("Status: 500");
    }
  });

  it("should handle network errors as retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = { name: "Updated Name" };
    const mockToken = "mock-auth0-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.rejects({
      code: "ECONNREFUSED",
      message: "Connection refused",
    });

    // Act & Assert
    try {
      await updateUserInAuth0(email, updates);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("NetworkError");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("Failed to update user");
    }
  });

  it("should handle generic errors as non-retryable", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = { name: "Updated Name" };
    const mockToken = "mock-auth0-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.rejects(new Error("Generic error"));

    // Act & Assert
    try {
      await updateUserInAuth0(email, updates);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("Auth0UpdateUserError");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("Failed to update user");
    }
  });

  it("should handle database connection errors", async () => {
    // Arrange
    const email = "test@example.com";
    const updates = { name: "Updated Name" };

    UserMock.findOne.rejects(new Error("Database connection failed"));

    // Act & Assert
    try {
      await updateUserInAuth0(email, updates);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("Auth0UpdateUserError");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("Failed to update user");
    }
  });

  it("should handle getAuth0Token failure", async () => {
    // Arrange
    const email = "test@example.com";
    const updates = { name: "Updated Name" };

    mockGetAuth0Token.rejects(new Error("Token fetch failed"));

    // Act & Assert
    try {
      await updateUserInAuth0(email, updates);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("Auth0UpdateUserError");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("Failed to update user");
    }
  });

  it("should handle updateUserStatus failure", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = { name: "Updated Name" };
    const mockToken = "mock-auth0-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.resolves({ status: 200 });
    mockUpdateUserStatus.rejects(new Error("Status update failed"));

    // Act & Assert
    try {
      await updateUserInAuth0(email, updates);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("Auth0UpdateUserError");
      expect(error.nonRetryable).to.be.false;
      expect(error.message).to.include("Failed to update user");
    }
  });

  it("should handle Auth0 unauthorized error (401)", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = { name: "Updated Name" };
    const mockToken = "invalid-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.rejects({
      response: {
        status: 401,
        data: { message: "Unauthorized" },
      },
    });

    // Act & Assert
    try {
      await updateUserInAuth0(email, updates);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("Auth0ClientError");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include("Status: 401");
      expect(error.message).to.include("Unauthorized");
    }
  });

  it("should handle special characters in name", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = { name: "José María Ñoño 测试用户 🚀" };
    const mockToken = "mock-auth0-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.resolves({ status: 200 });
    mockUpdateUserStatus.resolves();

    // Act
    await updateUserInAuth0(email, updates);

    // Assert
    expect(axiosPatchStub.calledOnce).to.be.true;
    const [, payload] = axiosPatchStub.firstCall.args;
    expect(payload.name).to.equal(updates.name);
  });

  it("should handle empty updates object", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = {};
    const mockToken = "mock-auth0-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.resolves({ status: 200 });
    mockUpdateUserStatus.resolves();

    // Act
    await updateUserInAuth0(email, updates);

    // Assert
    expect(axiosPatchStub.calledOnce).to.be.true;
    const [, payload] = axiosPatchStub.firstCall.args;
    expect(payload).to.deep.equal({
      connection: "Username-Password-Authentication",
    });
  });

  it("should handle Auth0 rate limiting (429)", async () => {
    // Arrange
    const email = "test@example.com";
    const auth0Id = "auth0|123456789";
    const updates = { name: "Updated Name" };
    const mockToken = "mock-auth0-token";

    mockGetAuth0Token.resolves(mockToken);
    UserMock.findOne.resolves({ email, auth0Id });
    axiosPatchStub.rejects({
      response: {
        status: 429,
        data: { message: "Too many requests" },
      },
    });

    // Act & Assert
    try {
      await updateUserInAuth0(email, updates);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error).to.be.instanceOf(ApplicationFailure);
      expect(error.type).to.equal("Auth0ClientError");
      expect(error.nonRetryable).to.be.true;
      expect(error.message).to.include("Status: 429");
      expect(error.message).to.include("Too many requests");
    }
  });
});
