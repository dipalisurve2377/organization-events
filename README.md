# 🌐 Organization Events Backend

This project is a **Node.js + Express + Temporal** backend for managing organizations and syncing with **Auth0**. It handles asynchronous workflows like **organization creation, update, and deletion**, and tracks each organization's status in MongoDB.

---

## 🚀 Features

- ✅ Create Organization (MongoDB + Auth0)

- 📝 Update Organization details (name, identifier) in Auth0 and MongoDB

- ❌ Soft Delete Organization (update status to `deleted`)

- 📦 Uses Temporal Workflows for background processing

- 📧 Sends email notifications after actions

- 🔐 Auth0 integration for secure org management

- 📊 MongoDB for persistence

---

## 🛠️ Tech Stack

| Layer       | Tech                                    |
| ----------- | --------------------------------------- |
| Language    | TypeScript                              |
| Backend     | Node.js, Express                        |
| Database    | MongoDB (Mongoose ORM)                  |
| Auth        | Auth0 Management API                    |
| Workflows   | Temporal.io                             |
| Email       | Nodemailer (or any SMTP-compatible API) |
| HTTP Client | Axios                                   |

---

## 📂 Folder Structure

```
Organization-Events/
│
├── backend/                             # Node.js backend (Express API server)
│   ├── controllers/                     # API logic: triggers workflows
│   │   └── organizationController.js    # Handles org event triggers
│   ├── routes/                          # Express routes
│   │   └── organizationRoutes.js        # Routes to trigger org events
│   ├── models/                          # MongoDB (Mongoose) models
│   │   └── Organization.js              # Organization schema with status
|   |
│   ├── workflows/
│   │   |                                # Temporal connection + client
│   │   └── triggerOrgWorkflow.ts        # Starts org workflow via client
│   └── index.js                         # Main entry: Express server setup
│
├── temporal/                            # Temporal logic (TypeScript SDK)
│   ├── workflows/                       # Actual workflow definitions
│   │   └── organizationWorkflow.ts      # Orchestrates status + email
│   ├── activities/                      # Logic called from workflows
│   │   ├── mongoActivities.ts           # Updates org status in MongoDB
│   │   └── emailActivities.ts           # Calls Nodemailer
│   └── worker.ts                        # Runs Temporal worker for workflows
│
├── .env                                 # Environment variables (Mongo URI, email creds)
├── package.json                         # Project dependencies
├── tsconfig.json                        # TypeScript config for Temporal
└── README.md

```

## 📍 Create Organization

curl -X POST http://localhost:7000/api/organizations/ \
 -H "Content-Type: application/json" \
 -d '{
"name": "Fresh Org Name",
"identifier": "fresh-org-id",
"createdByEmail": "dipali@platformatory.com"
}'

## ✏️ Update Organization

curl -X PUT http://localhost:7000/api/organizations/update \
 -H "Content-Type: application/json" \
 -d '{
"orgId": "PASTE_ORG_ID_HERE",
"name": "Updated Fresh Org Name",
"identifier": "updated-fresh-org-id",
"createdByEmail": "dipali@platformatory.com"
}'

## ❌ Delete Organization (Soft Delete)

curl -X DELETE http://localhost:7000/api/organizations/delete \
 -H "Content-Type: application/json" \
 -d '{
"orgId": "6872681b7cde0ba11ff397d0",
"createdByEmail": "dipali@platformatory.com"
}'

## ⚙️ Setup Instructions

1. **Clone the repository**

```bash
git clone https://github.com/dipalisurve2377/organization-events
cd organization-events
```
