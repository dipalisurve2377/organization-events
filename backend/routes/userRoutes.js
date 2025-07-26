import express from "express";
import {
  createUserController,
  deleteUserController,
  listUsersController,
  updateUserController,
  getUserByIdController,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/", listUsersController);
router.post("/", createUserController);
router.put("/:id", updateUserController);
router.delete("/:id", deleteUserController);
router.get("/:id", getUserByIdController);

export default router;
