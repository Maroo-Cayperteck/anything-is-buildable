import { useQuery } from "@tanstack/react-query";
import { portalSnapshotQuery } from "./portal-data";

/** Profile & live portal snapshot guaranteed loaded by the /portal layout before children render. */
export function useProfile() {
  return useQuery(portalSnapshotQuery()).data!.profile;
}

export function usePortalSnapshot(semesterId?: string) {
  return useQuery(portalSnapshotQuery(semesterId));
}
