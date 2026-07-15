import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { EditHistory } from '../../core/commands/EditHistory'

interface HistoryPanelProps {
  editHistoryRef: { current: EditHistory }
  undoLabel: string | null
  redoLabel: string | null
  onHistoryChange: () => void
  historyVersion: number
  onUndo: () => void
  onRedo: () => void
}

export default function HistoryPanel({
  editHistoryRef, undoLabel, redoLabel, onHistoryChange,
  historyVersion, onUndo, onRedo,
}: HistoryPanelProps) {
  const { t } = useTranslation()
  const entries = useMemo(() => {
    // historyVersion is used to trigger re-computation
    void historyVersion
    return editHistoryRef.current.getHistoryEntries()
  }, [editHistoryRef, historyVersion])

  const doneCount = entries.filter(e => e.status === 'done').length
  const undoneCount = entries.filter(e => e.status === 'undone').length

  const handleEntryClick = (entry: typeof entries[0]) => {
    const h = editHistoryRef.current
    if (entry.status === 'done') {
      // Undo back to this state: undo until this entry is no longer in the undo stack
      while (h.undoStackSize > entry.index + 1) {
        h.undo()
      }
    } else {
      // Redo to this state: redo until this entry is in the undo stack
      const targetUndoneIdx = entry.index - doneCount
      while (h.redoStackSize > targetUndoneIdx + 1) {
        h.redo()
      }
    }
    onHistoryChange()
  }

  return (
    <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px' }}>

      {/* Undo/Redo buttons */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexShrink: 0 }}>
        <button
          className="studio-btn"
          onClick={onUndo}
          disabled={!editHistoryRef.current.canUndo}
          title={undoLabel ?? undefined}
        >
          {undoLabel ? t('historyPanel.undoPrefix', { label: undoLabel }) : t('historyPanel.undo')}
        </button>
        <button
          className="studio-btn"
          onClick={onRedo}
          disabled={!editHistoryRef.current.canRedo}
          title={redoLabel ?? undefined}
        >
          {redoLabel ? t('historyPanel.redoPrefix', { label: redoLabel }) : t('historyPanel.redo')}
        </button>
      </div>

      {/* History Entry List */}
      <div className="history-list" style={{ flex: 1, overflowY: 'auto' }}>
        {entries.length === 0 && (
          <div className="history-empty">{t('historyPanel.noHistory')}</div>
        )}

        {entries.map((entry, i) => {
          const isLastDone = entry.status === 'done' && i === doneCount - 1
          return (
            <div key={`${entry.index}-${entry.status}`}>
              {isLastDone && doneCount > 0 && undoneCount > 0 && (
                <div className="history-separator">
                  <span>{t('historyPanel.currentState')}</span>
                </div>
              )}
              <div
                className={`history-entry ${entry.status}`}
                onClick={() => handleEntryClick(entry)}
                title={t('historyPanel.jumpTooltip')}
              >
                <span className={`history-dot ${entry.status}`} />
                <span className="history-label">{entry.label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer Stats */}
      {(doneCount > 0 || undoneCount > 0) && (
        <div className="history-footer" style={{ flexShrink: 0 }}>
          <span>{t('historyPanel.footerActions', { count: entries.length })}</span>
          <span className="history-footer-spacer">|</span>
          <span>{t('historyPanel.footerUndone', { count: undoneCount })}</span>
        </div>
      )}
    </div>
  )
}
