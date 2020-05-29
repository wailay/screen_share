
console.log("refreshed");
const socket = io.connect();

socket.emit('join_session');

var users = [];

socket.on('username', (data) => {
    console.log("you", data);
});
socket.on('user_joined', (data) => {
    console.log("users" , data);
})

console.log(users);