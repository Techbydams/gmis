/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useEffect, useRef } from "react";
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

type Event = "INSERT" | "UPDATE" | "DELETE" | "*";

interface RealtimeOptions {
  /** Postgres filter string, e.g. "course_id=eq.abc123" */
  filter?: string;
  onInsert?: (row: any) => void;
  onUpdate?: (row: any) => void;
  onDelete?: (row: any) => void;
}

/**
 * useRealtimeTable
 *
 * Subscribes to Postgres changes on a single table and calls the
 * appropriate callback when a row is inserted, updated, or deleted.
 *
 * The subscription is automatically cleaned up when the component
 * unmounts or when any dependency changes (db, table, filter).
 *
 * Usage:
 *   useRealtimeTable(db, "chat_messages", {
 *     filter: `course_id=eq.${courseId}`,
 *     onInsert: (row) => setMessages(prev => [...prev, row]),
 *   });
 */
export function useRealtimeTable(
  db: SupabaseClient | null,
  table: string,
  options: RealtimeOptions,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Keep option callbacks in a ref so the effect doesn't re-run when they change
  const cbRef = useRef(options);
  cbRef.current = options;

  useEffect(() => {
    if (!db) return;

    const channelName = options.filter
      ? `${table}:${options.filter}`
      : `${table}:all`;

    const events: { event: Event }[] = [];
    if (options.onInsert) events.push({ event: "INSERT" });
    if (options.onUpdate) events.push({ event: "UPDATE" });
    if (options.onDelete) events.push({ event: "DELETE" });
    if (events.length === 0) events.push({ event: "*" });

    let channel = db.channel(channelName);

    for (const { event } of events) {
      channel = channel.on(
        "postgres_changes" as any,
        {
          event,
          schema: "public",
          table,
          ...(options.filter ? { filter: options.filter } : {}),
        },
        (payload: any) => {
          if (payload.eventType === "INSERT" && cbRef.current.onInsert)
            cbRef.current.onInsert(payload.new);
          if (payload.eventType === "UPDATE" && cbRef.current.onUpdate)
            cbRef.current.onUpdate(payload.new);
          if (payload.eventType === "DELETE" && cbRef.current.onDelete)
            cbRef.current.onDelete(payload.old);
        },
      );
    }

    channelRef.current = channel.subscribe();

    return () => {
      if (channelRef.current) {
        db.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, table, options.filter]);
}
