import express from "express";

import { createOrganizationController } from "../controllers/organizationController.js";
import { updateOrganizationController } from "../controllers/organizationController.js";
import { deleteOrganizationController } from "../controllers/organizationController.js";
import { listOrganizationController } from "../controllers/organizationController.js";

const router = express.Router();

router.post("/", createOrganizationController);
router.put("/:id", updateOrganizationController);
router.delete("/:id", deleteOrganizationController);
router.get("/", listOrganizationController);

export default router;
