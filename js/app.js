// Khởi tạo PeerJS
const peer = new Peer();

// DOM Elements
const myIdInput = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id');
const copyBtn = document.getElementById('copy-btn');
const callBtn = document.getElementById('call-btn');
const endCallBtn = document.getElementById('end-call-btn');

const loginScreen = document.getElementById('login-screen');
const callScreen = document.getElementById('call-screen');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const outputCanvas = document.getElementById('output-canvas');

const audioLevelBar = document.getElementById('audio-level');

// Global variables
let localStream;
let peerConnection;
let audioContext;
let analyser;
let dataArray;
window.currentMicVolume = 0; // Biến toàn cục để ar-engine đọc

// Khi PeerJS kết nối tới server thành công
peer.on('open', (id) => {
    myIdInput.value = id;
});

// Copy ID
copyBtn.addEventListener('click', () => {
    myIdInput.select();
    document.execCommand('copy');
    copyBtn.innerText = 'Đã copy!';
    setTimeout(() => copyBtn.innerText = 'Copy', 2000);
});

// Yêu cầu quyền Camera và Mic với các ràng buộc khử ồn
async function setupMedia() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480
            },
            audio: {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true
            }
        });
        
        localStream = stream;
        localVideo.srcObject = stream;

        // Khởi tạo AudioContext để đo âm lượng
        setupAudioAnalyzer(stream);

        // Khởi động MediaPipe (gọi từ ar-engine.js)
        if (window.startMediaPipe) {
            window.startMediaPipe(localVideo);
        }

        return stream;
    } catch (err) {
        console.error("Lỗi lấy quyền Camera/Mic:", err);
        alert("Không thể truy cập Camera hoặc Microphone!");
    }
}

// Thiết lập đo âm lượng (Audio Analyser)
function setupAudioAnalyzer(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    source.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    function measureVolume() {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;
        window.currentMicVolume = average; // Cập nhật biến toàn cục
        
        // Update UI bar
        const width = Math.min(100, (average / 128) * 100);
        audioLevelBar.style.width = width + '%';
        if (width > 50) {
            audioLevelBar.style.backgroundColor = '#ef4444'; // Đỏ nếu to
        } else {
            audioLevelBar.style.backgroundColor = '#10b981'; // Xanh
        }

        requestAnimationFrame(measureVolume);
    }
    
    measureVolume();
}

// Lấy luồng kết hợp giữa Canvas (AR) và Mic để gửi đi
function getMixedStream() {
    // Lấy stream từ Canvas (30 fps)
    const canvasStream = outputCanvas.captureStream(30);
    // Lấy audio track từ localStream gốc
    const audioTracks = localStream.getAudioTracks();
    
    if (audioTracks.length > 0) {
        canvasStream.addTrack(audioTracks[0]);
    }
    return canvasStream;
}

// Gọi cho người khác
callBtn.addEventListener('click', async () => {
    const peerId = peerIdInput.value.trim();
    if (!peerId) return alert('Vui lòng nhập ID người gọi!');

    await setupMedia();
    const mixedStream = getMixedStream();

    const call = peer.call(peerId, mixedStream);
    handleCall(call);
    
    showCallScreen();
});

// Nhận cuộc gọi
peer.on('call', async (call) => {
    const accept = confirm("Bạn có cuộc gọi đến. Chấp nhận?");
    if (accept) {
        await setupMedia();
        const mixedStream = getMixedStream();
        
        call.answer(mixedStream); // Trả lời với stream đã có AR
        handleCall(call);
        showCallScreen();
    }
});

function handleCall(call) {
    peerConnection = call;
    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
    });

    call.on('close', () => {
        endCall();
    });
}

function showCallScreen() {
    loginScreen.classList.add('hidden');
    callScreen.classList.remove('hidden');
}

endCallBtn.addEventListener('click', () => {
    if (peerConnection) {
        peerConnection.close();
    }
    endCall();
});

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    remoteVideo.srcObject = null;
    loginScreen.classList.remove('hidden');
    callScreen.classList.add('hidden');
    window.location.reload(); // Reset trạng thái cho nhanh
}
