import express from "express";

import { createOrganizationController } from "../controllers/organizationController.js";
import { updateOrganizationController } from "../controllers/organizationController.js";
import { deleteOrganizationController } from "../controllers/organizationController.js";
import { listOrganizationController } from "../controllers/organizationController.js";
import { getOrganizationByIdController } from "../controllers/organizationController.js";

const router = express.Router();

router.post("/", createOrganizationController);
router.get("/", listOrganizationController);
router.get("/:id", getOrganizationByIdController);
router.put("/:id", updateOrganizationController);
router.delete("/:id", deleteOrganizationController);

export default router;
