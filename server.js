const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 1e7 }); // ১০এমবি পর্যন্ত ইমেজ সাপোর্ট
const mongoose = require('mongoose');

// MongoDB কানেকশন
const uri = "mongodb+srv://nid-server:Ibrahim9250@cluster0.9jxg3wa.mongodb.net/messengerDB?retryWrites=true&w=majority";
mongoose.connect(uri).then(() => console.log("✅ DB Connected")).catch(err => console.log(err));

// স্কিমা (মেসেজ আইডি এবং ইমেজ সাপোর্ট সহ)
const User = mongoose.model('User', { username: String, pass: String, avatar: String });
const Message = mongoose.model('Message', { 
    user: String, text: String, time: String, 
    msgId: String, isImage: Boolean, isEdited: { type: Boolean, default: false } 
});

app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));

// Auth APIs
app.post('/api/auth', async (req, res) => {
    const { username, pass, type, avatar } = req.body;
    if (type === 'login') {
        const found = await User.findOne({ username, pass });
        return found ? res.json(found) : res.status(401).json({ error: "ভুল তথ্য!" });
    } else {
        const existing = await User.findOne({ username });
        if(existing) return res.status(400).json({ error: "ইউজারনেমটি আছে" });
        const newUser = new User({ username, pass, avatar });
        await newUser.save();
        res.json(newUser);
    }
});

// সকেট লজিক
let onlineUsers = {};
io.on('connection', (socket) => {
    socket.on('join', async (user) => {
        onlineUsers[socket.id] = user;
        io.emit('user-list', Object.values(onlineUsers));
        const history = await Message.find().sort({ _id: -1 }).limit(50);
        socket.emit('load-history', history.reverse());
    });

    socket.on('chat-message', async (data) => {
        const newMsg = new Message(data);
        await newMsg.save();
        socket.broadcast.emit('chat-message', data);
    });

    socket.on('typing', (user) => socket.broadcast.emit('user-typing', user));

    socket.on('delete-msg', async (id) => {
        await Message.deleteOne({ msgId: id });
        io.emit('msg-deleted', id);
    });

    socket.on('edit-msg', async ({ id, newText }) => {
        await Message.updateOne({ msgId: id }, { text: newText, isEdited: true });
        io.emit('msg-edited', { id, newText });
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('user-list', Object.values(onlineUsers));
    });
});

http.listen(3000, () => console.log(`🚀 Server running: http://localhost:3000`));