import { sendUpdateSignalController } from "../controllers/organizationController.js";
import { sendTerminateSignalController } from "../controllers/organizationController.js";
import { sendCancelSignalController } from "../controllers/organizationController.js";

router.post("/send-update-signal", sendUpdateSignalController);
router.post("/send-terminate-signal", sendTerminateSignalController);
router.post("/send-cancel-signal", sendCancelSignalController);
