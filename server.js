const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
    maxHttpBufferSize: 1e7, // ১০ মেগাবাইট লিমিট
    cors: { origin: "*" } 
});
const mongoose = require('mongoose');

// MongoDB কানেকশন
const uri = "mongodb+srv://nid-server:Ibrahim9250@cluster0.9jxg3wa.mongodb.net/messengerDB?retryWrites=true&w=majority";
mongoose.connect(uri).then(() => console.log("✅ MongoDB Connected")).catch(err => console.log(err));

// স্কিমা
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    avatar: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
    role: { type: String, default: 'user' },
    isBanned: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
    user: String, text: String, time: String, isFile: Boolean,
    msgId: { type: String, unique: true }, avatar: String,
    isEdited: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', messageSchema);

app.use(express.static('public'));
app.use(express.json({ limit: '10mb' })); // বডি লিমিট বাড়ানো হয়েছে

// API সমূহ
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) {
        if (user.isBanned) return res.status(403).json({ error: "ব্যান করা হয়েছে!" });
        res.json(user);
    } else res.status(401).json({ error: "ভুল ইউজার বা পাসওয়ার্ড!" });
});

app.post('/api/register', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.json(newUser);
    } catch (e) { res.status(400).json({ error: "ইউজারনেমটি আগে থেকেই আছে!" }); }
});

app.post('/api/update-profile', async (req, res) => {
    const { username, avatar } = req.body;
    await User.updateOne({ username }, { $set: { avatar } });
    res.json({ success: true });
});

// সকেট লজিক
let onlineUsers = {};
io.on('connection', (socket) => {
    socket.on('new-user', async (userData) => {
        onlineUsers[socket.id] = userData;
        io.emit('user-list', Object.values(onlineUsers));
        const history = await Message.find().sort({ _id: -1 }).limit(50); // ৫০টি মেসেজ লোড হবে স্পিড বাড়াতে
        socket.emit('load-history', history.reverse());
    });

    socket.on('chat-message', async (data) => {
        try {
            const newMessage = new Message(data);
            await newMessage.save();
            socket.broadcast.emit('chat-message', data);
        } catch (e) { console.log("Error saving message"); }
    });

    socket.on('delete-message', async (msgId) => {
        await Message.deleteOne({ msgId });
        io.emit('message-deleted', msgId);
    });

    socket.on('edit-message', async ({ msgId, newText }) => {
        await Message.updateOne({ msgId }, { $set: { text: newText, isEdited: true } });
        io.emit('message-edited', { msgId, newText });
    });

    socket.on('typing', (user) => {
        socket.broadcast.emit('user-typing', user);
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('user-list', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));