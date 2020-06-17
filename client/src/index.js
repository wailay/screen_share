
import socket from './socket.js';
const userSpace = document.getElementById("user-space");
const servers = {
    'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }]
};
sessionStorage.clear();

const base62chars = [..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"]


var clientSocketId;
var clientUsername;
var roomId;
var connections = {};
var stream;
var isSharing = false;

function removeUser(username) {
    document.getElementById(username).remove();
}

function displayCurrentUser(id, username) {
    let user = document.createElement("div");
    user.className = "user me";
    user.id = "me";

    let video = document.createElement("video");
    video.className = "shared-screen";
    video.id = "my-screen";
    video.autoplay = true;
    video.muted = true;
    video.srcObject = null;
    video.hidden = true;
    video.playsinline = true;


    let usernameDiv = document.createElement("div");
    usernameDiv.className = "username";
    usernameDiv.innerHTML = username;

    let fullscreenImg = document.createElement("div");
    fullscreenImg.className = "material-icons icon fullscreen-icon  icon-container";
    fullscreenImg.innerHTML = "fullscreen";
    // fullscreenImg.onclick = enlargeUser;

    let shareScreenIcon = document.createElement("div");
    shareScreenIcon.className = "material-icons icon share-screen-icon icon-container";
    shareScreenIcon.innerHTML = "screen_share";
    shareScreenIcon.onclick = startSharing;
    shareScreenIcon.id = "my-share-icon";

    let stopShareScreenIcon = document.createElement("div");
    stopShareScreenIcon.className = "material-icons icon share-screen-icon icon-container";
    stopShareScreenIcon.innerHTML = "stop_screen_share";
    stopShareScreenIcon.onclick = stopSharing;
    stopShareScreenIcon.style.display = "none";
    stopShareScreenIcon.id = "my-stop-share-icon";


    user.appendChild(video);
    user.appendChild(usernameDiv);
    user.appendChild(fullscreenImg);
    user.appendChild(shareScreenIcon);
    user.appendChild(stopShareScreenIcon);

    userSpace.appendChild(user);
}
function displayJoinedUser(id, username) {

    let user = document.createElement("div");
    user.className = "user";
    user.id = username;

    let video = document.createElement("video");
    video.className = "shared-screen";
    video.id = "screen";
    video.muted = true;
    video.autoplay = true;
    video.hidden = true;
    video.playsinline = true;


    let usernameDiv = document.createElement("div");
    usernameDiv.className = "username";
    usernameDiv.innerHTML = username;

    let fullscreenImg = document.createElement("div");
    fullscreenImg.className = "material-icons icon fullscreen-icon icon-container";
    fullscreenImg.innerHTML = "fullscreen";
    fullscreenImg.onclick = enlargeUser;


    user.appendChild(video);
    user.appendChild(usernameDiv);
    user.appendChild(fullscreenImg);

    userSpace.appendChild(user);


}

function generateId(length) {

    var uid = '';
    for (let i = 0; i < length; i++) {
        let idx = Math.ceil((Date.now() % 62 + Math.random() * 62)) % 62;
        uid = uid.concat(base62chars[idx]);
    }
    return uid;
}
function createSession() {
    window.location.href = generateId(5);
    socket.emit('join_session', id);

}

function initSession() {
    let id;
    if (window.location.pathname === "/") {
        id = generateId(5);
        window.location.href = id;
    } else {
        id = window.location.pathname.replace('/', '');
    }
    console.log('init session wesh');
    socket.emit('join_session', id);
    roomId = id;
    window.sessionStorage.setItem('room', id);
}


function createRTCConnection(username, socketId) {
    console.log('creating rtc connection with username ,', username);

    let conn = new RTCPeerConnection(servers);

    conn.ontrack = e => {
        let user = document.getElementById(username);
        console.log('track event ', username, e, user);
        let video = user.childNodes[0];
        video.hidden = false;
        video.srcObject = e.streams[0];
    }

    
    conn.onnegotiationneeded = async (e) => {
        try {

            let offer = await conn.createOffer();
            await conn.setLocalDescription(offer);
            socket.emit('offer', conn.localDescription, socketId, clientUsername, clientSocketId);
        } catch (err) {
            console.log(err);
        }
    }

    conn.onicecandidate = e => {
        if (e.candidate) {
            socket.emit('icecandidate', e.candidate, socketId, clientUsername);
        }
    }

    conn.onconnectionstatechange = e => {
        
    }

    return conn;
}

async function sendOfferToPeer(username, remoteSocketId) {
    try {
        console.log('sending offer to peer');
        let rtcConn;
        if (!connections[username]){
            console.log('connections not existent creating new one');
            connections[username] = createRTCConnection(username, remoteSocketId);
        }
        
        rtcConn = connections[username];

        for (const track of stream.getTracks()) {
            rtcConn.addTrack(track, stream);
        }

    } catch (err) {
        console.log(err);
    }


}

socket.on('offer', async (offer, username, localSocketId) => {
    try {
        //remote peer
        console.log('received offer from ', username);

        if (!connections[username]) {
            connections[username] = createRTCConnection(username, localSocketId);
        }
        // console.log('got offer from ', username, connections);
        let rtcConn = connections[username];


        let offerRTC = new RTCSessionDescription(offer);
        await rtcConn.setRemoteDescription(offerRTC);
        let answer = await rtcConn.createAnswer();
        await rtcConn.setLocalDescription(answer);
        console.log('sending answer');
        socket.emit('answer', rtcConn.localDescription, localSocketId, clientUsername);

    } catch (err) {
        console.log(err);
    }
});

socket.on('answer', (answer, username) => {
    //local peer
    console.log('received answer from', username);
    let answerRTC = new RTCSessionDescription(answer);
    let rtcConn = connections[username];
    rtcConn.setRemoteDescription(answerRTC)
        .then(() => {
            return;
        });


});


async function startSharing() {
    try {
        if (!isSharing) {

            
            let video = document.getElementById('my-screen');
            let shareIcon = document.getElementById('my-share-icon');
            let stopIcon = document.getElementById('my-stop-share-icon');

            
            isSharing = true;
            
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: 1366, height: 768, frameRate: 30 },
                audio: false
            });
            stream.onended = e => {
                console.log('stream ended');
            }

            shareIcon.style.display = 'none';
            stopIcon.style.display = 'block';
            video.srcObject = stream;
            video.hidden = false;
            socket.emit('start_sharing', roomId);
        }
    } catch (err) {
        isSharing = false;
    }
}

function stopSharing() {

    stream.getTracks().forEach(track => track.stop());
    let video = document.getElementById("my-screen");
    let shareIcon = document.getElementById('my-share-icon');
    let stopIcon = document.getElementById('my-stop-share-icon');
    
    shareIcon.style.display = 'block';
    stopIcon.style.display = 'none';

    shareIcon.disabled = false;
    stopIcon.disabled = true;
    video.hidden = true;
    isSharing = false;
    socket.emit('stop_sharing', roomId, clientUsername);
    for (let [user, conn] of Object.entries(connections)) {
        conn.close();
        connections[user] = null;
    }
}


socket.on('shared_screen', (users) => {
    for (let [id, username] of Object.entries(users)) {
        if (username !== clientUsername) {
            console.log('start sharing ', username, id);
            sendOfferToPeer(username, id);
        }
    }
})

socket.on('stop_sharing', (username) => {
    let user = document.getElementById(username);
    let video = user.childNodes[0];
    video.srcObject = null;
    video.hidden = true;
    connections[username].close();
    connections[username] = null;
});

socket.on('username', (socketId, username) => {
    console.log('this client is ', socketId, username);
    clientSocketId = socketId;
    clientUsername = username;
    window.sessionStorage.setItem('username', username);
    displayCurrentUser(socketId, username);
});

socket.on('users_in_room', (users) => {
    for (let [id, username] of Object.entries(users)) {
        displayJoinedUser(id, username);


    }
})
socket.on('user_joined', (id, username) => {
    console.log('user_joined ', username, id, isSharing);
    displayJoinedUser(id, username);
    if (isSharing) {
        sendOfferToPeer(username, id);
    }
});

//todo refactor
// attach a unique id to each new user component
// for now i am sending back a new user list after user disconnection and redraw everything
// should optimise this and delete only disconnected user for better scalabilty
socket.on('user_disconnected', (username) => {
    removeUser(username);
    if (connections[username]) {
        connections[username].close();
        delete connections[username];
    }
});



socket.on('icecandidate', (candidate, username) => {

    let candidiateRTC = new RTCIceCandidate(candidate);
    connections[username].addIceCandidate(candidiateRTC);
});

function showConn() {

    for (let [username, conn] of Object.entries(connections)) {
        console.log('checking connections : ', username);
        console.log(connections[username].getSenders());
        console.log(connections[username].getReceivers());
    }
}

initSession();


function enlargeUser(e) {
    e.stopPropagation();
    let icon = e.srcElement
    let user = icon.parentElement;
    let userVideo = user.childNodes[0];
    let mainVideo = document.getElementById("main-video");

    mainVideo.srcObject = userVideo.srcObject;

}
