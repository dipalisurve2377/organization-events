
import express from "express";

import { createOrganizationController } from "../controllers/organizationController.js";

const router=express.Router();

router.post('/',createOrganizationController);

export default router;