// Import express and create a router
const express = require("express");
const router = express.Router();

// Placeholder route to test if upload route works
router.get("/", (req, res) => {
  res.send("File upload route working.");
});

// Export the router so it can be used in server.js
module.exports = router;
