const mongoose = require("mongoose");
const dns = require("node:dns");

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const connectDB = () => {
  return (
    mongoose
      .connect(process.env.MONGODB_URI || process.env.MONGO_URI)
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host}`);
      })
      .catch((error) => {
        console.error(`MongoDB connection error: ${error.message}`);
        throw error;
      })
  );
};

module.exports = connectDB;