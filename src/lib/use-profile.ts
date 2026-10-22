import { useQuery } from "@tanstack/react-query";
import { profileQuery } from "./portal-data";

/** Profile is guaranteed loaded by the /portal layout before children render. */
export function useProfile() {
  return useQuery(profileQuery).data!;
}
