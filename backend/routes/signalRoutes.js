import express from "express";

import { sendTerminateSignalController } from "../controllers/organizationController.js";
import { sendCancelSignalController } from "../controllers/organizationController.js";

const router = express.Router();

router.post("/:id/terminate", sendTerminateSignalController);
router.post("/:id/cancel", sendCancelSignalController);

export default router;
