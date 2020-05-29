const express = require('express');
const app = express();
var adj = require('./adj.json');
var names = require('./name.json'); 
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.use(express.static('public'));

var currentId;
var users = {};

app.use((req, res, next) => {

    console.log('ip is ', req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    next();
})

app.get(['/:id', '/'] , (req, res) => {
    res.sendFile(__dirname + '/index.html');
});



io.on('connection' , (socket) => {
    
    
    socket.on('join_session', (id) => {
        
        socket.join(id, () => {
            // console.log(' a room ', socket.rooms);
        });
        
        if (!users[id]){
            users[id] = {};
        }
        
        
        let username;
        let unique = false;
        while(!unique){
            username = generateRandomName();
            unique = checkUniqueUsername(users[id], username);
        }
        //send back to the sender its new username
        socket.emit('username', socket.id, username);
        socket.emit('users_in_room',  users[id]);
        
        users[id][socket.id] =  username;

        
        //send to all sockets except the sender
        //this event is for updating the dom
        socket.to(id).emit('user_joined', socket.id, username);

        
    
    });


    //offer 
    socket.on('offer' , (offer, remoteSocketId, username, clientSocketId) => {

        //broadcast the offer to the remote socket
        io.to(remoteSocketId).emit('offer', offer, username, clientSocketId);

    });

    socket.on('answer', (answer, transmittingSocketId, username) => {
        
        //broadcast the answer to the transmitting socket
        io.to(transmittingSocketId).emit('answer', answer ,username);
    });

    socket.on('icecandidate', (candidate, clientSocketId, username) => {
        io.to(clientSocketId).emit('icecandidate', candidate, username);
    });

    //when a client clicks the start sharing button the server sends the users in the room
    socket.on('start_sharing', (id) => {
        socket.emit('shared_screen', users[id]);
    });

    socket.on('stop_sharing', (id, username) => {
        socket.to(id).emit('stop_sharing', username);
    });

    socket.on('disconnecting', () => {
        const rooms = socket.rooms;

        for(let [key, room] of Object.entries(rooms)){
            if (users[room]){
                io.to(room).emit('user_disconnected', users[room][socket.id]);
                delete users[room][socket.id];
            }
        }

    });
    socket.on('disconnect', () => {
    });
});

// nm.on('connection', (socket) => {
//     console.log('user conn to namespace ')
//     console.log('ther are many users ')
// });
http.listen(3000, () => {
    console.log('listening on port 3000');
});

function generateRandomName(){
    let randIdx = Math.ceil(Date.now() + 574745556 + Math.random() + 999888444) % adj.length;
    let randAdj = adj[randIdx];
    randIdx = Math.ceil(Date.now() + 888888666 + Math.random() + 333444777) % names.length
    let randName = names[randIdx]
    let randNum = Math.ceil(Math.random()*99);
    return `${randAdj}${randName}${randNum}`;
}

function checkUniqueUsername(roomUsers, createdUsername){
    for(let [sockId, username] in Object.entries(roomUsers)) {
        if (createdUsername === username) {
            return false;
        }
    }
    return true;
}