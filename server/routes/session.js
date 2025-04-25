// Import express and uuid generator
const express = require("express");
const { v4: uuidv4 } = require("uuid");

// Export a function that receives the shared sessions object
module.exports = (sessions) => {
  const router = express.Router();

  // Create a new session with a unique ID
  router.post("/create", (req, res) => {
    const sessionId = uuidv4();
    sessions[sessionId] = { users: [] };
    res.json({ sessionId });
  });

  // Join an existing session by ID
  router.post("/join", (req, res) => {
    const { sessionId } = req.body;
    if (sessions[sessionId]) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: "Session not found." });
    }
  });

  // Return the router
  return router;
};
