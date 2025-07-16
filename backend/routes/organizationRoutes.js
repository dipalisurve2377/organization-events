import express from "express";

import { createOrganizationController } from "../controllers/organizationController.js";
import { updateOrganizationController } from "../controllers/organizationController.js";
import { deleteOrganizationController } from "../controllers/organizationController.js";
import { sendUpdateSignalController } from "../controllers/organizationController.js";
import { sendTerminateSignalController } from "../controllers/organizationController.js";
import { sendCancelSignalController } from "../controllers/organizationController.js";

const router = express.Router();

router.post("/", createOrganizationController);
router.put("/update", updateOrganizationController);
router.delete("/delete", deleteOrganizationController);
router.post("/send-update-signal", sendUpdateSignalController);
router.post("/send-terminate-signal", sendTerminateSignalController);
router.post("/send-cancel-signal", sendCancelSignalController);

export default router;
