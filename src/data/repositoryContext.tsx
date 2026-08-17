import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { InventoryRepository } from "./contracts";

export const RepositoryContext = createContext<InventoryRepository | null>(null);

export function RepositoryProvider({
  repository,
  children,
}: {
  repository: InventoryRepository;
  children: ReactNode;
}) {
  return (
    <RepositoryContext.Provider value={repository}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository() {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error("RepositoryProvider is missing.");
  return repository;
}

export function useRepositorySnapshot() {
  const repository = useRepository();
  return useSyncExternalStore(
    repository.subscribe,
    repository.snapshot,
    repository.snapshot,
  );
}

/** Compatibility alias while pages migrate without UI rewrites. */
export const useMockSnapshot = useRepositorySnapshot;
