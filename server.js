const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
    maxHttpBufferSize: 1e8, // ফাইল সাইজ লিমিট
    cors: { origin: "*" } 
});
const mongoose = require('mongoose');

// MongoDB কানেকশন
const uri = "mongodb+srv://nid-server:Ibrahim9250@cluster0.9jxg3wa.mongodb.net/messengerDB?retryWrites=true&w=majority";
mongoose.connect(uri)
    .then(() => console.log("✅ MongoDB Connected Successfully!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// --- আপডেট করা মেসেজ স্কিমা ---
const messageSchema = new mongoose.Schema({
    user: String,
    text: String,
    time: String,
    isFile: Boolean,
    msgId: { type: String, unique: true },
    avatar: String,
    replyTo: { type: String, default: null }, // কার মেসেজে রিপ্লাই দেওয়া হয়েছে (টেক্সট বা আইডি)
    isEdited: { type: Boolean, default: false }, // মেসেজ এডিট করা হয়েছে কি না
    status: { type: String, default: 'sent' } // sent, delivered, seen
});
const Message = mongoose.model('Message', messageSchema);

app.use(express.static('public'));

let users = {};

io.on('connection', async (socket) => {
    
    // ১. পুরনো ১০০টি মেসেজ লোড
    try {
        const history = await Message.find().sort({ _id: -1 }).limit(100);
        socket.emit('load-history', history.reverse());
    } catch (err) {
        console.error("History Fetch Error:", err);
    }

    // ২. নতুন ইউজার যুক্ত হওয়া
    socket.on('new-user', data => {
        users[socket.id] = { name: data.name, avatar: data.avatar, id: socket.id };
        io.emit('user-list', Object.values(users));
    });

    // ৩. নতুন মেসেজ পাঠানো (রিপ্লাই সহ)
    socket.on('chat-message', async (data) => {
        try {
            const newMessage = new Message({
                ...data,
                status: 'sent'
            });
            await newMessage.save();
            socket.broadcast.emit('chat-message', data);
        } catch (err) {
            console.error("Save Error:", err);
        }
    });

    // ৪. মেসেজ এডিট করা
    socket.on('edit-message', async (data) => {
        try {
            await Message.updateOne(
                { msgId: data.id }, 
                { $set: { text: data.newText, isEdited: true } }
            );
            io.emit('message-edited', data); // সবাইকে আপডেট জানাবে
        } catch (err) {
            console.error("Edit Error:", err);
        }
    });

    // ৫. মেসেজ ডিলিট (সবার জন্য)
    socket.on('delete-message', async (msgId) => {
        try {
            await Message.deleteOne({ msgId: msgId });
            io.emit('message-deleted', msgId);
        } catch (err) {
            console.error("Delete Error:", err);
        }
    });

    // ৬. মেসেজ 'Seen' স্ট্যাটাস আপডেট
    socket.on('mark-seen', async (msgId) => {
        try {
            await Message.updateOne({ msgId: msgId }, { $set: { status: 'seen' } });
            socket.broadcast.emit('message-seen-update', msgId);
        } catch (err) {
            console.error("Seen Update Error:", err);
        }
    });

    // ৭. টাইপিং স্ট্যাটাস
    socket.on('typing', (data) => {
        socket.broadcast.emit('display-typing', data);
    });

    // ৮. কলিং ফিচার (WebRTC সিগন্যালিং - বেসিক)
    socket.on('call-user', (data) => {
        // data তে থাকবে: callerName, signalData, userToCall
        socket.broadcast.emit('incoming-call', data);
    });

    socket.on('answer-call', (data) => {
        socket.broadcast.emit('call-accepted', data.signal);
    });

    // ৯. ডিসকানেক্ট
    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('user-list', Object.values(users));
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));