import React from 'react'
import { Terminal, Settings, Search, X } from 'lucide-react'

const ProcessView = ({
  matrixText,
  currentTime,
  systemStats,
  isMobile,
  searchTerm,
  onSearchChange,
  sortBy,
  sortOrder,
  onSort,
  filteredProcesses,
  selectedProcess,
  onSelectProcess,
  onKillProcess,
  onOpenSettings,
  onNavigatePerformance,
  helpers
}) => {
  const {
    formatMemory,
    formatNumber,
    formatUptime,
    getCpuBarColor,
    handleCopy
  } = helpers

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
              <h1 className="text-base md:text-lg font-bold text-green-400">[PROCESS_MONITOR.EXE]</h1>
              <div className="text-xs text-green-300">STATUS: ACTIVE | TIME: {currentTime.toLocaleTimeString()}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-3 text-xs">
            <button className="px-2 md:px-3 py-1 bg-green-500/20 text-green-300 border border-green-400 rounded" disabled>
              PROC
            </button>
            <button
              onClick={onNavigatePerformance}
              className="px-2 md:px-3 py-1 border border-green-500 text-green-400 hover:bg-green-500/20 rounded"
            >
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

      <div className="p-3 md:p-4 bg-gray-900/50 border-b border-green-500/30">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 md:gap-4 text-xs">
          <div className="text-center">
            <div className="text-green-300">PROCESSES</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{systemStats.processes}</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">CPU_USAGE</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{systemStats.totalCpu.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">GPU_USAGE</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{systemStats.gpuUsage.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">MEMORY</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{formatMemory(systemStats.usedMemory)}</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">POWER</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{systemStats.totalPower.toFixed(1)}W</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">BATTERY</div>
            <div className={`font-bold text-sm md:text-lg ${systemStats.batteryLevel > 20 ? 'text-green-400' : 'text-red-400'}`}>
              {systemStats.batteryLevel.toFixed(0)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-green-300">THREADS</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{formatNumber(systemStats.threads)}</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">UPTIME</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{systemStats.uptime}</div>
          </div>
        </div>
      </div>

      <div className="p-3 md:p-4 border-b border-green-500/30 bg-gray-900/30">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-400" />
          <input
            type="text"
            placeholder="> SEARCH_PROCESS_OR_PID..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-green-500/50 rounded text-green-400 placeholder-green-600 focus:ring-2 focus:ring-green-400 focus:border-green-400 text-sm"
          />
        </div>
      </div>

      <div className="bg-gray-900/50 px-3 md:px-4 py-3 border-b border-green-500/30">
        <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-bold text-green-300">
          <button onClick={() => onSort('name')} className="col-span-3 text-left hover:text-green-400 transition-colors">
            [PROCESS_NAME] {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => onSort('pid')} className="col-span-1 text-center hover:text-green-400 transition-colors">
            [PID] {sortBy === 'pid' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <div className="col-span-1 text-center">[STATUS]</div>
          <div className="col-span-1 text-center">[USER]</div>
          <button onClick={() => onSort('cpu')} className="col-span-1 text-right hover:text-green-400 transition-colors">
            [CPU%] {sortBy === 'cpu' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => onSort('memory')} className="col-span-2 text-right hover:text-green-400 transition-colors">
            [MEMORY] {sortBy === 'memory' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => onSort('threads')} className="col-span-1 text-right hover:text-green-400 transition-colors">
            [THREADS] {sortBy === 'threads' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <div className="col-span-1 text-center">[ACTION]</div>
        </div>

        <div className="md:hidden flex justify-between text-xs font-bold text-green-300">
          <button onClick={() => onSort('name')} className="text-left hover:text-green-400">
            [PROCESS] {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => onSort('cpu')} className="text-right hover:text-green-400">
            [CPU%] {sortBy === 'cpu' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => onSort('memory')} className="text-right hover:text-green-400">
            [MEM] {sortBy === 'memory' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <div>[ACTION]</div>
        </div>
      </div>

      <div className="overflow-y-auto max-h-96 bg-black">
        {filteredProcesses.map((process, index) => (
          <div
            key={process.id}
            className={`px-3 md:px-4 py-2 text-xs border-b border-green-500/20 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-gray-900/20' : 'bg-black'} ${selectedProcess?.pid === process.pid ? 'bg-green-500/10 ring-1 ring-green-500/60' : 'hover:bg-green-500/10'}`}
            onClick={() => onSelectProcess(process.pid)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectProcess(process.pid)
              }
            }}
          >
            <div className="hidden md:grid grid-cols-12 gap-4">
              <div className="col-span-3 font-medium truncate text-green-400">{process.name}</div>
              <div className="col-span-1 text-center font-mono text-green-300">{process.pid}</div>
              <div className="col-span-1 text-center">
                <span className={`px-2 py-1 rounded text-xs border ${process.status === 'Running' ? 'bg-green-500/20 text-green-400 border-green-500' : 'bg-red-500/20 text-red-400 border-red-500'} animate-pulse`}>
                  {process.status.toUpperCase()}
                </span>
              </div>
              <div className="col-span-1 text-center text-green-300">{process.user}</div>
              <div className="col-span-1 text-right">
                <span className={`font-mono font-bold ${process.cpu > 20 ? 'text-red-400' : process.cpu > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {process.cpu.toFixed(1)}
                </span>
              </div>
              <div className="col-span-2 text-right font-mono text-green-400">{formatMemory(process.memory)}</div>
              <div className="col-span-1 text-right font-mono text-green-300">{process.threads}</div>
              <div className="col-span-1 text-center">
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onKillProcess(process.pid)
                  }}
                  className="w-6 h-6 rounded border border-red-500 hover:bg-red-500/20 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
                  title="TERMINATE"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="md:hidden">
              <div className="flex justify-between items-start mb-1">
                <div className="font-medium text-green-400 text-sm truncate flex-1 mr-2">{process.name}</div>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onKillProcess(process.pid)
                  }}
                  className="w-5 h-5 rounded border border-red-500 hover:bg-red-500/20 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors ml-2"
                  title="TERMINATE"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex space-x-4">
                  <span className="text-green-300">PID: {process.pid}</span>
                  <span className={`${process.cpu > 20 ? 'text-red-400' : process.cpu > 10 ? 'text-yellow-400' : 'text-green-400'} font-bold`}>
                    CPU: {process.cpu.toFixed(1)}%
                  </span>
                  <span className="text-green-300">MEM: {formatMemory(process.memory)}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs border ${process.status === 'Running' ? 'bg-green-500/20 text-green-400 border-green-500' : 'bg-red-500/20 text-red-400 border-red-500'}`}>
                  {process.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedProcess && (
        <div className="p-3 md:p-4 bg-black/60 border-t border-green-500/30">
          <div className="bg-black/80 border border-green-500/40 rounded-lg p-4 md:p-5 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <div className="text-green-400 text-xs font-bold tracking-widest">[PROCESS_DETAIL]</div>
                <h3 className="text-lg md:text-xl font-bold text-green-200">{selectedProcess.name}</h3>
                <div className="text-green-300 text-xs font-mono">PID: {selectedProcess.pid}</div>
              </div>
              <button
                onClick={() => onSelectProcess(null)}
                className="self-start md:self-center px-2 py-1 border border-green-500/60 text-green-300 rounded hover:bg-green-500/20 transition-colors text-xs"
              >
                CLOSE
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button
                onClick={() => onKillProcess(selectedProcess.pid)}
                className="px-3 py-1 rounded border border-red-500 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                TERMINATE
              </button>
              <button
                onClick={() => onKillProcess(selectedProcess.pid, 'SIGKILL')}
                className="px-3 py-1 rounded border border-red-500 text-red-300 hover:bg-red-500/30 transition-colors"
              >
                FORCE KILL
              </button>
              <button
                onClick={() => handleCopy('PID', String(selectedProcess.pid))}
                className="px-3 py-1 rounded border border-green-500 text-green-300 hover:bg-green-500/20 transition-colors"
              >
                COPY PID
              </button>
              <button
                onClick={() => handleCopy('COMMAND', selectedProcess.command || selectedProcess.name)}
                className="px-3 py-1 rounded border border-green-500 text-green-300 hover:bg-green-500/20 transition-colors"
              >
                COPY CMD
              </button>
              {selectedProcess.path && (
                <button
                  onClick={() => handleCopy('PATH', selectedProcess.path)}
                  className="px-3 py-1 rounded border border-green-500 text-green-300 hover:bg-green-500/20 transition-colors"
                >
                  COPY PATH
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-green-200">
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">STATUS</div>
                <div className="font-bold">{selectedProcess.status}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">USER</div>
                <div className="font-bold">{selectedProcess.user}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">CPU%</div>
                <div className="font-mono font-bold">{selectedProcess.cpu.toFixed(2)}%</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">MEM USAGE</div>
                <div className="font-mono font-bold">
                  {formatMemory(selectedProcess.memory)} (
                  {Number.isFinite(selectedProcess.memoryRaw) ? selectedProcess.memoryRaw.toFixed(2) : '0.00'}%
                  )
                </div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">THREADS</div>
                <div className="font-mono font-bold">{selectedProcess.threads}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">HANDLES</div>
                <div className="font-mono font-bold">{selectedProcess.handles}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">PARENT PID</div>
                <div className="font-mono font-bold">{selectedProcess.parentPid ?? 'N/A'}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">PRIORITY</div>
                <div className="font-mono font-bold">{selectedProcess.priority ?? 'N/A'}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">STARTED</div>
                <div className="font-mono font-bold break-all">{selectedProcess.started || 'Unknown'}</div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-green-200">
              {selectedProcess.command && (
                <div>
                  <div className="text-green-500/80 text-[10px] tracking-widest">COMMAND</div>
                  <div className="bg-gray-900/60 border border-green-500/20 rounded p-2 font-mono break-all text-[11px]">
                    {selectedProcess.command}
                  </div>
                </div>
              )}
              {selectedProcess.params && (
                <div>
                  <div className="text-green-500/80 text-[10px] tracking-widest">ARGS</div>
                  <div className="bg-gray-900/60 border border-green-500/20 rounded p-2 font-mono break-all text-[11px]">
                    {selectedProcess.params}
                  </div>
                </div>
              )}
              {selectedProcess.path && (
                <div>
                  <div className="text-green-500/80 text-[10px] tracking-widest">PATH</div>
                  <div className="bg-gray-900/60 border border-green-500/20 rounded p-2 font-mono break-all text-[11px]">
                    {selectedProcess.path}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProcessView
