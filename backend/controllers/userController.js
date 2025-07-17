import { triggerCreateUser } from "../workflows/userWorkflowsTrigger/triggerCreateUser.ts";
import { triggerUpdateUser } from "../workflows/userWorkflowsTrigger/triggerUpdateUser.ts";
import { triggerDeleteUser } from "../workflows/userWorkflowsTrigger/triggerDeleteUser.ts";
import { triggerListUsers } from "../workflows/userWorkflowsTrigger/triggerListUsers.ts";
import User from "../models/User.js";

export const createUserController = async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({
      error: "Email ,Name and password are required.",
      statusCode: 400,
    });
  }

  try {
    await User.create({
      email,
      name,
      password,
      status: "provisioning",
    });

    console.log(
      `[${new Date().toISOString()}] User saved with status 'provisioning'. Scheduling workflow...`
    );

    const workflowId = await triggerCreateUser({ email, password, name });
    res.status(200).json({ message: "User provisioning started", workflowId });
  } catch (error) {
    console.error("Error starting workflow:", error);
    res.status(500).json({
      error: "Failed to start user creation workflow",
      statusCode: 500,
    });
  }
};

export const updateUserController = async (req, res) => {
  const userId = req.params.id;

  const { updates } = req.body;

  if (!userId || userId == "undefined") {
    return res
      .status(400)
      .json({ error: "userId is required.", statusCode: 400 });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { email } = user;

    const workflowId = await triggerUpdateUser({ email, updates });
    res.status(200).json({ message: "User update started", workflowId });
  } catch (error) {
    console.error("Error starting update workflow:", error);
    res.status(500).json({ error: "Failed to start user update workflow" });
  }
};

// delete user

export const deleteUserController = async (req, res) => {
  const userId = req.params.id;

  if (!userId || userId == "undefined") {
    return res
      .status(400)
      .json({ error: "User ID is required.", statusCode: 400 });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found.", statusCode: 404 });
    }

    const workflowId = await triggerDeleteUser({
      email: user.email,
      userId: user._id.toString(),
    });
    res.status(200).json({ message: "User deletion started", workflowId });
  } catch (error) {
    console.error("Error starting delete workflow:", error);
    res.status(500).json({ error: "Failed to start user deletion workflow" });
  }
};

// list users

export const listUsersController = async (req, res) => {
  try {
    const users = await triggerListUsers();
    const cleanedUsers = users.map((user) => ({
      name: user.name,
      email: user.email,
      user_id: user.user_id,
      created_at: user.created_at,
    }));

    res.status(200).json({ users: cleanedUsers });
  } catch (error) {
    console.error("Error listing users:", error);
    res.status(500).json({ error: "Failed to fetch users from Auth0" });
  }
};
