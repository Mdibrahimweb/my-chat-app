const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 1e8 });
const mongoose = require('mongoose');

// MongoDB URI
const uri = "mongodb+srv://nid-server:Ibrahim9250@cluster0.9jxg3wa.mongodb.net/messengerDB?retryWrites=true&w=majority";

mongoose.connect(uri)
    .then(() => console.log("✅ MongoDB Connected!"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// Schema
const messageSchema = new mongoose.Schema({
    user: String,
    text: String,
    time: String,
    isFile: Boolean,
    msgId: String,
    avatar: String
});
const Message = mongoose.model('Message', messageSchema);

app.use(express.static('public'));

io.on('connection', async (socket) => {
    // Load old messages
    const history = await Message.find().sort({ _id: 1 }).limit(100);
    socket.emit('load-history', history);

    socket.on('new-user', data => {
        socket.broadcast.emit('user-joined', data.name);
    });

    socket.on('chat-message', async (data) => {
        const newMessage = new Message(data);
        await newMessage.save();
        socket.broadcast.emit('chat-message', data);
    });

    socket.on('delete-message', async (msgId) => {
        await Message.deleteOne({ msgId: msgId });
        io.emit('message-deleted', msgId);
    });

    socket.on('typing', (data) => {
        socket.broadcast.emit('display-typing', data);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));