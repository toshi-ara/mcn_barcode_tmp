///////////////////////////////////////
// IndexedDB
///////////////////////////////////////

const DB_NAME = "mcn_barcode_tmp";
const DB_VESION = 1;

export interface Item {
  id: string;
  timestamp: string;
}


export function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VESION);

        request.onupgradeneeded = (_event) => {
            const db = request.result;
            if (!db.objectStoreNames.contains("items")) {
                db.createObjectStore("items", { keyPath: "key", autoIncrement: true });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}


export async function getAllItems(): Promise<Item[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("items", "readonly");
        const store = tx.objectStore("items");
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result as Item[]);
        request.onerror = () => reject(request.error);
    });
}


export async function addItem(item: Item): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("items", "readwrite");
        tx.objectStore("items").put(item);   // put: 既存IDなら上書き
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}


export async function clearDB(): Promise<void> {
    const db = await openDB();

    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction("items", "readwrite");
        const store = tx.objectStore("items");
        const req = store.clear();  // 全削除

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

