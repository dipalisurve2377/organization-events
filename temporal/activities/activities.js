"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrganizationRecord = exports.updateOrganizationStatus = exports.sendNotificationEmail = exports.createOrganizationRecord = void 0;
var mongoose_1 = require("mongoose");
var nodemailer_1 = require("nodemailer");
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
var connected = false;
var connectDB = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!!connected) return [3 /*break*/, 2];
                return [4 /*yield*/, mongoose_1.default.connect(process.env.MONGO_URI || 'mongodb+srv://dipali:organization2000@cluster0.l9sxobd.mongodb.net/')];
            case 1:
                _a.sent();
                connected = true;
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); };
var organizationSchema = new mongoose_1.default.Schema({
    name: String,
    identifier: { type: String, unique: true },
    createdByEmail: String,
    status: {
        type: String,
        enum: ['provisioning', 'updating', 'deleting', 'success', 'failed', 'updated', 'deleted'],
        default: 'provisioning',
    }
}, {
    timestamps: true
});
var Organization = mongoose_1.default.models.Organization || mongoose_1.default.model('Organization', organizationSchema);
// create organization
var createOrganizationRecord = function (name, identifier, createdByEmail) { return __awaiter(void 0, void 0, void 0, function () {
    var org;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, connectDB()];
            case 1:
                _a.sent();
                return [4 /*yield*/, Organization.create({
                        name: name,
                        identifier: identifier,
                        createdByEmail: createdByEmail,
                        status: 'provisioning'
                    })];
            case 2:
                org = _a.sent();
                console.log('Organization created successfully', org._id);
                return [2 /*return*/, org._id.toString()];
        }
    });
}); };
exports.createOrganizationRecord = createOrganizationRecord;
// sending email to the user
var sendNotificationEmail = function (to, name) { return __awaiter(void 0, void 0, void 0, function () {
    var transporter;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                transporter = nodemailer_1.default.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER || 'dipalim680@gmail.com',
                        pass: process.env.EMAIL_PASS || 'shni mrvx yumy xnmc',
                    }
                });
                return [4 /*yield*/, transporter.sendMail({
                        from: process.env.EMAIL_USER || 'dipalim680@gmail.com',
                        to: to,
                        subject: 'Organization Created',
                        text: "Hello, your organization \"".concat(name, "\" has been successfully created."),
                    })];
            case 1:
                _a.sent();
                console.log('Notification email sent to ', to);
                return [2 /*return*/];
        }
    });
}); };
exports.sendNotificationEmail = sendNotificationEmail;
// update the organization status
var updateOrganizationStatus = function (orgId, status) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, connectDB()];
            case 1:
                _a.sent();
                return [4 /*yield*/, Organization.findByIdAndUpdate(orgId, { status: status })];
            case 2:
                _a.sent();
                console.log("Organization status updated to \"".concat(status, "\" for ").concat(orgId));
                return [2 /*return*/];
        }
    });
}); };
exports.updateOrganizationStatus = updateOrganizationStatus;
// update updateOrganizationRecord
var updateOrganizationRecord = function (orgId, name, identifier) { return __awaiter(void 0, void 0, void 0, function () {
    var updateFields;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, connectDB()];
            case 1:
                _a.sent();
                updateFields = {};
                if (name)
                    updateFields.name = name;
                if (identifier)
                    updateFields.identifier = identifier;
                return [4 /*yield*/, Organization.findByIdAndUpdate(orgId, updateFields, { new: true })];
            case 2:
                _a.sent();
                console.log("Organization ".concat(orgId, " has been updated"));
                return [2 /*return*/];
        }
    });
}); };
exports.updateOrganizationRecord = updateOrganizationRecord;
