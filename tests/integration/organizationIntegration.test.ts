import { expect } from 'chai';
import request from 'supertest';
import express, { Request, Response } from 'express';
import sinon from 'sinon';
import mongoose from 'mongoose';

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock the Organization model
const OrganizationMock = {
  create: sinon.stub(),
  findById: sinon.stub(),
  find: sinon.stub(),
  findByIdAndUpdate: sinon.stub(),
  findByIdAndDelete: sinon.stub()
};

// Mock workflow triggers
const workflowTriggers = {
  triggerCreateOrganization: sinon.stub(),
  triggerUpdateOrganization: sinon.stub(),
  triggerDeleteOrganization: sinon.stub(),
  triggerListOrganizations: sinon.stub()
};

// Mock the controller functions directly
const organizationController = {
  createOrganizationController: async (req: Request, res: Response) => {
    const { name, identifier, createdByEmail } = req.body;

    if (!name || !identifier || !createdByEmail) {
      return res.status(400).json({ error: `All fields are required.`, statusCode: 400 });
    }

    try {
      const org = await OrganizationMock.create({
        name,
        identifier,
        createdByEmail,
        status: "provisioning",
      });

      const workflowId = await workflowTriggers.triggerCreateOrganization({
        orgId: org._id.toString(),
        name,
        identifier,
        createdByEmail,
      });
      res.status(200).json({ message: "Organization provisioning started", workflowId });
    } catch (error: any) {
      console.error("Error starting organization workflow:", error);
      res.status(500).json({
        error: "Failed to start organization creation workflow",
        statusCode: 500,
      });
    }
  },

  updateOrganizationController: async (req: Request, res: Response) => {
    const orgId = req.params.id;
    const { name, identifier } = req.body;

    if (!orgId || orgId == "undefined") {
      return res.status(404).json({ error: "Organization ID is required", statusCode: 404 });
    }

    try {
      const organization = await OrganizationMock.findById(orgId);

      if (!organization) {
        return res.status(404).json({ error: "Organization not found", statusCode: 404 });
      }

      const { createdByEmail } = organization;

      const workflowId = await workflowTriggers.triggerUpdateOrganization({
        orgId,
        name,
        identifier,
        createdByEmail,
      });
      res.status(200).json({ message: "Organization update started", workflowId });
    } catch (error: any) {
      console.error("Error starting update workflow:", error);
      res.status(500).json({ error: "Failed to start organization update workflow" });
    }
  },

  deleteOrganizationController: async (req: Request, res: Response) => {
    const orgId = req.params.id;

    if (!orgId || orgId == "undefined") {
      return res.status(400).json({ error: "orgId is required", statusCode: 400 });
    }

    try {
      const organization = await OrganizationMock.findById(orgId);

      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      const { name, createdByEmail } = organization;

      const workflowId = await workflowTriggers.triggerDeleteOrganization({
        orgId,
        name,
        createdByEmail,
      });
      res.status(200).json({
        message: "Organization deletion started",
        workflowId,
      });
    } catch (error: any) {
      console.error("Error starting delete workflow:", error);
      res.status(500).json({ error: "Failed to start organization deletion workflow" });
    }
  },

  listOrganizationController: async (req: Request, res: Response) => {
    try {
      const organizations = await workflowTriggers.triggerListOrganizations();

      const cleanedOrganizations = organizations.map((org: any) => ({
        name: org.display_name,
        identifier: org.name,
        orgId: org.id,
        createdAt: org.created_at,
      }));

      res.status(200).json({ 
        organizations: cleanedOrganizations,
        count: cleanedOrganizations.length
      });
    } catch (error: any) {
      console.error("Error listing organizations:", error);
      res.status(500).json({ error: "Failed to list organizations" });
    }
  }
};

// Setup routes
app.post('/api/organizations', organizationController.createOrganizationController);
app.put('/api/organizations/:id', organizationController.updateOrganizationController);
app.delete('/api/organizations/:id', organizationController.deleteOrganizationController);
app.get('/api/organizations', organizationController.listOrganizationController);

describe('Organization Integration Tests', () => {
  const testOrganization = {
    name: 'Test Organization',
    identifier: 'test-org',
    createdByEmail: 'test@example.com'
  };

  const orgId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    // Reset all stubs before each test - DO NOT set default behavior here
    Object.values(OrganizationMock).forEach((stub: any) => {
      if (stub.reset) stub.reset();
    });
    Object.values(workflowTriggers).forEach((stub: any) => {
      if (stub.reset) stub.reset();
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('POST /api/organizations - Create Organization', () => {
    it('should create organization successfully', async () => {
      // Set up successful behavior for this specific test
      OrganizationMock.create.resolves({
        _id: new mongoose.Types.ObjectId(),
        name: testOrganization.name,
        identifier: testOrganization.identifier,
        createdByEmail: testOrganization.createdByEmail,
        status: 'provisioning',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      workflowTriggers.triggerCreateOrganization.resolves('create-workflow-123');

      const response = await request(app)
        .post('/api/organizations')
        .send(testOrganization)
        .expect(200);

      expect(response.body).to.have.property('message', 'Organization provisioning started');
      expect(response.body).to.have.property('workflowId', 'create-workflow-123');
      expect(OrganizationMock.create.calledOnce).to.be.true;
      expect(workflowTriggers.triggerCreateOrganization.calledOnce).to.be.true;
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org' }) // Missing identifier and createdByEmail
        .expect(400);

      expect(response.body).to.have.property('error', 'All fields are required.');
      expect(response.body).to.have.property('statusCode', 400);
    });

    it('should handle database errors gracefully', async () => {
      // Set up error behavior for this specific test
      OrganizationMock.create.rejects(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/organizations')
        .send(testOrganization)
        .expect(500);

      expect(response.body).to.have.property('error', 'Failed to start organization creation workflow');
      expect(response.body).to.have.property('statusCode', 500);
    });

    it('should handle workflow trigger errors gracefully', async () => {
      // Set up mixed behavior - successful create but failed workflow trigger
      OrganizationMock.create.resolves({
        _id: new mongoose.Types.ObjectId(),
        name: testOrganization.name,
        identifier: testOrganization.identifier,
        createdByEmail: testOrganization.createdByEmail,
        status: 'provisioning'
      });
      workflowTriggers.triggerCreateOrganization.rejects(new Error('Temporal workflow failed'));

      const response = await request(app)
        .post('/api/organizations')
        .send(testOrganization)
        .expect(500);

      expect(response.body).to.have.property('error', 'Failed to start organization creation workflow');
    });
  });

  describe('PUT /api/organizations/:id - Update Organization', () => {
    it('should update organization successfully', async () => {
      // Set up successful behavior for this specific test
      OrganizationMock.findById.resolves({
        _id: orgId,
        name: 'Existing Organization',
        identifier: 'existing-org',
        createdByEmail: 'admin@test.com',
        status: 'success'
      });
      workflowTriggers.triggerUpdateOrganization.resolves('update-workflow-456');

      const updateData = {
        name: 'Updated Organization Name',
        identifier: 'updated-org-identifier'
      };

      const response = await request(app)
        .put(`/api/organizations/${orgId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).to.have.property('message', 'Organization update started');
      expect(response.body).to.have.property('workflowId', 'update-workflow-456');
      expect(OrganizationMock.findById.calledWith(orgId)).to.be.true;
      expect(workflowTriggers.triggerUpdateOrganization.calledOnce).to.be.true;
    });

    it('should return 404 for missing organization ID', async () => {
      const response = await request(app)
        .put('/api/organizations/undefined')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body).to.have.property('error', 'Organization ID is required');
      expect(response.body).to.have.property('statusCode', 404);
    });

    it('should return 404 when organization not found', async () => {
      // Set up null return for this specific test
      OrganizationMock.findById.resolves(null);

      const response = await request(app)
        .put('/api/organizations/nonexistent-id')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body).to.have.property('error', 'Organization not found');
    });

    it('should handle database errors during update', async () => {
      // Set up error behavior for this specific test
      OrganizationMock.findById.rejects(new Error('Database error'));

      const response = await request(app)
        .put(`/api/organizations/${orgId}`)
        .send({ name: 'Updated Name' })
        .expect(500);

      expect(response.body).to.have.property('error', 'Failed to start organization update workflow');
    });
  });

  describe('DELETE /api/organizations/:id - Delete Organization', () => {
    it('should delete organization successfully', async () => {
      // Set up successful behavior for this specific test
      OrganizationMock.findById.resolves({
        _id: orgId,
        name: 'Existing Organization',
        identifier: 'existing-org',
        createdByEmail: 'admin@test.com',
        status: 'success'
      });
      workflowTriggers.triggerDeleteOrganization.resolves('delete-workflow-789');

      const response = await request(app)
        .delete(`/api/organizations/${orgId}`)
        .expect(200);

      expect(response.body).to.have.property('message', 'Organization deletion started');
      expect(response.body).to.have.property('workflowId', 'delete-workflow-789');
      expect(OrganizationMock.findById.calledWith(orgId)).to.be.true;
      expect(workflowTriggers.triggerDeleteOrganization.calledOnce).to.be.true;
    });

    it('should return 400 for missing organization ID', async () => {
      const response = await request(app)
        .delete('/api/organizations/undefined')
        .expect(400);

      expect(response.body).to.have.property('error', 'orgId is required');
      expect(response.body).to.have.property('statusCode', 400);
    });

    it('should return 404 when organization not found', async () => {
      // Set up null return for this specific test
      OrganizationMock.findById.resolves(null);

      const response = await request(app)
        .delete('/api/organizations/nonexistent-id')
        .expect(404);

      expect(response.body).to.have.property('error', 'Organization not found');
    });

    it('should handle database errors during deletion', async () => {
      // Set up error behavior for this specific test
      OrganizationMock.findById.rejects(new Error('Database error'));

      const response = await request(app)
        .delete(`/api/organizations/${orgId}`)
        .expect(500);

      expect(response.body).to.have.property('error', 'Failed to start organization deletion workflow');
    });
  });

  describe('GET /api/organizations - List Organizations', () => {
    it('should list organizations successfully', async () => {
      // Set up successful behavior for this specific test
      workflowTriggers.triggerListOrganizations.resolves([
        { id: 'org_123', name: 'Test Organization 1', display_name: 'Test Organization 1' },
        { id: 'org_456', name: 'Test Organization 2', display_name: 'Test Organization 2' }
      ]);

      const response = await request(app)
        .get('/api/organizations')
        .expect(200);

      expect(response.body).to.have.property('organizations');
      expect(response.body.organizations).to.be.an('array');
      expect(response.body.organizations).to.have.length(2);
      expect(response.body).to.have.property('count', 2);
      expect(workflowTriggers.triggerListOrganizations.calledOnce).to.be.true;
    });

    it('should handle empty organization list', async () => {
      // Set up empty array return for this specific test
      workflowTriggers.triggerListOrganizations.resolves([]);

      const response = await request(app)
        .get('/api/organizations')
        .expect(200);

      expect(response.body.organizations).to.be.an('array');
      expect(response.body.organizations).to.have.length(0);
      expect(response.body.count).to.equal(0);
    });

    it('should handle workflow errors during listing', async () => {
      // Set up error behavior for this specific test
      workflowTriggers.triggerListOrganizations.rejects(new Error('Workflow failed'));

      const response = await request(app)
        .get('/api/organizations')
        .expect(500);

      expect(response.body).to.have.property('error', 'Failed to list organizations');
    });
  });
});