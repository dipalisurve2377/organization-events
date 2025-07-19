"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const sinon_1 = __importDefault(require("sinon"));
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const client_1 = require("@temporalio/client");
// Mock all user activities
const mockCreateUserInAuth0 = sinon_1.default.stub();
const mockSaveAuth0IdToMongoDB = sinon_1.default.stub();
const mockUpdateUserInAuth0 = sinon_1.default.stub();
const mockUpdateUserStatus = sinon_1.default.stub();
const mockDeleteUserFromAuth0 = sinon_1.default.stub();
const mockDeleteUserFromDB = sinon_1.default.stub();
const mockListUsersFromAuth0 = sinon_1.default.stub();
// Mock Express app with all user routes
const createMockApp = () => {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Create User Route
    app.post('/api/users', async (req, res) => {
        try {
            const { email, name, password, organizationId } = req.body;
            // Step 1: Update user status to "provisioning"
            await mockUpdateUserStatus(email, "provisioning", organizationId, name);
            // Step 2: Create user in Auth0
            const auth0Id = await mockCreateUserInAuth0(email, name, password);
            // Step 3: Save Auth0 ID to MongoDB
            await mockSaveAuth0IdToMongoDB(email, auth0Id);
            // Step 4: Update user status to "created"
            await mockUpdateUserStatus(email, "created", organizationId, name);
            res.status(201).json({
                success: true,
                auth0Id,
                message: `User ${email} created successfully`
            });
        }
        catch (error) {
            // Rollback status
            try {
                await mockUpdateUserStatus(req.body.email, "failed", req.body.organizationId, req.body.name);
            }
            catch (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }
            if (error instanceof client_1.ApplicationFailure) {
                res.status(error.nonRetryable ? 400 : 500).json({
                    success: false,
                    error: error.message,
                    type: error.type
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    });
    // Update User Route
    app.put('/api/users/:email', async (req, res) => {
        try {
            const { email } = req.params;
            const { updates, organizationId } = req.body;
            // Step 1: Update user status to "updating"
            await mockUpdateUserStatus(email, "updating", organizationId);
            // Step 2: Update user in Auth0
            const updatedFields = await mockUpdateUserInAuth0(email, updates);
            // Step 3: Update user status to "active"
            await mockUpdateUserStatus(email, "active", organizationId);
            res.status(200).json({
                success: true,
                message: `User ${email} updated successfully`,
                updatedFields
            });
        }
        catch (error) {
            // Rollback status
            try {
                await mockUpdateUserStatus(req.params.email, "failed", req.body.organizationId);
            }
            catch (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }
            if (error instanceof client_1.ApplicationFailure) {
                res.status(error.nonRetryable ? 400 : 500).json({
                    success: false,
                    error: error.message,
                    type: error.type
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    });
    // Delete User Route
    app.delete('/api/users/:email', async (req, res) => {
        try {
            const { email } = req.params;
            const { organizationId } = req.query;
            // Step 1: Update user status to "deleting"
            await mockUpdateUserStatus(email, "deleting", organizationId);
            const deletedFrom = [];
            // Step 2: Delete user from Auth0
            try {
                await mockDeleteUserFromAuth0(email);
                deletedFrom.push('Auth0');
            }
            catch (error) {
                if (!error.message?.includes('404') && !error.message?.includes('not found')) {
                    throw error;
                }
            }
            // Step 3: Delete user from MongoDB
            try {
                await mockDeleteUserFromDB(email);
                deletedFrom.push('MongoDB');
            }
            catch (error) {
                if (!error.message?.includes('not found') && !error.message?.includes('No user found')) {
                    throw error;
                }
            }
            // Step 4: Update user status to "deleted" (if any records were deleted)
            if (deletedFrom.length > 0) {
                try {
                    await mockUpdateUserStatus(email, "deleted", organizationId);
                }
                catch (statusError) {
                    console.warn("Failed to update status to deleted:", statusError);
                }
            }
            res.status(200).json({
                success: true,
                message: `User ${email} deletion completed`,
                deletedFrom
            });
        }
        catch (error) {
            // Rollback status
            try {
                await mockUpdateUserStatus(req.params.email, "failed", req.query.organizationId);
            }
            catch (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }
            if (error instanceof client_1.ApplicationFailure) {
                res.status(error.nonRetryable ? 400 : 500).json({
                    success: false,
                    error: error.message,
                    type: error.type
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    });
    // List Users Route
    app.get('/api/users', async (req, res) => {
        try {
            const { page = '0', perPage = '50', searchQuery, organizationId } = req.query;
            const pageNum = parseInt(page);
            const perPageNum = parseInt(perPage);
            // Step 1: Update workflow status to "fetching" (optional)
            if (organizationId) {
                try {
                    await mockUpdateUserStatus('workflow', "fetching", organizationId);
                }
                catch (statusError) {
                    console.warn('Failed to update workflow status:', statusError);
                }
            }
            // Step 2: List users from Auth0
            const auth0Response = await mockListUsersFromAuth0(pageNum, perPageNum, searchQuery);
            // Step 3: Update workflow status to "completed" (optional)
            if (organizationId) {
                try {
                    await mockUpdateUserStatus('workflow', "completed", organizationId);
                }
                catch (statusError) {
                    console.warn('Failed to update workflow status to completed:', statusError);
                }
            }
            res.status(200).json({
                success: true,
                message: `Successfully retrieved ${auth0Response.users.length} users`,
                users: auth0Response.users,
                pagination: {
                    page: pageNum,
                    perPage: perPageNum,
                    total: auth0Response.total,
                    hasMore: (pageNum + 1) * perPageNum < auth0Response.total
                }
            });
        }
        catch (error) {
            // Rollback status
            if (req.query.organizationId) {
                try {
                    await mockUpdateUserStatus('workflow', "failed", req.query.organizationId);
                }
                catch (rollbackError) {
                    console.error("Rollback failed:", rollbackError);
                }
            }
            if (error instanceof client_1.ApplicationFailure) {
                res.status(error.nonRetryable ? 400 : 500).json({
                    success: false,
                    error: error.message,
                    type: error.type
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    });
    return app;
};
describe('User Integration Tests', () => {
    let app;
    beforeEach(() => {
        // Reset all mocks completely
        mockCreateUserInAuth0.reset();
        mockSaveAuth0IdToMongoDB.reset();
        mockUpdateUserInAuth0.reset();
        mockUpdateUserStatus.reset();
        mockDeleteUserFromAuth0.reset();
        mockDeleteUserFromDB.reset();
        mockListUsersFromAuth0.reset();
        // Clear all behaviors
        mockCreateUserInAuth0.resetBehavior();
        mockSaveAuth0IdToMongoDB.resetBehavior();
        mockUpdateUserInAuth0.resetBehavior();
        mockUpdateUserStatus.resetBehavior();
        mockDeleteUserFromAuth0.resetBehavior();
        mockDeleteUserFromDB.resetBehavior();
        mockListUsersFromAuth0.resetBehavior();
        app = createMockApp();
    });
    afterEach(() => {
        sinon_1.default.restore();
    });
    describe('Complete User Lifecycle Integration', () => {
        it('should handle complete user lifecycle: create → update → list → delete', async () => {
            const email = 'lifecycle@example.com';
            const name = 'Lifecycle User';
            const password = 'SecurePassword123!';
            const organizationId = 'org123';
            const auth0Id = 'auth0|lifecycle123';
            // Step 1: Create User
            mockUpdateUserStatus.resolves();
            mockCreateUserInAuth0.resolves(auth0Id);
            mockSaveAuth0IdToMongoDB.resolves();
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/users')
                .send({ email, name, password, organizationId });
            (0, chai_1.expect)(createResponse.status).to.equal(201);
            (0, chai_1.expect)(createResponse.body).to.deep.equal({
                success: true,
                auth0Id,
                message: `User ${email} created successfully`
            });
            // Verify create workflow calls
            (0, chai_1.expect)(mockUpdateUserStatus.callCount).to.equal(2);
            (0, chai_1.expect)(mockUpdateUserStatus.getCall(0).calledWith(email, "provisioning", organizationId, name)).to.be.true;
            (0, chai_1.expect)(mockUpdateUserStatus.getCall(1).calledWith(email, "created", organizationId, name)).to.be.true;
            (0, chai_1.expect)(mockCreateUserInAuth0.calledWith(email, name, password)).to.be.true;
            (0, chai_1.expect)(mockSaveAuth0IdToMongoDB.calledWith(email, auth0Id)).to.be.true;
            // Reset mocks for next step
            mockUpdateUserStatus.reset();
            mockUpdateUserInAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockUpdateUserInAuth0.resetBehavior();
            // Step 2: Update User
            const updates = { name: 'Updated Lifecycle User', blocked: false };
            const updatedFields = ['name', 'blocked'];
            mockUpdateUserStatus.resolves();
            mockUpdateUserInAuth0.resolves(updatedFields);
            const updateResponse = await (0, supertest_1.default)(app)
                .put(`/api/users/${email}`)
                .send({ updates, organizationId });
            (0, chai_1.expect)(updateResponse.status).to.equal(200);
            (0, chai_1.expect)(updateResponse.body).to.deep.equal({
                success: true,
                message: `User ${email} updated successfully`,
                updatedFields
            });
            // Verify update workflow calls
            (0, chai_1.expect)(mockUpdateUserStatus.callCount).to.equal(2);
            (0, chai_1.expect)(mockUpdateUserStatus.getCall(0).calledWith(email, "updating", organizationId)).to.be.true;
            (0, chai_1.expect)(mockUpdateUserStatus.getCall(1).calledWith(email, "active", organizationId)).to.be.true;
            (0, chai_1.expect)(mockUpdateUserInAuth0.calledWith(email, updates)).to.be.true;
            // Reset mocks for next step
            mockUpdateUserStatus.reset();
            mockListUsersFromAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockListUsersFromAuth0.resetBehavior();
            // Step 3: List Users (should include our created user)
            const mockUsers = [
                { id: auth0Id, email, name: 'Updated Lifecycle User', blocked: false },
                { id: 'auth0|other', email: 'other@example.com', name: 'Other User' }
            ];
            const mockResponse = { users: mockUsers, total: 2 };
            mockUpdateUserStatus.resolves();
            mockListUsersFromAuth0.resolves(mockResponse);
            const listResponse = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ page: 0, perPage: 50, organizationId });
            (0, chai_1.expect)(listResponse.status).to.equal(200);
            (0, chai_1.expect)(listResponse.body.success).to.be.true;
            (0, chai_1.expect)(listResponse.body.users).to.deep.equal(mockUsers);
            (0, chai_1.expect)(listResponse.body.pagination).to.deep.equal({
                page: 0,
                perPage: 50,
                total: 2,
                hasMore: false
            });
            // Verify list workflow calls
            (0, chai_1.expect)(mockUpdateUserStatus.callCount).to.equal(2);
            (0, chai_1.expect)(mockUpdateUserStatus.getCall(0).calledWith('workflow', "fetching", organizationId)).to.be.true;
            (0, chai_1.expect)(mockUpdateUserStatus.getCall(1).calledWith('workflow', "completed", organizationId)).to.be.true;
            (0, chai_1.expect)(mockListUsersFromAuth0.calledWith(0, 50, undefined)).to.be.true;
            // Reset mocks for next step
            mockUpdateUserStatus.reset();
            mockDeleteUserFromAuth0.reset();
            mockDeleteUserFromDB.reset();
            mockUpdateUserStatus.resetBehavior();
            mockDeleteUserFromAuth0.resetBehavior();
            mockDeleteUserFromDB.resetBehavior();
            // Step 4: Delete User
            mockUpdateUserStatus.resolves();
            mockDeleteUserFromAuth0.resolves();
            mockDeleteUserFromDB.resolves();
            const deleteResponse = await (0, supertest_1.default)(app)
                .delete(`/api/users/${email}`)
                .query({ organizationId });
            (0, chai_1.expect)(deleteResponse.status).to.equal(200);
            (0, chai_1.expect)(deleteResponse.body).to.deep.equal({
                success: true,
                message: `User ${email} deletion completed`,
                deletedFrom: ['Auth0', 'MongoDB']
            });
            // Verify delete workflow calls
            (0, chai_1.expect)(mockUpdateUserStatus.callCount).to.equal(2);
            (0, chai_1.expect)(mockUpdateUserStatus.getCall(0).calledWith(email, "deleting", organizationId)).to.be.true;
            (0, chai_1.expect)(mockUpdateUserStatus.getCall(1).calledWith(email, "deleted", organizationId)).to.be.true;
            (0, chai_1.expect)(mockDeleteUserFromAuth0.calledWith(email)).to.be.true;
            (0, chai_1.expect)(mockDeleteUserFromDB.calledWith(email)).to.be.true;
        });
        it('should handle partial user lifecycle with failures and recovery', async () => {
            const email = 'partial@example.com';
            const name = 'Partial User';
            const password = 'SecurePassword123!';
            const organizationId = 'org123';
            const auth0Id = 'auth0|partial123';
            // Step 1: Create User (Success)
            mockUpdateUserStatus.resolves();
            mockCreateUserInAuth0.resolves(auth0Id);
            mockSaveAuth0IdToMongoDB.resolves();
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/users')
                .send({ email, name, password, organizationId });
            (0, chai_1.expect)(createResponse.status).to.equal(201);
            (0, chai_1.expect)(createResponse.body.success).to.be.true;
            // Reset mocks for next step
            mockUpdateUserStatus.reset();
            mockUpdateUserInAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockUpdateUserInAuth0.resetBehavior();
            // Step 2: Update User (Failure)
            const updates = { name: 'Updated Partial User' };
            const auth0Error = client_1.ApplicationFailure.create({
                message: 'Auth0 user update failed',
                type: 'Auth0ClientError',
                nonRetryable: true
            });
            mockUpdateUserStatus.onCall(0).resolves(); // updating status
            mockUpdateUserInAuth0.rejects(auth0Error);
            mockUpdateUserStatus.onCall(1).resolves(); // failed status
            const updateResponse = await (0, supertest_1.default)(app)
                .put(`/api/users/${email}`)
                .send({ updates, organizationId });
            (0, chai_1.expect)(updateResponse.status).to.equal(400); // nonRetryable error
            (0, chai_1.expect)(updateResponse.body).to.deep.equal({
                success: false,
                error: 'Auth0 user update failed',
                type: 'Auth0ClientError'
            });
            // Verify rollback was attempted
            (0, chai_1.expect)(mockUpdateUserStatus.callCount).to.equal(2);
            (0, chai_1.expect)(mockUpdateUserStatus.getCall(1).calledWith(email, "failed", organizationId)).to.be.true;
            // Reset mocks for next step
            mockUpdateUserStatus.reset();
            mockListUsersFromAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockListUsersFromAuth0.resetBehavior();
            // Step 3: List Users (Success - user still exists)
            const mockUsers = [
                { id: auth0Id, email, name, blocked: false } // Original name, not updated
            ];
            const mockResponse = { users: mockUsers, total: 1 };
            mockUpdateUserStatus.resolves();
            mockListUsersFromAuth0.resolves(mockResponse);
            const listResponse = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ page: 0, perPage: 50, organizationId });
            (0, chai_1.expect)(listResponse.status).to.equal(200);
            (0, chai_1.expect)(listResponse.body.success).to.be.true;
            (0, chai_1.expect)(listResponse.body.users[0].name).to.equal(name); // Original name
            // Reset mocks for next step
            mockUpdateUserStatus.reset();
            mockDeleteUserFromAuth0.reset();
            mockDeleteUserFromDB.reset();
            mockUpdateUserStatus.resetBehavior();
            mockDeleteUserFromAuth0.resetBehavior();
            mockDeleteUserFromDB.resetBehavior();
            // Step 4: Delete User (Partial success - Auth0 not found, MongoDB success)
            mockUpdateUserStatus.resolves();
            mockDeleteUserFromAuth0.rejects(new Error('User not found (404)'));
            mockDeleteUserFromDB.resolves();
            const deleteResponse = await (0, supertest_1.default)(app)
                .delete(`/api/users/${email}`)
                .query({ organizationId });
            (0, chai_1.expect)(deleteResponse.status).to.equal(200);
            (0, chai_1.expect)(deleteResponse.body).to.deep.equal({
                success: true,
                message: `User ${email} deletion completed`,
                deletedFrom: ['MongoDB'] // Only MongoDB deletion succeeded
            });
        });
    });
    describe('Bulk Operations Integration', () => {
        it('should handle creating multiple users in sequence', async () => {
            const users = [
                { email: 'bulk1@example.com', name: 'Bulk User 1', password: 'Pass1!' },
                { email: 'bulk2@example.com', name: 'Bulk User 2', password: 'Pass2!' },
                { email: 'bulk3@example.com', name: 'Bulk User 3', password: 'Pass3!' }
            ];
            const organizationId = 'bulk-org';
            mockUpdateUserStatus.resolves();
            mockSaveAuth0IdToMongoDB.resolves();
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const auth0Id = `auth0|bulk${i + 1}`;
                // Reset create mock for each user
                mockCreateUserInAuth0.reset();
                mockCreateUserInAuth0.resetBehavior();
                mockCreateUserInAuth0.resolves(auth0Id);
                const response = await (0, supertest_1.default)(app)
                    .post('/api/users')
                    .send({ ...user, organizationId });
                (0, chai_1.expect)(response.status).to.equal(201);
                (0, chai_1.expect)(response.body.success).to.be.true;
                (0, chai_1.expect)(response.body.auth0Id).to.equal(auth0Id);
                (0, chai_1.expect)(mockCreateUserInAuth0.calledWith(user.email, user.name, user.password)).to.be.true;
            }
            // Verify all users can be listed
            mockUpdateUserStatus.reset();
            mockListUsersFromAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockListUsersFromAuth0.resetBehavior();
            const mockUsers = users.map((user, i) => ({
                id: `auth0|bulk${i + 1}`,
                email: user.email,
                name: user.name
            }));
            const mockResponse = { users: mockUsers, total: 3 };
            mockUpdateUserStatus.resolves();
            mockListUsersFromAuth0.resolves(mockResponse);
            const listResponse = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ organizationId });
            (0, chai_1.expect)(listResponse.status).to.equal(200);
            (0, chai_1.expect)(listResponse.body.users).to.have.length(3);
            (0, chai_1.expect)(listResponse.body.pagination.total).to.equal(3);
        });
        it('should handle mixed success/failure in bulk operations', async () => {
            const users = [
                { email: 'mixed1@example.com', name: 'Mixed User 1', password: 'Pass1!' },
                { email: 'mixed2@example.com', name: 'Mixed User 2', password: 'Pass2!' },
                { email: 'mixed3@example.com', name: 'Mixed User 3', password: 'Pass3!' }
            ];
            const organizationId = 'mixed-org';
            mockUpdateUserStatus.resolves();
            mockSaveAuth0IdToMongoDB.resolves();
            const results = [];
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const auth0Id = `auth0|mixed${i + 1}`;
                // Reset mocks for each user
                mockCreateUserInAuth0.reset();
                mockCreateUserInAuth0.resetBehavior();
                if (i === 1) {
                    // Second user fails
                    mockCreateUserInAuth0.rejects(client_1.ApplicationFailure.create({
                        message: 'Auth0 user creation failed',
                        type: 'Auth0ClientError',
                        nonRetryable: true
                    }));
                }
                else {
                    mockCreateUserInAuth0.resolves(auth0Id);
                }
                const response = await (0, supertest_1.default)(app)
                    .post('/api/users')
                    .send({ ...user, organizationId });
                results.push({
                    email: user.email,
                    success: response.status === 201,
                    status: response.status
                });
            }
            // Verify results
            (0, chai_1.expect)(results[0].success).to.be.true; // First user succeeded
            (0, chai_1.expect)(results[1].success).to.be.false; // Second user failed
            (0, chai_1.expect)(results[1].status).to.equal(400); // nonRetryable error
            (0, chai_1.expect)(results[2].success).to.be.true; // Third user succeeded
            // Verify only successful users are listed
            mockUpdateUserStatus.reset();
            mockListUsersFromAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockListUsersFromAuth0.resetBehavior();
            const mockUsers = [
                { id: 'auth0|mixed1', email: 'mixed1@example.com', name: 'Mixed User 1' },
                { id: 'auth0|mixed3', email: 'mixed3@example.com', name: 'Mixed User 3' }
            ];
            const mockResponse = { users: mockUsers, total: 2 };
            mockUpdateUserStatus.resolves();
            mockListUsersFromAuth0.resolves(mockResponse);
            const listResponse = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ organizationId });
            (0, chai_1.expect)(listResponse.status).to.equal(200);
            (0, chai_1.expect)(listResponse.body.users).to.have.length(2); // Only successful users
        });
    });
    describe('Search and Pagination Integration', () => {
        it('should handle search with pagination across multiple requests', async () => {
            const organizationId = 'search-org';
            // Mock large dataset
            const allUsers = Array.from({ length: 150 }, (_, i) => ({
                id: `auth0|user${i + 1}`,
                email: `user${i + 1}@example.com`,
                name: `User ${i + 1}`
            }));
            // Test pagination without search
            mockUpdateUserStatus.resolves();
            // Page 0
            const page0Users = allUsers.slice(0, 50);
            mockListUsersFromAuth0.reset();
            mockListUsersFromAuth0.resetBehavior();
            mockListUsersFromAuth0.resolves({ users: page0Users, total: 150 });
            const page0Response = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ page: 0, perPage: 50, organizationId });
            (0, chai_1.expect)(page0Response.status).to.equal(200);
            (0, chai_1.expect)(page0Response.body.users).to.have.length(50);
            (0, chai_1.expect)(page0Response.body.pagination).to.deep.equal({
                page: 0,
                perPage: 50,
                total: 150,
                hasMore: true
            });
            // Page 1
            const page1Users = allUsers.slice(50, 100);
            mockListUsersFromAuth0.reset();
            mockListUsersFromAuth0.resetBehavior();
            mockListUsersFromAuth0.resolves({ users: page1Users, total: 150 });
            const page1Response = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ page: 1, perPage: 50, organizationId });
            (0, chai_1.expect)(page1Response.status).to.equal(200);
            (0, chai_1.expect)(page1Response.body.users).to.have.length(50);
            (0, chai_1.expect)(page1Response.body.pagination.hasMore).to.be.true;
            // Last page
            const page2Users = allUsers.slice(100, 150);
            mockListUsersFromAuth0.reset();
            mockListUsersFromAuth0.resetBehavior();
            mockListUsersFromAuth0.resolves({ users: page2Users, total: 150 });
            const page2Response = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ page: 2, perPage: 50, organizationId });
            (0, chai_1.expect)(page2Response.status).to.equal(200);
            (0, chai_1.expect)(page2Response.body.users).to.have.length(50);
            (0, chai_1.expect)(page2Response.body.pagination.hasMore).to.be.false;
            // Test search functionality
            const searchQuery = 'admin';
            const searchResults = [
                { id: 'auth0|admin1', email: 'admin1@example.com', name: 'Admin User 1' },
                { id: 'auth0|admin2', email: 'admin2@example.com', name: 'Admin User 2' }
            ];
            mockListUsersFromAuth0.reset();
            mockListUsersFromAuth0.resetBehavior();
            mockListUsersFromAuth0.resolves({ users: searchResults, total: 2 });
            const searchResponse = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ searchQuery, organizationId });
            (0, chai_1.expect)(searchResponse.status).to.equal(200);
            (0, chai_1.expect)(searchResponse.body.users).to.have.length(2);
            (0, chai_1.expect)(searchResponse.body.pagination.total).to.equal(2);
            (0, chai_1.expect)(mockListUsersFromAuth0.calledWith(0, 50, searchQuery)).to.be.true;
        });
    });
    describe('Error Handling and Recovery Integration', () => {
        it('should handle cascading failures and partial recovery', async () => {
            const email = 'cascading@example.com';
            const name = 'Cascading User';
            const password = 'SecurePassword123!';
            const organizationId = 'cascade-org';
            // Scenario 1: Create user fails at Auth0 step
            mockUpdateUserStatus.onCall(0).resolves(); // provisioning status
            mockCreateUserInAuth0.rejects(client_1.ApplicationFailure.create({
                message: 'Auth0 service unavailable',
                type: 'Auth0ServiceError',
                nonRetryable: false
            }));
            mockUpdateUserStatus.onCall(1).resolves(); // failed status
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/users')
                .send({ email, name, password, organizationId });
            (0, chai_1.expect)(createResponse.status).to.equal(500); // retryable error
            (0, chai_1.expect)(createResponse.body.success).to.be.false;
            (0, chai_1.expect)(createResponse.body.type).to.equal('Auth0ServiceError');
            // Verify rollback was attempted
            (0, chai_1.expect)(mockUpdateUserStatus.callCount).to.equal(2);
            (0, chai_1.expect)(mockUpdateUserStatus.getCall(1).calledWith(email, "failed", organizationId, name)).to.be.true;
            // Reset mocks for retry scenario
            mockUpdateUserStatus.reset();
            mockCreateUserInAuth0.reset();
            mockSaveAuth0IdToMongoDB.reset();
            mockUpdateUserStatus.resetBehavior();
            mockCreateUserInAuth0.resetBehavior();
            mockSaveAuth0IdToMongoDB.resetBehavior();
            // Scenario 2: Retry create user (success)
            const auth0Id = 'auth0|cascading123';
            mockUpdateUserStatus.resolves();
            mockCreateUserInAuth0.resolves(auth0Id);
            mockSaveAuth0IdToMongoDB.resolves();
            const retryCreateResponse = await (0, supertest_1.default)(app)
                .post('/api/users')
                .send({ email, name, password, organizationId });
            (0, chai_1.expect)(retryCreateResponse.status).to.equal(201);
            (0, chai_1.expect)(retryCreateResponse.body.success).to.be.true;
            // Scenario 3: Update fails, then list shows original state
            mockUpdateUserStatus.reset();
            mockUpdateUserInAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockUpdateUserInAuth0.resetBehavior();
            const updates = { name: 'Updated Cascading User' };
            mockUpdateUserStatus.onCall(0).resolves(); // updating status
            mockUpdateUserInAuth0.rejects(new Error('Network timeout'));
            mockUpdateUserStatus.onCall(1).resolves(); // failed status
            const updateResponse = await (0, supertest_1.default)(app)
                .put(`/api/users/${email}`)
                .send({ updates, organizationId });
            (0, chai_1.expect)(updateResponse.status).to.equal(500);
            (0, chai_1.expect)(updateResponse.body.success).to.be.false;
            // Verify user still has original data
            mockUpdateUserStatus.reset();
            mockListUsersFromAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockListUsersFromAuth0.resetBehavior();
            const mockUsers = [
                { id: auth0Id, email, name, blocked: false } // Original name
            ];
            const mockResponse = { users: mockUsers, total: 1 };
            mockUpdateUserStatus.resolves();
            mockListUsersFromAuth0.resolves(mockResponse);
            const listResponse = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ organizationId });
            (0, chai_1.expect)(listResponse.status).to.equal(200);
            (0, chai_1.expect)(listResponse.body.users[0].name).to.equal(name); // Original name preserved
        });
        it('should handle concurrent operations with proper isolation', async () => {
            const organizationId = 'concurrent-org';
            const users = [
                { email: 'concurrent1@example.com', name: 'Concurrent User 1', password: 'Pass1!' },
                { email: 'concurrent2@example.com', name: 'Concurrent User 2', password: 'Pass2!' },
                { email: 'concurrent3@example.com', name: 'Concurrent User 3', password: 'Pass3!' }
            ];
            // Setup mocks for concurrent operations
            mockUpdateUserStatus.resolves();
            mockSaveAuth0IdToMongoDB.resolves();
            // Setup mock to return different auth0Id based on email
            mockCreateUserInAuth0.callsFake((email) => {
                if (email === 'concurrent1@example.com')
                    return Promise.resolve('auth0|concurrent1');
                if (email === 'concurrent2@example.com')
                    return Promise.resolve('auth0|concurrent2');
                if (email === 'concurrent3@example.com')
                    return Promise.resolve('auth0|concurrent3');
                return Promise.resolve('auth0|unknown');
            });
            // Simulate concurrent user creation
            const createPromises = users.map(async (user, index) => {
                // Simulate different timing for each request
                await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
                const response = await (0, supertest_1.default)(app)
                    .post('/api/users')
                    .send({ ...user, organizationId });
                return {
                    email: user.email,
                    success: response.status === 201,
                    auth0Id: response.body.auth0Id,
                    expectedAuth0Id: `auth0|concurrent${index + 1}`
                };
            });
            const results = await Promise.all(createPromises);
            // Verify all operations succeeded independently
            results.forEach((result) => {
                (0, chai_1.expect)(result.success).to.be.true;
                (0, chai_1.expect)(result.auth0Id).to.match(/^auth0\|concurrent[123]$/); // Should be one of the expected IDs
            });
            // Verify final state shows all users
            mockUpdateUserStatus.reset();
            mockListUsersFromAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockListUsersFromAuth0.resetBehavior();
            const mockUsers = users.map((user, i) => ({
                id: `auth0|concurrent${i + 1}`,
                email: user.email,
                name: user.name
            }));
            const mockResponse = { users: mockUsers, total: 3 };
            mockUpdateUserStatus.resolves();
            mockListUsersFromAuth0.resolves(mockResponse);
            const listResponse = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ organizationId });
            (0, chai_1.expect)(listResponse.status).to.equal(200);
            (0, chai_1.expect)(listResponse.body.users).to.have.length(3);
        });
    });
    describe('Edge Cases and Data Validation Integration', () => {
        it('should handle special characters and international data', async () => {
            const email = 'tëst+üser@exämple-domain.com';
            const name = 'José María Ñoño 测试用户 🚀';
            const password = 'Pássw0rd!@#$%^&*()';
            const organizationId = 'org-测试_123';
            const auth0Id = 'auth0|special_123';
            // Create user with special characters
            mockUpdateUserStatus.resolves();
            mockCreateUserInAuth0.resolves(auth0Id);
            mockSaveAuth0IdToMongoDB.resolves();
            const createResponse = await (0, supertest_1.default)(app)
                .post('/api/users')
                .send({ email, name, password, organizationId });
            (0, chai_1.expect)(createResponse.status).to.equal(201);
            (0, chai_1.expect)(createResponse.body.success).to.be.true;
            // Update with more special characters
            mockUpdateUserStatus.reset();
            mockUpdateUserInAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockUpdateUserInAuth0.resetBehavior();
            const updates = {
                name: '新しい名前 José María Ñoño 🎉',
                password: 'Nëw-Pássw0rd!@#$%^&*()'
            };
            const updatedFields = ['name', 'password'];
            mockUpdateUserStatus.resolves();
            mockUpdateUserInAuth0.resolves(updatedFields);
            const updateResponse = await (0, supertest_1.default)(app)
                .put(`/api/users/${encodeURIComponent(email)}`)
                .send({ updates, organizationId });
            (0, chai_1.expect)(updateResponse.status).to.equal(200);
            (0, chai_1.expect)(updateResponse.body.success).to.be.true;
            // Search with special characters
            mockUpdateUserStatus.reset();
            mockListUsersFromAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockListUsersFromAuth0.resetBehavior();
            const searchQuery = 'josé maría 测试';
            const mockUsers = [
                { id: auth0Id, email, name: updates.name }
            ];
            const mockResponse = { users: mockUsers, total: 1 };
            mockUpdateUserStatus.resolves();
            mockListUsersFromAuth0.resolves(mockResponse);
            const searchResponse = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ searchQuery, organizationId });
            (0, chai_1.expect)(searchResponse.status).to.equal(200);
            (0, chai_1.expect)(searchResponse.body.users[0].name).to.equal(updates.name);
            (0, chai_1.expect)(mockListUsersFromAuth0.calledWith(0, 50, searchQuery)).to.be.true;
            // Delete user with special characters
            mockUpdateUserStatus.reset();
            mockDeleteUserFromAuth0.reset();
            mockDeleteUserFromDB.reset();
            mockUpdateUserStatus.resetBehavior();
            mockDeleteUserFromAuth0.resetBehavior();
            mockDeleteUserFromDB.resetBehavior();
            mockUpdateUserStatus.resolves();
            mockDeleteUserFromAuth0.resolves();
            mockDeleteUserFromDB.resolves();
            const deleteResponse = await (0, supertest_1.default)(app)
                .delete(`/api/users/${encodeURIComponent(email)}`)
                .query({ organizationId });
            (0, chai_1.expect)(deleteResponse.status).to.equal(200);
            (0, chai_1.expect)(deleteResponse.body.success).to.be.true;
        });
        it('should handle empty and null data gracefully', async () => {
            // Test empty list response
            mockUpdateUserStatus.resolves();
            mockListUsersFromAuth0.resolves({ users: [], total: 0 });
            const emptyListResponse = await (0, supertest_1.default)(app)
                .get('/api/users')
                .query({ organizationId: 'empty-org' });
            (0, chai_1.expect)(emptyListResponse.status).to.equal(200);
            (0, chai_1.expect)(emptyListResponse.body.users).to.have.length(0);
            (0, chai_1.expect)(emptyListResponse.body.pagination.total).to.equal(0);
            // Test delete non-existent user
            mockUpdateUserStatus.reset();
            mockDeleteUserFromAuth0.reset();
            mockDeleteUserFromDB.reset();
            mockUpdateUserStatus.resetBehavior();
            mockDeleteUserFromAuth0.resetBehavior();
            mockDeleteUserFromDB.resetBehavior();
            mockUpdateUserStatus.resolves();
            mockDeleteUserFromAuth0.rejects(new Error('User not found (404)'));
            mockDeleteUserFromDB.rejects(new Error('No user found with email'));
            const deleteNonExistentResponse = await (0, supertest_1.default)(app)
                .delete('/api/users/nonexistent@example.com')
                .query({ organizationId: 'empty-org' });
            (0, chai_1.expect)(deleteNonExistentResponse.status).to.equal(200);
            (0, chai_1.expect)(deleteNonExistentResponse.body.deletedFrom).to.have.length(0);
            // Test update with empty updates
            mockUpdateUserStatus.reset();
            mockUpdateUserInAuth0.reset();
            mockUpdateUserStatus.resetBehavior();
            mockUpdateUserInAuth0.resetBehavior();
            mockUpdateUserStatus.resolves();
            mockUpdateUserInAuth0.resolves([]);
            const emptyUpdateResponse = await (0, supertest_1.default)(app)
                .put('/api/users/test@example.com')
                .send({ updates: {}, organizationId: 'empty-org' });
            (0, chai_1.expect)(emptyUpdateResponse.status).to.equal(200);
            (0, chai_1.expect)(emptyUpdateResponse.body.updatedFields).to.have.length(0);
        });
    });
});
