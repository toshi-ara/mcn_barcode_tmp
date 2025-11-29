// Check barcode detector
if (!("BarcodeDetector" in window)) {
    alert("このブラウザは Barcode Detector をサポートしていません");
}

const detector = new (window as any).BarcodeDetector({
    formats: ["codabar"]
});
if (!detector) {
    alert("このブラウザは Barcode Detector をサポートしていません");
}


interface Item {
  id: string;
  timestamp: string;
}

const formatter = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
});


//学籍番号を取得する正規表現
// （codabarのスタート、ストップ文字に挟まれた6桁の数字）
const matchStr = /^[A-D](\d{6})[A-D]$/;


// initial setting for global variables
let stream: MediaStream | null = null;
let detectTimer: number | null = null;
let scanning: boolean = false;
let dataArr: Item[] = [];
let lastText: string = "";
const storageNameData = "ReadBarcode";



///////////////////////////////////////
// elements
///////////////////////////////////////

// div
const elemDivInitial = <HTMLElement>document.getElementById("initial")!;
const elemDivScan = <HTMLElement>document.getElementById("scan")!;

// initial
const elemHeader = <HTMLElement>document.getElementById("header")!;
const elemScanBtn = <HTMLInputElement>document.getElementById("scan-btn")!;
const elemClearBtn = <HTMLInputElement>document.getElementById("clear-btn")!;

// scan
const elemStartBtn = <HTMLInputElement>document.getElementById("start-btn")!;
const elemBackBtn = <HTMLInputElement>document.getElementById("back-btn")!;
const elemVideo = <HTMLVideoElement>document.getElementById("video")!;
const canvas = document.createElement("canvas");
const ctx = <CanvasRenderingContext2D>canvas.getContext("2d")!;

// result (item number and list)
const elemItemNumber = <HTMLElement>document.getElementById("item-number")!;
const elemResultList = <HTMLElement>document.getElementById("result-list")!;



///////////////////////////////////////
// set Callback function
///////////////////////////////////////
elemScanBtn.addEventListener("click", callbackScanBtn);
elemClearBtn.addEventListener("click", callbackClearBtn);

elemStartBtn.addEventListener("click", callbackStartBtn);
elemBackBtn.addEventListener("click", callbackBackBtn);



///////////////////////////////////////
// change state of UI
///////////////////////////////////////
function setUIState(state: string): void {
    if (state === "initial") {
        // initial
        elemDivInitial.style.display = "block";
        elemHeader.style.display = "block";
        elemScanBtn.style.display = "block";
        elemClearBtn.style.display = "block";
        // other
        elemDivScan.style.display = "none";
        // show item number and list
        showItemNumber();
        showResultList();
    } else if (state === "scan") {
        // scan
        elemDivScan.style.display = "block";
        elemStartBtn.style.display = "inline";
        elemBackBtn.style.display = "inline";
        elemVideo.style.display = "none";
        // other
        elemDivInitial.style.display = "none";
        // result list
        elemResultList.innerHTML = "";
    } else if (state === "send") {
        ;
    }
}


///////////////////////////////////////
// callback functions
///////////////////////////////////////

// スキャン画面ボタン
function callbackScanBtn(): void {
    setUIState("scan");
};

// 戻るボタン
function callbackBackBtn(): void {
    setUIState("initial");
};


// スキャン開始・スキャン停止ボタン
async function callbackStartBtn() {
    if (!scanning) {
        // Start
        scanning = true;
        elemStartBtn.textContent = "スキャン停止";
        elemBackBtn.disabled = true;
        elemBackBtn.style.backgroundColor = "gray";
        elemVideo.style.display = "block";
        startVideo();
    } else {
        // Stop
        scanning = false;
        elemStartBtn.textContent = "スキャン開始";
        elemBackBtn.disabled = false;
        elemBackBtn.style.backgroundColor = "#007bff";
        elemVideo.style.display = "none";
        stopVideo();
    }
};


// 結果クリアボタン
function callbackClearBtn(): void {
    const result = confirm("保持データを消去しますか？");

    if (result) {
        dataArr = [];
        lastText = "";
        showItemNumber();
        elemResultList.innerHTML = "";
        localStorage.removeItem(storageNameData);
    }
};



///////////////////////////////////////
// other functions
///////////////////////////////////////

// カメラ起動 & バーコード検出
async function startVideo() {
    stream = await navigator.mediaDevices
        .getUserMedia({
            audio: false,
            video: { facingMode: "environment" }
        });
    elemVideo.srcObject = stream;

    // 映像が利用可能になるまで待つ
    elemVideo.onloadedmetadata = () => {
        elemVideo.play();  // 念のため
    };

    // 映像が実際に表示開始されるイベント
    elemVideo.onplaying = () => {
        // 以前の detectTimer をクリア
        if (detectTimer !== null) {
            clearInterval(detectTimer);
        }
        detectTimer = window.setInterval(detect, 200);
        detect();  // バーコード検出
    };
};


// カメラ停止
function stopVideo(): void {
    if (detectTimer !== null) {
        clearInterval(detectTimer);
        detectTimer = null;
    }

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    // video 要素を完全リセット
    elemVideo.pause();
    elemVideo.srcObject = null;
    elemVideo.removeAttribute("src"); // 念のため
    elemVideo.load();                 // video の状態を初期化
}


// バーコード検出
async function detect() {
    if (!('BarcodeDetector' in window)) return;
    const crop = getCropRect(elemVideo);

    const SCAN_W = 640;
    const SCAN_H = 320;   // アスペクト比 2:1 に合わせる

    canvas.width = SCAN_W;
    canvas.height = SCAN_H;

    ctx.drawImage(
      elemVideo,
      crop.sx, crop.sy, crop.sw, crop.sh,
      0, 0, SCAN_W, SCAN_H
    );

    const codes = await detector.detect(canvas);
    if (codes.length > 0) {
        analyzeBarcode(codes[0].rawValue);
    }
}


function getCropRect(video: HTMLVideoElement) {
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    const elemW = video.clientWidth;
    const elemH = video.clientHeight;

    const videoRatio = videoW / videoH;
    const elemRatio = elemW / elemH;

    let sx, sy, sw, sh;

    if (videoRatio > elemRatio) {
        // 横に広いので左右をカット
        sw = videoH * elemRatio;
        sh = videoH;
        sx = (videoW - sw) / 2;
        sy = 0;
    } else {
        // 縦に長いので上下をカット
        sw = videoW;
        sh = videoW / elemRatio;
        sx = 0;
        sy = (videoH - sh) / 2;
    }

    return { sx, sy, sw, sh };
}


// バーコード解析
// スタート文字[A-D]とストップ文字[A-D]の中に含まれる6桁の数字を取得
//    => 6桁の数字が学籍番号
// function analyzeBarcode(code: string): void {
//     if (code === lastText) return;

//     const match = code.match(matchStr);
//     if (match) {
//         addResultItem(match[1]);
//         lastText = code;
//         saveStorageData(dataArr);
//     } else {
//         alert("無効なバーコードです");
//     }
// };
async function analyzeBarcode(code: string): Promise<void> {
    if (code === lastText) return;

    const match = code.match(matchStr);
    if (!match) {
        alert("無効なバーコードです");
        return;
    }

    const id = match[1];

    // タイムスタンプ作成
    const now = new Date();
    const parts = formatter.formatToParts(now);
    const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const timeStr = `${obj.year}-${obj.month}-${obj.day}T${obj.hour}:${obj.minute}:${obj.second}`;

    // 画面に表示
    addResultItem(id);

    // IndexedDB に保存
    await addItem({ id, timestamp: timeStr });

    // 二重読み取り防止
    lastText = code;

    await showItemNumber();
}


function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("MyDB", 1);

        request.onupgradeneeded = (_event) => {
            const db = request.result;
            if (!db.objectStoreNames.contains("items")) {
                // db.createObjectStore("items", { keyPath: "id" }); // id をキーにする
                db.createObjectStore("items", { keyPath: "key", autoIncrement: true });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}


async function addItem(item: Item): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("items", "readwrite");
        tx.objectStore("items").put(item);   // put: 既存IDなら上書き
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}


async function getAllItems(): Promise<Item[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("items", "readonly");
        const store = tx.objectStore("items");
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result as Item[]);
        request.onerror = () => reject(request.error);
    });
}



// 結果を配列に追加
// ID, timestamp
function addResultItem(id: string): void {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const timeStr = `${obj.year}-${obj.month}-${obj.day}T${obj.hour}:${obj.minute}:${obj.second}`;

    const resultItem = <HTMLElement>document.createElement("div");
    resultItem.className = "result-item";
    resultItem.textContent = `ID: ${id} (timestamp ${timeStr})`;
    elemResultList.insertBefore(resultItem, elemResultList.firstChild);

    // dataArr.push({ "id": id, "timestamp": timeStr });
    addItem({ id, timestamp: timeStr });

    showItemNumber();
    playBeepSound(100);      // 100 msec
    navigator.vibrate(100);  // 100 msec
};



///////////////////////////////////////
// display item number
///////////////////////////////////////

// function showItemNumber(): void {
//     const num = new Set(dataArr.map(item => item["id"]));
//     const total = dataArr.length;
//     elemItemNumber.textContent = `登録 ${num["size"]}件（合計 ${total}件）`;
// };

async function showItemNumber(): Promise<void> {
  const items = await getAllItems(); // 全件取得

  const unique = new Set(items.map(i => i.id)).size;
  const total = items.length;

  elemItemNumber.textContent = `登録 ${unique}件（合計 ${total}件）`;
}


// display result list
function showResultList(): void {
    // sort (1) id and (2) timestamp
    const sorted = [...dataArr].sort((a, b) => {
        // (1) compare id
        const idCompare = Number(a["id"]) - Number(b["id"]);
        if (idCompare !== 0) return idCompare;
        // (2) compare timestamp
        if (a["timestamp"] < b["timestamp"]) return -1;
        if (a["timestamp"] > b["timestamp"]) return 1;
        return 0;
    });

    const unique = sorted.filter((item, index, self) =>
      index === self.findIndex(t => t["id"] === item["id"])
    );

    let str = "";
    for (const dict of unique) {
        str = str + `${dict["id"]}: ${dict["timestamp"]}<BR>`;
    }
    elemResultList.innerHTML = str;
};


// Beep sound
//   duration: msec
function playBeepSound(duration: number): void {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = "sine";
    oscillator.frequency.value = 1000;
    gainNode.gain.value = 0.1;

    oscillator.start();
    oscillator.stop(context.currentTime + duration / 1000);
};



// ///////////////////////////////////////
// // storage
// ///////////////////////////////////////

// // save data to localStorage
// function saveStorageData(data: Item[]): void {
//     localStorage.setItem(storageNameData, JSON.stringify(data))
// }

// // get data in localStorage
// function loadStorageData(): Item[] {
//     const data: string | null = localStorage.getItem(storageNameData);
//     return data ? JSON.parse(data): [];
// }



///////////////////////////////////////
// Initialization
///////////////////////////////////////
document.addEventListener("DOMContentLoaded", async () => {
    const items = await getAllItems();
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // 新しい順

    for (const item of items) {
        const elem = document.createElement("div");
        elem.className = "result-item";
        elem.textContent = `ID: ${item.id} (timestamp ${item.timestamp})`;
        elemResultList.appendChild(elem);
    }

    setUIState("initial");
    // dataArr = loadStorageData();
    // show item number and list
    showItemNumber();
    showResultList();
});

