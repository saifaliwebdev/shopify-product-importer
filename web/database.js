import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Attempting reconnect...");
    });

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    // For testing, don't exit - just log and continue
    console.log("Continuing without MongoDB for testing...");
    return null;
  }
};

export default connectDB;
