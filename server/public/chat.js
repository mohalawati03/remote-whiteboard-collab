// Get references to chat DOM elements
const msgInput = document.getElementById("messageInput");
const msgBox = document.getElementById("messages");
const fileInput = document.getElementById("fileInput");

// Send message when "Enter" is pressed
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

// Function to send message to server
function sendMessage() {
  const message = msgInput.value.trim();
  if (!message) return;
  socket.emit("chatMessage", { sessionId, text: message });
  msgInput.value = "";
}

// Display a received chat message
socket.on("chatMessage", (data) => {
  const msg = document.createElement("div");
  msg.innerHTML = `<strong>${data.name}:</strong> ${data.text}`;
  msgBox.appendChild(msg);
  msgBox.scrollTop = msgBox.scrollHeight;
});

// Display system messages (join/leave)
socket.on("systemMessage", (text) => {
  const msg = document.createElement("div");
  msg.style.color = "gray";
  msg.innerText = text;
  msgBox.appendChild(msg);
  msgBox.scrollTop = msgBox.scrollHeight;
});

// Handle file upload when user selects a file
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  // Send file to server with uploader ID
  fetch(`/upload/${sessionId}`, {
    method: "POST",
    body: formData,
    headers: {
      "uploader-id": socket.id
    }
  });
});

// Show uploaded file link in chat with uploader name
socket.on("fileShared", ({ fileName, fileUrl, uploader }) => {
  const msg = document.createElement("div");
  msg.innerHTML = `<strong>${uploader} uploaded:</strong> <a href="${fileUrl}" target="_blank">${fileName}</a>`;
  msgBox.appendChild(msg);
  msgBox.scrollTop = msgBox.scrollHeight;
});

// Display number of participants and their names above the chat
socket.on("updateUserList", (names) => {
  const userList = document.getElementById("userList");
  userList.innerHTML = `👥 ${names.length} participant(s): ${names.join(", ")}`;
});
