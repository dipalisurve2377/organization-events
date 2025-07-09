// mongodb+srv://dipali:organization2000@cluster0.l9sxobd.mongodb.net/

import mongoose from "mongoose";

const connectDB=async()=>{
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://dipali:organization2000@cluster0.l9sxobd.mongodb.net/')

        console.log("MongoDB connected successfully");
    } catch (error) {
        
        console.error("Failed to connect to MongoDB",error);
        process.exit(1);
    }
}

export default connectDB;