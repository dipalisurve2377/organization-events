import { expect } from 'chai';
import request from 'supertest';
import express, { Request, Response } from 'express';
import sinon from 'sinon';
import mongoose from 'mongoose';

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock the User model
const UserMock = {
  create: sinon.stub(),
  findOne: sinon.stub(),
  findById: sinon.stub(),
  findByIdAndUpdate: sinon.stub(),
  findByIdAndDelete: sinon.stub()
};

// Mock workflow triggers
const workflowTriggers = {
  triggerCreateUser: sinon.stub(),
  triggerUpdateUser: sinon.stub(),
  triggerDeleteUser: sinon.stub(),
  triggerListUsers: sinon.stub()
};

// Mock the controller functions directly
const userController = {
  createUserController: async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: `All fields are required.`, statusCode: 400 });
    }

    try {
      const user = await UserMock.create({
        email,
        name,
        status: "provisioning",
      });

      const workflowId = await workflowTriggers.triggerCreateUser({
        email,
        password,
        name,
      });
      res.status(200).json({ message: "User provisioning started", workflowId });
    } catch (error: any) {
      console.error("Error starting user workflow:", error);
      res.status(500).json({
        error: "Failed to start user creation workflow",
        statusCode: 500,
      });
    }
  },

  updateUserController: async (req: Request, res: Response) => {
    const email = req.params.email;
    const { name, password } = req.body;

    if (!email || email === "undefined") {
      return res.status(404).json({ error: "Email is required", statusCode: 404 });
    }

    try {
      const user = await UserMock.findOne({ email });

      if (!user) {
        return res.status(404).json({ error: "User not found", statusCode: 404 });
      }

      const workflowId = await workflowTriggers.triggerUpdateUser({
        email,
        name,
        password,
      });
      res.status(200).json({ message: "User update started", workflowId });
    } catch (error: any) {
      console.error("Error starting user update workflow:", error);
      res.status(500).json({ error: "Failed to start user update workflow" });
    }
  },

  deleteUserController: async (req: Request, res: Response) => {
    const email = req.params.email;

    if (!email || email === "undefined") {
      return res.status(400).json({ error: "Email is required", statusCode: 400 });
    }

    try {
      const user = await UserMock.findOne({ email });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const workflowId = await workflowTriggers.triggerDeleteUser({
        email,
      });
      res.status(200).json({
        message: "User deletion started",
        workflowId,
      });
    } catch (error: any) {
      console.error("Error starting user delete workflow:", error);
      res.status(500).json({ error: "Failed to start user deletion workflow" });
    }
  },

  listUsersController: async (req: Request, res: Response) => {
    try {
      const users = await workflowTriggers.triggerListUsers();

      const cleanedUsers = users.map((user: any) => ({
        name: user.name,
        email: user.email,
        userId: user.user_id,
        createdAt: user.created_at,
      }));

      res.status(200).json({ 
        users: cleanedUsers,
        count: cleanedUsers.length
      });
    } catch (error: any) {
      console.error("Error listing users:", error);
      res.status(500).json({ error: "Failed to list users" });
    }
  }
};

// Setup routes
app.post('/api/users', userController.createUserController);
app.put('/api/users/:email', userController.updateUserController);
app.delete('/api/users/:email', userController.deleteUserController);
app.get('/api/users', userController.listUsersController);

describe('User Integration Tests', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'SecurePassword123!',
    name: 'Test User'
  };

  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    // Reset all stubs before each test - DO NOT set default behavior here
    Object.values(UserMock).forEach((stub: any) => {
      if (stub.reset) stub.reset();
    });
    Object.values(workflowTriggers).forEach((stub: any) => {
      if (stub.reset) stub.reset();
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('POST /api/users - Create User', () => {
    it('should create user successfully', async () => {
      // Set up successful behavior for this specific test
      UserMock.create.resolves({
        _id: new mongoose.Types.ObjectId(),
        email: testUser.email,
        name: testUser.name,
        status: 'provisioning',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      workflowTriggers.triggerCreateUser.resolves('create-user-workflow-123');

      const response = await request(app)
        .post('/api/users')
        .send(testUser)
        .expect(200);

      expect(response.body).to.have.property('message', 'User provisioning started');
      expect(response.body).to.have.property('workflowId', 'create-user-workflow-123');
      expect(UserMock.create.calledOnce).to.be.true;
      expect(workflowTriggers.triggerCreateUser.calledOnce).to.be.true;
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ email: 'test@example.com' }) // Missing password and name
        .expect(400);

      expect(response.body).to.have.property('error', 'All fields are required.');
      expect(response.body).to.have.property('statusCode', 400);
    });

    it('should handle database errors gracefully', async () => {
      // Set up error behavior for this specific test
      UserMock.create.rejects(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/users')
        .send(testUser)
        .expect(500);

      expect(response.body).to.have.property('error', 'Failed to start user creation workflow');
      expect(response.body).to.have.property('statusCode', 500);
    });

    it('should handle workflow trigger errors gracefully', async () => {
      // Set up mixed behavior - successful create but failed workflow trigger
      UserMock.create.resolves({
        _id: new mongoose.Types.ObjectId(),
        email: testUser.email,
        name: testUser.name,
        status: 'provisioning'
      });
      workflowTriggers.triggerCreateUser.rejects(new Error('Temporal workflow failed'));

      const response = await request(app)
        .post('/api/users')
        .send(testUser)
        .expect(500);

      expect(response.body).to.have.property('error', 'Failed to start user creation workflow');
    });
  });

  describe('PUT /api/users/:email - Update User', () => {
    it('should update user successfully', async () => {
      // Set up successful behavior for this specific test
      UserMock.findOne.resolves({
        _id: userId,
        email: testUser.email,
        name: 'Existing User',
        status: 'active'
      });
      workflowTriggers.triggerUpdateUser.resolves('update-user-workflow-456');

      const updateData = {
        name: 'Updated User Name',
        password: 'NewPassword123!'
      };

      const response = await request(app)
        .put(`/api/users/${testUser.email}`)
        .send(updateData)
        .expect(200);

      expect(response.body).to.have.property('message', 'User update started');
      expect(response.body).to.have.property('workflowId', 'update-user-workflow-456');
      expect(UserMock.findOne.calledWith({ email: testUser.email })).to.be.true;
      expect(workflowTriggers.triggerUpdateUser.calledOnce).to.be.true;
    });

    it('should return 404 for missing email', async () => {
      const response = await request(app)
        .put('/api/users/undefined')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body).to.have.property('error', 'Email is required');
      expect(response.body).to.have.property('statusCode', 404);
    });

    it('should return 404 when user not found', async () => {
      // Set up null return for this specific test
      UserMock.findOne.resolves(null);

      const response = await request(app)
        .put('/api/users/nonexistent@example.com')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body).to.have.property('error', 'User not found');
    });

    it('should handle database errors during update', async () => {
      // Set up error behavior for this specific test
      UserMock.findOne.rejects(new Error('Database error'));

      const response = await request(app)
        .put(`/api/users/${testUser.email}`)
        .send({ name: 'Updated Name' })
        .expect(500);

      expect(response.body).to.have.property('error', 'Failed to start user update workflow');
    });
  });

  describe('DELETE /api/users/:email - Delete User', () => {
    it('should delete user successfully', async () => {
      // Set up successful behavior for this specific test
      UserMock.findOne.resolves({
        _id: userId,
        email: testUser.email,
        name: 'Existing User',
        status: 'active'
      });
      workflowTriggers.triggerDeleteUser.resolves('delete-user-workflow-789');

      const response = await request(app)
        .delete(`/api/users/${testUser.email}`)
        .expect(200);

      expect(response.body).to.have.property('message', 'User deletion started');
      expect(response.body).to.have.property('workflowId', 'delete-user-workflow-789');
      expect(UserMock.findOne.calledWith({ email: testUser.email })).to.be.true;
      expect(workflowTriggers.triggerDeleteUser.calledOnce).to.be.true;
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .delete('/api/users/undefined')
        .expect(400);

      expect(response.body).to.have.property('error', 'Email is required');
      expect(response.body).to.have.property('statusCode', 400);
    });

    it('should return 404 when user not found', async () => {
      // Set up null return for this specific test
      UserMock.findOne.resolves(null);

      const response = await request(app)
        .delete('/api/users/nonexistent@example.com')
        .expect(404);

      expect(response.body).to.have.property('error', 'User not found');
    });

    it('should handle database errors during deletion', async () => {
      // Set up error behavior for this specific test
      UserMock.findOne.rejects(new Error('Database error'));

      const response = await request(app)
        .delete(`/api/users/${testUser.email}`)
        .expect(500);

      expect(response.body).to.have.property('error', 'Failed to start user deletion workflow');
    });
  });

  describe('GET /api/users - List Users', () => {
    it('should list users successfully', async () => {
      // Set up successful behavior for this specific test
      workflowTriggers.triggerListUsers.resolves([
        { user_id: 'auth0|123', name: 'Test User 1', email: 'user1@example.com', created_at: '2023-01-01' },
        { user_id: 'auth0|456', name: 'Test User 2', email: 'user2@example.com', created_at: '2023-01-02' }
      ]);

      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(response.body).to.have.property('users');
      expect(response.body.users).to.be.an('array');
      expect(response.body.users).to.have.length(2);
      expect(response.body).to.have.property('count', 2);
      expect(workflowTriggers.triggerListUsers.calledOnce).to.be.true;
    });

    it('should handle empty user list', async () => {
      // Set up empty array return for this specific test
      workflowTriggers.triggerListUsers.resolves([]);

      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(response.body.users).to.be.an('array');
      expect(response.body.users).to.have.length(0);
      expect(response.body.count).to.equal(0);
    });

    it('should handle workflow errors during listing', async () => {
      // Set up error behavior for this specific test
      workflowTriggers.triggerListUsers.rejects(new Error('Workflow failed'));

      const response = await request(app)
        .get('/api/users')
        .expect(500);

      expect(response.body).to.have.property('error', 'Failed to list users');
    });
  });
});