/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useRef, useCallback } from "react";
import { useFocusEffect } from "expo-router";

/**
 * useAutoLoad — fires `loader` when screen focuses, but skips reload
 * if data is already loaded (hasData=true) and loadAlways=false.
 * Pass loadAlways=true to reload on every focus (e.g. for dashboards that need fresh counts).
 */
export function useAutoLoad(
  loader: () => void,
  deps: React.DependencyList,
  options?: { hasData?: boolean; loadAlways?: boolean }
) {
  const { hasData = false, loadAlways = false } = options ?? {};
  useFocusEffect(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback(() => {
      if (!loadAlways && hasData) return;
      loader();
    }, deps)
  );
}
