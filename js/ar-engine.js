const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const arSelect = document.getElementById('ar-select');

// === CẤU HÌNH CÁC ĐƯỜNG DẪN ẢNH MEME ===
const MEME_URLS = {
    rose: 'img/meo-hoa.jpg', // Ảnh chú mèo cầm hoa hồng (khi nắm tay)
    greenDog: 'img/cho-xanh.jpg', // Ảnh chó xanh (khi suỵt)
    screamingMan: 'img/nguoi-het.jpg', // Ảnh meme hét (khi mở miệng to + la)
    sparkle: 'https://cdn-icons-png.flaticon.com/512/100/100064.png', // Icon 100 (khi cười)
    mask: 'https://cdn-icons-png.flaticon.com/512/1019/1019024.png', // Mặt nạ (AR Menu)
    bunny: 'https://cdn-icons-png.flaticon.com/512/4042/4042137.png', // Tai thỏ (AR Menu)
    loading: 'https://cdn-icons-png.flaticon.com/512/285/285272.png' // Icon loading (khi nhíu mày)
};

// Hàm tải ảnh từ URL
function loadImage(src) {
    const img = new Image();
    img.src = src;
    img.crossOrigin = "Anonymous";
    return img;
}

const images = {
    rose: loadImage(MEME_URLS.rose),
    greenDog: loadImage(MEME_URLS.greenDog),
    screamingMan: loadImage(MEME_URLS.screamingMan),
    sparkle: loadImage(MEME_URLS.sparkle),
    mask: loadImage(MEME_URLS.mask),
    bunny: loadImage(MEME_URLS.bunny),
    loading: loadImage(MEME_URLS.loading)
};

// Biến trạng thái để chứa dữ liệu Face và Hand hiện tại
let latestFaceLandmarks = null;
let latestHandLandmarks = null;
let isFrowning = false; // Trạng thái nhíu mày (đen trắng)

// Kích thước video (giả định)
const WIDTH = 640;
const HEIGHT = 480;
canvasElement.width = WIDTH;
canvasElement.height = HEIGHT;

// === KHỞI TẠO MEDIAPIPE FACE MESH ===
const faceMesh = new FaceMesh({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
}});
faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
faceMesh.onResults((results) => {
    latestFaceLandmarks = results.multiFaceLandmarks ? results.multiFaceLandmarks[0] : null;
    drawFrame(results.image); // Vẽ lại mọi thứ mỗi khi có frame mới
});

// === KHỞI TẠO MEDIAPIPE HANDS ===
const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});
hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
hands.onResults((results) => {
    latestHandLandmarks = results.multiHandLandmarks ? results.multiHandLandmarks[0] : null;
});

// Hàm tính khoảng cách giữa 2 điểm (2D)
function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// === HÀM VẼ CHÍNH LÊN CANVAS ===
function drawFrame(videoImage) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
    
    // Nếu đang nhíu mày -> Bộ lọc đen trắng
    if (isFrowning) {
        canvasCtx.filter = 'grayscale(100%)';
    } else {
        canvasCtx.filter = 'none';
    }

    // Vẽ luồng video gốc (đã lật gương bằng CSS, nhưng trên canvas gốc để stream cần vẽ bình thường hoặc lật)
    canvasCtx.drawImage(videoImage, 0, 0, WIDTH, HEIGHT);
    canvasCtx.filter = 'none'; // Reset filter cho các hình ảnh AR đè lên sau đó

    // 1. KIỂM TRA & VẼ CÁC HIỆU ỨNG MENU (Ngụy trang)
    if (latestFaceLandmarks) {
        const arType = arSelect.value;
        const nose = latestFaceLandmarks[1];
        const forehead = latestFaceLandmarks[10];

        if (arType === 'mask' && images.mask.complete) {
            // Vẽ mặt nạ vào vị trí mũi
            const maskSize = 200;
            canvasCtx.drawImage(images.mask, nose.x * WIDTH - maskSize/2, nose.y * HEIGHT - maskSize/2 - 30, maskSize, maskSize);
        } else if (arType === 'bunny' && images.bunny.complete) {
            // Vẽ tai thỏ trên trán
            const bunnySize = 150;
            canvasCtx.drawImage(images.bunny, forehead.x * WIDTH - bunnySize/2, forehead.y * HEIGHT - bunnySize - 20, bunnySize, bunnySize);
        }
    }

    // 2. KIỂM TRA & KÍCH HOẠT HIỆU ỨNG BÍ MẬT (Chạy ngầm)
    checkSecretTriggers();

    canvasCtx.restore();
}

function checkSecretTriggers() {
    const vol = window.currentMicVolume || 0;

    // A. NHẬN DIỆN CỬ CHỈ TAY
    if (latestHandLandmarks) {
        const wrist = latestHandLandmarks[0];
        const indexTip = latestHandLandmarks[8];
        const middleTip = latestHandLandmarks[12];
        const ringTip = latestHandLandmarks[16];
        const pinkyTip = latestHandLandmarks[20];

        // 1. Nắm tay (Fist) -> Hiện bông hồng
        // Nếu khoảng cách từ các đầu ngón tay đến cổ tay ngắn (tay đóng lại)
        const dIndex = getDistance(indexTip, wrist);
        const dMiddle = getDistance(middleTip, wrist);
        if (dIndex < 0.25 && dMiddle < 0.25) {
            if (images.rose.complete) {
                // Vẽ bông hồng ngay tại cổ tay
                canvasCtx.drawImage(images.rose, wrist.x * WIDTH - 50, wrist.y * HEIGHT - 50, 100, 100);
            }
        }

        // 2. Đưa ngón tay lên môi suỵt + Mic im lặng -> Chó xanh
        if (latestFaceLandmarks) {
            const lips = latestFaceLandmarks[13]; // Điểm môi trên
            const dFingerLips = getDistance(indexTip, lips);
            
            // Ngón trỏ gần môi VÀ âm lượng rất bé (im lặng)
            if (dFingerLips < 0.1 && vol < 10) {
                if (images.greenDog.complete) {
                    canvasCtx.drawImage(images.greenDog, 20, 20, 150, 150); // Hiện góc trái
                }
            }
        }
    }

    // B. NHẬN DIỆN BIỂU CẢM KHUÔN MẶT
    if (latestFaceLandmarks) {
        const upperLip = latestFaceLandmarks[13];
        const lowerLip = latestFaceLandmarks[14];
        const mouthLeft = latestFaceLandmarks[61];
        const mouthRight = latestFaceLandmarks[291];
        const leftEyebrow = latestFaceLandmarks[55];
        const rightEyebrow = latestFaceLandmarks[285];
        const forehead = latestFaceLandmarks[10];

        // 3. Mở miệng hết cỡ + Mic lớn -> Người đàn ông hét
        const mouthOpenDist = getDistance(upperLip, lowerLip);
        if (mouthOpenDist > 0.08 && vol > 60) {
            if (images.screamingMan.complete) {
                canvasCtx.drawImage(images.screamingMan, 0, HEIGHT - 200, 200, 200); // Hiện góc dưới
            }
        }

        // 4. Cười lớn -> Sparkle / 100
        const smileDist = getDistance(mouthLeft, mouthRight);
        // Ngưỡng cười phụ thuộc khuôn mặt, ở đây giả định > 0.12
        if (smileDist > 0.12 && mouthOpenDist < 0.05) {
            if (images.sparkle.complete) {
                // Bay ra từ hai bên khóe miệng
                canvasCtx.drawImage(images.sparkle, mouthLeft.x * WIDTH - 40, mouthLeft.y * HEIGHT - 20, 40, 40);
                canvasCtx.drawImage(images.sparkle, mouthRight.x * WIDTH, mouthRight.y * HEIGHT - 20, 40, 40);
            }
        }

        // 5. Nhíu mày -> Đen trắng + Loading
        const eyebrowDist = getDistance(leftEyebrow, rightEyebrow);
        if (eyebrowDist < 0.13) { // Khoảng cách lông mày thu hẹp
            isFrowning = true;
            if (images.loading.complete) {
                // Quay icon loading trên đầu
                const time = Date.now() / 100;
                canvasCtx.save();
                canvasCtx.translate(forehead.x * WIDTH, forehead.y * HEIGHT - 50);
                canvasCtx.rotate(time * Math.PI / 180);
                canvasCtx.drawImage(images.loading, -30, -30, 60, 60);
                canvasCtx.restore();
            }
        } else {
            isFrowning = false;
        }
    }
}

// === EXPORT HÀM KHỞI ĐỘNG ===
// Được gọi từ app.js sau khi có quyền truy cập camera
window.startMediaPipe = function(videoElement) {
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            // Đẩy frame vào FaceMesh và Hands để xử lý đồng thời
            await Promise.all([
                faceMesh.send({image: videoElement}),
                hands.send({image: videoElement})
            ]);
        },
        width: 640,
        height: 480
    });
    camera.start();
};
