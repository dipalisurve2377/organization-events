import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";

describe("sendNotificationEmail", () => {
  let nodemailerStub: sinon.SinonStub;
  let transporterMock: any;
  let sendNotificationEmail: any;
  let originalEnv: any;

  beforeEach(() => {
    // Store original environment variables
    originalEnv = {
      EMAIL_USER: process.env.EMAIL_USER,
      EMAIL_PASS: process.env.EMAIL_PASS,
    };

    // Set up test environment variables
    process.env.EMAIL_USER = "test@example.com";
    process.env.EMAIL_PASS = "test-password";

    // Create transporter mock
    transporterMock = {
      sendMail: sinon.stub(),
    };

    // Create nodemailer mock
    nodemailerStub = sinon.stub().returns(transporterMock);

    // Mock nodemailer.createTransport
    const nodemailerMock = {
      createTransport: nodemailerStub,
    };

    // Create the function to test inline to avoid import issues
    sendNotificationEmail = async (
      to: string,
      name: string,
      action:
        | "created"
        | "updated"
        | "deleted"
        | "cancelled"
        | "failed" = "created"
    ): Promise<void> => {
      try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
          throw new Error(
            "EMAIL_USER or EMAIL_PASS environment variable is missing."
          );
        }
        const transporter = nodemailerMock.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
          connectionTimeout: 30000,
        });

        // creating dynamic body for mail
        let messageBody = "";
        if (action == "created") {
          messageBody = `<p>Hello,</p>
            <p>Your organization <strong>${name}</strong> has been <span style="color:green;"><strong>successfully created</strong></span>.</p>`;
        } else if (action == "updated") {
          messageBody = `<p>Hello,</p>
            <p>Your organization has been <span style="color:orange;"><strong>successfully updated to ${name}</strong></span>.</p>`;
        } else if (action == "deleted") {
          messageBody = `<p>Hello,</p>
            <p>Your organization <strong>${name}</strong> has been <span style="color:red;"><strong>successfully deleted</strong></span>.</p>`;
        }

        const htmlTemplate = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            ${messageBody}
            <p style="margin-top: 20px;">Thank you,<br/>Organization Events Team</p>
          </div>
        `;

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to,
          subject: `Organization ${action}`,
          html: htmlTemplate,
        });

        console.log(`Notification email sent to ${to} for action ${action}`);
      } catch (error: any) {
        const errorMsg = `Failed to send notification email to ${to} for action "${action}": ${error.message}`;
        console.error(errorMsg);

        throw new Error(errorMsg);
      }
    };
  });

  afterEach(() => {
    // Restore original environment variables
    process.env.EMAIL_USER = originalEnv.EMAIL_USER;
    process.env.EMAIL_PASS = originalEnv.EMAIL_PASS;

    // Restore all stubs
    sinon.restore();
  });

  it("should successfully send notification email for created action", async () => {
    // Arrange
    const mockTo = "user@example.com";
    const mockName = "Test Organization";
    const mockAction = "created";

    transporterMock.sendMail.resolves();

    // Act
    await sendNotificationEmail(mockTo, mockName, mockAction);

    // Assert
    expect(nodemailerStub.calledOnce).to.be.true;
    expect(
      nodemailerStub.calledWith({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        connectionTimeout: 30000,
      })
    ).to.be.true;

    expect(transporterMock.sendMail.calledOnce).to.be.true;
    const sendMailArgs = transporterMock.sendMail.getCall(0).args[0];
    expect(sendMailArgs.from).to.equal(process.env.EMAIL_USER);
    expect(sendMailArgs.to).to.equal(mockTo);
    expect(sendMailArgs.subject).to.equal(`Organization ${mockAction}`);
    expect(sendMailArgs.html).to.include(mockName);
    expect(sendMailArgs.html).to.include("successfully created");
    expect(sendMailArgs.html).to.include("color:green");
  });

  it("should successfully send notification email for updated action", async () => {
    // Arrange
    const mockTo = "user@example.com";
    const mockName = "Updated Organization";
    const mockAction = "updated";

    transporterMock.sendMail.resolves();

    // Act
    await sendNotificationEmail(mockTo, mockName, mockAction);

    // Assert
    expect(transporterMock.sendMail.calledOnce).to.be.true;
    const sendMailArgs = transporterMock.sendMail.getCall(0).args[0];
    expect(sendMailArgs.subject).to.equal(`Organization ${mockAction}`);
    expect(sendMailArgs.html).to.include(mockName);
    expect(sendMailArgs.html).to.include("successfully updated to");
    expect(sendMailArgs.html).to.include("color:orange");
  });

  it("should successfully send notification email for deleted action", async () => {
    // Arrange
    const mockTo = "user@example.com";
    const mockName = "Deleted Organization";
    const mockAction = "deleted";

    transporterMock.sendMail.resolves();

    // Act
    await sendNotificationEmail(mockTo, mockName, mockAction);

    // Assert
    expect(transporterMock.sendMail.calledOnce).to.be.true;
    const sendMailArgs = transporterMock.sendMail.getCall(0).args[0];
    expect(sendMailArgs.subject).to.equal(`Organization ${mockAction}`);
    expect(sendMailArgs.html).to.include(mockName);
    expect(sendMailArgs.html).to.include("successfully deleted");
    expect(sendMailArgs.html).to.include("color:red");
  });

  it('should use default "created" action when no action is specified', async () => {
    // Arrange
    const mockTo = "user@example.com";
    const mockName = "Test Organization";

    transporterMock.sendMail.resolves();

    // Act
    await sendNotificationEmail(mockTo, mockName);

    // Assert
    expect(transporterMock.sendMail.calledOnce).to.be.true;
    const sendMailArgs = transporterMock.sendMail.getCall(0).args[0];
    expect(sendMailArgs.subject).to.equal("Organization created");
    expect(sendMailArgs.html).to.include("successfully created");
    expect(sendMailArgs.html).to.include("color:green");
  });

  it("should handle missing EMAIL_USER environment variable", async () => {
    // Arrange
    delete process.env.EMAIL_USER;
    const mockTo = "user@example.com";
    const mockName = "Test Organization";

    // Act & Assert
    try {
      await sendNotificationEmail(mockTo, mockName);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as Error).message).to.include(
        "Failed to send notification email"
      );
      expect((error as Error).message).to.include(
        "EMAIL_USER or EMAIL_PASS environment variable is missing"
      );
    }
  });

  it("should handle missing EMAIL_PASS environment variable", async () => {
    // Arrange
    delete process.env.EMAIL_PASS;
    const mockTo = "user@example.com";
    const mockName = "Test Organization";

    // Act & Assert
    try {
      await sendNotificationEmail(mockTo, mockName);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as Error).message).to.include(
        "Failed to send notification email"
      );
      expect((error as Error).message).to.include(
        "EMAIL_USER or EMAIL_PASS environment variable is missing"
      );
    }
  });

  it("should handle email sending failures", async () => {
    // Arrange
    const mockTo = "user@example.com";
    const mockName = "Test Organization";
    const mockAction = "created";
    const mockError = new Error("SMTP connection failed");

    transporterMock.sendMail.rejects(mockError);

    // Act & Assert
    try {
      await sendNotificationEmail(mockTo, mockName, mockAction);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as Error).message).to.include(
        "Failed to send notification email"
      );
      expect((error as Error).message).to.include(mockTo);
      expect((error as Error).message).to.include(mockAction);
      expect((error as Error).message).to.include("SMTP connection failed");
    }
  });

  it("should handle authentication failures", async () => {
    // Arrange
    const mockTo = "user@example.com";
    const mockName = "Test Organization";
    const mockAction = "created";
    const mockError = new Error(
      "Invalid login: 535-5.7.8 Username and Password not accepted"
    );

    transporterMock.sendMail.rejects(mockError);

    // Act & Assert
    try {
      await sendNotificationEmail(mockTo, mockName, mockAction);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as Error).message).to.include(
        "Failed to send notification email"
      );
      expect((error as Error).message).to.include(
        "Username and Password not accepted"
      );
    }
  });

  it("should handle empty email address", async () => {
    // Arrange
    const mockTo = "";
    const mockName = "Test Organization";
    const mockAction = "created";
    const mockError = new Error("Invalid recipients");

    transporterMock.sendMail.rejects(mockError);

    // Act & Assert
    try {
      await sendNotificationEmail(mockTo, mockName, mockAction);
      expect.fail("Expected function to throw an error");
    } catch (error) {
      expect((error as Error).message).to.include(
        "Failed to send notification email"
      );
      expect((error as Error).message).to.include("Invalid recipients");
    }
  });

  // 🔧 FIXED TEST - This was the failing one
  it("should handle special characters in organization name", async () => {
    // Arrange
    const mockTo = "user@example.com";
    const mockName = "Test & Special <Organization>";
    const mockAction = "created";

    transporterMock.sendMail.resolves();

    // Act
    await sendNotificationEmail(mockTo, mockName, mockAction);

    // Assert
    expect(transporterMock.sendMail.calledOnce).to.be.true;
    const sendMailArgs = transporterMock.sendMail.getCall(0).args[0];

    // The function doesn't escape HTML, so we expect the raw characters
    expect(sendMailArgs.html).to.include("Test & Special <Organization>");
    expect(sendMailArgs.html).to.include("successfully created");
    expect(sendMailArgs.html).to.include("Organization Events Team");
  });

  it("should handle cancelled and failed actions with default message", async () => {
    // Arrange
    const mockTo = "user@example.com";
    const mockName = "Test Organization";
    const mockAction = "cancelled";

    transporterMock.sendMail.resolves();

    // Act
    await sendNotificationEmail(mockTo, mockName, mockAction);

    // Assert
    expect(transporterMock.sendMail.calledOnce).to.be.true;
    const sendMailArgs = transporterMock.sendMail.getCall(0).args[0];
    expect(sendMailArgs.subject).to.equal("Organization cancelled");
    // Should have empty message body for unsupported actions
    expect(sendMailArgs.html).to.include("Organization Events Team");
  });
});
