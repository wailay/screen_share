
import socket from './socket.js';

const create = document.getElementById("create-btn");
const join = document.getElementById("join-btn");
const start = document.getElementById("start-btn");
const stop = document.getElementById("stop-btn");
const vid = document.getElementById("screen");
const userSpace = document.getElementById("user-space");
const servers = {
    'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }]
};
sessionStorage.clear();
start.disabled = false;
stop.disabled = true;
const base62chars = [..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"]

console.log("refreshed");
// const socket = io.connect();


var users = [];
var clientSocketId;
var clientUsername;
var roomId;
var userCurrentlySharing;
var connections = {};
var stream;
var isSharing = false;

function removeUserSpaceChildren() {
    userSpace.querySelectorAll("*").forEach(c => c.remove());
}
function removeUser(username) {
    document.getElementById(username).remove();
}

function displayCurrentUser(id, username) {
    let user = document.createElement("div");
    user.className = "user me";
    user.id = "me";

    let video = document.createElement("video");
    video.className = "shared-screen";
    video.id = "screen";
    video.autoplay = true;
    video.muted = true;
    video.srcObject = null;
    video.hidden = true;
    video.playsinline = true;


    let usernameDiv = document.createElement("div");
    usernameDiv.className = "username";
    usernameDiv.innerHTML = username;

    let fullscreenImg = document.createElement("div");
    fullscreenImg.className = "material-icons fullscreen-icon  icon-container";
    fullscreenImg.innerHTML = "fullscreen";
    fullscreenImg.onclick = enlargeUser;


    user.appendChild(video);
    user.appendChild(usernameDiv);
    user.appendChild(fullscreenImg);

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
    fullscreenImg.className = "material-icons fullscreen-icon icon-container";
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
    let conn = new RTCPeerConnection(servers);

    // conn.onicecandidate = handleICECandidateEvent;
    // conn.onnegotiationneeded = handleNegotiationNeededEvent;
    // conn.ontrack = handleTrackEvent;
    // conn.onremovetrack = handleRemoveTrack;
    // conn.oniceconnectionstatechange = handleICEConnectionStateChange;
    // conn.onicegatheringstatechange = handleICEGatheringStateChange;
    // conn.onsignalingstatechange = handleSignalingStateChange;

    conn.ontrack = e => {
        let user = document.getElementById(username);
        console.log('track event ', username, e, user);
        let video = user.childNodes[0];
        video.hidden = false;
        video.srcObject = e.streams[0];
    }

    
    conn.onnegotiationneeded = async (e) => {
        try {
            console.log("nego needed")
            let offer = await conn.createOffer();
            await conn.setLocalDescription(offer);
            socket.emit('offer', conn.localDescription, socketId, clientUsername, clientSocketId);
        } catch (err) {
            console.log(err);
        }
    }

    conn.onicecandidate = e => {
        console.log("onicecandidate fired ! ");

        if (e.candidate) {
            console.log("emitting icecandidate ");
            socket.emit('icecandidate', e.candidate, socketId, clientUsername);
        }
    }

    conn.onconnectionstatechange = e => {
        console.log("on conn state change ! ", e, conn.connectionState);
    }

    return conn;
}

async function sendOfferToPeer(username, remoteSocketId) {
    try {
        console.log('sending offer to peer');
        let rtcConn = createRTCConnection(username, remoteSocketId);
        connections[username] = rtcConn;

        for (const track of stream.getTracks()) {
            console.log('adding track to stream');
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
            console.log('creating connections as ', username);
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
    console.log('received answer ', answer, username);
    let answerRTC = new RTCSessionDescription(answer);
    let rtcConn = connections[username];
    rtcConn.setRemoteDescription(answerRTC)
        .then(() => {
            console.log("trickle ? ", rtcConn.canTrickleIceCandidates);
        });


});


async function startSharing() {
    try {

        if (!isSharing) {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: 1366, height: 768, frameRate: 30 },
                audio: false
            });
            stream.onended = e => {
                console.log('stream ended');
            }
            //set screen of the current client 
            let user = document.getElementById("me");
            let video = user.childNodes[0];
            video.srcObject = stream;
            isSharing = true;
            start.disabled = true;
            stop.disabled = false;
            video.hidden = false;
            socket.emit('start_sharing', roomId);
        }
    } catch (err) {
        console.log(err);
    }
}

function stopSharing() {

    start.disabled = false;
    stop.disabled = true;
    stream.getTracks().forEach(track => track.stop());
    let user = document.getElementById("me");
    let video = user.childNodes[0];
    video.hidden = true;
    isSharing = false;
    socket.emit('stop_sharing', roomId, clientUsername);
    for (let [user, conn] of Object.entries(connections)) {
        conn.close();
        connections[user] = null;
    }
}


socket.on('shared_screen', (users) => {
    console.log(users);
    for (let [id, username] of Object.entries(users)) {
        if (username !== clientUsername) {
            console.log('start sharing ', username, id);
            sendOfferToPeer(username, id);
        }
    }
})

socket.on('stop_sharing', (username) => {
    console.log('host stopped sharing');
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
    start.disabled = false;
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
    console.log('got icecandidate from adding it !');
    let candidiateRTC = new RTCIceCandidate(candidate);
    connections[username].addIceCandidate(candidiateRTC);
});

var show = document.getElementById("show-btn");
function showConn() {
    console.log(connections);

    for (let [username, conn] of Object.entries(connections)) {
        console.log('checking connections : ', username);
        console.log(connections[username].getSenders());
        console.log(connections[username].getReceivers());
    }
}
// create.addEventListener("click", createSession);
start.addEventListener("click", startSharing);
stop.addEventListener("click", stopSharing);
show.addEventListener("click", showConn);
userSpace.addEventListener("scroll", onScroll);
initSession();

function onScroll(e){
    console.log(userSpace.scrollTop);
}

function enlargeUser(e) {
    e.stopPropagation();
    let icon = e.srcElement
    let user = icon.parentElement;
    console.log(user);
    let type = 'fullscreen';
    if (icon.innerHTML === 'fullscreen') {
        type = 'fullscreen_exit';
    }
    icon.innerHTML = type;

    if (user.style.width !== "1366px") {
        user.style.width = "1366px";
        user.style.height = "768px";
    } else {
        user.style.width = "400px";
        user.style.height = "225px";
    }

}
