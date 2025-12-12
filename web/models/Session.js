import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  shop: { type: String, required: true, index: true },
  state: String,
  isOnline: { type: Boolean, default: false },
  scope: String,
  accessToken: String,
  expires: Date,
  onlineAccessInfo: {
    associated_user: {
      id: Number,
      first_name: String,
      last_name: String,
      email: String,
      account_owner: Boolean,
    },
  },
}, {
  timestamps: true,
});

export default mongoose.model("Session", sessionSchema);