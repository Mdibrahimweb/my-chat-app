const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 1e8 });
const mongoose = require('mongoose');

// MongoDB URI
const uri = "mongodb+srv://nid-server:Ibrahim9250@cluster0.9jxg3wa.mongodb.net/messengerDB?retryWrites=true&w=majority";

mongoose.connect(uri)
    .then(() => console.log("✅ MongoDB Connected Successfully!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// মেসেজ স্কিমা
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

let users = {};

io.on('connection', async (socket) => {
    // পুরনো মেসেজ লোড (সর্বশেষ ১০০টি)
    try {
        const history = await Message.find().sort({ _id: 1 }).limit(100);
        socket.emit('load-history', history);
    } catch (err) {
        console.error("History Fetch Error:", err);
    }

    socket.on('new-user', data => {
        users[socket.id] = { name: data.name, avatar: data.avatar, id: socket.id };
        io.emit('user-list', Object.values(users));
    });

    socket.on('chat-message', async (data) => {
        try {
            const newMessage = new Message(data);
            await newMessage.save();
            socket.broadcast.emit('chat-message', data);
        } catch (err) {
            console.error("Save Error:", err);
        }
    });

    socket.on('delete-message', async (msgId) => {
        try {
            await Message.deleteOne({ msgId: msgId });
            io.emit('message-deleted', msgId);
        } catch (err) {
            console.error("Delete Error:", err);
        }
    });

    socket.on('typing', (data) => {
        socket.broadcast.emit('display-typing', data);
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('user-list', Object.values(users));
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));