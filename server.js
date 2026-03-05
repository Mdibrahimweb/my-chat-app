const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 1e8 });
const mongoose = require('mongoose');

// আপনার MongoDB URI
const uri = "mongodb+srv://nid-server:Ibrahim9250@cluster0.9jxg3wa.mongodb.net/messengerDB?retryWrites=true&w=majority";

// MongoDB কানেকশন
mongoose.connect(uri)
    .then(() => console.log("✅ MongoDB Connected Successfully!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// মেসেজ স্কিমা (Schema)
const messageSchema = new mongoose.Schema({
    user: String,
    text: String,
    time: String,
    isFile: Boolean,
    msgId: String,
    targetId: String,
    senderId: String
});
const Message = mongoose.model('Message', messageSchema);

app.use(express.static('public'));

let users = {};

io.on('connection', async (socket) => {
    // কানেক্ট হওয়ার পর পুরনো চ্যাট হিস্ট্রি লোড করা (সর্বশেষ ১০০টি)
    try {
        const history = await Message.find().sort({ _id: 1 }).limit(100);
        socket.emit('load-history', history);
    } catch (err) {
        console.error("Error fetching history:", err);
    }

    socket.on('new-user', name => {
        users[socket.id] = { name, id: socket.id };
        io.emit('user-list', Object.values(users));
    });

    socket.on('chat-message', async (data) => {
        try {
            // ডাটাবেজে মেসেজ সেভ করা
            const newMessage = new Message({
                ...data,
                senderId: socket.id
            });
            await newMessage.save();

            if (data.targetId) {
                socket.to(data.targetId).emit('chat-message', { ...data, senderId: socket.id });
            } else {
                socket.broadcast.emit('chat-message', data);
            }
        } catch (err) {
            console.error("Message Save Error:", err);
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

// লাইভ হোস্টিংয়ের জন্য ডাইনামিক পোর্ট
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));