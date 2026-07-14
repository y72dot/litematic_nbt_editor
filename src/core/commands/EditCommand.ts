/**
 * Interface for edit commands that support undo/redo.
 */
export interface EditCommand {
  /** Execute the edit operation. */
  execute(): void;

  /** Reverse the edit operation. */
  undo(): void;

  /** Human-readable description of this command (e.g., "Set block at (1,2,3)"). */
  getLabel(): string;
}
