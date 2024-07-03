const socket = io();
let localStream;
let remoteStream;
let peerConnection;

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

startButton.onclick = start;
callButton.onclick = call;

async function start() {
    console.log('Starting media stream');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        startButton.disabled = true;
        callButton.disabled = false;
        console.log('Local media stream started');
    } catch (e) {
        console.error('Error accessing media devices:', e);
    }
}

function call() {
    console.log('Initiating call');
    peerConnection = new RTCPeerConnection(configuration);
    
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
        console.log('Added local track to peer connection:', track.kind);
    });

    peerConnection.ontrack = event => {
        console.log('Received remote track:', event.track.kind);
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            console.log('Sending ICE candidate');
            socket.emit('candidate', event.candidate);
        }
    };

    peerConnection.createOffer()
        .then(offer => {
            console.log('Created offer');
            return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
            console.log('Sending offer');
            socket.emit('offer', peerConnection.localDescription);
        })
        .catch(e => console.error('Error creating offer:', e));

    callButton.disabled = true;
}

socket.on('offer', async offer => {
    console.log('Received offer');
    if (!peerConnection) {
        await start();
        peerConnection = new RTCPeerConnection(configuration);
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log('Added local track to peer connection:', track.kind);
        });
        peerConnection.ontrack = event => {
            console.log('Received remote track:', event.track.kind);
            remoteVideo.srcObject = event.streams[0];
        };
    }
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    console.log('Sending answer');
    socket.emit('answer', answer);
    callButton.disabled = true;
});

socket.on('answer', answer => {
    console.log('Received answer');
    peerConnection.setRemoteDescription(answer);
});

socket.on('candidate', candidate => {
    console.log('Received ICE candidate');
    if (peerConnection) {
        peerConnection.addIceCandidate(candidate)
            .catch(e => console.error('Error adding received ICE candidate:', e));
    }
});

socket.on('connect', () => {
    console.log('Connected to signaling server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from signaling server');
});