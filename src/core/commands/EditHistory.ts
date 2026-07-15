import type { EditCommand } from './EditCommand';

const MAX_HISTORY = 100;

/**
 * Manages a dual-stack undo/redo history for edit commands.
 */
export class EditHistory {
  private undoStack: EditCommand[] = [];
  private redoStack: EditCommand[] = [];
  private maxSize: number;

  constructor(maxSize: number = MAX_HISTORY) {
    this.maxSize = maxSize;
  }

  /** Execute a command and push it onto the undo stack. */
  execute(command: EditCommand): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo on new action

    // Trim oldest if over limit
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  /** Undo the most recent command. Returns the command label, or null if nothing to undo. */
  undo(): string | null {
    const command = this.undoStack.pop();
    if (!command) return null;

    command.undo();
    this.redoStack.push(command);
    return command.getLabel();
  }

  /** Redo the most recently undone command. Returns the command label, or null if nothing to redo. */
  redo(): string | null {
    const command = this.redoStack.pop();
    if (!command) return null;

    command.execute();
    this.undoStack.push(command);
    return command.getLabel();
  }

  /** Whether there are commands to undo. */
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Whether there are commands to redo. */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Label of the most recent undo-able command, or null. */
  get undoLabel(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].getLabel();
  }

  /** Label of the most recent redo-able command, or null. */
  get redoLabel(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].getLabel();
  }

  /** Number of commands in the undo stack. */
  get undoStackSize(): number {
    return this.undoStack.length;
  }

  /** Number of commands in the redo stack. */
  get redoStackSize(): number {
    return this.redoStack.length;
  }

  /**
   * Returns all history entries for display, ordered oldest to newest.
   * Entries in the undo stack are 'done', and entries in the redo stack are 'undone'.
   */
  getHistoryEntries(): import('../../types').HistoryEntry[] {
    const entries: import('../../types').HistoryEntry[] = [];
    let idx = 0;

    for (const cmd of this.undoStack) {
      entries.push({ index: idx++, label: cmd.getLabel(), status: 'done' });
    }
    for (const cmd of [...this.redoStack].reverse()) {
      entries.push({ index: idx++, label: cmd.getLabel(), status: 'undone' });
    }

    return entries;
  }

  /** Clear all history. */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
