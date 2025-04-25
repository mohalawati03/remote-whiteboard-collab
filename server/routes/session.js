const express = require("express");
const { v4: uuidv4 } = require("uuid");

module.exports = (sessions) => {
  const router = express.Router();

  router.post("/create", (req, res) => {
    const sessionId = uuidv4();
    sessions[sessionId] = { users: [] };
    res.json({ sessionId });
  });

  router.post("/join", (req, res) => {
    const { sessionId } = req.body;
    if (sessions[sessionId]) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: "Session not found." });
    }
  });

  return router;
};
