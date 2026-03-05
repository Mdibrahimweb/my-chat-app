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

// মেসেজ স্কিমা (Schema) - প্রোফাইল পিক (avatar) সহ
const messageSchema = new mongoose.Schema({
    user: String,
    text: String,
    time: String,
    isFile: Boolean,
    msgId: String,
    targetId: String,
    senderId: String,
    avatar: String
});
const Message = mongoose.model('Message', messageSchema);

app.use(express.static('public'));

let users = {};

io.on('connection', async (socket) => {
    // পুরনো চ্যাট হিস্ট্রি লোড করা
    try {
        const history = await Message.find().sort({ _id: 1 }).limit(100);
        socket.emit('load-history', history);
    } catch (err) {
        console.error("Error fetching history:", err);
    }

    socket.on('new-user', data => {
        users[socket.id] = { name: data.name, avatar: data.avatar, id: socket.id };
        io.emit('user-list', Object.values(users));
    });

    socket.on('chat-message', async (data) => {
        try {
            const newMessage = new Message({
                ...data,
                senderId: socket.id
            });
            await newMessage.save();
            socket.broadcast.emit('chat-message', { ...data, senderId: socket.id });
        } catch (err) {
            console.error("Message Save Error:", err);
        }
    });

    // পার্মানেন্ট ডিলিট লজিক (DB থেকে মুছে ফেলা)
    socket.on('delete-message', async (msgId) => {
        try {
            await Message.deleteOne({ msgId: msgId });
            io.emit('message-deleted', msgId); // সবাইকে জানানো
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
http.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));