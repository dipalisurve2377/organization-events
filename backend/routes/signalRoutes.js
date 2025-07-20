import express from "express";

import { sendTerminateSignalController } from "../controllers/organizationController.js";
import { sendCancelSignalController } from "../controllers/organizationController.js";
import { sendUpdateSignalController } from "../controllers/organizationController.js";

const router = express.Router();

router.post("/:id/terminate", sendTerminateSignalController);
router.post("/:id/cancel", sendCancelSignalController);
router.post("/:id/update", sendUpdateSignalController);

export default router;
