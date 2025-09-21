import React from 'react'
import { X } from 'lucide-react'

const SettingsModal = ({
  isOpen,
  pendingSettings,
  onClose,
  onSubmit,
  onUpdateField,
  onCardToggle,
  tabs,
  minUpdateInterval,
  minHistory,
  maxHistory
}) => {
  if (!isOpen) return null

  const enabledCards = pendingSettings.enabledCards || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-xl bg-gray-950 border border-green-500/40 rounded-lg shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-green-200">[SETTINGS_PANEL]</h2>
          <button onClick={onClose} className="text-green-300 hover:text-green-100" aria-label="Close settings">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 text-xs md:text-sm text-green-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="block uppercase tracking-wide text-green-300">更新頻率 (毫秒)</span>
              <input
                type="number"
                min={minUpdateInterval}
                step={100}
                value={pendingSettings.updateInterval}
                onChange={(e) => onUpdateField('updateInterval', Number(e.target.value))}
                className="w-full bg-black border border-green-500/40 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
              />
              <span className="text-[10px] text-green-400/80">最小 {minUpdateInterval} ms</span>
            </label>

            <label className="space-y-2">
              <span className="block uppercase tracking-wide text-green-300">歷史長度 (取樣數)</span>
              <input
                type="number"
                min={minHistory}
                max={maxHistory}
                step={10}
                value={pendingSettings.historyLength}
                onChange={(e) => onUpdateField('historyLength', Number(e.target.value))}
                className="w-full bg-black border border-green-500/40 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
              />
              <span className="text-[10px] text-green-400/80">{minHistory}-{maxHistory} 取樣點</span>
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="block uppercase tracking-wide text-green-300">預設 Performance 卡片</span>
            <select
              value={pendingSettings.defaultPerformanceTab}
              onChange={(e) => onUpdateField('defaultPerformanceTab', e.target.value)}
              className="w-full bg-black border border-green-500/40 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
            >
              {tabs.map(tab => (
                <option key={tab.id} value={tab.id} disabled={enabledCards[tab.id] === false}>
                  {tab.label}{enabledCards[tab.id] === false ? ' (關閉)' : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <span className="block uppercase tracking-wide text-green-300">顯示的卡片</span>
            <div className="grid grid-cols-2 gap-2">
              {tabs.map(tab => (
                <label
                  key={tab.id}
                  className={`flex items-center space-x-2 bg-black/40 border border-green-500/30 rounded px-2 py-1 ${tab.id === 'cpu' ? 'opacity-80' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={enabledCards[tab.id] !== false}
                    disabled={tab.id === 'cpu'}
                    onChange={(e) => onCardToggle(tab.id, e.target.checked)}
                    className="accent-green-400"
                  />
                  <span>{tab.label}</span>
                </label>
              ))}
            </div>
            <span className="text-[10px] text-green-400/80">CPU 卡片為必須顯示。</span>
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 border border-green-500/40 text-green-300 rounded hover:bg-green-500/10"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-3 py-1 border border-green-500 text-green-100 bg-green-500/30 rounded hover:bg-green-500/40"
            >
              SAVE
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SettingsModal
