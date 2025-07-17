import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    auth0Id: {
      type: String,
    },
    status: {
      type: String,
      enum: [
        "provisioning",
        "updating",
        "deleting",
        "success",
        "failed",
        "updated" | "deleted",
      ],
      default: "provisioning",
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
