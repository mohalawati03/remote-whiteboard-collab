const express = require("express");
const http = require("http");
const cors = require("cors");
const multer = require("multer");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static("server/public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const sessions = {};
const userNames = {};
const canvasSnapshots = {};

// File storage setup
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "_" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// File upload endpoint
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

// Session creation
app.post("/session/create", (req, res) => {
  const sessionId = uuidv4();
  sessions[sessionId] = { users: [] };
  res.json({ sessionId });
});

// Session joining
app.post("/session/join", (req, res) => {
  const { sessionId } = req.body;
  if (sessions[sessionId]) {
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: "Session not found" });
  }
});

// WebSocket logic
io.on("connection", (socket) => {
  socket.on("joinSession", ({ sessionId, name, isHost }) => {
    socket.join(sessionId);
    const displayName = isHost ? "Host" : name || "Anonymous";
    userNames[socket.id] = displayName;

    // Add user to session
    if (!sessions[sessionId]) sessions[sessionId] = { users: [] };
    sessions[sessionId].users.push({ id: socket.id, name: displayName });

    // Send updated user list
    const namesList = sessions[sessionId].users.map(u => u.name);
    io.to(sessionId).emit("updateUserList", namesList);

    // Send snapshot if exists
    if (canvasSnapshots[sessionId]) {
      socket.emit("loadSnapshot", canvasSnapshots[sessionId]);
    }

    io.to(sessionId).emit("systemMessage", `${displayName} joined the session`);
  });

  // Drawing
  socket.on("draw", (data) => {
    socket.to(data.sessionId).emit("draw", data);
  });

  socket.on("shape", (data) => {
    socket.to(data.sessionId).emit("shape", data);
  });

  // Chat
  socket.on("chatMessage", (data) => {
    const sender = userNames[socket.id] || "Anonymous";
    io.to(data.sessionId).emit("chatMessage", { name: sender, text: data.text });
  });

  // Canvas snapshot
  socket.on("snapshot", ({ sessionId, image }) => {
    canvasSnapshots[sessionId] = image;
  });

  // Disconnect
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

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
