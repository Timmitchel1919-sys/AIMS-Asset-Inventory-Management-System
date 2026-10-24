import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { firestore } from "../lib/firebase";

export interface NetworkDirectoryDevice {
  id: string;
  hostname: string | null;
  ipAddress: string;
  macAddress: string | null;
  vendor: string | null;
  deviceType: string | null;
  assetId: string | null;
  assetCode: string | null;
  location: string | null;
  status: string;
  firstSeen: Date | null;
  lastSeen: Date | null;
}
const toDate = (value: unknown) =>
  value && typeof value === "object" && "toDate" in value
    ? (value as { toDate: () => Date }).toDate()
    : null;
const mapDevice = (id: string, data: DocumentData): NetworkDirectoryDevice => ({
  id,
  hostname: data.hostname ?? null,
  ipAddress: String(data.ipAddress || ""),
  macAddress: data.macAddress ?? null,
  vendor: data.vendor ?? null,
  deviceType: data.deviceType ?? null,
  assetId: data.assetId ?? null,
  assetCode: data.assetCode ?? null,
  location: data.location ?? null,
  status: String(data.status || "DISCOVERED"),
  firstSeen: toDate(data.firstSeen),
  lastSeen: toDate(data.lastSeen),
});

export function useNetworkDirectory() {
  const [devices, setDevices] = useState<NetworkDirectoryDevice[]>([]),
    [loading, setLoading] = useState(Boolean(firestore)),
    [error, setError] = useState(
      firestore ? "" : "Firebase is not configured.",
    );
  useEffect(() => {
    if (!firestore) return;
    return onSnapshot(
      query(
        collection(firestore, "deviceNetwork"),
        orderBy("lastSeen", "desc"),
        limit(500),
      ),
      (snapshot) => {
        setDevices(
          snapshot.docs.map((item) => mapDevice(item.id, item.data())),
        );
        setLoading(false);
        setError("");
      },
      (cause) => {
        setError(cause.message);
        setLoading(false);
      },
    );
  }, []);
  return { devices, loading, error };
}
