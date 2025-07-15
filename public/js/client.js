const socket = io();

const form = document.getElementById('send-container');
const messageInput = document.querySelector('.message-input');
const messageContainer = document.querySelector('.messages-container');
const fileInput = document.getElementById('fileInput');
const onlineUsersContainer = document.querySelector('.online-users');
const nameInput = document.getElementById('nameInput');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const chatSection = document.querySelector('.chat-section');

let name = '';
let room = '';

const audio = new Audio('assets/notification-2-269292.mp3');


const appendMessage = (message, type) => {
  const messageElement = document.createElement('div');
  if (message.type === 'file') {
    messageElement.innerHTML = `<strong>${message.name}:</strong><br><a href="${message.message}" target="_blank">📎 Download File</a>`;
  } else {
    messageElement.innerText = `${message.name}: ${message.message}`;
  }
  messageElement.classList.add('message', type);
  messageContainer.appendChild(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
};

joinBtn.onclick = () => {
  name = nameInput.value.trim();
  room = roomInput.value.trim();
  if (name && room) {
    document.querySelector('.user-info').style.display = 'none';
    chatSection.classList.remove('hidden');
    socket.emit('join-room', { name, room });
  }
};

socket.on('chat-history', history => {
  history.forEach(msg => appendMessage(msg, 'received'));
});

socket.on('user-joined', joinedName => {
  appendMessage({ name: 'System', message: `${joinedName} joined`, type: 'text' }, 'received');
});

socket.on('receive', data => {
  // Avoid showing the message again if it's from 'You'
  if (data.name !== name) {
    appendMessage(data, 'received');
    audio.play();
  }
});

socket.on('receive-private', data => {
  appendMessage({ name: `Private from ${data.from}`, message: data.message, type: 'text' }, 'received');
});

socket.on('user-left', leftName => {
  appendMessage({ name: 'System', message: `${leftName} left`, type: 'text' }, 'received');
});

socket.on('online-users', users => {
  onlineUsersContainer.innerHTML = '<strong>Online Users:</strong>';
  users.forEach(user => {
    const userBtn = document.createElement('button');
    userBtn.className = 'user-button';
    userBtn.textContent = user.name;
    userBtn.onclick = () => {
      const msg = prompt(`Send private message to ${user.name}`);
      if (msg) {
        socket.emit('private-message', { toSocketId: user.socketId, message: msg });
      }
    };
    onlineUsersContainer.appendChild(userBtn);
  });
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const message = messageInput.value.trim();

  if (fileInput.files.length > 0) {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const res = await fetch('/upload', { method: 'POST', body: formData });
    const { filePath } = await res.json();
    socket.emit('send-file', { filePath });

    appendMessage({ name: 'You', message: filePath, type: 'file' }, 'sent');
    fileInput.value = '';
  }

  if (message) {
    socket.emit('send', message);
    appendMessage({ name: 'You', message, type: 'text' }, 'sent');
    messageInput.value = '';
  }
});
