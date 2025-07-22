import { expect } from "chai";
import request from "supertest";
import mongoose from "mongoose";
import Organization from "../models/Organization.js";
import app from "../index.js";

// Use a dedicated test database URI
const TEST_DB_URI = process.env.MONGO_URI_TEST || "mongodb://localhost:27017/organization_test_db";

describe("Organization Integration Tests (Real API)", () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
  });

  after(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Organization.deleteMany({});
  });

  const testOrganization = {
    name: "Test Organization",
    identifier: "test-org",
    createdByEmail: "test@example.com",
  };

  describe("POST /api/organizations - Create Organization", () => {
    it("should create organization successfully", async () => {
      const response = await request(app)
        .post("/api/organizations")
        .send(testOrganization)
        .expect(200);

      expect(response.body).to.have.property("message", "Organization provisioning started");
      expect(response.body).to.have.property("workflowId");
      // Optionally, check DB
      const org = await Organization.findOne({ identifier: testOrganization.identifier });
      expect(org).to.exist;
      expect(org.name).to.equal(testOrganization.name);
    });

    it("should return 400 for missing required fields", async () => {
      const response = await request(app)
        .post("/api/organizations")
        .send({ name: "Test Org" })
        .expect(400);

      expect(response.body).to.have.property("error", "All fields are required.");
      expect(response.body).to.have.property("statusCode", 400);
    });
  });

  describe("PUT /api/organizations/:id - Update Organization", () => {
    it("should update organization successfully", async () => {
      // First, create an org
      const org = await Organization.create(testOrganization);

      const updateData = {
        name: "Updated Organization Name",
        identifier: "updated-org-identifier",
      };

      const response = await request(app)
        .put(`/api/organizations/${org._id}`)
        .send(updateData)
        .expect(200);

      expect(response.body).to.have.property("message", "Organization update started");
      expect(response.body).to.have.property("workflowId");
    });

    it("should return 404 for missing organization ID", async () => {
      const response = await request(app)
        .put("/api/organizations/undefined")
        .send({ name: "Updated Name" })
        .expect(404);

      expect(response.body).to.have.property("error", "Organization ID is required");
      expect(response.body).to.have.property("statusCode", 404);
    });

    it("should return 404 when organization not found", async () => {
      const response = await request(app)
        .put(`/api/organizations/${new mongoose.Types.ObjectId()}`)
        .send({ name: "Updated Name" })
        .expect(404);

      expect(response.body).to.have.property("error", "Organization not found");
    });
  });

  describe("DELETE /api/organizations/:id - Delete Organization", () => {
    it("should delete organization successfully", async () => {
      // First, create an org
      const org = await Organization.create(testOrganization);

      const response = await request(app)
        .delete(`/api/organizations/${org._id}`)
        .expect(200);

      expect(response.body).to.have.property("message", "Organization deletion started");
      expect(response.body).to.have.property("workflowId");
    });

    it("should return 400 for missing organization ID", async () => {
      const response = await request(app)
        .delete("/api/organizations/undefined")
        .expect(400);

      expect(response.body).to.have.property("error", "orgId is required");
      expect(response.body).to.have.property("statusCode", 400);
    });

    it("should return 404 when organization not found", async () => {
      const response = await request(app)
        .delete(`/api/organizations/${new mongoose.Types.ObjectId()}`)
        .expect(404);

      expect(response.body).to.have.property("error", "Organization not found");
    });
  });

  describe("GET /api/organizations - List Organizations", () => {
    it("should list organizations successfully", async () => {
      // Create a couple of orgs
      await Organization.create([
        { name: "Org1", identifier: "org1", createdByEmail: "a@a.com" },
        { name: "Org2", identifier: "org2", createdByEmail: "b@b.com" },
      ]);

      const response = await request(app).get("/api/organizations").expect(200);

      expect(response.body.organizations).to.be.an("array");
      // The actual structure may depend on your workflow trigger's return
    });
  });
});