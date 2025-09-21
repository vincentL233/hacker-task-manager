import React from 'react'

const StatusBar = ({
  isMobile,
  systemStats,
  updateInterval,
  currentTime,
  filteredCount,
  totalCount
}) => {
  return (
    <div className="bg-gray-900 px-3 md:px-4 py-2 border-t border-green-500/30 text-xs text-green-300">
      <div className="flex flex-col md:flex-row justify-between space-y-1 md:space-y-0">
        <span>DISPLAY: {filteredCount}/{totalCount} PROC</span>
        <span className="animate-pulse">
          {isMobile
            ? `CPU:${systemStats.totalCpu.toFixed(0)}% GPU:${systemStats.gpuUsage.toFixed(0)}% PWR:${systemStats.totalPower.toFixed(0)}W BAT:${systemStats.batteryLevel.toFixed(0)}%`
            : `UPDATE: ${(updateInterval / 1000).toFixed(1)}s | CPU: ${systemStats.totalCpu.toFixed(1)}% | GPU: ${systemStats.gpuUsage.toFixed(1)}% | PWR: ${systemStats.totalPower.toFixed(1)}W | BAT: ${systemStats.batteryLevel.toFixed(0)}% | TIME: ${currentTime.toLocaleTimeString()}`}
        </span>
      </div>
    </div>
  )
}

export default StatusBar
