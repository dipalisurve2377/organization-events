import request from "supertest";
import { expect } from "chai";
import mongoose from "mongoose";

const API_BASE_URL = "http://localhost:7001";
const MONGO_URI =
  "mongodb+srv://dipali:userorg2000@cluster0.as6jcdi.mongodb.net/user-org-db";

describe("Organization API", function () {
  this.timeout(20000);

  let createdOrgIdentifier = "test-org-" + Date.now();
  let createdOrgId: string;

  before(async function () {
    await mongoose.connect(MONGO_URI);
  });

  after(async function () {
    await mongoose.disconnect();
  });

  it("should create an organization", async function () {
    const orgData = {
      name: "Integration Test Org",
      identifier: createdOrgIdentifier,
      createdByEmail: "integration@test.com",
    };

    const res = await request(API_BASE_URL)
      .post("/api/organizations/")
      .send(orgData)
      .set("Accept", "application/json");

    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body).to.have.property("workflowId");
    // Wait a bit for the org to be written to the DB
    await new Promise((res) => setTimeout(res, 2000));

    // Fetch the organization from MongoDB
    const org = await mongoose.connection
      .db!.collection("organizations")
      .findOne({ identifier: createdOrgIdentifier });
    expect(org).to.exist;
    if (!org) throw new Error("Organization not found in DB after creation");
    createdOrgId = org._id.toString();
    console.log("Fetched orgId from DB:", createdOrgId);
  });

  it("should list organizations and find the created one", async function () {
    let org;
    let lastOrganizations = [];
    for (let i = 0; i < 10; i++) {
      const res = await request(API_BASE_URL)
        .get("/api/organizations")
        .set("Accept", "application/json");
      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      lastOrganizations = res.body.organizations;
      org = lastOrganizations.find(
        (o: any) => o.identifier === createdOrgIdentifier
      );
      console.log("Organizations list:", lastOrganizations);
      if (org) break;
      await new Promise((res) => setTimeout(res, 1000));
    }
    if (!org) {
      console.error("Organizations list after retries:", lastOrganizations);
    }
    expect(org, "Organization not found in list after waiting").to.exist;
  });

  it("should fetch and log the organization before update", async function () {
    const res = await request(API_BASE_URL)
      .get("/api/organizations")
      .set("Accept", "application/json");
    const org = res.body.organizations.find(
      (o: any) => o.identifier === createdOrgIdentifier
    );
    console.log("Org before update:", org);
  });

  it("should update the organization", async function () {
    const res = await request(API_BASE_URL)
      .put(`/api/organizations/${createdOrgId}`)
      .send({
        name: "Updated Integration Test Org",
        identifier: createdOrgIdentifier,
      })
      .set("Accept", "application/json");

    if (res.status !== 200) {
      console.error("Update error:", res.body);
    }
    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body).to.have.property("workflowId");
  });

  it("should delete the organization", async function () {
    const res = await request(API_BASE_URL)
      .delete(`/api/organizations/${createdOrgId}`)
      .set("Accept", "application/json");

    if (res.status !== 200) {
      console.error("Delete error:", res.body);
    }
    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body).to.have.property("workflowId");
  });
});
