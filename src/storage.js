const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open("icon-studio", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("workspace");
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
export async function readSaved() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("workspace")
      .objectStore("workspace")
      .get("current");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveWorkspace(value) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(value, "current");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
