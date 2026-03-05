const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 1e8 });
const mongoose = require('mongoose');

const uri = "mongodb+srv://nid-server:Ibrahim9250@cluster0.9jxg3wa.mongodb.net/messengerDB?retryWrites=true&w=majority";

mongoose.connect(uri)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

const messageSchema = new mongoose.Schema({
user:String,
text:String,
time:String,
isFile:Boolean,
msgId:String,
avatar:String
});

const Message = mongoose.model("Message",messageSchema);

app.use(express.static("public"));

io.on("connection",async(socket)=>{

const history = await Message.find().sort({_id:1}).limit(100);
socket.emit("load-history",history);

socket.on("new-user",(data)=>{
socket.broadcast.emit("user-joined",data.name);
});

socket.on("chat-message",async(data)=>{
const msg = new Message(data);
await msg.save();
socket.broadcast.emit("chat-message",data);
});

socket.on("delete-message",async(id)=>{
await Message.deleteOne({msgId:id});
io.emit("message-deleted",id);
});

socket.on("typing",(data)=>{
socket.broadcast.emit("display-typing",data);
});

});

const PORT = process.env.PORT || 3000;

http.listen(PORT,()=>{
console.log("Server running on http://localhost:"+PORT);
});