const mongoose = require("mongoose");

const connectDB = () => {
  return mongoose.connect(process.env.MONGO_URI)
    .then((conn) => {
      console.log(`MongoDB Connected: ${conn.connection.host}`);
    })
    .catch((error) => {
      console.error(`MongoDB connection error: ${error.message}`);
      throw error;
    });
};

module.exports = connectDB;
