const msgInput = document.getElementById("messageInput");
const msgBox = document.getElementById("messages");
const fileInput = document.getElementById("fileInput");

msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const message = msgInput.value.trim();
  if (!message) return;
  socket.emit("chatMessage", { sessionId, text: message });
  msgInput.value = "";
}

socket.on("chatMessage", (data) => {
  const msg = document.createElement("div");
  msg.innerHTML = `<strong>${data.name}:</strong> ${data.text}`;
  msgBox.appendChild(msg);
  msgBox.scrollTop = msgBox.scrollHeight;
});

socket.on("systemMessage", (text) => {
  const msg = document.createElement("div");
  msg.style.color = "gray";
  msg.innerText = text;
  msgBox.appendChild(msg);
  msgBox.scrollTop = msgBox.scrollHeight;
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  fetch(`/upload/${sessionId}`, {
    method: "POST",
    body: formData,
    headers: {
      "uploader-id": socket.id
    }
  });
});

socket.on("fileShared", ({ fileName, fileUrl, uploader }) => {
  const msg = document.createElement("div");
  msg.innerHTML = `<strong>${uploader} uploaded:</strong> <a href="${fileUrl}" target="_blank">${fileName}</a>`;
  msgBox.appendChild(msg);
  msgBox.scrollTop = msgBox.scrollHeight;
});

// ✅ Show user list above chat
socket.on("updateUserList", (names) => {
  const userList = document.getElementById("userList");
  userList.innerHTML = `👥 ${names.length} participant(s): ${names.join(", ")}`;
});
