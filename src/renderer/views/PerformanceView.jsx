import React from 'react'
import { Terminal, Settings } from 'lucide-react'
import PerformancePanel from '../components/PerformancePanel'

const PerformanceView = ({
  matrixText,
  currentTime,
  onNavigateProcesses,
  onOpenSettings,
  panelProps
}) => {
  return (
    <div className="w-full max-w-7xl mx-auto bg-black text-green-400 rounded-lg shadow-2xl border border-green-500/30 font-mono">
      <div className="bg-gray-900 p-3 md:p-4 border-b border-green-500/30 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="text-green-300 text-xs leading-3 whitespace-pre-wrap">
            {matrixText}
          </div>
        </div>
        <div className="relative flex flex-col md:flex-row justify-between md:items-center space-y-2 md:space-y-0">
          <div className="flex items-center space-x-2 md:space-x-3">
            <Terminal className="w-5 h-5 md:w-6 md:h-6 text-green-400 animate-pulse" />
            <div>
              <h1 className="text-base md:text-lg font-bold text-green-400">[SYSTEM_MONITOR.EXE]</h1>
              <div className="text-xs text-green-300">STATUS: ACTIVE | TIME: {currentTime.toLocaleTimeString()}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-3 text-xs">
            <button
              onClick={onNavigateProcesses}
              className="px-2 md:px-3 py-1 border border-green-500 text-green-400 hover:bg-green-500/20 rounded"
            >
              PROC
            </button>
            <button className="px-2 md:px-3 py-1 bg-green-500/20 text-green-300 border border-green-400 rounded" disabled>
              PERF
            </button>
            <button
              onClick={onOpenSettings}
              className="px-2 md:px-3 py-1 border border-green-500/40 text-green-300 hover:bg-green-500/10 rounded flex items-center space-x-1"
            >
              <Settings className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">SET</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        <PerformancePanel {...panelProps} />
      </div>
    </div>
  )
}

export default PerformanceView
