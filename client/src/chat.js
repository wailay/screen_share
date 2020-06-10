import socket from './socket.js';

var chatContainer = document.getElementById("chat-space");
const send = document.getElementById("send-btn");
const input = document.getElementById("chat-input");
var typingTimeout;

const messageList = document.getElementById('message-list');
const userTypingElement = document.getElementById('user-typing');
const userTypingText = document.getElementById('user-typing-text');

userTypingElement.style.display = "none";

function addMessage(username, message) {

    let messageBody = document.createElement('div');
    messageBody.className = 'message';

    let messageUsername = document.createElement('div');
    messageUsername.className = 'message-username';
    messageUsername.innerHTML = username;

    let messageContainer = document.createElement('p');
    messageContainer.innerHTML = message;

   

    messageBody.appendChild(messageUsername);
    messageBody.appendChild(messageContainer);

    messageList.appendChild(messageBody);
}
function sendMessage() {

    let msg = input.value;
    
    if (msg.length <= 0) return;

    const clientUsername = window.sessionStorage.getItem('username');
    const roomId = window.sessionStorage.getItem('room');
    //add the message in the sender chat box
    addMessage(clientUsername + " (You)", msg);
    
    socket.emit('message', roomId, msg, clientUsername);
}

function checkEnterPressed(e) {
    //pressed enter
    if (e.keyCode === 13 && e.srcElement.value.length > 0) {
        e.preventDefault();
        send.click();
        return;
    }
}
function userTyping(e) {
    
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    } else {
        const clientUsername = window.sessionStorage.getItem('username');
        const roomId = window.sessionStorage.getItem('room');
        socket.emit('user_typing', roomId, clientUsername);
    }
    typingTimeout = setTimeout(userStoppedTyping, 2000);
}

function userStoppedTyping() {
    typingTimeout = null;
    const roomId = window.sessionStorage.getItem('room');
    socket.emit('user_stopped_typing', roomId);
}

socket.on('user_stopped_typing' ,() => {
    userTypingElement.style.display = "none";
});
socket.on('user_typing', (username) => {
    console.log('got remote is typing ', username);
    userTypingText.innerHTML = username;
    userTypingElement.style.display = "inline";
});
socket.on('new_message', (msg, username) => {
    addMessage(username, msg);
});
send.addEventListener("click", sendMessage);
input.addEventListener("input", userTyping);
input.addEventListener("keyup", checkEnterPressed);

