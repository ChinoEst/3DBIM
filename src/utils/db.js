const DB_NAME = '3dbmi-db'
const DB_VERSION = 1
const STORE_NAME = 'autosave'
const AUTOSAVE_KEY = 'current-project'

/*
Promise: async functions to save, load, and clear autosave data in IndexedDB. The data is stored under a specific key in an object store.
three types of Promise: pending, fulfilled, rejected. 

IndexedDB: like localstorege, save js obj in browser, but more powerful. 
*/


function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      //first time open the db, create object store if not exist.
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    //declare: if sucess
    req.onsuccess = () => resolve(req.result)
    //declare: if error
    req.onerror = () => reject(req.error)
  })
}


// Save the autosave data to IndexedDB.
export async function saveAutosave(data) {
  const db = await openDB()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(data, AUTOSAVE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally { db.close() }
}

// Load the autosave data from IndexedDB. Returns null if no autosave exists.
export async function loadAutosave() {
  const db = await openDB()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(AUTOSAVE_KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } finally { db.close() }
}

// Clear the autosave data from IndexedDB.
export async function clearAutosave() {
  const db = await openDB()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(AUTOSAVE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally { db.close() }
}