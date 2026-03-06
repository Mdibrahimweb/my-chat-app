const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');

// MongoDB কানেকশন (সহজ ও হালকা ডাটাবেজ)
const uri = "mongodb+srv://nid-server:Ibrahim9250@cluster0.9jxg3wa.mongodb.net/messengerDB?retryWrites=true&w=majority";
mongoose.connect(uri).then(() => console.log("✅ DB Connected")).catch(err => console.log(err));

// ডাটাবেজ স্কিমা
const User = mongoose.model('User', { username: String, pass: String, avatar: String });
const Message = mongoose.model('Message', { user: String, text: String, avatar: String, time: String });

app.use(express.static('public'));
app.use(express.json());

// লগইন ও রেজিস্ট্রেশন API
app.post('/api/auth', async (req, res) => {
    const { username, pass, type, avatar } = req.body;
    if (type === 'login') {
        const found = await User.findOne({ username, pass });
        return found ? res.json(found) : res.status(401).json({ error: "ভুল ইউজার বা পাসওয়ার্ড" });
    } else {
        const existing = await User.findOne({ username });
        if(existing) return res.status(400).json({ error: "ইউজারনেমটি আগে থেকেই আছে" });
        const newUser = new User({ username, pass, avatar });
        await newUser.save();
        res.json(newUser);
    }
});

// রিয়েল টাইম চ্যাট লজিক
let onlineUsers = {};
io.on('connection', (socket) => {
    socket.on('join', async (user) => {
        onlineUsers[socket.id] = user;
        io.emit('user-list', Object.values(onlineUsers));
        
        // আগের ৩০টি মেসেজ লোড
        const history = await Message.find().sort({ _id: -1 }).limit(30);
        socket.emit('load-history', history.reverse());
    });

    socket.on('chat-message', async (data) => {
        const newMsg = new Message(data);
        await newMsg.save();
        socket.broadcast.emit('chat-message', data); // অন্য সবাইকে পাঠানো
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('user-list', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));