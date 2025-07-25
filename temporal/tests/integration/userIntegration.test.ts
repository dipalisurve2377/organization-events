import request from "supertest";
import { expect } from "chai";
import mongoose from "mongoose";

const API_BASE_URL = "http://localhost:7001";
const MONGO_URI =
  "mongodb+srv://dipali:userorg2000@cluster0.as6jcdi.mongodb.net/user-org-db";

describe("User API ", function () {
  this.timeout(20000);

  let createdUserId: string;
  const testEmail = "testuser+" + Date.now() + "@example.com";

  before(async function () {
    await mongoose.connect(MONGO_URI);
  });

  after(async function () {
    await mongoose.disconnect();
  });

  it("should create a user", async function () {
    const userData = {
      name: "Test User",
      email: testEmail,
      password: "securepass",
    };

    const res = await request(API_BASE_URL)
      .post("/api/users")
      .send(userData)
      .set("Accept", "application/json");

    expect(res.status, JSON.stringify(res.body)).to.be.oneOf([200, 201]);
    // Wait for the user to be written to the DB
    await new Promise((res) => setTimeout(res, 2000));

    // Fetch the user from MongoDB
    const user = await mongoose.connection
      .db!.collection("users")
      .findOne({ email: testEmail });
    expect(user).to.exist;
    if (!user) throw new Error("User not found in DB after creation");
    createdUserId = user._id.toString();
    console.log("Fetched userId from DB:", createdUserId);
  });

  it("should list all users", async function () {
    const res = await request(API_BASE_URL)
      .get("/api/users")
      .set("Accept", "application/json");

    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body).to.have.property("users");
    expect(res.body.users).to.be.an("array");
    console.log("All users:", res.body.users);
  });

  it("should update the user", async function () {
    const res = await request(API_BASE_URL)
      .put(`/api/users/${createdUserId}`)
      .send({
        updates: {
          name: "Updated Dimple User",
        },
      })
      .set("Accept", "application/json");

    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body).to.have.property("workflowId");
  });

  it("should delete the user", async function () {
    const res = await request(API_BASE_URL)
      .delete(`/api/users/${createdUserId}`)
      .set("Accept", "application/json");

    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body).to.have.property("workflowId");
  });
});
