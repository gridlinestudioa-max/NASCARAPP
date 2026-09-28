// Shared react-dnd item type + payload shape for the Tiered Lineup drag-and-drop
// board (TieredLineupForm). One item type site-wide is enough for now — add more
// here if another drag-and-drop surface gets built later.
export const ItemTypes = { DRIVER: "driver" } as const;

export type DriverDragItem = {
  driverId: string;
  // null when dragged out of the driver pool; a pickNumber when dragged out of
  // an already-filled slot (so dropping it elsewhere can swap the two slots).
  sourcePickNumber: number | null;
};
