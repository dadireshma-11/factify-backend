import mongoose from "mongoose";
import dns from "dns";

const connectDB = async () => {
  try {
    if (process.env.MONGO_URI?.startsWith("mongodb+srv://")) {
      dns.setServers(["8.8.8.8", "8.8.4.4"]);
      console.log("[MongoDB] Using Google DNS for SRV resolution");
    }

    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;