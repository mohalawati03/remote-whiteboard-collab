const express = require("express");
const router = express.Router();

// File upload logic goes here later

router.get("/", (req, res) => {
  res.send("File upload route working.");
});

module.exports = router;
