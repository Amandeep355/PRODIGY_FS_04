const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const Message = require('./models/Message');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const mongoose = require('mongoose');

mongoose.connect("mongodb://127.0.0.1:27017/chatapp")

  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });


const users = {}; // socket.id -> {name, room}
const chatHistory = {}; // room -> [{ name, message, type }]

// File storage setup
const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Static files
app.use(express.static('public'));

// ✅ Root route to serve index.html explicitly
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// File upload route
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ filePath: '/uploads/' + req.file.filename });
});

io.on('connection', socket => {
  socket.on('join-room', async ({ name, room }) => {
    users[socket.id] = { name, room };
    socket.join(room);

    if (!chatHistory[room]) chatHistory[room] = [];

    // Fetch and send message history from MongoDB
    const messages = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);
    socket.emit('chat-history', messages.map(msg => ({ name: msg.username, message: msg.message, type: msg.type || 'text' })));

    socket.to(room).emit('user-joined', name);
    io.to(room).emit('online-users', getUsersInRoom(room));
  });

  socket.on('send', async message => {
    const user = users[socket.id];
    if (user && user.room) {
      const msgData = { name: user.name, message, type: 'text' };
      chatHistory[user.room].push(msgData);
      io.to(user.room).emit('receive', msgData);

      // Save to MongoDB
      const newMsg = new Message({ username: user.name, message: message, room: user.room, type: 'text' });
      await newMsg.save();
    }
  });

  socket.on('send-file', async ({ filePath }) => {
    const user = users[socket.id];
    if (user && user.room) {
      const msgData = { name: user.name, message: filePath, type: 'file' };
      chatHistory[user.room].push(msgData);
      io.to(user.room).emit('receive', msgData);

      // Save to MongoDB
      const newMsg = new Message({ username: user.name, message: filePath, room: user.room, type: 'file' });
      await newMsg.save();
    }
  });

  socket.on('private-message', ({ toSocketId, message }) => {
    const sender = users[socket.id];
    if (sender) {
      io.to(toSocketId).emit('receive-private', {
        from: sender.name,
        message
      });
    }
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user && user.room) {
      socket.to(user.room).emit('user-left', user.name);
      delete users[socket.id];
      io.to(user.room).emit('online-users', getUsersInRoom(user.room));
    }
  });
});

function getUsersInRoom(room) {
  return Object.entries(users)
    .filter(([_, user]) => user.room === room)
    .map(([socketId, user]) => ({ socketId, name: user.name }));
}

server.listen(8000, () => console.log('✅ Server running at http://localhost:8000'));
