// Required modules
const express = require("express");
const http = require("http");
const cors = require("cors");
const multer = require("multer");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

// Create express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("server/public")); // Serve frontend
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Serve uploaded files

// In-memory data
const sessions = {};
const userNames = {};
const canvasSnapshots = {};

// Multer storage config
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "_" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Upload route
app.post("/upload/:sessionId", upload.single("file"), (req, res) => {
  const sessionId = req.params.sessionId;
  const file = req.file;
  const uploaderId = req.headers["uploader-id"];
  const uploaderName = userNames[uploaderId] || "Someone";

  if (!file) return res.status(400).send("No file uploaded");
  const fileUrl = `/uploads/${file.filename}`;

  io.to(sessionId).emit("fileShared", {
    fileName: file.originalname,
    fileUrl,
    uploader: uploaderName,
  });

  res.status(200).send({ fileName: file.originalname, fileUrl });
});

// Create a session
app.post("/session/create", (req, res) => {
  const sessionId = uuidv4();
  sessions[sessionId] = { users: [] };
  res.json({ sessionId });
});

// Join a session
app.post("/session/join", (req, res) => {
  const { sessionId } = req.body;
  if (sessions[sessionId]) {
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: "Session not found" });
  }
});

// Socket.io logic
io.on("connection", (socket) => {
  // User joins a session
  socket.on("joinSession", ({ sessionId, name, isHost }) => {
    socket.join(sessionId);
    const displayName = isHost ? "Host" : name || "Anonymous";
    userNames[socket.id] = displayName;

    if (!sessions[sessionId]) sessions[sessionId] = { users: [] };
    sessions[sessionId].users.push({ id: socket.id, name: displayName });

    const namesList = sessions[sessionId].users.map(u => u.name);
    io.to(sessionId).emit("updateUserList", namesList);

    if (canvasSnapshots[sessionId]) {
      socket.emit("loadSnapshot", canvasSnapshots[sessionId]);
    }

    io.to(sessionId).emit("systemMessage", `${displayName} joined the session`);
  });

  // Broadcast freehand drawings
  socket.on("draw", (data) => {
    socket.to(data.sessionId).emit("draw", data);
  });

  // Broadcast shapes (rect, circle, triangle, fill)
  socket.on("shape", (data) => {
    socket.to(data.sessionId).emit("shape", data);
  });

  // Broadcast chat messages
  socket.on("chatMessage", (data) => {
    const sender = userNames[socket.id] || "Anonymous";
    io.to(data.sessionId).emit("chatMessage", { name: sender, text: data.text });
  });

  // Store canvas snapshot
  socket.on("snapshot", ({ sessionId, image }) => {
    canvasSnapshots[sessionId] = image;
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const name = userNames[socket.id];

    for (const sessionId in sessions) {
      const userList = sessions[sessionId].users;
      sessions[sessionId].users = userList.filter(u => u.id !== socket.id);

      const updatedNames = sessions[sessionId].users.map(u => u.name);
      io.to(sessionId).emit("updateUserList", updatedNames);

      io.to(sessionId).emit("systemMessage", `${name} left the session`);
    }

    delete userNames[socket.id];
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
