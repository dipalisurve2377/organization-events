
import express from "express";

import { createOrganizationController } from "../controllers/organizationController.js";
import { updateOrganizationController } from "../controllers/organizationController.js";
import { deleteOrganizationController } from "../controllers/organizationController.js";

const router=express.Router();

router.post('/',createOrganizationController);
router.put("/update",updateOrganizationController);
router.delete("/delete", deleteOrganizationController);

export default router;