"use client";

import { openDB } from "idb";

const DB_NAME = "observatorio-digital";
const DB_VERSION = 2;

export const SESSION_STORE = "sessions";
export const CONFIG_STORE = "configuration";

export const observatoryDb = () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        database.createObjectStore(SESSION_STORE);
      }
      if (!database.objectStoreNames.contains(CONFIG_STORE)) {
        database.createObjectStore(CONFIG_STORE);
      }
    },
  });
