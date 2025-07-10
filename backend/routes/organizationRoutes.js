
import express from "express";

import { createOrganizationController } from "../controllers/organizationController.js";
import { updateOrganizationController } from "../controllers/organizationController.js";

const router=express.Router();

router.post('/',createOrganizationController);
router.put("/update",updateOrganizationController);


export default router;