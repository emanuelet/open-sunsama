import { describe, expect, it } from "vitest";
import { layoutOverlappingItems, type LayoutItem } from "./event-layout";

function referenceLayout(items: LayoutItem[]) {
  const sorted = [...items].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime()
  );
  const result = new Map<string, { lane: number; columnCount: number }>();
  let cluster: LayoutItem[] = [];
  let end = -Infinity;
  const flush = () => {
    const lanes: number[] = [];
    const positions = cluster.map((item) => {
      let lane = lanes.findIndex((laneEnd) => laneEnd <= item.start.getTime());
      if (lane < 0) lane = lanes.length;
      lanes[lane] = item.end.getTime();
      return { id: item.id, lane };
    });
    for (const position of positions) result.set(position.id, { lane: position.lane, columnCount: lanes.length });
    cluster = [];
    end = -Infinity;
  };
  for (const item of sorted) {
    if (item.start.getTime() >= end) flush();
    cluster.push(item);
    end = Math.max(end, item.end.getTime());
  }
  flush();
  return result;
}

describe("calendar overlap layout", () => {
  it("matches the original lowest-lane packing across dense and disjoint schedules", () => {
    let seed = 42;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (let run = 0; run < 100; run++) {
      const items = Array.from({ length: 200 }, (_, index) => {
        const start = Math.floor(random() * 300);
        return { id: String(index), start: new Date(start * 60000), end: new Date((start + 1 + Math.floor(random() * 90)) * 60000) };
      });
      expect(layoutOverlappingItems(items)).toEqual(referenceLayout(items));
    }
  });

  it("handles large overlap clusters without argument limits", () => {
    const items = Array.from({ length: 150_000 }, (_, index) => ({
      id: String(index), start: new Date(0), end: new Date(60_000),
    }));
    const result = layoutOverlappingItems(items);
    expect(result.get("149999")).toEqual({ lane: 149999, columnCount: 150000 });
  });
});
