import express from "express";

import { sendTerminateSignalController } from "../controllers/organizationController.js";
import { sendCancelSignalController } from "../controllers/organizationController.js";

const router = express.Router();

router.post("/:id", sendTerminateSignalController);
router.post("/:id", sendCancelSignalController);

export default router;
